use axum::{
    body::{to_bytes, Body},
    http::{Request, StatusCode},
};
use fretbloom_backend::{process::run_process, router, separator::align, AppState, Config};
use std::{ffi::OsString, time::Duration};
use tokio_util::sync::CancellationToken;
use tower::ServiceExt;

#[test]
fn alignment_keeps_sample_zero_and_rejects_large_length_errors() {
    let mut pcm = vec![0.5, 0.25, -0.25];
    align(&mut pcm, 5).unwrap();
    assert_eq!(pcm, vec![0.5, 0.25, -0.25, 0.0, 0.0]);
    align(&mut pcm, 3).unwrap();
    assert_eq!(pcm, vec![0.5, 0.25, -0.25]);
    assert_eq!(
        align(&mut pcm, 24000).unwrap_err().0.code,
        "SEPARATION_FAILED"
    );
    assert!(align(&mut vec![f32::NAN], 1).is_err());
}
#[tokio::test]
async fn wire_defaults_unknown_focus_and_unavailable_never_fall_back() {
    let root = tempfile::tempdir().unwrap();
    let state = AppState::new(Config {
        temp_root: root.path().into(),
        separator_weights: root.path().join("missing"),
        ..Config::default()
    })
    .await
    .unwrap();
    let app = router(state.clone());
    for (extra, expected) in [
        ("", StatusCode::ACCEPTED),
        (",\"focus\":\"guitar\"", StatusCode::SERVICE_UNAVAILABLE),
        (",\"focus\":\"bass\"", StatusCode::BAD_REQUEST),
        (",\"surprise\":true", StatusCode::BAD_REQUEST),
    ] {
        let body = format!("{{\"source\":{{\"kind\":\"upload\",\"name\":\"a.wav\",\"contentType\":\"audio/wav\",\"byteLength\":50}}{extra}}}");
        let response = app
            .clone()
            .oneshot(
                Request::post("/v1/jobs")
                    .header("content-type", "application/json")
                    .body(Body::from(body))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), expected);
        let v: serde_json::Value =
            serde_json::from_slice(&to_bytes(response.into_body(), 16384).await.unwrap()).unwrap();
        if expected == StatusCode::ACCEPTED {
            assert_eq!(v["focus"], "full_mix");
        }
        if expected == StatusCode::SERVICE_UNAVAILABLE {
            assert_eq!(v["error"]["code"], "SEPARATOR_UNAVAILABLE");
        }
    }
    state.shutdown().await;
}
#[tokio::test]
async fn separator_cancel_reaps_grandchild_and_memory_watchdog_works() {
    let dir = tempfile::tempdir().unwrap();
    let helper = dir.path().join("helper.py");
    tokio::fs::write(&helper,"import subprocess,time,pathlib\np=subprocess.Popen(['/usr/bin/sleep','60'])\npathlib.Path('grandchild.pid').write_text(str(p.pid))\ntime.sleep(60)\n").await.unwrap();
    let mut c = Config {
        separator_python: "/usr/bin/python3".into(),
        ..Config::default()
    };
    let args: Vec<OsString> = vec!["-I".into(), "-B".into(), helper.into_os_string()];
    let token = CancellationToken::new();
    let cancel = token.clone();
    let path = dir.path().to_owned();
    let killer = tokio::spawn(async move {
        while !path.join("grandchild.pid").exists() {
            tokio::time::sleep(Duration::from_millis(10)).await;
        }
        cancel.cancel();
    });
    let out = run_process(
        &c.separator_python,
        &args,
        dir.path(),
        &c,
        &token,
        Duration::from_secs(10),
        4096,
    )
    .await;
    killer.await.unwrap();
    assert_eq!(out.err().unwrap().0.code, "JOB_CANCELED");
    let pid: i32 = tokio::fs::read_to_string(dir.path().join("grandchild.pid"))
        .await
        .unwrap()
        .parse()
        .unwrap();
    assert!(matches!(
        nix::sys::signal::kill(nix::unistd::Pid::from_raw(pid), None),
        Err(nix::errno::Errno::ESRCH)
    ));
    c.separator_max_rss = 1024 * 1024;
    let out = run_process(
        &c.separator_python,
        &[
            "-c".into(),
            "import time; a=bytearray(10000000); time.sleep(5)".into(),
        ],
        dir.path(),
        &c,
        &CancellationToken::new(),
        Duration::from_secs(10),
        4096,
    )
    .await;
    assert_eq!(out.err().unwrap().0.code, "SEPARATION_LIMIT");
}

