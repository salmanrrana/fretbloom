use crate::{
    jobs::{Focus, Job, Progress, Source, Status},
    AppState, BackendError,
};
use axum::{
    body::{to_bytes, Body},
    extract::{Path, Request, State},
    http::{HeaderMap, Method, StatusCode},
    response::{IntoResponse, Response},
    routing::{get, post, put},
    Json, Router,
};
use fretbloom_analysis::{
    chord_vocabulary, AnalysisMode, AnalysisOptions, Spelling, ENGINE_VERSION,
};
use http_body_util::BodyExt;
use serde::Deserialize;
use std::{sync::Arc, time::Instant};
use tokio::io::{AsyncReadExt, AsyncSeekExt, AsyncWriteExt};
use tokio_util::{io::ReaderStream, sync::CancellationToken};
use uuid::Uuid;

pub fn router(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/v1/capabilities", get(capabilities))
        .route("/v1/jobs", post(create))
        .route("/v1/jobs/{id}", get(status).delete(cancel))
        .route("/v1/jobs/{id}/media", put(upload))
        .route("/v1/jobs/{id}/result", get(result))
        .route("/v1/jobs/{id}/features", get(features))
        .route("/v1/jobs/{id}/audio", get(audio))
        .route("/v1/jobs/{id}/guitar-audio", get(guitar_audio))
        .fallback(|| async { BackendError::new("INVALID_REQUEST") })
        .layer(axum::middleware::map_response(
            |mut response: Response| async move {
                response
                    .headers_mut()
                    .insert("cache-control", "private, no-store".parse().unwrap());
                response
                    .headers_mut()
                    .insert("x-content-type-options", "nosniff".parse().unwrap());
                response
            },
        ))
        .with_state(state)
}
async fn capabilities(State(state): State<Arc<AppState>>) -> Json<serde_json::Value> {
    Json(
        serde_json::json!({"schemaVersion":1,"engineVersion":ENGINE_VERSION,"modes":["auto","monophonic","polyphonic"],"qualities":chord_vocabulary().iter().map(|t|t.quality).collect::<Vec<_>>(),"limits":{"maxSourceBytes":state.config.max_source_bytes,"maxDurationSeconds":state.config.max_duration_seconds},"uploads":true,"youtube":true,"separation":state.separation}),
    )
}
#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct PartialOptions {
    mode: Option<AnalysisMode>,
    concert_a_hz: Option<f64>,
    spelling: Option<Spelling>,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Create {
    source: Source,
    #[serde(default)]
    focus: Focus,
    #[serde(default)]
    options: PartialOptions,
}
async fn create(
    State(state): State<Arc<AppState>>,
    request: Request,
) -> Result<Response, BackendError> {
    if request
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .is_none_or(|v| v.split(';').next() != Some("application/json"))
    {
        return Err(BackendError::new("INVALID_REQUEST"));
    }
    let bytes = to_bytes(request.into_body(), 16 * 1024)
        .await
        .map_err(|_| BackendError::new("INVALID_REQUEST"))?;
    let input: Create =
        serde_json::from_slice(&bytes).map_err(|_| BackendError::new("INVALID_REQUEST"))?;
    let defaults = AnalysisOptions::default();
    let job = state
        .create_focused(
            input.source,
            AnalysisOptions {
                mode: input.options.mode.unwrap_or(defaults.mode),
                concert_a_hz: input.options.concert_a_hz.unwrap_or(defaults.concert_a_hz),
                spelling: input.options.spelling.unwrap_or(defaults.spelling),
            },
            input.focus,
        )
        .await?;
    let location = format!("/api/analysis/v1/jobs/{}", job.id);
    Ok((StatusCode::ACCEPTED, [("location", location)], Json(job)).into_response())
}
fn id(raw: &str) -> Result<Uuid, BackendError> {
    Uuid::parse_str(raw)
        .ok()
        .filter(|id| id.get_version_num() == 4)
        .ok_or_else(|| BackendError::new("INVALID_REQUEST"))
}
async fn status(
    State(s): State<Arc<AppState>>,
    Path(raw): Path<String>,
) -> Result<Json<Job>, BackendError> {
    Ok(Json(s.get(id(&raw)?, true).await?))
}
async fn cancel(
    State(s): State<Arc<AppState>>,
    Path(raw): Path<String>,
) -> Result<Response, BackendError> {
    Ok((StatusCode::ACCEPTED, Json(s.cancel(id(&raw)?).await?)).into_response())
}
struct UploadGuard(Option<CancellationToken>);
impl Drop for UploadGuard {
    fn drop(&mut self) {
        if let Some(token) = &self.0 {
            token.cancel();
        }
    }
}
async fn upload(
    State(s): State<Arc<AppState>>,
    Path(raw): Path<String>,
    request: Request,
) -> Result<Response, BackendError> {
    let id = id(&raw)?;
    let (dir, token, expected) = {
        let mut inner = s.inner.lock().await;
        let r = inner
            .jobs
            .get_mut(&id)
            .ok_or_else(|| BackendError::new("JOB_NOT_FOUND"))?;
        if r.job.status != Status::AwaitingUpload || r.busy {
            return Err(BackendError::new("NOT_READY"));
        }
        let Source::Upload { byte_length, .. } = r.job.source else {
            return Err(BackendError::new("INVALID_REQUEST"));
        };
        if let Some(length) = request.headers().get("content-length") {
            let n = length
                .to_str()
                .ok()
                .and_then(|s| s.parse::<u64>().ok())
                .ok_or_else(|| BackendError::new("INVALID_REQUEST"))?;
            if n > s.config.max_source_bytes {
                return Err(BackendError::new("SOURCE_TOO_LARGE"));
            }
            if n != byte_length {
                return Err(BackendError::new("INVALID_REQUEST"));
            }
        }
        r.busy = true;
        r.lease = Instant::now();
        r.job.progress = Progress {
            stage: "uploading".into(),
            fraction: Some(0.0),
        };
        (r.dir.path().to_owned(), r.cancel.clone(), byte_length)
    };
    let mut guard = UploadGuard(Some(token.clone()));
    let operation = async {
        let mut file = tokio::fs::File::create(dir.join("source.bin")).await?;
        let mut body = request.into_body();
        let mut count = 0_u64;
        loop {
            let frame = tokio::select! {
                _=token.cancelled()=>return Err(BackendError::new("JOB_CANCELED")),
                result=tokio::time::timeout(s.config.upload_idle_timeout,body.frame())=>result.map_err(|_|BackendError::new("PROCESSING_TIMEOUT"))?,
            };
            let Some(frame) = frame else {
                break;
            };
            let frame = frame.map_err(|_| BackendError::new("JOB_CANCELED"))?;
            if let Ok(bytes) = frame.into_data() {
                count += bytes.len() as u64;
                if count > s.config.max_source_bytes {
                    return Err(BackendError::new("SOURCE_TOO_LARGE"));
                }
                if count > expected {
                    return Err(BackendError::new("INVALID_REQUEST"));
                }
                file.write_all(&bytes).await?;
                if let Some(r) = s.inner.lock().await.jobs.get_mut(&id) {
                    if !r.job.status.terminal() {
                        r.job.progress.fraction = Some(count as f64 / expected as f64);
                    }
                }
            }
        }
        if count != expected {
            return Err(BackendError::new("INVALID_REQUEST"));
        }
        file.flush().await?;
        Ok(())
    };
    let outcome = tokio::time::timeout(s.config.upload_timeout, operation)
        .await
        .unwrap_or_else(|_| Err(BackendError::new("PROCESSING_TIMEOUT")));
    if let Err(error) = outcome {
        token.cancel();
        s.fail(id, BackendError(error.0.clone())).await;
        if let Some(r) = s.inner.lock().await.jobs.get_mut(&id) {
            r.busy = false;
        }
        s.notify.notify_one();
        return Err(error);
    }
    guard.0 = None;
    let mut inner = s.inner.lock().await;
    let r = inner
        .jobs
        .get_mut(&id)
        .ok_or_else(|| BackendError::new("JOB_NOT_FOUND"))?;
    r.busy = false;
    if token.is_cancelled() || r.job.status.terminal() {
        return Err(BackendError::new("JOB_CANCELED"));
    }
    r.job.status = Status::Queued;
    r.job.progress = Progress {
        stage: "queued".into(),
        fraction: None,
    };
    r.lease = Instant::now();
    r.queued_at = Instant::now();
    let job = r.job.clone();
    inner.queue.push_back(id);
    drop(inner);
    s.notify.notify_one();
    Ok((StatusCode::ACCEPTED, Json(job)).into_response())
}
fn ready(status: Status) -> Result<(), BackendError> {
    match status {
        Status::Succeeded => Ok(()),
        Status::Failed => Err(BackendError::new("JOB_FAILED")),
        Status::Canceled => Err(BackendError::new("JOB_CANCELED")),
        _ => Err(BackendError::new("NOT_READY")),
    }
}
async fn json_artifact(
    s: Arc<AppState>,
    id: Uuid,
    features: bool,
) -> Result<Response, BackendError> {
    let inner = s.inner.lock().await;
    let r = inner
        .jobs
        .get(&id)
        .ok_or_else(|| BackendError::new("JOB_NOT_FOUND"))?;
    ready(r.job.status)?;
    let data = if features { &r.features } else { &r.result };
    let data = data
        .as_ref()
        .ok_or_else(|| BackendError::new("NOT_READY"))?;
    Ok((
        [("content-type", "application/json; charset=utf-8")],
        data.as_ref().clone(),
    )
        .into_response())
}
async fn result(
    State(s): State<Arc<AppState>>,
    Path(raw): Path<String>,
) -> Result<Response, BackendError> {
    json_artifact(s, id(&raw)?, false).await
}
async fn features(
    State(s): State<Arc<AppState>>,
    Path(raw): Path<String>,
) -> Result<Response, BackendError> {
    json_artifact(s, id(&raw)?, true).await
}

