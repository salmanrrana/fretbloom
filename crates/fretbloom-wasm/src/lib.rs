//! Small wire bridge over the same native analysis engine.
use fretbloom_analysis::{analyze, AnalysisError, AnalysisOptions, ENGINE_VERSION, SAMPLE_RATE_HZ};
use serde::Serialize;
use wasm_bindgen::prelude::*;

// Raw numeric import lets JSPI suspend the existing cancellation checkpoints.
#[cfg(target_arch = "wasm32")]
#[link(wasm_import_module = "fretbloom_host")]
extern "C" {
    fn poll() -> i32;
}
fn host_cancelled() -> bool {
    #[cfg(target_arch = "wasm32")]
    {
        unsafe { poll() != 0 }
    }
    #[cfg(not(target_arch = "wasm32"))]
    {
        false
    }
}

const MAX_SAMPLES: usize = 7_200_000;
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct EngineInfo {
    bridge_version: u8,
    schema_version: u8,
    engine_version: &'static str,
    sample_rate_hz: u32,
    max_samples: usize,
}
#[wasm_bindgen]
pub fn engine_info_json() -> String {
    serde_json::to_string(&EngineInfo {
        bridge_version: 2,
        schema_version: 1,
        engine_version: ENGINE_VERSION,
        sample_rate_hz: SAMPLE_RATE_HZ,
        max_samples: MAX_SAMPLES,
    })
    .expect("engine info contains only constant serializable fields")
}
fn error(code: &str, message: &str) -> JsValue {
    JsValue::from_str(&serde_json::json!({"code": code, "message": message}).to_string())
}
fn validate(
    mono: &[f32],
    rate: u32,
    json: &str,
) -> Result<AnalysisOptions, (&'static str, &'static str)> {
    if mono.len() > MAX_SAMPLES || json.len() > 4096 {
        return Err((
            "LIMIT_EXCEEDED",
            "PCM or options exceed the local analysis limit",
        ));
    }
    if mono.is_empty() || rate != SAMPLE_RATE_HZ || mono.iter().any(|x| !x.is_finite()) {
        return Err((
            "INVALID_INPUT",
            "Expected finite nonempty mono PCM at 24000 Hz",
        ));
    }
    let options: AnalysisOptions =
        serde_json::from_str(json).map_err(|_| ("INVALID_INPUT", "Invalid analysis options"))?;
    if !options.concert_a_hz.is_finite() || !(432.0..=446.0).contains(&options.concert_a_hz) {
        return Err(("INVALID_INPUT", "Concert A must be 432..446 Hz"));
    }
    Ok(options)
}
#[wasm_bindgen]
pub fn analyze_pcm_json(
    mono: &[f32],
    sample_rate_hz: u32,
    options_json: &str,
) -> Result<String, JsValue> {
    let options = validate(mono, sample_rate_hz, options_json).map_err(|(c, m)| error(c, m))?;
    // The first checkpoint polls immediately; subsequent host crossings occur at most
    // 64 engine checks apart. The JS host still schedules tasks at its 50 ms budget.
    // AtomicU32 satisfies the engine's Sync callback type. This instance is unshared;
    // the portable non-atomics WASM target lowers it to ordinary loads/stores.
    #[cfg(target_arch = "wasm32")]
    let checks = std::sync::atomic::AtomicU32::new(0);
    let cancelled = || {
        #[cfg(target_arch = "wasm32")]
        {
            checks.fetch_add(1, std::sync::atomic::Ordering::Relaxed) & 63 == 0 && host_cancelled()
        }
        #[cfg(not(target_arch = "wasm32"))]
        {
            host_cancelled()
        }
    };
    let output =
        analyze(mono, sample_rate_hz, &options, &cancelled, &mut |_| {}).map_err(|e| match e {
            AnalysisError::InvalidInput(_) => error("INVALID_INPUT", "Invalid analysis input"),
            AnalysisError::LimitExceeded(_) => error("LIMIT_EXCEEDED", "Analysis limit exceeded"),
            AnalysisError::Cancelled => error("CANCELED", "Analysis canceled"),
        })?;
    serde_json::to_string(&output)
        .map_err(|_| error("SERIALIZATION_FAILED", "Could not serialize analysis"))
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn strict_input_contract() {
        let options = r#"{"mode":"auto","concertAHz":440,"spelling":"sharps"}"#;
        assert!(validate(&[0.0], 24_000, options).is_ok());
        assert!(validate(&[], 24_000, options).is_err());
        assert!(validate(&[f32::NAN], 24_000, options).is_err());
        assert!(validate(&[0.0], 48_000, options).is_err());
        assert!(validate(&[0.0], 24_000, r#"{"mode":"auto"}"#).is_err());
        assert!(validate(&[0.0], 24_000, &options.replace("440", "447")).is_err());
    }
}
