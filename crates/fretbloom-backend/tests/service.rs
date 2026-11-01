use axum::{
    body::{to_bytes, Body},
    http::{Request, StatusCode},
};
use fretbloom_analysis::{AnalysisOptions, WarningCode};
use fretbloom_backend::jobs::{Source, Status};
use fretbloom_backend::{media::decode_media, process::run_process, router, AppState, Config};
use sha2::{Digest, Sha256};
use std::{
    path::{Path, PathBuf},
    time::Duration,
};
use tokio_util::sync::CancellationToken;
use tower::ServiceExt;

fn config(root: &Path) -> Config {
    Config {
        temp_root: root.into(),
        ffmpeg: std::env::var_os("FFMPEG_PATH")
            .map(PathBuf::from)
            .unwrap_or_else(|| "ffmpeg".into()),
        ffprobe: std::env::var_os("FFPROBE_PATH")
            .map(PathBuf::from)
            .unwrap_or_else(|| "ffprobe".into()),
        ..Config::default()
    }
}
fn wav(seconds: f64, rate: u32, channels: u16, antiphase: bool) -> Vec<u8> {
    let count = (seconds * rate as f64) as usize;
    let data = (count * channels as usize * 2) as u32;
    let mut b = Vec::new();
    b.extend(b"RIFF");
    b.extend((36 + data).to_le_bytes());
    b.extend(b"WAVEfmt ");
    b.extend(16_u32.to_le_bytes());
    b.extend(1_u16.to_le_bytes());
    b.extend(channels.to_le_bytes());
    b.extend(rate.to_le_bytes());
    b.extend((rate * channels as u32 * 2).to_le_bytes());
    b.extend((channels * 2).to_le_bytes());
    b.extend(16_u16.to_le_bytes());
    b.extend(b"data");
    b.extend(data.to_le_bytes());
    for i in 0..count {
        let s = if i < rate as usize / 20 {
            0
        } else {
            (0.2 * 32767.0 * (std::f64::consts::TAU * 440.0 * i as f64 / rate as f64).sin()) as i16
        };
        for c in 0..channels {
            b.extend((if antiphase && c == 1 { -s } else { s }).to_le_bytes());
        }
    }
    b
}
fn upload_source(n: usize) -> Source {
    Source::Upload {
        name: "test.wav".into(),
        byte_length: n as u64,
        content_type: "audio/wav".into(),
    }
}
async fn body_json(response: axum::response::Response) -> serde_json::Value {
    serde_json::from_slice(
        &to_bytes(response.into_body(), 10 * 1024 * 1024)
            .await
            .unwrap(),
    )
    .unwrap()
}
async fn wait_terminal(state: &AppState, id: uuid::Uuid) -> fretbloom_backend::jobs::Job {
    tokio::time::timeout(Duration::from_secs(20), async {
        loop {
            let job = state.get(id, true).await.unwrap();
            if job.status.terminal() {
                return job;
            }
            tokio::time::sleep(Duration::from_millis(20)).await;
        }
    })
    .await
    .expect("job deadline")
}
#[tokio::test]
async fn actual_wav_upload_result_features_playback_range_and_delete() {
    let temp = tempfile::tempdir().unwrap();
    let state = AppState::new(config(temp.path())).await.unwrap();
    let app = router(state.clone());
    let wav = wav(0.25, 44_100, 1, false);
    let created=app.clone().oneshot(Request::post("/v1/jobs").header("content-type","application/json").body(Body::from(serde_json::to_vec(&serde_json::json!({"source":{"kind":"upload","name":"test.wav","byteLength":wav.len(),"contentType":"audio/wav"}})).unwrap())).unwrap()).await.unwrap();
    assert_eq!(created.status(), StatusCode::ACCEPTED);
    let created = body_json(created).await;
    let id = created["id"].as_str().unwrap();
    let uuid = uuid::Uuid::parse_str(id).unwrap();
    let premature = app
        .clone()
        .oneshot(
            Request::get(format!("/v1/jobs/{id}/result"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(premature.status(), StatusCode::CONFLICT);
    let uploaded = app
        .clone()
        .oneshot(
            Request::put(format!("/v1/jobs/{id}/media"))
                .header("content-length", wav.len())
                .body(Body::from(wav))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(uploaded.status(), StatusCode::ACCEPTED);
    let job = wait_terminal(&state, uuid).await;
    assert!(job.status == Status::Succeeded, "{:?}", job.error);
    let result = app
        .clone()
        .oneshot(
            Request::get(format!("/v1/jobs/{id}/result"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(result.headers()["cache-control"], "private, no-store");
    let result = body_json(result).await;
    assert_eq!(result["analysis"]["sampleRateHz"], 24_000);
    assert_eq!(result["analysis"]["duration"], 0.25);
    assert_eq!(result["pcmSha256"].as_str().unwrap().len(), 64);
    let features = body_json(
        app.clone()
            .oneshot(
                Request::get(format!("/v1/jobs/{id}/features"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap(),
    )
    .await;
    assert!(features["frames"].as_array().unwrap().len() > 1);
    let head = app
        .clone()
        .oneshot(
            Request::head(format!("/v1/jobs/{id}/audio"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(head.status(), StatusCode::OK);
    assert_eq!(head.headers()["content-length"], "12044");
    assert!(to_bytes(head.into_body(), 100).await.unwrap().is_empty());
    let range = app
        .clone()
        .oneshot(
            Request::get(format!("/v1/jobs/{id}/audio"))
                .header("range", "bytes=0-43")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(range.status(), StatusCode::PARTIAL_CONTENT);
    assert_eq!(range.headers()["content-range"], "bytes 0-43/12044");
    let bytes = to_bytes(range.into_body(), 44).await.unwrap();
    assert_eq!(&bytes[..4], b"RIFF");
    let invalid = app
        .clone()
        .oneshot(
            Request::get(format!("/v1/jobs/{id}/audio"))
                .header("range", "bytes=999999-")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(invalid.status(), StatusCode::RANGE_NOT_SATISFIABLE);
    let canceled = state.cancel(uuid).await.unwrap();
    assert!(canceled.status == Status::Canceled);
    assert!(state.cancel(uuid).await.unwrap().status == Status::Canceled);
    let denied = app
        .oneshot(
            Request::get(format!("/v1/jobs/{id}/result"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(body_json(denied).await["error"]["code"], "JOB_CANCELED");
    state.shutdown().await;
    assert_eq!(std::fs::read_dir(temp.path()).unwrap().count(), 1); // run marker only; the run directory disappears with state
}
#[tokio::test]
async fn decoding_actual_rates_antiphase_and_exact_pcm_hash() {
    for rate in [12_000, 24_000, 32_000, 44_100, 48_000] {
        let temp = tempfile::tempdir().unwrap();
        let source = temp.path().join("input");
        std::fs::write(&source, wav(0.2, rate, 2, true)).unwrap();
        let decoded = decode_media(
            &source,
            temp.path(),
            &config(temp.path()),
            &CancellationToken::new(),
        )
        .await
        .unwrap();
        assert_eq!(decoded.mono.len(), 4800);
        assert!(decoded.mono[..100].iter().all(|v| v.abs() < 1e-3));
        assert!(decoded.mono.iter().any(|v| v.abs() > 0.1));
        assert!(decoded
            .warnings
            .iter()
            .any(|w| w.code == WarningCode::ChannelCancellation));
        if rate == 12_000 {
            assert!(decoded
                .warnings
                .iter()
                .any(|w| w.code == WarningCode::LimitedBandwidth));
        }
        let bytes: Vec<u8> = decoded.mono.iter().flat_map(|v| v.to_le_bytes()).collect();
        assert_eq!(decoded.pcm_sha256, format!("{:x}", Sha256::digest(bytes)));
        let playback = std::fs::read(decoded.playback_wav).unwrap();
        for (i, sample) in decoded.mono.iter().enumerate() {
            assert_eq!(
                i16::from_le_bytes(playback[44 + i * 2..46 + i * 2].try_into().unwrap()),
                (sample.clamp(-1.0, 1.0) * 32767.0).round() as i16
            );
        }
    }
}
#[tokio::test]
async fn rejects_duration_source_limits_corruption_and_network_or_local_playlists() {
    let temp = tempfile::tempdir().unwrap();
    let source = temp.path().join("input");
    let mut c = config(temp.path());
    c.max_duration_seconds = 1;
    std::fs::write(&source, wav(1.01, 24_000, 1, false)).unwrap();
    assert_eq!(
        decode_media(&source, temp.path(), &c, &CancellationToken::new())
            .await
            .err()
            .unwrap()
            .0
            .code,
        "DURATION_LIMIT"
    );
    c.max_source_bytes = 20;
    assert_eq!(
        decode_media(&source, temp.path(), &c, &CancellationToken::new())
            .await
            .err()
            .unwrap()
            .0
            .code,
        "SOURCE_TOO_LARGE"
    );
    c.max_source_bytes = 50 * 1024 * 1024;
    for input in [
        b"#EXTM3U\nhttp://127.0.0.1:9/private\n".as_slice(),
        b"ffconcat version 1.0\nfile '/etc/passwd'\n",
        b"#EXTM3U\n/etc/passwd\n",
        b"RIFFbroken",
    ] {
        std::fs::write(&source, input).unwrap();
        let error = decode_media(&source, temp.path(), &c, &CancellationToken::new())
            .await
            .err()
            .unwrap();
        assert_eq!(error.0.code, "UNSUPPORTED_MEDIA");
    }
}
#[tokio::test]
async fn reservations_admission_upload_mismatch_lease_queue_and_retention() {
    let temp = tempfile::tempdir().unwrap();
    let mut c = config(temp.path());
    c.lease_timeout = Duration::from_millis(150);
    c.retention = Duration::from_millis(150);
    let state = AppState::new(c).await.unwrap();
    let mut ids = Vec::new();
    for _ in 0..3 {
        ids.push(
            state
                .create(upload_source(12), AnalysisOptions::default())
                .await
                .unwrap()
                .id,
        );
    }
    assert_eq!(
        state
            .create(upload_source(12), AnalysisOptions::default())
            .await
            .err()
            .unwrap()
            .0
            .code,
        "QUEUE_FULL"
    );
    let response = router(state.clone())
        .oneshot(
            Request::put(format!("/v1/jobs/{}/media", ids[0]))
                .body(Body::from("too short"))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    assert_eq!(
        state.get(ids[0], false).await.unwrap().error.unwrap().code,
        "INVALID_REQUEST"
    );
    tokio::time::sleep(Duration::from_millis(500)).await;
    for id in ids {
        assert_eq!(
            state.get(id, false).await.err().unwrap().0.code,
            "JOB_NOT_FOUND"
        );
    }
    assert!(state
        .create(upload_source(12), AnalysisOptions::default())
        .await
        .is_ok());
    state.shutdown().await;
}
#[tokio::test]
async fn upload_idle_and_total_deadline_and_cancel_are_terminal() {
    let temp = tempfile::tempdir().unwrap();
    let mut c = config(temp.path());
    c.upload_idle_timeout = Duration::from_millis(40);
    let state = AppState::new(c).await.unwrap();
    let job = state
        .create(upload_source(12), AnalysisOptions::default())
        .await
        .unwrap();
    let (sender, receiver) =
        tokio::sync::mpsc::channel::<Result<axum::body::Bytes, std::io::Error>>(1);
    let stream = futures_stream(receiver);
    let response = router(state.clone())
        .oneshot(
            Request::put(format!("/v1/jobs/{}/media", job.id))
                .body(Body::from_stream(stream))
                .unwrap(),
        )
        .await
        .unwrap();
    drop(sender);
    assert_eq!(response.status(), StatusCode::GATEWAY_TIMEOUT);
    assert_eq!(
        state.get(job.id, false).await.unwrap().error.unwrap().code,
        "PROCESSING_TIMEOUT"
    );
    state.shutdown().await;
}
fn futures_stream(
    receiver: tokio::sync::mpsc::Receiver<Result<axum::body::Bytes, std::io::Error>>,
) -> impl tokio_stream::Stream<Item = Result<axum::body::Bytes, std::io::Error>> {
    tokio_stream::wrappers::ReceiverStream::new(receiver)
}
#[cfg(unix)]
async fn script(dir: &Path, name: &str, code: &str) -> PathBuf {
    use std::os::unix::fs::PermissionsExt;
    let p = dir.join(name);
    tokio::fs::write(&p, format!("#!/bin/sh\n{code}\n"))
        .await
        .unwrap();
    tokio::fs::set_permissions(&p, std::fs::Permissions::from_mode(0o700))
        .await
        .unwrap();
    p
}
#[cfg(unix)]
#[tokio::test]
async fn process_timeout_cancel_bounded_output_and_secret_free_environment() {
    let temp = tempfile::tempdir().unwrap();
    let c = config(temp.path());
    let token = CancellationToken::new();
    let env = script(
        temp.path(),
        "env-check",
        "test -z \"$DATABASE_URL$FRETBLOOM_ACCESS_PASSWORD$AWS_SECRET_ACCESS_KEY\" && printf safe",
    )
    .await;
    let result = run_process(
        &env,
        &[],
        temp.path(),
        &c,
        &token,
        Duration::from_secs(1),
        100,
    )
    .await
    .unwrap();
    assert!(result.success);
    assert_eq!(result.stdout, b"safe");
    let wait = script(
        temp.path(),
        "wait",
        "sleep 30 &\necho $! > descendant.pid\nwait",
    )
    .await;
    let error = run_process(
        &wait,
        &[],
        temp.path(),
        &c,
        &token,
        Duration::from_millis(50),
        100,
    )
    .await
    .err()
    .unwrap();
    assert_eq!(error.0.code, "PROCESSING_TIMEOUT");
    let child = tokio::fs::read_to_string(temp.path().join("descendant.pid"))
        .await
        .unwrap()
        .trim()
        .parse::<i32>()
        .unwrap();
    #[cfg(target_os = "linux")]
    assert!(
        !std::path::Path::new(&format!("/proc/{child}")).exists(),
        "descendant must be reaped"
    );
    let cancel = token.clone();
    tokio::spawn(async move {
        tokio::time::sleep(Duration::from_millis(30)).await;
        cancel.cancel();
    });
    assert_eq!(
        run_process(
            &wait,
            &[],
            temp.path(),
            &c,
            &token,
            Duration::from_secs(1),
            100
        )
        .await
        .err()
        .unwrap()
        .0
        .code,
        "JOB_CANCELED"
    );
    let loud = script(
        temp.path(),
        "loud",
        "while :; do printf 12345678901234567890; done",
    )
    .await;
    assert_eq!(
        run_process(
            &loud,
            &[],
            temp.path(),
            &c,
            &CancellationToken::new(),
            Duration::from_secs(1),
            100
        )
        .await
        .err()
        .unwrap()
        .0
        .code,
        "RESULT_TOO_COMPLEX"
    );
}
#[test]
fn strict_range_and_loopback_configuration() {
    use fretbloom_backend::api::byte_range;
    assert_eq!(byte_range("bytes=0-9", 20), Some((0, 9)));
    assert_eq!(byte_range("bytes=-5", 20), Some((15, 19)));
    assert_eq!(byte_range("bytes=5-", 20), Some((5, 19)));
    for invalid in [
        "bytes=20-",
        "bytes=5-4",
        "bytes=-0",
        "bytes=0-1,3-4",
        "items=0-2",
        "bytes=+1-2",
    ] {
        assert_eq!(byte_range(invalid, 20), None, "{invalid}");
    }
    let c = Config {
        listen: "0.0.0.0:5210".parse().unwrap(),
        ..Config::default()
    };
    assert!(c.validate().is_err());
}
#[cfg(unix)]
#[tokio::test]
async fn youtube_fixed_id_metadata_hls_retry_bytes_and_deadline() {
    use fretbloom_backend::youtube::acquire_youtube;
    let temp = tempfile::tempdir().unwrap();
    let tools = tempfile::tempdir().unwrap();
    let mut c = config(temp.path());
    c.yt_dlp=script(tools.path(),"youtube","printf '%s\\n' \"$@\" >> args.log\ncase \"$*\" in *--dump-single-json*) printf '{\"duration\":1,\"title\":\"Test\",\"formats\":[{\"format_id\":\"hls-1\",\"protocol\":\"m3u8_native\",\"vcodec\":\"none\",\"abr\":64}]}' ;; *'--format bestaudio/best'*) exit 1 ;; *) printf wav > source.wav ;; esac").await;
    let result = acquire_youtube("abcdefghijk", temp.path(), &c, &CancellationToken::new())
        .await
        .unwrap();
    assert_eq!(result.title.as_deref(), Some("Test"));
    let args = tokio::fs::read_to_string(temp.path().join("args.log"))
        .await
        .unwrap();
    for required in [
        "--ignore-config",
        "--no-cookies",
        "--no-cookies-from-browser",
        "--no-playlist",
        "--js-runtimes",
        "hls-1",
        "https://www.youtube.com/watch?v=abcdefghijk",
    ] {
        assert!(args.contains(required));
    }
    assert_eq!(
        acquire_youtube("https://bad", temp.path(), &c, &CancellationToken::new())
            .await
            .err()
            .unwrap()
            .0
            .code,
        "INVALID_REQUEST"
    );
    tokio::fs::remove_file(temp.path().join("source.wav"))
        .await
        .unwrap();
    c.yt_dlp = script(
        tools.path(),
        "live",
        "printf '{\"duration\":1,\"is_live\":true}'",
    )
    .await;
    assert_eq!(
        acquire_youtube("abcdefghijk", temp.path(), &c, &CancellationToken::new())
            .await
            .err()
            .unwrap()
            .0
            .code,
        "YOUTUBE_UNAVAILABLE"
    );
    c.yt_dlp = script(tools.path(), "slow", "sleep 30").await;
    c.youtube_timeout = Duration::from_millis(50);
    assert_eq!(
        acquire_youtube("abcdefghijk", temp.path(), &c, &CancellationToken::new())
            .await
            .err()
            .unwrap()
            .0
            .code,
        "PROCESSING_TIMEOUT"
    );
}

#[cfg(unix)]
#[tokio::test]
async fn queue_timeout_fetch_cancellation_and_immediate_readmission() {
    let temp = tempfile::tempdir().unwrap();
    let tools = tempfile::tempdir().unwrap();
    let mut c = config(temp.path());
    c.queue_timeout = Duration::from_millis(60);
    c.yt_dlp = script(tools.path(), "blocked-extractor", "sleep 30").await;
    let state = AppState::new(c).await.unwrap();
    let first = state
        .create(
            Source::Youtube {
                video_id: "abcdefghijk".into(),
            },
            AnalysisOptions::default(),
        )
        .await
        .unwrap();
    tokio::time::timeout(Duration::from_secs(1), async {
        loop {
            if state.get(first.id, true).await.unwrap().status == Status::Fetching {
                break;
            }
            tokio::task::yield_now().await;
        }
    })
    .await
    .unwrap();
    let second = state
        .create(
            Source::Youtube {
                video_id: "abcdefghijk".into(),
            },
            AnalysisOptions::default(),
        )
        .await
        .unwrap();
    tokio::time::sleep(Duration::from_millis(150)).await;
    assert_eq!(
        state
            .get(second.id, false)
            .await
            .unwrap()
            .error
            .unwrap()
            .code,
        "PROCESSING_TIMEOUT"
    );
    state.cancel(first.id).await.unwrap();
    tokio::time::timeout(Duration::from_secs(3), async {
        loop {
            if !state.inner.lock().await.jobs[&first.id].busy {
                break;
            }
            tokio::time::sleep(Duration::from_millis(10)).await;
        }
    })
    .await
    .unwrap();
    assert!(state.get(first.id, false).await.unwrap().status == Status::Canceled);
    assert!(state.inner.lock().await.queue.is_empty());
    assert!(state
        .create(upload_source(10), AnalysisOptions::default())
        .await
        .is_ok());
    state.shutdown().await;
}
#[tokio::test]
async fn upload_disconnect_oversize_total_timeout_and_explicit_cancel() {
    let temp = tempfile::tempdir().unwrap();
    let mut c = config(temp.path());
    c.max_source_bytes = 100;
    c.upload_timeout = Duration::from_millis(80);
    c.upload_idle_timeout = Duration::from_millis(70);
    let state = AppState::new(c).await.unwrap();
    let job = state
        .create(upload_source(12), AnalysisOptions::default())
        .await
        .unwrap();
    let response = router(state.clone())
        .oneshot(
            Request::put(format!("/v1/jobs/{}/media", job.id))
                .body(Body::from_stream(tokio_stream::iter([Err::<
                    axum::body::Bytes,
                    _,
                >(
                    std::io::Error::other("disconnected"),
                )])))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::CONFLICT);
    assert!(state.get(job.id, false).await.unwrap().status == Status::Canceled);
    let job = state
        .create(upload_source(100), AnalysisOptions::default())
        .await
        .unwrap();
    let response = router(state.clone())
        .oneshot(
            Request::put(format!("/v1/jobs/{}/media", job.id))
                .body(Body::from(vec![0_u8; 101]))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::PAYLOAD_TOO_LARGE);
    let job = state
        .create(upload_source(100), AnalysisOptions::default())
        .await
        .unwrap();
    let (sender, receiver) = tokio::sync::mpsc::channel(1);
    let producer = tokio::spawn(async move {
        loop {
            if sender
                .send(Ok::<_, std::io::Error>(axum::body::Bytes::from_static(
                    b"a",
                )))
                .await
                .is_err()
            {
                break;
            }
            tokio::time::sleep(Duration::from_millis(20)).await;
        }
    });
    let response = router(state.clone())
        .oneshot(
            Request::put(format!("/v1/jobs/{}/media", job.id))
                .body(Body::from_stream(futures_stream(receiver)))
                .unwrap(),
        )
        .await
        .unwrap();
    producer.abort();
    assert_eq!(response.status(), StatusCode::GATEWAY_TIMEOUT);
    let job = state
        .create(upload_source(100), AnalysisOptions::default())
        .await
        .unwrap();
    let (sender, receiver) =
        tokio::sync::mpsc::channel::<Result<axum::body::Bytes, std::io::Error>>(1);
    let cancel_state = state.clone();
    tokio::spawn(async move {
        tokio::time::sleep(Duration::from_millis(10)).await;
        cancel_state.cancel(job.id).await.unwrap();
    });
    let response = router(state.clone())
        .oneshot(
            Request::put(format!("/v1/jobs/{}/media", job.id))
                .body(Body::from_stream(futures_stream(receiver)))
                .unwrap(),
        )
        .await
        .unwrap();
    drop(sender);
    assert_eq!(response.status(), StatusCode::CONFLICT);
    assert!(state.get(job.id, false).await.unwrap().status == Status::Canceled);
    state.shutdown().await;
}
#[tokio::test]
async fn analysis_deadline_and_cancel_never_publish_late_success() {
    for cancel_requested in [false, true] {
        let temp = tempfile::tempdir().unwrap();
        let mut c = config(temp.path());
        c.analysis_timeout = if cancel_requested {
            Duration::from_secs(120)
        } else {
            Duration::from_millis(1)
        };
        let state = AppState::new(c).await.unwrap();
        let data = wav(30.0, 24_000, 1, false);
        let job = state
            .create(upload_source(data.len()), AnalysisOptions::default())
            .await
            .unwrap();
        let response = router(state.clone())
            .oneshot(
                Request::put(format!("/v1/jobs/{}/media", job.id))
                    .body(Body::from(data))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::ACCEPTED);
        if cancel_requested {
            tokio::time::timeout(Duration::from_secs(5), async {
                loop {
                    let job = state.get(job.id, true).await.unwrap();
                    if job.status == Status::Analyzing {
                        break;
                    }
                    assert!(!job.status.terminal());
                    tokio::time::sleep(Duration::from_millis(1)).await;
                }
            })
            .await
            .unwrap();
            state.cancel(job.id).await.unwrap();
        }
        let terminal = wait_terminal(&state, job.id).await;
        assert_eq!(
            terminal.error.unwrap().code,
            if cancel_requested {
                "JOB_CANCELED"
            } else {
                "PROCESSING_TIMEOUT"
            }
        );
        tokio::time::timeout(Duration::from_secs(3), async {
            loop {
                if !state.inner.lock().await.jobs[&job.id].busy {
                    break;
                }
                tokio::time::sleep(Duration::from_millis(10)).await;
            }
        })
        .await
        .unwrap();
        let inner = state.inner.lock().await;
        assert!(inner.jobs[&job.id].result.is_none());
        assert!(inner.jobs[&job.id].features.is_none());
        drop(inner);
        state.shutdown().await;
    }
}

#[tokio::test]
async fn actual_single_file_compressed_formats_decode_on_the_original_timeline() {
    let temp = tempfile::tempdir().unwrap();
    let c = config(temp.path());
    tokio::fs::write(temp.path().join("input.wav"), wav(0.2, 48_000, 1, false))
        .await
        .unwrap();
    for (extension, codec) in [
        ("mp3", "libmp3lame"),
        ("flac", "flac"),
        ("ogg", "libvorbis"),
        ("m4a", "aac"),
        ("webm", "libopus"),
    ] {
        let filename = format!("audio.{extension}");
        let args: Vec<std::ffi::OsString> = [
            "-nostdin",
            "-hide_banner",
            "-loglevel",
            "error",
            "-threads",
            "1",
            "-i",
            "input.wav",
            "-c:a",
            codec,
            "-threads",
            "1",
            "-y",
            &filename,
        ]
        .into_iter()
        .map(std::ffi::OsString::from)
        .collect();
        let encoded = run_process(
            &c.ffmpeg,
            &args,
            temp.path(),
            &c,
            &CancellationToken::new(),
            Duration::from_secs(5),
            100,
        )
        .await
        .unwrap();
        assert!(encoded.success, "encoder {codec}");
        let decoded = decode_media(
            &temp.path().join(filename),
            temp.path(),
            &c,
            &CancellationToken::new(),
        )
        .await
        .unwrap();
        assert!(
            decoded.duration >= 0.19 && decoded.duration <= 0.24,
            "{extension} {}",
            decoded.duration
        );
        let leading_rms = (decoded.mono[..240]
            .iter()
            .map(|x| (*x as f64).powi(2))
            .sum::<f64>()
            / 240.0)
            .sqrt();
        assert!(
            leading_rms < 0.002,
            "{extension}: leading silence was shifted {leading_rms}"
        );
        assert_eq!(
            std::fs::metadata(decoded.playback_wav).unwrap().len(),
            44 + decoded.mono.len() as u64 * 2
        );
    }
}
#[cfg(unix)]
#[tokio::test]
async fn decode_probe_deadline_tool_absence_and_cancel_reap_without_late_results() {
    let temp = tempfile::tempdir().unwrap();
    let tools = tempfile::tempdir().unwrap();
    let mut c = config(temp.path());
    let source = temp.path().join("source.bin");
    tokio::fs::write(&source, wav(0.1, 24_000, 1, false))
        .await
        .unwrap();
    c.ffprobe = tools.path().join("absent");
    assert_eq!(
        decode_media(&source, temp.path(), &c, &CancellationToken::new())
            .await
            .err()
            .unwrap()
            .0
            .code,
        "TOOL_UNAVAILABLE"
    );
    c.ffprobe = script(tools.path(), "slow-probe", "sleep 30").await;
    c.probe_timeout = Duration::from_millis(50);
    assert_eq!(
        decode_media(&source, temp.path(), &c, &CancellationToken::new())
            .await
            .err()
            .unwrap()
            .0
            .code,
        "PROCESSING_TIMEOUT"
    );
    c.probe_timeout = Duration::from_secs(10);
    let state = AppState::new(c).await.unwrap();
    let data = wav(0.1, 24_000, 1, false);
    let job = state
        .create(upload_source(data.len()), AnalysisOptions::default())
        .await
        .unwrap();
    let response = router(state.clone())
        .oneshot(
            Request::put(format!("/v1/jobs/{}/media", job.id))
                .body(Body::from(data))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::ACCEPTED);
    tokio::time::timeout(Duration::from_secs(1), async {
        loop {
            if state.get(job.id, true).await.unwrap().status == Status::Decoding {
                break;
            }
            tokio::task::yield_now().await;
        }
    })
    .await
    .unwrap();
    state.cancel(job.id).await.unwrap();
    tokio::time::timeout(Duration::from_secs(3), async {
        loop {
            if !state.inner.lock().await.jobs[&job.id].busy {
                break;
            }
            tokio::time::sleep(Duration::from_millis(10)).await;
        }
    })
    .await
    .unwrap();
    assert!(state.get(job.id, false).await.unwrap().status == Status::Canceled);
    assert!(state.inner.lock().await.jobs[&job.id].result.is_none());
    state.shutdown().await;
}
#[tokio::test]
async fn stale_cleanup_is_scoped_and_retention_eviction_preserves_unrelated_directories() {
    let temp = tempfile::tempdir().unwrap();
    let unrelated = temp.path().join("keep-me");
    std::fs::create_dir(&unrelated).unwrap();
    std::fs::write(unrelated.join("marker"), b"safe").unwrap();
    let stale = temp.path().join("fretbloom-run-v1-stale-test");
    std::fs::create_dir(&stale).unwrap();
    std::fs::write(stale.join("owner.pid"), b"2147483647").unwrap();
    std::fs::write(stale.join("owned-file"), b"safe to remove").unwrap();
    let state = AppState::new(config(temp.path())).await.unwrap();
    assert!(unrelated.join("marker").exists());
    #[cfg(unix)]
    assert!(!stale.exists());
    for _ in 0..13 {
        let job = state
            .create(upload_source(1), AnalysisOptions::default())
            .await
            .unwrap();
        state.cancel(job.id).await.unwrap();
    }
    tokio::time::sleep(Duration::from_millis(150)).await;
    assert!(state.inner.lock().await.jobs.len() <= 10);
    state.shutdown().await;
    assert!(unrelated.join("marker").exists());
}

#[cfg(unix)]
#[tokio::test]
async fn youtube_advertised_and_actual_partial_sizes_cannot_bypass_source_limit() {
    use fretbloom_backend::youtube::acquire_youtube;
    let temp = tempfile::tempdir().unwrap();
    let tools = tempfile::tempdir().unwrap();
    let mut c = config(temp.path());
    c.max_source_bytes = 64;
    c.yt_dlp = script(
        tools.path(),
        "too-large-metadata",
        "printf '{\"duration\":1,\"filesize\":65}'",
    )
    .await;
    assert_eq!(
        acquire_youtube("abcdefghijk", temp.path(), &c, &CancellationToken::new())
            .await
            .err()
            .unwrap()
            .0
            .code,
        "SOURCE_TOO_LARGE"
    );
    c.yt_dlp=script(tools.path(),"too-large-download","case \"$*\" in *--dump-single-json*) printf '{\"duration\":1}' ;; *) dd if=/dev/zero of=source.part bs=256 count=1 2>/dev/null ;; esac").await;
    assert_eq!(
        acquire_youtube("abcdefghijk", temp.path(), &c, &CancellationToken::new())
            .await
            .err()
            .unwrap()
            .0
            .code,
        "SOURCE_TOO_LARGE"
    );
    assert!(
        std::fs::metadata(temp.path().join("source.part"))
            .unwrap()
            .len()
            <= 64
    );
}