pub fn byte_range(value: &str, size: u64) -> Option<(u64, u64)> {
    let (start, end) = value.strip_prefix("bytes=")?.split_once('-')?;
    if size == 0
        || value.contains(',')
        || !start.bytes().all(|b| b.is_ascii_digit())
        || !end.bytes().all(|b| b.is_ascii_digit())
    {
        return None;
    }
    if start.is_empty() {
        let suffix = end.parse::<u64>().ok()?;
        if suffix == 0 {
            return None;
        }
        return Some((size.saturating_sub(suffix), size - 1));
    }
    let start = start.parse::<u64>().ok()?;
    let end = if end.is_empty() {
        size - 1
    } else {
        end.parse::<u64>().ok()?.min(size - 1)
    };
    if start >= size || end < start {
        None
    } else {
        Some((start, end))
    }
}
async fn audio(
    State(s): State<Arc<AppState>>,
    Path(raw): Path<String>,
    method: Method,
    headers: HeaderMap,
) -> Result<Response, BackendError> {
    audio_artifact(s, raw, method, headers, false).await
}
async fn guitar_audio(
    State(s): State<Arc<AppState>>,
    Path(raw): Path<String>,
    method: Method,
    headers: HeaderMap,
) -> Result<Response, BackendError> {
    audio_artifact(s, raw, method, headers, true).await
}
async fn audio_artifact(
    s: Arc<AppState>,
    raw: String,
    method: Method,
    headers: HeaderMap,
    guitar: bool,
) -> Result<Response, BackendError> {
    let id = id(&raw)?;
    // Open while holding the record lock; expiry cannot race the open. Existing reads keep their file descriptor.
    let mut file = {
        let inner = s.inner.lock().await;
        let r = inner
            .jobs
            .get(&id)
            .ok_or_else(|| BackendError::new("JOB_NOT_FOUND"))?;
        ready(r.job.status)?;
        if guitar && r.job.focus != Focus::Guitar {
            return Err(BackendError::new("INVALID_REQUEST"));
        }
        tokio::fs::File::open(
            r.dir
                .path()
                .join(if guitar { "guitar.wav" } else { "playback.wav" }),
        )
        .await?
    };
    let size = file.metadata().await?.len();
    let range = if let Some(raw) = headers.get("range") {
        match raw.to_str().ok().and_then(|v| byte_range(v, size)) {
            Some(r) => Some(r),
            None => {
                return Ok((
                    StatusCode::RANGE_NOT_SATISFIABLE,
                    [("content-range", format!("bytes */{size}"))],
                    Body::empty(),
                )
                    .into_response())
            }
        }
    } else {
        None
    };
    let (start, end) = range.unwrap_or((0, size - 1));
    let length = end - start + 1;
    file.seek(std::io::SeekFrom::Start(start)).await?;
    let body = if method == Method::HEAD {
        Body::empty()
    } else {
        Body::from_stream(ReaderStream::new(file.take(length)))
    };
    let mut response = (
        if range.is_some() {
            StatusCode::PARTIAL_CONTENT
        } else {
            StatusCode::OK
        },
        body,
    )
        .into_response();
    let h = response.headers_mut();
    h.insert("content-type", "audio/wav".parse().unwrap());
    h.insert("accept-ranges", "bytes".parse().unwrap());
    h.insert("content-length", length.into());
    if range.is_some() {
        h.insert(
            "content-range",
            format!("bytes {start}-{end}/{size}").parse().unwrap(),
        );
    }
    Ok(response)
}
