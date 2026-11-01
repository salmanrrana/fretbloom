use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiError {
    pub code: String,
    pub message: String,
    pub retryable: bool,
}

#[derive(Debug, thiserror::Error)]
#[error("{0:?}")]
pub struct BackendError(pub ApiError);
impl BackendError {
    pub fn new(code: &str) -> Self {
        let (message, retryable) = match code {
            "SEPARATOR_UNAVAILABLE" => (
                "Guitar separation is unavailable. Choose full mix explicitly to continue.",
                false,
            ),
            "SEPARATION_FAILED" => (
                "Guitar separation failed. No full-mix analysis was substituted.",
                false,
            ),
            "SEPARATION_LIMIT" => (
                "Guitar separation exceeded its memory or disk limit.",
                false,
            ),
            "INVALID_REQUEST" => ("The analysis request is invalid.", false),
            "SOURCE_TOO_LARGE" => ("The source exceeds the byte limit.", false),
            "UNSUPPORTED_MEDIA" => ("This single-file audio format is not supported.", false),
            "DURATION_LIMIT" => ("The decoded audio exceeds the duration limit.", false),
            "DECODE_FAILED" => ("The audio could not be decoded completely.", false),
            "YOUTUBE_UNAVAILABLE" => (
                "This public YouTube audio is unavailable or restricted.",
                true,
            ),
            "QUEUE_FULL" => ("Analysis capacity is full. Try again shortly.", true),
            "TOOL_UNAVAILABLE" => ("A required media tool is unavailable.", true),
            "PROCESSING_TIMEOUT" => ("Audio processing exceeded its time limit.", true),
            "RESULT_TOO_COMPLEX" => ("The analysis exceeds the result size limit.", false),
            "JOB_NOT_FOUND" => ("The analysis job was not found or has expired.", false),
            "JOB_CANCELED" => ("The analysis job was canceled.", false),
            "JOB_FAILED" => ("The analysis job failed.", false),
            "NOT_READY" => ("The analysis is not ready.", true),
            _ => ("The analysis service is unavailable.", true),
        };
        Self(ApiError {
            code: code.into(),
            message: message.into(),
            retryable,
        })
    }
    pub fn status(&self) -> StatusCode {
        match self.0.code.as_str() {
            "SEPARATION_FAILED" => StatusCode::UNPROCESSABLE_ENTITY,
            "SEPARATION_LIMIT" => StatusCode::INSUFFICIENT_STORAGE,
            "INVALID_REQUEST" => StatusCode::BAD_REQUEST,
            "SOURCE_TOO_LARGE" | "RESULT_TOO_COMPLEX" => StatusCode::PAYLOAD_TOO_LARGE,
            "UNSUPPORTED_MEDIA" => StatusCode::UNSUPPORTED_MEDIA_TYPE,
            "DURATION_LIMIT" | "DECODE_FAILED" | "YOUTUBE_UNAVAILABLE" => {
                StatusCode::UNPROCESSABLE_ENTITY
            }
            "QUEUE_FULL" => StatusCode::TOO_MANY_REQUESTS,
            "PROCESSING_TIMEOUT" => StatusCode::GATEWAY_TIMEOUT,
            "JOB_NOT_FOUND" => StatusCode::NOT_FOUND,
            "JOB_CANCELED" | "JOB_FAILED" | "NOT_READY" => StatusCode::CONFLICT,
            _ => StatusCode::SERVICE_UNAVAILABLE,
        }
    }
}
impl From<std::io::Error> for BackendError {
    fn from(error: std::io::Error) -> Self {
        tracing::warn!(error = %error, "internal media I/O failure");
        Self::new("BACKEND_UNAVAILABLE")
    }
}
impl IntoResponse for BackendError {
    fn into_response(self) -> Response {
        let status = self.status();
        let mut response = (status, Json(serde_json::json!({"error": self.0}))).into_response();
        if status == StatusCode::TOO_MANY_REQUESTS {
            response
                .headers_mut()
                .insert("retry-after", "5".parse().unwrap());
        }
        response
    }
}
