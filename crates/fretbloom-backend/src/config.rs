use crate::BackendError;
use std::{net::SocketAddr, path::PathBuf, time::Duration};

#[derive(Debug, Clone)]
pub struct Config {
    pub listen: SocketAddr,
    pub temp_root: PathBuf,
    pub ffmpeg: PathBuf,
    pub ffprobe: PathBuf,
    pub yt_dlp: PathBuf,
    pub node: PathBuf,
    pub max_source_bytes: u64,
    pub max_duration_seconds: u32,
    pub probe_timeout: Duration,
    pub decode_timeout: Duration,
    pub youtube_timeout: Duration,
    pub analysis_timeout: Duration,
    pub active_timeout: Duration,
    pub upload_timeout: Duration,
    pub upload_idle_timeout: Duration,
    pub queue_timeout: Duration,
    pub lease_timeout: Duration,
    pub retention: Duration,
    pub max_process_output: usize,
    pub max_job_disk: u64,
    pub max_total_disk: u64,
}
impl Default for Config {
    fn default() -> Self {
        Self {
            listen: "127.0.0.1:5210".parse().unwrap(),
            temp_root: std::env::temp_dir().join("fretbloom-analysis"),
            ffmpeg: "ffmpeg".into(),
            ffprobe: "ffprobe".into(),
            yt_dlp: ".tools/youtube/bin/yt-dlp".into(),
            node: "node".into(),
            max_source_bytes: 50 * 1024 * 1024,
            max_duration_seconds: 600,
            probe_timeout: Duration::from_secs(10),
            decode_timeout: Duration::from_secs(45),
            youtube_timeout: Duration::from_secs(150),
            analysis_timeout: Duration::from_secs(120),
            active_timeout: Duration::from_secs(300),
            upload_timeout: Duration::from_secs(120),
            upload_idle_timeout: Duration::from_secs(15),
            queue_timeout: Duration::from_secs(60),
            lease_timeout: Duration::from_secs(60),
            retention: Duration::from_secs(1800),
            max_process_output: 2 * 1024 * 1024,
            max_job_disk: 256 * 1024 * 1024,
            max_total_disk: 512 * 1024 * 1024,
        }
    }
}
impl Config {
    pub fn from_env() -> Result<Self, BackendError> {
        let mut c = Self::default();
        if let Ok(v) = std::env::var("FRETBLOOM_ANALYSIS_LISTEN") {
            c.listen = v
                .parse()
                .map_err(|_| BackendError::new("INVALID_REQUEST"))?;
        }
        if let Ok(host) = std::env::var("FRETBLOOM_ANALYSIS_HOST") {
            c.listen.set_ip(
                host.parse()
                    .map_err(|_| BackendError::new("INVALID_REQUEST"))?,
            );
        }
        if let Ok(port) = std::env::var("FRETBLOOM_ANALYSIS_PORT") {
            c.listen.set_port(
                port.parse()
                    .map_err(|_| BackendError::new("INVALID_REQUEST"))?,
            );
        }
        if let Some(node) = std::env::var_os("NODE_PATH_FOR_YTDLP") {
            c.node = node.into();
        }
        for (key, target) in [
            ("FRETBLOOM_ANALYSIS_TEMP_ROOT", &mut c.temp_root),
            ("FFMPEG_PATH", &mut c.ffmpeg),
            ("FFPROBE_PATH", &mut c.ffprobe),
            ("YTDLP_PATH", &mut c.yt_dlp),
            ("NODE_PATH", &mut c.node),
        ] {
            if let Some(v) = std::env::var_os(key) {
                *target = v.into();
            }
        }
        if let Ok(v) = std::env::var("FRETBLOOM_ANALYSIS_MAX_SOURCE_BYTES") {
            c.max_source_bytes = v
                .parse()
                .map_err(|_| BackendError::new("INVALID_REQUEST"))?;
        }
        if let Ok(v) = std::env::var("FRETBLOOM_ANALYSIS_MAX_DURATION_SECONDS") {
            c.max_duration_seconds = v
                .parse()
                .map_err(|_| BackendError::new("INVALID_REQUEST"))?;
        }
        // Resolve relative executable paths before subprocess cwd changes to a private job directory.
        for executable in [&mut c.ffmpeg, &mut c.ffprobe, &mut c.yt_dlp, &mut c.node] {
            if executable.components().count() > 1 && executable.is_relative() {
                *executable = std::env::current_dir()?.join(&*executable);
            }
        }
        if c.temp_root.is_relative() {
            c.temp_root = std::env::current_dir()?.join(&c.temp_root);
        }
        c.validate()?;
        Ok(c)
    }
    pub fn validate(&self) -> Result<(), BackendError> {
        let d = Self::default();
        if !self.listen.ip().is_loopback()
            || self.max_source_bytes == 0
            || self.max_source_bytes > d.max_source_bytes
            || self.max_duration_seconds == 0
            || self.max_duration_seconds > 600
            || self.max_process_output == 0
            || self.max_process_output > d.max_process_output
            || self.max_job_disk == 0
            || self.max_job_disk > d.max_job_disk
            || self.max_total_disk < self.max_job_disk
            || self.max_total_disk > d.max_total_disk
        {
            return Err(BackendError::new("INVALID_REQUEST"));
        }
        for (value, max) in [
            (self.probe_timeout, d.probe_timeout),
            (self.decode_timeout, d.decode_timeout),
            (self.youtube_timeout, d.youtube_timeout),
            (self.analysis_timeout, d.analysis_timeout),
            (self.active_timeout, d.active_timeout),
            (self.upload_timeout, d.upload_timeout),
            (self.upload_idle_timeout, d.upload_idle_timeout),
            (self.queue_timeout, d.queue_timeout),
            (self.lease_timeout, d.lease_timeout),
            (self.retention, d.retention),
        ] {
            if value.is_zero() || value > max {
                return Err(BackendError::new("INVALID_REQUEST"));
            }
        }
        Ok(())
    }
}