#[tokio::test]
async fn unexpected_parent_death_cannot_leave_inherited_pipes_open() {
    let dir = tempfile::tempdir().unwrap();
    let c = Config {
        separator_python: "/usr/bin/python3".into(),
        ..Config::default()
    };
    let args = ["-I".into(), "-B".into(), "-c".into(), "import subprocess,os,signal,pathlib; p=subprocess.Popen(['/usr/bin/sleep','60']); pathlib.Path('pid').write_text(str(p.pid)); os.kill(os.getpid(),signal.SIGKILL)".into()];
    let token = CancellationToken::new();
    let out = tokio::time::timeout(
        Duration::from_secs(3),
        run_process(
            &c.separator_python,
            &args,
            dir.path(),
            &c,
            &token,
            Duration::from_secs(60),
            4096,
        ),
    )
    .await
    .expect("A dead leader must immediately close inherited child pipes")
    .unwrap();
    assert!(!out.success);
    let pid: i32 = tokio::fs::read_to_string(dir.path().join("pid"))
        .await
        .unwrap()
        .parse()
        .unwrap();
    assert!(matches!(
        nix::sys::signal::kill(nix::unistd::Pid::from_raw(pid), None),
        Err(nix::errno::Errno::ESRCH)
    ));
}

/// Stereo 48 kHz WAV with different content per channel, so a wrong downmix changes the level.
fn stereo_wav(seconds: f64) -> Vec<u8> {
    let rate = 48_000_u32;
    let count = (seconds * rate as f64) as usize;
    let data = (count * 4) as u32;
    let mut b = Vec::new();
    for part in [&b"RIFF"[..], &(36 + data).to_le_bytes(), b"WAVEfmt "] {
        b.extend(part);
    }
    b.extend(16_u32.to_le_bytes());
    b.extend(1_u16.to_le_bytes());
    b.extend(2_u16.to_le_bytes());
    b.extend(rate.to_le_bytes());
    b.extend((rate * 4).to_le_bytes());
    b.extend(4_u16.to_le_bytes());
    b.extend(16_u16.to_le_bytes());
    b.extend(b"data");
    b.extend(data.to_le_bytes());
    for i in 0..count {
        let t = i as f64 / rate as f64;
        let pluck = (-5.0 * (t % 0.5)).exp() * (std::f64::consts::TAU * 196.0 * t).sin();
        let left = (0.4 * pluck * 32767.0) as i16;
        let right = (0.25 * (std::f64::consts::TAU * 330.0 * t).sin() * 32767.0) as i16;
        b.extend(left.to_le_bytes());
        b.extend(right.to_le_bytes());
    }
    b
}
fn wav_samples(bytes: &[u8]) -> Vec<f64> {
    bytes[44..]
        .chunks_exact(2)
        .map(|b| i16::from_le_bytes([b[0], b[1]]) as f64)
        .collect()
}

