use crate::{process::run_process, BackendError, Config};
use fretbloom_analysis::{AnalysisWarning, WarningCode, SAMPLE_RATE_HZ};
use sha2::{Digest, Sha256};
use std::{
    ffi::OsString,
    path::{Path, PathBuf},
};
use tokio::{fs, io::AsyncWriteExt};
use tokio_util::sync::CancellationToken;

pub struct DecodedMedia {
    pub mono: Vec<f32>,
    pub sample_rate_hz: u32,
    pub duration: f64,
    pub playback_wav: PathBuf,
    pub pcm_sha256: String,
    pub warnings: Vec<AnalysisWarning>,
    /// FFmpeg filter that gives the separator the same channel choice and level as `mono`:
    /// true stereo for an ordinary 2-channel source, otherwise the mono mix in both channels.
    pub separator_pan: String,
}
const DEMUXERS: &str = "wav,mp3,flac,ogg,mov,matroska,webm";
fn args(values: &[&str]) -> Vec<OsString> {
    values.iter().map(OsString::from).collect()
}
pub(crate) fn input_args(source: &Path) -> Vec<OsString> {
    let mut a = args(&[
        "-nostdin",
        "-xerror",
        "-err_detect",
        "explode",
        "-hide_banner",
        "-loglevel",
        "error",
        "-threads",
        "1",
        "-filter_threads",
        "1",
        "-protocol_whitelist",
        "file,pipe",
        "-format_whitelist",
        DEMUXERS,
        "-i",
    ]);
    a.push(source.as_os_str().to_owned());
    a.extend(args(&[
        "-map", "0:a:0", "-vn", "-sn", "-dn", "-threads", "1",
    ]));
    a
}

