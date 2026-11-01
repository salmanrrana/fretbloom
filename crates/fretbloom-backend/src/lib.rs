pub mod api;
pub mod config;
pub mod error;
pub mod jobs;
pub mod media;
pub mod process;
pub mod separator;
pub mod youtube;
pub use config::Config;
pub use error::BackendError;
pub use jobs::AppState;

pub fn router(state: std::sync::Arc<AppState>) -> axum::Router {
    api::router(state)
}

pub async fn run(
    config: Config,
    shutdown: tokio_util::sync::CancellationToken,
) -> Result<(), BackendError> {
    config.validate()?;
    let listener = tokio::net::TcpListener::bind(config.listen).await?;
    let state = AppState::new(config).await?;
    let app = router(state.clone());
    let stopping = state.clone();
    axum::serve(listener, app)
        .with_graceful_shutdown(async move {
            shutdown.cancelled().await;
            stopping.inner.lock().await.stopping = true;
            stopping.shutdown_token.cancel();
        })
        .await?;
    state.shutdown().await;
    Ok(())
}
