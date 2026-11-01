//! Direct child execution with an empty, allowlisted environment and process-group cleanup.
use crate::{BackendError, Config};
use std::{ffi::OsString, path::Path, process::Stdio, time::Duration};
use tokio::{io::AsyncReadExt, process::Command};
use tokio_util::sync::CancellationToken;

struct GroupGuard(Option<u32>);
impl Drop for GroupGuard {
    fn drop(&mut self) {
        #[cfg(unix)]
        if let Some(pid) = self.0 {
            let _ = nix::sys::signal::killpg(
                nix::unistd::Pid::from_raw(pid as i32),
                nix::sys::signal::Signal::SIGKILL,
            );
        }
    }
}

// Linux services may run as PID 1 without an init reaper. Adopt only orphaned descendants,
// and reap by process group so concurrent, unrelated commands keep their own wait handles.
#[cfg(target_os = "linux")]
fn enable_subreaper() -> Result<(), BackendError> {
    static ENABLED: std::sync::OnceLock<bool> = std::sync::OnceLock::new();
    let enabled = ENABLED.get_or_init(|| {
        // SAFETY: prctl with this scalar operation accepts no pointers and changes only our child-reaping policy.
        unsafe { nix::libc::prctl(nix::libc::PR_SET_CHILD_SUBREAPER, 1, 0, 0, 0) == 0 }
    });
    if !enabled {
        return Err(BackendError::new("BACKEND_UNAVAILABLE"));
    }
    Ok(())
}

#[cfg(target_os = "linux")]
async fn reap_group(pid: u32) {
    use nix::{
        sys::wait::{waitpid, WaitPidFlag, WaitStatus},
        unistd::Pid,
    };
    let deadline = tokio::time::Instant::now() + Duration::from_secs(2);
    loop {
        match waitpid(Pid::from_raw(-(pid as i32)), Some(WaitPidFlag::WNOHANG)) {
            Ok(WaitStatus::StillAlive) if tokio::time::Instant::now() < deadline => {
                tokio::time::sleep(Duration::from_millis(5)).await
            }
            Ok(WaitStatus::Exited(..) | WaitStatus::Signaled(..)) => {}
            _ => break,
        }
    }
}

pub struct ProcessOutput {
    pub stdout: Vec<u8>,
    pub success: bool,
}

async fn capture(
    mut stream: impl tokio::io::AsyncRead + Unpin,
    max: usize,
) -> Result<Vec<u8>, BackendError> {
    let mut output = Vec::new();
    let mut bytes = [0_u8; 8192];
    loop {
        let n = stream.read(&mut bytes).await?;
        if n == 0 {
            return Ok(output);
        }
        if output.len() + n > max {
            return Err(BackendError::new("RESULT_TOO_COMPLEX"));
        }
        output.extend_from_slice(&bytes[..n]);
    }
}

pub async fn directory_bytes(dir: &Path) -> Result<u64, BackendError> {
    let mut entries = tokio::fs::read_dir(dir).await?;
    let mut size = 0_u64;
    while let Some(entry) = entries.next_entry().await? {
        let meta = entry.metadata().await?;
        // Tools must not create nested directories, symlinks or special files.
        if !meta.is_file() || entry.file_type().await?.is_symlink() {
            return Err(BackendError::new("UNSUPPORTED_MEDIA"));
        }
        size = size.saturating_add(meta.len());
    }
    Ok(size)
}

pub async fn run_process(
    executable: &Path,
    args: &[OsString],
    dir: &Path,
    config: &Config,
    cancel: &CancellationToken,
    timeout: Duration,
    stdout_cap: usize,
) -> Result<ProcessOutput, BackendError> {
    if cancel.is_cancelled() {
        return Err(BackendError::new("JOB_CANCELED"));
    }
    #[cfg(target_os = "linux")]
    enable_subreaper()?;
    let mut cmd = Command::new(executable);
    cmd.args(args)
        .current_dir(dir)
        .env_clear()
        .env("PATH", std::env::var_os("PATH").unwrap_or_default())
        .env("LANG", "C.UTF-8")
        .env("LC_ALL", "C.UTF-8")
        .env("HOME", dir)
        .env("TMPDIR", dir)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);
    #[cfg(unix)]
    {
        cmd.process_group(0);
        let file_limit = if executable == config.yt_dlp {
            config.max_source_bytes
        } else {
            config.max_job_disk
        };
        // SAFETY: this pre-exec hook only calls async-signal-safe setrlimit with stack values.
        unsafe {
            cmd.pre_exec(move || {
                let limit = nix::libc::rlimit {
                    rlim_cur: file_limit as nix::libc::rlim_t,
                    rlim_max: file_limit as nix::libc::rlim_t,
                };
                if nix::libc::setrlimit(nix::libc::RLIMIT_FSIZE, &limit) != 0 {
                    return Err(std::io::Error::last_os_error());
                }
                let no_core = nix::libc::rlimit {
                    rlim_cur: 0,
                    rlim_max: 0,
                };
                if nix::libc::setrlimit(nix::libc::RLIMIT_CORE, &no_core) != 0 {
                    return Err(std::io::Error::last_os_error());
                }
                Ok(())
            });
        }
    }
    let mut child = cmd.spawn().map_err(|e| {
        tracing::warn!(error=%e, "media executable failed to start");
        BackendError::new("TOOL_UNAVAILABLE")
    })?;
    let pid = child.id();
    let mut group_guard = GroupGuard(pid);
    let stdout = child.stdout.take().unwrap();
    let stderr = child.stderr.take().unwrap();
    let collect = async {
        let (status, out, err) = tokio::try_join!(
            async { child.wait().await.map_err(BackendError::from) },
            capture(stdout, stdout_cap),
            capture(stderr, config.max_process_output)
        )?;
        if !status.success() {
            tracing::warn!(status = %status, diagnostic = %String::from_utf8_lossy(&err), "media process failed");
        }
        Ok(ProcessOutput {
            stdout: out,
            success: status.success(),
        })
    };
    let result = {
        tokio::pin!(collect);
        let deadline = tokio::time::sleep(timeout);
        tokio::pin!(deadline);
        let mut monitor = tokio::time::interval(Duration::from_millis(20));
        loop {
            tokio::select! {
                biased;
                _ = cancel.cancelled() => break Err(BackendError::new("JOB_CANCELED")),
                _ = &mut deadline => break Err(BackendError::new("PROCESSING_TIMEOUT")),
                result = &mut collect => break result,
                _ = monitor.tick() => {
                    match directory_bytes(dir).await {
                        Ok(bytes) if bytes <= config.max_job_disk => {},
                        Ok(_) => break Err(BackendError::new("SOURCE_TOO_LARGE")),
                        Err(e) => break Err(e),
                    }
                }
            }
        }
    };
    // Also sweep descendants after an apparently successful parent exit. No background children survive.
    #[cfg(unix)]
    if let Some(pid) = pid {
        use nix::{
            sys::signal::{killpg, Signal},
            unistd::Pid,
        };
        let group = Pid::from_raw(pid as i32);
        let _ = killpg(group, Signal::SIGTERM);
        if result.is_err() {
            let _ = tokio::time::timeout(Duration::from_secs(2), child.wait()).await;
        }
        let _ = killpg(group, Signal::SIGKILL);
    }
    if result.is_err() {
        let _ = child.kill().await;
    }
    let _ = child.wait().await;
    #[cfg(target_os = "linux")]
    if let Some(pid) = pid {
        reap_group(pid).await;
    }
    group_guard.0 = None;
    result
}
