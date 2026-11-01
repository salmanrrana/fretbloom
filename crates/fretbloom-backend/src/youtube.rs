use crate::{
    process::{directory_bytes, run_process},
    BackendError, Config,
};
use std::{
    ffi::OsString,
    path::{Path, PathBuf},
    time::Duration,
};
use tokio_util::sync::CancellationToken;

pub struct AcquiredMedia {
    pub source_path: PathBuf,
    pub title: Option<String>,
    pub duration_hint: Option<f64>,
}
pub fn valid_video_id(id: &str) -> bool {
    id.len() == 11
        && id
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-')
}

pub async fn acquire_youtube(
    video_id: &str,
    work_dir: &Path,
    config: &Config,
    cancel: &CancellationToken,
) -> Result<AcquiredMedia, BackendError> {
    if !valid_video_id(video_id) {
        return Err(BackendError::new("INVALID_REQUEST"));
    }
    let token = cancel.child_token();
    let operation = acquire(video_id, work_dir, config, &token);
    tokio::pin!(operation);
    tokio::select! {
        result = &mut operation => result,
        _ = tokio::time::sleep(config.youtube_timeout) => {
            token.cancel();
            let _ = operation.await;
            Err(BackendError::new("PROCESSING_TIMEOUT"))
        }
    }
}
async fn acquire(
    video_id: &str,
    dir: &Path,
    config: &Config,
    cancel: &CancellationToken,
) -> Result<AcquiredMedia, BackendError> {
    let url = format!("https://www.youtube.com/watch?v={video_id}");
    let common: Vec<OsString> = [
        "--ignore-config",
        "--no-cache-dir",
        "--no-cookies",
        "--no-cookies-from-browser",
        "--no-playlist",
        "--no-progress",
        "--no-warnings",
        "--socket-timeout",
        "15",
        "--retries",
        "1",
        "--concurrent-fragments",
        "1",
        "--fragment-retries",
        "1",
        "--js-runtimes",
    ]
    .into_iter()
    .map(OsString::from)
    .chain(std::iter::once(OsString::from(format!(
        "node:{}",
        config.node.display()
    ))))
    .collect();
    let mut metadata = common.clone();
    metadata.extend(
        [
            "--format",
            "bestaudio/best",
            "--dump-single-json",
            "--skip-download",
            "--",
            &url,
        ]
        .into_iter()
        .map(OsString::from),
    );
    let output = run_process(
        &config.yt_dlp,
        &metadata,
        dir,
        config,
        cancel,
        config.youtube_timeout,
        config.max_process_output,
    )
    .await?;
    if !output.success {
        return Err(BackendError::new("YOUTUBE_UNAVAILABLE"));
    }
    let info: serde_json::Value = serde_json::from_slice(&output.stdout)
        .map_err(|_| BackendError::new("YOUTUBE_UNAVAILABLE"))?;
    let duration = info["duration"]
        .as_f64()
        .filter(|v| v.is_finite() && *v > 0.0)
        .ok_or_else(|| BackendError::new("YOUTUBE_UNAVAILABLE"))?;
    if info["is_live"] == true || info["live_status"] == "is_live" {
        return Err(BackendError::new("YOUTUBE_UNAVAILABLE"));
    }
    if duration > config.max_duration_seconds as f64 {
        return Err(BackendError::new("DURATION_LIMIT"));
    }
    for entry in std::iter::once(&info).chain(
        ["requested_downloads", "requested_formats"]
            .into_iter()
            .flat_map(|key| info[key].as_array().into_iter().flatten()),
    ) {
        if entry["filesize"]
            .as_u64()
            .or_else(|| entry["filesize_approx"].as_u64())
            .is_some_and(|v| v > config.max_source_bytes)
        {
            return Err(BackendError::new("SOURCE_TOO_LARGE"));
        }
    }
    let mut hls: Vec<_> = info["formats"]
        .as_array()
        .into_iter()
        .flatten()
        .filter(|f| {
            f["vcodec"] == "none"
                && f["protocol"]
                    .as_str()
                    .is_some_and(|p| p.starts_with("m3u8"))
                && f["format_id"].as_str().is_some_and(|s| {
                    !s.is_empty()
                        && s.len() <= 64
                        && s.bytes()
                            .all(|b| b.is_ascii_alphanumeric() || b"._-".contains(&b))
                })
                && f["filesize"]
                    .as_u64()
                    .or_else(|| f["filesize_approx"].as_u64())
                    .is_none_or(|v| v <= config.max_source_bytes)
        })
        .collect();
    hls.sort_by(|a, b| {
        b["abr"]
            .as_f64()
            .or_else(|| b["tbr"].as_f64())
            .unwrap_or(0.0)
            .total_cmp(
                &a["abr"]
                    .as_f64()
                    .or_else(|| a["tbr"].as_f64())
                    .unwrap_or(0.0),
            )
    });
    let formats =
        std::iter::once("bestaudio/best").chain(hls.first().and_then(|f| f["format_id"].as_str()));
    for format in formats {
        let mut command = common.clone();
        command.extend(
            [
                "--format",
                format,
                "--abort-on-unavailable-fragments",
                "--max-filesize",
                &config.max_source_bytes.to_string(),
                "--output",
                "source.%(ext)s",
                "--",
                &url,
            ]
            .into_iter()
            .map(OsString::from),
        );
        // The monitor is independent of yt-dlp's advertised size and includes fragments and .part files.
        let local = cancel.child_token();
        let watchdog = local.clone();
        let download = run_process(
            &config.yt_dlp,
            &command,
            dir,
            config,
            &local,
            config.youtube_timeout,
            config.max_process_output,
        );
        tokio::pin!(download);
        let mut monitor = tokio::time::interval(Duration::from_millis(20));
        let result = loop {
            tokio::select! {
                result = &mut download => break result,
                _ = monitor.tick() => if directory_bytes(dir).await? > config.max_source_bytes {
                    watchdog.cancel(); let _ = (&mut download).await; return Err(BackendError::new("SOURCE_TOO_LARGE"));
                }
            }
        }?;
        if !result.success && directory_bytes(dir).await? >= config.max_source_bytes {
            return Err(BackendError::new("SOURCE_TOO_LARGE"));
        }
        if result.success {
            let mut entries = tokio::fs::read_dir(dir).await?;
            let mut found = Vec::new();
            while let Some(entry) = entries.next_entry().await? {
                let name = entry.file_name();
                let name = name.to_string_lossy();
                if name.starts_with("source.")
                    && !name.ends_with(".part")
                    && !name.ends_with(".ytdl")
                    && entry.file_type().await?.is_file()
                {
                    found.push(entry.path());
                }
            }
            if directory_bytes(dir).await? > config.max_source_bytes {
                return Err(BackendError::new("SOURCE_TOO_LARGE"));
            }
            if found.len() != 1 {
                return Err(BackendError::new("YOUTUBE_UNAVAILABLE"));
            }
            return Ok(AcquiredMedia {
                source_path: found.remove(0),
                title: info["title"]
                    .as_str()
                    .map(|s| s.chars().filter(|c| !c.is_control()).take(300).collect()),
                duration_hint: Some(duration),
            });
        }
        let mut entries = tokio::fs::read_dir(dir).await?;
        while let Some(entry) = entries.next_entry().await? {
            if entry.file_type().await?.is_file()
                && entry.file_name().to_string_lossy().starts_with("source.")
            {
                tokio::fs::remove_file(entry.path()).await?;
            }
        }
    }
    Err(BackendError::new("YOUTUBE_UNAVAILABLE"))
}