pub async fn decode_media(
    source: &Path,
    work_dir: &Path,
    config: &Config,
    cancel: &CancellationToken,
) -> Result<DecodedMedia, BackendError> {
    let size = fs::metadata(source).await?.len();
    if size == 0 {
        return Err(BackendError::new("UNSUPPORTED_MEDIA"));
    }
    if size > config.max_source_bytes {
        return Err(BackendError::new("SOURCE_TOO_LARGE"));
    }
    let mut probe = args(&[
        "-hide_banner",
        "-loglevel",
        "error",
        "-threads",
        "1",
        "-protocol_whitelist",
        "file,pipe",
        "-format_whitelist",
        DEMUXERS,
        "-show_entries",
        "stream=codec_type,sample_rate,channels:format=format_name",
        "-of",
        "json",
    ]);
    probe.push(source.as_os_str().to_owned());
    let info = run_process(
        &config.ffprobe,
        &probe,
        work_dir,
        config,
        cancel,
        config.probe_timeout,
        config.max_process_output,
    )
    .await?;
    if !info.success {
        return Err(BackendError::new("UNSUPPORTED_MEDIA"));
    }
    let parsed: serde_json::Value =
        serde_json::from_slice(&info.stdout).map_err(|_| BackendError::new("DECODE_FAILED"))?;
    let stream = parsed["streams"]
        .as_array()
        .and_then(|s| s.iter().find(|s| s["codec_type"] == "audio"))
        .ok_or_else(|| BackendError::new("UNSUPPORTED_MEDIA"))?;
    let channels = stream["channels"]
        .as_u64()
        .filter(|v| (1..=8).contains(v))
        .ok_or_else(|| BackendError::new("UNSUPPORTED_MEDIA"))? as usize;
    let rate = stream["sample_rate"]
        .as_str()
        .and_then(|s| s.parse::<u32>().ok())
        .filter(|v| (1..=192_000).contains(v))
        .ok_or_else(|| BackendError::new("UNSUPPORTED_MEDIA"))?;
    let mut warnings = Vec::new();
    if rate <= 12_000 {
        warnings.push(AnalysisWarning {
            code: WarningCode::LimitedBandwidth,
            message: "The source has limited bandwidth; upsampling does not restore harmonics."
                .into(),
        });
    }
    // Probe bounded windows at the start and middle for phase cancellation before choosing one consistent mix.
    let mut strongest = 0;
    let mut cancellation = false;
    if channels > 1 {
        let mut energies = vec![0.0_f64; channels];
        let mut mixed_energy = 0.0;
        for offset in [0, 2] {
            let mut a = input_args(source);
            a.extend(args(&[
                "-ss",
                &offset.to_string(),
                "-t",
                "2",
                "-ar",
                "24000",
                "-c:a",
                "pcm_f32le",
                "-f",
                "f32le",
                "pipe:1",
            ]));
            let output = run_process(
                &config.ffmpeg,
                &a,
                work_dir,
                config,
                cancel,
                config.decode_timeout,
                48_000 * channels * 4,
            )
            .await?;
            if !output.success || output.stdout.len() % (4 * channels) != 0 {
                return Err(BackendError::new("DECODE_FAILED"));
            }
            for frame in output.stdout.chunks_exact(4 * channels) {
                let mut sum = 0.0;
                for (channel, bytes) in frame.chunks_exact(4).enumerate() {
                    let sample = f32::from_le_bytes(bytes.try_into().unwrap()) as f64;
                    if !sample.is_finite() {
                        return Err(BackendError::new("DECODE_FAILED"));
                    }
                    energies[channel] += sample * sample;
                    sum += sample;
                }
                mixed_energy += (sum / channels as f64).powi(2);
            }
        }
        strongest = energies
            .iter()
            .enumerate()
            .max_by(|(_, a), (_, b)| a.total_cmp(b))
            .map(|(i, _)| i)
            .unwrap_or(0);
        cancellation = energies[strongest] > 1e-10 && mixed_energy < energies[strongest] * 0.02;
    }
    let mix = if cancellation {
        warnings.push(AnalysisWarning { code: WarningCode::ChannelCancellation, message: "Opposite-phase channels would cancel; playback and analysis use the strongest channel.".into() });
        format!("c{strongest}")
    } else {
        (0..channels)
            .map(|n| format!("{}*c{n}", 1.0 / channels as f64))
            .collect::<Vec<_>>()
            .join("+")
    };
    let pan = format!("pan=mono|c0={mix}");
    // The separator later averages its two output channels, which reproduces `mix` exactly.
    let separator_pan = if channels == 2 && !cancellation {
        "pan=stereo|c0=c0|c1=c1".to_string()
    } else {
        format!("pan=stereo|c0={mix}|c1={mix}")
    };
    let mut a = input_args(source);
    a.extend(args(&[
        "-af",
        &pan,
        "-ar",
        "24000",
        "-ac",
        "1",
        "-t",
        &format!("{:.9}", config.max_duration_seconds as f64 + 0.001),
        "-c:a",
        "pcm_f32le",
        "-f",
        "f32le",
        "pipe:1",
    ]));
    let max_samples = config.max_duration_seconds as usize * SAMPLE_RATE_HZ as usize;
    let output = run_process(
        &config.ffmpeg,
        &a,
        work_dir,
        config,
        cancel,
        config.decode_timeout,
        (max_samples + 24) * 4,
    )
    .await
    .map_err(|e| {
        if e.0.code == "RESULT_TOO_COMPLEX" {
            BackendError::new("DURATION_LIMIT")
        } else {
            e
        }
    })?;
    if !output.success || output.stdout.is_empty() || output.stdout.len() % 4 != 0 {
        return Err(BackendError::new("DECODE_FAILED"));
    }
    if output.stdout.len() / 4 > max_samples {
        return Err(BackendError::new("DURATION_LIMIT"));
    }
    let pcm_sha256 = format!("{:x}", Sha256::digest(&output.stdout));
    let mono: Vec<f32> = output
        .stdout
        .chunks_exact(4)
        .map(|b| f32::from_le_bytes(b.try_into().unwrap()))
        .collect();
    drop(output);
    if mono.iter().any(|v| !v.is_finite()) {
        return Err(BackendError::new("DECODE_FAILED"));
    }
    let playback_wav = work_dir.join("playback.wav");
    write_playback(&playback_wav, &mono, cancel).await?;
    Ok(DecodedMedia {
        duration: mono.len() as f64 / SAMPLE_RATE_HZ as f64,
        mono,
        sample_rate_hz: SAMPLE_RATE_HZ,
        playback_wav,
        pcm_sha256,
        warnings,
        separator_pan,
    })
}

pub(crate) async fn write_playback(
    path: &Path,
    samples: &[f32],
    cancel: &CancellationToken,
) -> Result<(), BackendError> {
    let data_len = (samples.len() * 2) as u32;
    let mut header = Vec::with_capacity(44);
    header.extend_from_slice(b"RIFF");
    header.extend_from_slice(&(36 + data_len).to_le_bytes());
    header.extend_from_slice(b"WAVEfmt ");
    header.extend_from_slice(&16_u32.to_le_bytes());
    header.extend_from_slice(&1_u16.to_le_bytes());
    header.extend_from_slice(&1_u16.to_le_bytes());
    header.extend_from_slice(&SAMPLE_RATE_HZ.to_le_bytes());
    header.extend_from_slice(&(SAMPLE_RATE_HZ * 2).to_le_bytes());
    header.extend_from_slice(&2_u16.to_le_bytes());
    header.extend_from_slice(&16_u16.to_le_bytes());
    header.extend_from_slice(b"data");
    header.extend_from_slice(&data_len.to_le_bytes());
    let mut file = fs::File::create(path).await?;
    file.write_all(&header).await?;
    for chunk in samples.chunks(8192) {
        if cancel.is_cancelled() {
            return Err(BackendError::new("JOB_CANCELED"));
        }
        let bytes: Vec<u8> = chunk
            .iter()
            .flat_map(|v| ((v.clamp(-1.0, 1.0) * 32767.0).round() as i16).to_le_bytes())
            .collect();
        file.write_all(&bytes).await?;
    }
    file.flush().await?;
    Ok(())
}
