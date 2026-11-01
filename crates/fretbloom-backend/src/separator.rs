//! Verified offline separator identity and bounded, aligned extraction.
use crate::{
    jobs::{AppState, Focus, Status},
    media::{input_args, write_playback},
    process::run_process,
    BackendError, Config,
};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{ffi::OsString, path::Path, time::Duration};
use tokio_util::sync::CancellationToken;
use uuid::Uuid;
pub const WEIGHTS_SHA256: &str = "34c22ccb381c6f9fdbf324f04e1e2fe21aaaf293f5ded163a162697ff9a02ddd";
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Identity {
    pub model: String,
    pub weights_sha256: String,
    pub package: String,
    pub runtime: String,
    pub shifts: u8,
    pub overlap: f64,
}
#[derive(Clone, Serialize)]
pub struct Availability {
    pub available: bool,
    pub reason: Option<String>,
    pub separator: Option<Identity>,
}
#[derive(Serialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum AnalyzedAudio {
    FullMix {
        #[serde(rename = "pcmSha256")]
        pcm_sha256: String,
    },
    GuitarStem {
        #[serde(rename = "pcmSha256")]
        pcm_sha256: String,
        separator: Identity,
        #[serde(rename = "guitarLevelDb")]
        guitar_level_db: f64,
    },
}
fn arguments(config: &Config) -> Vec<OsString> {
    vec![
        "-I".into(),
        "-B".into(),
        config.separator_helper.clone().into_os_string(),
        "--weights".into(),
        config.separator_weights.clone().into_os_string(),
        "--threads".into(),
        config.separator_threads.to_string().into(),
    ]
}
pub async fn check(config: &Config, dir: &Path) -> Availability {
    let verify = async {
        let bytes = tokio::fs::read(&config.separator_weights).await?;
        if format!("{:x}", Sha256::digest(bytes)) != WEIGHTS_SHA256 {
            return Err(BackendError::new("SEPARATOR_UNAVAILABLE"));
        }
        let mut args = arguments(config);
        args.push("--check".into());
        let out = run_process(
            &config.separator_python,
            &args,
            dir,
            config,
            &CancellationToken::new(),
            Duration::from_secs(45),
            4096,
        )
        .await?;
        let identity: Identity = serde_json::from_slice(&out.stdout)
            .map_err(|_| BackendError::new("SEPARATOR_UNAVAILABLE"))?;
        if !out.success
            || identity.model != "htdemucs_6s"
            || identity.weights_sha256 != WEIGHTS_SHA256
            || identity.package != "demucs 4.1.0"
            || identity.shifts != 0
            || identity.overlap != 0.25
            || !identity.runtime.ends_with("+cpu cpu")
        {
            return Err(BackendError::new("SEPARATOR_UNAVAILABLE"));
        }
        Ok(identity)
    };
    match verify.await {
        Ok(identity) => Availability { available: true, reason: None, separator: Some(identity) },
        Err(_) => Availability { available: false, reason: Some("Guitar separator is missing or failed its offline startup check. Run npm run setup:separator.".into()), separator: None },
    }
}
/// Reserve every possible intermediate, separately for old full-mix jobs.
pub fn reservation(config: &Config, focus: Focus) -> u64 {
    config.max_source_bytes
        + config.max_duration_seconds as u64
            * (24_000 * 6
                + if focus == Focus::Guitar {
                    44_100 * 8 + 24_000 * 2
                } else {
                    0
                })
        + 16384
}
pub fn align(pcm: &mut Vec<f32>, count: usize) -> Result<(), BackendError> {
    if pcm.len().abs_diff(count) > 1200 || pcm.iter().any(|v| !v.is_finite()) {
        return Err(BackendError::new("SEPARATION_FAILED"));
    }
    pcm.resize(count, 0.0);
    Ok(())
}
pub async fn extract(
    state: &AppState,
    id: Uuid,
    source: &Path,
    dir: &Path,
    original: &[f32],
    separator_pan: &str,
    cancel: &CancellationToken,
) -> Result<(Vec<f32>, AnalyzedAudio), BackendError> {
    let c = &state.config;
    let mut args = input_args(source);
    args.extend(
        [
            "-af",
            separator_pan,
            "-ar",
            "44100",
            "-t",
            &c.max_duration_seconds.to_string(),
            "-c:a",
            "pcm_s16le",
            "-f",
            "wav",
            "separator-input.wav",
        ]
        .map(OsString::from),
    );
    let decoded = run_process(&c.ffmpeg, &args, dir, c, cancel, c.decode_timeout, 4096).await?;
    if !decoded.success {
        return Err(BackendError::new("SEPARATION_FAILED"));
    }
    tokio::fs::remove_file(source).await?;
    let mut args = arguments(c);
    args.extend(
        [
            "--input",
            "separator-input.wav",
            "--output",
            "separator-stem.wav",
            "--progress",
            "separator-progress.json",
        ]
        .map(OsString::from),
    );
    let run = run_process(
        &c.separator_python,
        &args,
        dir,
        c,
        cancel,
        c.separation_timeout,
        4096,
    );
    tokio::pin!(run);
    let mut poll = tokio::time::interval(Duration::from_millis(200));
    let output = loop {
        tokio::select! {
            result = &mut run => break result.map_err(|e| if matches!(e.0.code.as_str(), "JOB_CANCELED"|"PROCESSING_TIMEOUT"|"SEPARATION_LIMIT") { e } else { BackendError::new("SEPARATION_FAILED") })?,
            _ = poll.tick() => {
                if let Ok(bytes) = tokio::fs::read(dir.join("separator-progress.json")).await {
                    if let Ok(v) = serde_json::from_slice::<serde_json::Value>(&bytes) {
                        if let Some(fraction) = v["fraction"].as_f64().filter(|f| (0.0..=1.0).contains(f)) {
                            if let Some(r) = state.inner.lock().await.jobs.get_mut(&id) {
                                if r.job.status == Status::Separating { r.job.progress.fraction = Some(r.job.progress.fraction.unwrap_or(0.0).max(fraction)); }
                            }
                        }
                    }
                }
            }
        }
    };
    let identity: Identity = serde_json::from_slice(&output.stdout)
        .map_err(|_| BackendError::new("SEPARATION_FAILED"))?;
    if !output.success || state.separation.separator.as_ref() != Some(&identity) {
        return Err(BackendError::new("SEPARATION_FAILED"));
    }
    tokio::fs::remove_file(dir.join("separator-input.wav")).await?;
    let mut args = input_args(&dir.join("separator-stem.wav"));
    // Average explicitly; FFmpeg's default stereo downmix is 3 dB louder than the original mix.
    args.extend(
        [
            "-af",
            "pan=mono|c0=0.5*c0+0.5*c1",
            "-ar",
            "24000",
            "-c:a",
            "pcm_f32le",
            "-f",
            "f32le",
            "pipe:1",
        ]
        .map(OsString::from),
    );
    let output = run_process(
        &c.ffmpeg,
        &args,
        dir,
        c,
        cancel,
        c.decode_timeout,
        (original.len() + 1201) * 4,
    )
    .await
    .map_err(|e| {
        if matches!(
            e.0.code.as_str(),
            "JOB_CANCELED" | "PROCESSING_TIMEOUT" | "SEPARATION_LIMIT"
        ) {
            e
        } else {
            BackendError::new("SEPARATION_FAILED")
        }
    })?;
    if !output.success || output.stdout.is_empty() || output.stdout.len() % 4 != 0 {
        return Err(BackendError::new("SEPARATION_FAILED"));
    }
    let mut pcm: Vec<_> = output
        .stdout
        .chunks_exact(4)
        .map(|b| f32::from_le_bytes(b.try_into().unwrap()))
        .collect();
    align(&mut pcm, original.len())?;
    let mut hash = Sha256::new();
    for sample in &pcm {
        hash.update(sample.to_le_bytes());
    }
    let energy = |samples: &[f32]| samples.iter().map(|v| (*v as f64).powi(2)).sum::<f64>();
    let level =
        (10.0 * ((energy(&pcm) + 1e-30) / (energy(original) + 1e-30)).log10()).clamp(-120.0, 20.0);
    write_playback(&dir.join("guitar.wav"), &pcm, cancel).await?;
    tokio::fs::remove_file(dir.join("separator-stem.wav")).await?;
    tokio::fs::remove_file(dir.join("separator-progress.json")).await?;
    Ok((
        pcm,
        AnalyzedAudio::GuitarStem {
            pcm_sha256: format!("{:x}", hash.finalize()),
            separator: identity,
            guitar_level_db: level,
        },
    ))
}