/// Full guitar job with a copy-through stub separator. Needs the pinned weights from
/// `npm run setup:separator` (availability checks their hash) and FFmpeg on PATH.
#[tokio::test]
async fn guitar_job_keeps_original_identity_level_and_timeline_and_fails_closed() {
    let weights = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../.tools/separator/5c90dfd2-34c22ccb.th");
    if !weights.exists() {
        eprintln!("skipped: run npm run setup:separator for the pinned weights");
        return;
    }
    let root = tempfile::tempdir().unwrap();
    let helper = root.path().join("stub.py");
    // Copies the separator input for inputs of at least 1.5 s; shorter inputs fail like a crash.
    tokio::fs::write(
        &helper,
        format!(
            "import sys,json,shutil,pathlib,wave\n\
             identity=dict(model='htdemucs_6s',weightsSha256='{}',package='demucs 4.1.0',runtime='torch 2.8.0+cpu cpu',shifts=0,overlap=0.25)\n\
             if '--check' not in sys.argv:\n \
             w=wave.open('separator-input.wav')\n \
             if w.getnframes()<66150: sys.exit(1)\n \
             shutil.copyfile('separator-input.wav','separator-stem.wav')\n \
             pathlib.Path('separator-progress.json').write_text('{{\"fraction\":1}}')\n\
             print(json.dumps(identity))\n",
            fretbloom_backend::separator::WEIGHTS_SHA256
        ),
    )
    .await
    .unwrap();
    let state = AppState::new(Config {
        temp_root: root.path().join("jobs"),
        separator_python: "/usr/bin/python3".into(),
        separator_helper: helper,
        separator_weights: weights,
        ..Config::default()
    })
    .await
    .unwrap();
    assert!(state.separation.available, "{:?}", state.separation.reason);
    let app = router(state.clone());
    let call = |request: Request<Body>| {
        let app = app.clone();
        async move {
            let response = app.oneshot(request).await.unwrap();
            let status = response.status();
            (
                status,
                to_bytes(response.into_body(), 32 << 20).await.unwrap(),
            )
        }
    };
    let run = |source: Vec<u8>| async move {
        let body = format!("{{\"source\":{{\"kind\":\"upload\",\"name\":\"s.wav\",\"contentType\":\"audio/wav\",\"byteLength\":{}}},\"focus\":\"guitar\"}}", source.len());
        let (_, job) = call(
            Request::post("/v1/jobs")
                .header("content-type", "application/json")
                .body(Body::from(body))
                .unwrap(),
        )
        .await;
        let id = serde_json::from_slice::<serde_json::Value>(&job).unwrap()["id"]
            .as_str()
            .unwrap()
            .to_owned();
        call(
            Request::put(format!("/v1/jobs/{id}/media"))
                .body(Body::from(source))
                .unwrap(),
        )
        .await;
        let job = tokio::time::timeout(Duration::from_secs(60), async {
            loop {
                let (_, job) = call(
                    Request::get(format!("/v1/jobs/{id}"))
                        .body(Body::empty())
                        .unwrap(),
                )
                .await;
                let job: serde_json::Value = serde_json::from_slice(&job).unwrap();
                if ["succeeded", "failed", "canceled"].contains(&job["status"].as_str().unwrap()) {
                    return job;
                }
                tokio::time::sleep(Duration::from_millis(20)).await;
            }
        })
        .await
        .unwrap();
        (id, job)
    };

    let (id, job) = run(stereo_wav(2.0)).await;
    assert_eq!(job["status"], "succeeded", "{job}");
    assert_eq!(job["focus"], "guitar");
    let get = |path: String| call(Request::get(path).body(Body::empty()).unwrap());
    let (_, result) = get(format!("/v1/jobs/{id}/result")).await;
    let result: serde_json::Value = serde_json::from_slice(&result).unwrap();
    let analyzed = &result["analyzedAudio"];
    assert_eq!(result["focus"], "guitar");
    assert_eq!(analyzed["kind"], "guitar_stem");
    assert_ne!(analyzed["pcmSha256"], result["pcmSha256"]);
    assert_eq!(
        analyzed["separator"]["weightsSha256"],
        fretbloom_backend::separator::WEIGHTS_SHA256
    );
    // A copy-through separator must report the original's level, not FFmpeg's +3 dB downmix.
    assert!(
        analyzed["guitarLevelDb"].as_f64().unwrap().abs() < 0.1,
        "{analyzed}"
    );
    let (_, original) = get(format!("/v1/jobs/{id}/audio")).await;
    let (status, guitar) = get(format!("/v1/jobs/{id}/guitar-audio")).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(original.len(), guitar.len());
    let (x, y) = (wav_samples(&original), wav_samples(&guitar));
    let error: f64 = x.iter().zip(&y).map(|(a, b)| (a - b).powi(2)).sum();
    let signal: f64 = x.iter().map(|a| a * a).sum();
    assert!(
        10.0 * (signal / error).log10() > 40.0,
        "guitar preview drifted from the original"
    );

    let (id, job) = run(stereo_wav(1.0)).await;
    assert_eq!(job["status"], "failed");
    assert_eq!(job["error"]["code"], "SEPARATION_FAILED");
    let (status, _) = get(format!("/v1/jobs/{id}/result")).await;
    assert_eq!(status, StatusCode::CONFLICT);
    let id: uuid::Uuid = id.parse().unwrap();
    let dir = state.inner.lock().await.jobs[&id].dir.path().to_owned();
    assert!(
        std::fs::read_dir(dir).unwrap().next().is_none(),
        "failed job left files"
    );
    state.shutdown().await;
}
