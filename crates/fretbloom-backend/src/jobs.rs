use crate::{
    error::ApiError,
    media::decode_media,
    youtube::{acquire_youtube, valid_video_id},
    BackendError, Config,
};
use fretbloom_analysis::{AnalysisError, AnalysisOptions};
use serde::{Deserialize, Serialize};
use std::{
    collections::{HashMap, VecDeque},
    sync::Arc,
    time::{Duration, Instant},
};
use tokio::sync::{Mutex, Notify, Semaphore};
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

#[derive(Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum Source {
    Youtube {
        #[serde(rename = "videoId")]
        video_id: String,
    },
    Upload {
        name: String,
        #[serde(rename = "byteLength")]
        byte_length: u64,
        #[serde(rename = "contentType")]
        content_type: String,
    },
}
#[derive(Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Status {
    AwaitingUpload,
    Queued,
    Fetching,
    Decoding,
    Analyzing,
    Succeeded,
    Failed,
    Canceled,
}
impl Status {
    pub fn terminal(self) -> bool {
        matches!(self, Self::Succeeded | Self::Failed | Self::Canceled)
    }
}
#[derive(Clone, Serialize, Deserialize)]
pub struct Progress {
    pub stage: String,
    pub fraction: Option<f64>,
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Job {
    pub schema_version: u8,
    pub id: Uuid,
    pub source: Source,
    pub options: AnalysisOptions,
    pub created_at: String,
    pub expires_at: String,
    pub status: Status,
    pub progress: Progress,
    pub error: Option<ApiError>,
}
pub struct Record {
    pub job: Job,
    pub dir: tempfile::TempDir,
    pub cancel: CancellationToken,
    pub lease: Instant,
    pub queued_at: Instant,
    pub finished_at: Option<Instant>,
    pub busy: bool,
    pub result: Option<Arc<Vec<u8>>>,
    pub features: Option<Arc<Vec<u8>>>,
}
pub struct Inner {
    pub jobs: HashMap<Uuid, Record>,
    pub queue: VecDeque<Uuid>,
    pub stopping: bool,
}
pub struct AppState {
    pub config: Config,
    pub inner: Mutex<Inner>,
    pub notify: Notify,
    pub shutdown_token: CancellationToken,
    workers: Arc<Semaphore>,
    _root: tempfile::TempDir,
}
fn iso(offset: Duration) -> String {
    (time::OffsetDateTime::now_utc() + offset)
        .format(&time::format_description::well_known::Rfc3339)
        .unwrap()
}
impl AppState {
    pub async fn new(config: Config) -> Result<Arc<Self>, BackendError> {
        config.validate()?;
        tokio::fs::create_dir_all(&config.temp_root).await?;
        // Only remove our own abandoned run directories, after verifying their recorded PID is gone.
        let mut entries = tokio::fs::read_dir(&config.temp_root).await?;
        while let Some(entry) = entries.next_entry().await? {
            if !entry
                .file_name()
                .to_string_lossy()
                .starts_with("fretbloom-run-v1-")
                || !entry.file_type().await?.is_dir()
            {
                continue;
            }
            if let Ok(text) = tokio::fs::read_to_string(entry.path().join("owner.pid")).await {
                if let Ok(pid) = text.trim().parse::<i32>() {
                    #[cfg(unix)]
                    if matches!(
                        nix::sys::signal::kill(nix::unistd::Pid::from_raw(pid), None),
                        Err(nix::errno::Errno::ESRCH)
                    ) && pid > 0
                    {
                        tokio::fs::remove_dir_all(entry.path()).await?;
                    }
                }
            }
        }
        let root = tempfile::Builder::new()
            .prefix("fretbloom-run-v1-")
            .tempdir_in(&config.temp_root)?;
        tokio::fs::write(
            root.path().join("owner.pid"),
            std::process::id().to_string(),
        )
        .await?;
        let state = Arc::new(Self {
            config,
            inner: Mutex::new(Inner {
                jobs: HashMap::new(),
                queue: VecDeque::new(),
                stopping: false,
            }),
            notify: Notify::new(),
            shutdown_token: CancellationToken::new(),
            workers: Arc::new(Semaphore::new(1)),
            _root: root,
        });
        let scheduler = state.clone();
        tokio::spawn(async move {
            scheduler.scheduler().await;
        });
        Ok(state)
    }
    pub async fn create(
        self: &Arc<Self>,
        mut source: Source,
        options: AnalysisOptions,
    ) -> Result<Job, BackendError> {
        if !options.concert_a_hz.is_finite() || !(432.0..=446.0).contains(&options.concert_a_hz) {
            return Err(BackendError::new("INVALID_REQUEST"));
        }
        match &mut source {
            Source::Youtube { video_id } if !valid_video_id(video_id) => {
                return Err(BackendError::new("INVALID_REQUEST"))
            }
            Source::Upload {
                name,
                byte_length,
                content_type,
            } => {
                if *byte_length > self.config.max_source_bytes {
                    return Err(BackendError::new("SOURCE_TOO_LARGE"));
                }
                if *byte_length == 0
                    || content_type.len() > 200
                    || content_type.chars().any(char::is_control)
                {
                    return Err(BackendError::new("INVALID_REQUEST"));
                }
                *name = name.chars().filter(|c| !c.is_control()).take(200).collect();
                if name.is_empty() {
                    *name = "Audio upload".into();
                }
            }
            _ => {}
        }
        let mut inner = self.inner.lock().await;
        if inner.stopping
            || inner
                .jobs
                .values()
                .filter(|r| !r.job.status.terminal() || r.busy)
                .count()
                >= 3
        {
            return Err(BackendError::new("QUEUE_FULL"));
        }
        // Reserve worst-case source + canonical PCM/playback, even for upload reservations.
        let reserve = self.config.max_source_bytes
            + self.config.max_duration_seconds as u64 * 24_000 * 6
            + 4096;
        let mut disk = reserve;
        for r in inner.jobs.values() {
            disk += if !r.job.status.terminal() || r.busy {
                reserve
            } else {
                crate::process::directory_bytes(r.dir.path()).await?
            };
        }
        while disk > self.config.max_total_disk
            || inner
                .jobs
                .values()
                .filter(|r| r.job.status.terminal() && !r.busy)
                .count()
                >= 10
        {
            let oldest = inner
                .jobs
                .iter()
                .filter(|(_, r)| r.job.status.terminal() && !r.busy)
                .min_by_key(|(_, r)| r.finished_at)
                .map(|(id, _)| *id);
            let Some(id) = oldest else {
                return Err(BackendError::new("QUEUE_FULL"));
            };
            if let Some(r) = inner.jobs.remove(&id) {
                disk = disk.saturating_sub(crate::process::directory_bytes(r.dir.path()).await?);
            }
        }
        let id = Uuid::new_v4();
        let status = if matches!(source, Source::Upload { .. }) {
            Status::AwaitingUpload
        } else {
            Status::Queued
        };
        let job = Job {
            schema_version: 1,
            id,
            source,
            options,
            created_at: iso(Duration::ZERO),
            expires_at: iso(self.config.retention),
            status,
            progress: Progress {
                stage: if status == Status::Queued {
                    "queued"
                } else {
                    "awaiting_upload"
                }
                .into(),
                fraction: None,
            },
            error: None,
        };
        let record = Record {
            job: job.clone(),
            dir: tempfile::Builder::new()
                .prefix("job-")
                .tempdir_in(self._root.path())?,
            cancel: self.shutdown_token.child_token(),
            lease: Instant::now(),
            queued_at: Instant::now(),
            finished_at: None,
            busy: false,
            result: None,
            features: None,
        };
        inner.jobs.insert(id, record);
        if status == Status::Queued {
            inner.queue.push_back(id);
        }
        drop(inner);
        self.notify.notify_one();
        Ok(job)
    }
    pub async fn get(&self, id: Uuid, renew: bool) -> Result<Job, BackendError> {
        let mut inner = self.inner.lock().await;
        let r = inner
            .jobs
            .get_mut(&id)
            .ok_or_else(|| BackendError::new("JOB_NOT_FOUND"))?;
        if renew && !r.job.status.terminal() {
            r.lease = Instant::now();
        }
        Ok(r.job.clone())
    }
    pub async fn cancel(&self, id: Uuid) -> Result<Job, BackendError> {
        let mut inner = self.inner.lock().await;
        let r = inner
            .jobs
            .get_mut(&id)
            .ok_or_else(|| BackendError::new("JOB_NOT_FOUND"))?;
        r.cancel.cancel();
        r.job.status = Status::Canceled;
        r.job.progress = Progress {
            stage: "canceled".into(),
            fraction: None,
        };
        r.job.error = Some(BackendError::new("JOB_CANCELED").0);
        r.finished_at = Some(Instant::now());
        r.result = None;
        r.features = None;
        let view = r.job.clone();
        inner.queue.retain(|job| *job != id);
        drop(inner);
        self.notify.notify_one();
        Ok(view)
    }
    pub async fn fail(&self, id: Uuid, error: BackendError) {
        let mut inner = self.inner.lock().await;
        if let Some(r) = inner.jobs.get_mut(&id) {
            if !r.job.status.terminal() {
                r.job.status = if error.0.code == "JOB_CANCELED" {
                    Status::Canceled
                } else {
                    Status::Failed
                };
                r.job.error = Some(error.0);
                r.job.progress = Progress {
                    stage: "failed".into(),
                    fraction: None,
                };
                r.finished_at = Some(Instant::now());
            }
        }
    }
    pub async fn stage(&self, id: Uuid, status: Status, stage: &str) {
        if let Some(r) = self.inner.lock().await.jobs.get_mut(&id) {
            if !r.job.status.terminal() {
                r.job.status = status;
                r.job.progress = Progress {
                    stage: stage.into(),
                    fraction: None,
                };
            }
        }
    }
    async fn scheduler(self: Arc<Self>) {
        let mut interval = tokio::time::interval(Duration::from_millis(100));
        loop {
            tokio::select! {_=self.shutdown_token.cancelled()=>break,_=self.notify.notified()=>{},_=interval.tick()=>{}}
            let mut inner = self.inner.lock().await;
            let mut remove = Vec::new();
            for (id, r) in inner.jobs.iter_mut() {
                if !r.job.status.terminal()
                    && ((r.job.status == Status::Queued
                        && r.queued_at.elapsed() > self.config.queue_timeout)
                        || (!r.busy && r.lease.elapsed() > self.config.lease_timeout)
                        || (r.busy
                            && r.job.status != Status::AwaitingUpload
                            && r.lease.elapsed() > self.config.lease_timeout))
                {
                    r.cancel.cancel();
                    r.job.status = Status::Failed;
                    r.job.error = Some(BackendError::new("PROCESSING_TIMEOUT").0);
                    r.finished_at = Some(Instant::now());
                    r.job.progress = Progress {
                        stage: "failed".into(),
                        fraction: None,
                    };
                }
                if r.job.status.terminal() && !r.busy {
                    if r.job.status != Status::Succeeded {
                        let _ = clear_directory(r.dir.path()).await;
                    }
                    if r.finished_at
                        .is_some_and(|t| t.elapsed() >= self.config.retention)
                    {
                        remove.push(*id);
                    }
                }
            }
            for id in remove {
                inner.jobs.remove(&id);
            }
            while inner
                .jobs
                .values()
                .filter(|r| r.job.status.terminal() && !r.busy)
                .count()
                > 10
            {
                let oldest = inner
                    .jobs
                    .iter()
                    .filter(|(_, r)| r.job.status.terminal() && !r.busy)
                    .min_by_key(|(_, r)| r.finished_at)
                    .map(|(id, _)| *id);
                if let Some(id) = oldest {
                    inner.jobs.remove(&id);
                } else {
                    break;
                }
            }
            let terminal: Vec<_> = inner
                .jobs
                .iter()
                .filter(|(_, r)| r.job.status.terminal() && !r.busy)
                .map(|(id, _)| *id)
                .collect();
            inner.queue.retain(|id| !terminal.contains(id));
            if let Ok(permit) = self.workers.clone().try_acquire_owned() {
                if let Some(id) = inner.queue.pop_front() {
                    if let Some(r) = inner.jobs.get_mut(&id) {
                        if !r.job.status.terminal() {
                            r.busy = true;
                            let state = self.clone();
                            tokio::spawn(async move {
                                state.run_job(id).await;
                                drop(permit);
                                state.notify.notify_one();
                            });
                        }
                    }
                }
            }
        }
    }
    async fn run_job(self: &Arc<Self>, id: Uuid) {
        let (cancel, dir) = {
            let inner = self.inner.lock().await;
            let r = &inner.jobs[&id];
            (r.cancel.clone(), r.dir.path().to_owned())
        };
        let deadline_cancel = cancel.clone();
        let timer = tokio::spawn({
            let limit = self.config.active_timeout;
            async move {
                tokio::time::sleep(limit).await;
                deadline_cancel.cancel();
            }
        });
        let outcome = self.pipeline(id, &dir, &cancel).await;
        timer.abort();
        if let Err(mut error) = outcome {
            if cancel.is_cancelled() && error.0.code == "JOB_CANCELED" {
                error = BackendError::new("PROCESSING_TIMEOUT");
            }
            self.fail(id, error).await;
        }
        let mut inner = self.inner.lock().await;
        if let Some(r) = inner.jobs.get_mut(&id) {
            r.busy = false;
            if r.job.status != Status::Succeeded {
                let _ = clear_directory(r.dir.path()).await;
            }
        }
    }
    async fn pipeline(
        &self,
        id: Uuid,
        dir: &std::path::Path,
        cancel: &CancellationToken,
    ) -> Result<(), BackendError> {
        let job = self.get(id, false).await?;
        let (source, title) = match &job.source {
            Source::Youtube { video_id } => {
                self.stage(id, Status::Fetching, "fetching").await;
                let acquired = acquire_youtube(video_id, dir, &self.config, cancel).await?;
                (acquired.source_path, acquired.title)
            }
            Source::Upload { .. } => (dir.join("source.bin"), None),
        };
        self.stage(id, Status::Decoding, "decoding").await;
        let decoded = decode_media(&source, dir, &self.config, cancel).await?;
        tokio::fs::remove_file(source).await?;
        self.stage(id, Status::Analyzing, "analyzing").await;
        let options = job.options.clone();
        let token = cancel.clone();
        let progress = Arc::new(std::sync::atomic::AtomicU64::new(0));
        let worker_progress = progress.clone();
        let total = decoded.mono.len() as u64;
        let mut analysis = tokio::task::spawn_blocking(move || {
            analyze_song(
                &decoded.mono,
                decoded.sample_rate_hz,
                &options,
                &|| token.is_cancelled(),
                &mut |processed| {
                    worker_progress.store(processed, std::sync::atomic::Ordering::Relaxed);
                },
            )
        });
        let deadline = tokio::time::sleep(self.config.analysis_timeout);
        tokio::pin!(deadline);
        let mut poll = tokio::time::interval(Duration::from_millis(200));
        let mut output = loop {
            tokio::select! {
                result=&mut analysis=>break result.map_err(|_|BackendError::new("BACKEND_UNAVAILABLE"))?.map_err(|e|match e {AnalysisError::Cancelled=>BackendError::new("JOB_CANCELED"),AnalysisError::InvalidInput(_)=>BackendError::new("DECODE_FAILED"),AnalysisError::LimitExceeded(_)=>BackendError::new("RESULT_TOO_COMPLEX")})?,
                _=cancel.cancelled()=>{stop_analysis(&mut analysis).await;return Err(BackendError::new("JOB_CANCELED"));},
                _=&mut deadline=>{cancel.cancel();stop_analysis(&mut analysis).await;return Err(BackendError::new("PROCESSING_TIMEOUT"));},
                _=poll.tick()=>{if let Some(r)=self.inner.lock().await.jobs.get_mut(&id) {if !r.job.status.terminal(){r.job.progress.fraction=Some((progress.load(std::sync::atomic::Ordering::Relaxed) as f64/total as f64).clamp(0.0,1.0));}}}
            }
        };
        output.result.warnings.extend(decoded.warnings);
        let excess_alternatives = output.result.harmony.iter().any(|event| match &event.kind {
            fretbloom_analysis::HarmonyKind::Chord { alternatives, .. }
            | fretbloom_analysis::HarmonyKind::Unknown { alternatives, .. } => {
                alternatives.len() > 3
            }
            fretbloom_analysis::HarmonyKind::NoChord { .. } => false,
        });
        if excess_alternatives
            || output.result.harmony.len() > 18000
            || output.result.monophonic_notes.len() > 24000
            || output.result.polyphonic_notes.len() > 24000
            || output.features.frames.len() > 7500
        {
            return Err(BackendError::new("RESULT_TOO_COMPLEX"));
        }
        let result=serde_json::to_vec(&serde_json::json!({"schemaVersion":1,"jobId":id,"source":job.source,"title":title,"pcmSha256":decoded.pcm_sha256,"analysis":output.result})).map_err(|_|BackendError::new("RESULT_TOO_COMPLEX"))?;
        let features = serde_json::to_vec(&output.features)
            .map_err(|_| BackendError::new("RESULT_TOO_COMPLEX"))?;
        if result.len() > 8 * 1024 * 1024 || features.len() > 8 * 1024 * 1024 {
            return Err(BackendError::new("RESULT_TOO_COMPLEX"));
        }
        let mut inner = self.inner.lock().await;
        let r = inner
            .jobs
            .get_mut(&id)
            .ok_or_else(|| BackendError::new("JOB_NOT_FOUND"))?;
        if cancel.is_cancelled() || r.job.status.terminal() {
            return Err(BackendError::new("JOB_CANCELED"));
        }
        r.result = Some(Arc::new(result));
        r.features = Some(Arc::new(features));
        r.job.status = Status::Succeeded;
        r.job.progress = Progress {
            stage: "succeeded".into(),
            fraction: Some(1.0),
        };
        r.finished_at = Some(Instant::now());
        r.job.expires_at = iso(self.config.retention);
        Ok(())
    }
    pub async fn shutdown(&self) {
        {
            let mut inner = self.inner.lock().await;
            inner.stopping = true;
            for r in inner.jobs.values() {
                r.cancel.cancel();
            }
        }
        self.shutdown_token.cancel();
        // The sole pipeline releases its permit only after codec groups and cooperative DSP are reaped.
        let _permit = self.workers.acquire().await;
        let mut inner = self.inner.lock().await;
        inner.queue.clear();
        inner.jobs.clear();
    }
}
pub async fn clear_directory(dir: &std::path::Path) -> Result<(), BackendError> {
    let mut entries = tokio::fs::read_dir(dir).await?;
    while let Some(e) = entries.next_entry().await? {
        if e.file_type().await?.is_dir() {
            tokio::fs::remove_dir_all(e.path()).await?;
        } else {
            tokio::fs::remove_file(e.path()).await?;
        }
    }
    Ok(())
}

// Rust cannot forcibly unwind a stuck blocking thread. Cooperative cancellation normally
// joins within a hop; if that contract fails, fail the private process instead of releasing
// capacity to a second CPU worker or allowing shutdown to hang. Startup removes its own
// abandoned directories. The supervisor treats this as service failure.
async fn stop_analysis(
    worker: &mut tokio::task::JoinHandle<Result<fretbloom_analysis::AnalysisOutput, AnalysisError>>,
) {
    if tokio::time::timeout(Duration::from_secs(2), worker)
        .await
        .is_err()
    {
        tracing::error!("analysis worker ignored cancellation; terminating private service");
        std::process::exit(1);
    }
}

/// Analyze bounded song sections so a long recording cannot exhaust the per-call
/// live-engine event budget. Preserve absolute playback times in the joined result.
fn analyze_song(
    mono: &[f32],
    rate: u32,
    options: &AnalysisOptions,
    cancelled: &(dyn Fn() -> bool + Sync),
    progress: &mut dyn FnMut(u64),
) -> Result<fretbloom_analysis::AnalysisOutput, AnalysisError> {
    let mut joined: Option<fretbloom_analysis::AnalysisOutput> = None;
    let chunk_samples = rate as usize * 30;
    for (index, chunk) in mono.chunks(chunk_samples).enumerate() {
        let offset_samples = index * chunk_samples;
        let offset = offset_samples as f64 / rate as f64;
        let mut next = fretbloom_analysis::analyze(chunk, rate, options, cancelled, &mut |p| {
            progress(offset_samples as u64 + p.processed_samples)
        })?;
        for event in &mut next.result.harmony {
            event.start += offset;
            event.end += offset;
        }
        for event in next
            .result
            .monophonic_notes
            .iter_mut()
            .chain(next.result.polyphonic_notes.iter_mut())
        {
            event.start += offset;
            event.end += offset;
        }
        for frame in &mut next.features.frames {
            frame.time += offset;
        }
        if let Some(output) = &mut joined {
            output.result.harmony.extend(next.result.harmony);
            output
                .result
                .monophonic_notes
                .extend(next.result.monophonic_notes);
            output
                .result
                .polyphonic_notes
                .extend(next.result.polyphonic_notes);
            let last = output.features.frames.last().map_or(-1.0, |f| f.time);
            output
                .features
                .frames
                .extend(next.features.frames.into_iter().filter(|f| f.time > last));
            for warning in next.result.warnings {
                if !output
                    .result
                    .warnings
                    .iter()
                    .any(|existing| existing.code == warning.code)
                {
                    output.result.warnings.push(warning);
                }
            }
        } else {
            joined = Some(next);
        }
    }
    let mut output = joined.ok_or_else(|| AnalysisError::InvalidInput("PCM is empty".into()))?;
    output.result.duration = mono.len() as f64 / rate as f64;
    output.features.duration = output.result.duration;
    Ok(output)
}

#[cfg(test)]
mod song_length_tests {
    use super::*;
    #[test]
    fn six_minute_song_keeps_absolute_times_and_complete_features() {
        let rate = 24_000;
        let pcm: Vec<f32> = (0..360 * rate)
            .map(|i| {
                let t = i as f64 / rate as f64;
                let envelope = (-8.0 * (t % 0.5)).exp();
                [164.8138, 207.6523, 246.9417]
                    .iter()
                    .map(|f| (std::f64::consts::TAU * f * t).sin() * 0.07 * envelope)
                    .sum::<f64>() as f32
            })
            .collect();
        let mut processed = 0;
        let output = analyze_song(
            &pcm,
            rate,
            &AnalysisOptions::default(),
            &|| false,
            &mut |p| processed = p,
        )
        .unwrap();
        assert_eq!(output.result.duration, 360.0);
        assert_eq!(output.features.duration, 360.0);
        assert_eq!(processed, pcm.len() as u64);
        assert_eq!(output.result.harmony.first().unwrap().start, 0.0);
        assert_eq!(output.result.harmony.last().unwrap().end, 360.0);
        assert!(output
            .result
            .harmony
            .windows(2)
            .all(|p| (p[0].end - p[1].start).abs() < 1e-6));
        assert!(output
            .features
            .frames
            .windows(2)
            .all(|p| p[0].time < p[1].time));
        assert!(output.features.frames.len() <= 7500);
        assert!(serde_json::to_vec(&output.result).unwrap().len() < 8 * 1024 * 1024);
    }
}
