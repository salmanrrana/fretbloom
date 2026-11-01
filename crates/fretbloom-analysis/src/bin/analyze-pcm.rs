use clap::Parser;
use fretbloom_analysis::*;
use std::{
    io::{Read, Write},
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
};
#[derive(Parser)]
#[command(about = "Analyze raw mono little-endian float32 PCM; diagnostics use stderr")]
struct Args {
    #[arg(long)]
    input: PathBuf,
    #[arg(long, default_value_t = 24000)]
    sample_rate: u32,
    #[arg(long,default_value="auto",value_parser=["auto","monophonic","polyphonic"])]
    mode: String,
    #[arg(long, default_value_t = 440.0)]
    concert_a_hz: f64,
    #[arg(long,default_value="sharps",value_parser=["sharps","flats"])]
    spelling: String,
    #[arg(long)]
    output: PathBuf,
}
fn run(args: Args, cancel: Arc<AtomicBool>) -> Result<(), (i32, String)> {
    let fail = |e: std::io::Error| (2, e.to_string());
    let file = std::fs::File::open(&args.input).map_err(fail)?;
    let len = file.metadata().map_err(fail)?.len();
    if len == 0 || len % 4 != 0 {
        return Err((2, "input must contain complete f32le samples".into()));
    }
    if len > 57_600_000 {
        return Err((3, "PCM exceeds 600 seconds".into()));
    }
    let mut bytes = Vec::new();
    file.take(57_600_004)
        .read_to_end(&mut bytes)
        .map_err(fail)?;
    if bytes.len() as u64 != len {
        return Err((2, "PCM size changed while reading".into()));
    }
    let mono: Vec<f32> = bytes
        .chunks_exact(4)
        .map(|b| f32::from_le_bytes([b[0], b[1], b[2], b[3]]))
        .collect();
    drop(bytes);
    let options = AnalysisOptions {
        mode: match args.mode.as_str() {
            "monophonic" => AnalysisMode::Monophonic,
            "polyphonic" => AnalysisMode::Polyphonic,
            _ => AnalysisMode::Auto,
        },
        concert_a_hz: args.concert_a_hz,
        spelling: if args.spelling == "flats" {
            Spelling::Flats
        } else {
            Spelling::Sharps
        },
    };
    let output = analyze(
        &mono,
        args.sample_rate,
        &options,
        &|| cancel.load(Ordering::Relaxed),
        &mut |_| {},
    )
    .map_err(|e| {
        let code = match e {
            AnalysisError::InvalidInput(_) => 2,
            AnalysisError::LimitExceeded(_) => 3,
            AnalysisError::Cancelled => 130,
        };
        (code, e.to_string())
    })?;
    let json = serde_json::to_vec(&output).map_err(|e| (3, e.to_string()))?;
    if cancel.load(Ordering::Relaxed) {
        return Err((130, "cancelled".into()));
    }
    // Write beside the destination and rename only complete results.
    let temp = args
        .output
        .with_extension(format!("json.{}.tmp", std::process::id()));
    let publish = (|| -> std::io::Result<()> {
        let mut f = std::fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temp)?;
        f.write_all(&json)?;
        f.write_all(b"\n")?;
        f.flush()?;
        if cancel.load(Ordering::Relaxed) {
            return Err(std::io::Error::new(
                std::io::ErrorKind::Interrupted,
                "cancelled",
            ));
        }
        std::fs::rename(&temp, &args.output)
    })();
    if let Err(e) = publish {
        let _ = std::fs::remove_file(&temp);
        return Err((
            if cancel.load(Ordering::Relaxed) {
                130
            } else {
                3
            },
            e.to_string(),
        ));
    }
    Ok(())
}
fn main() {
    let args = Args::parse();
    let cancel = Arc::new(AtomicBool::new(false));
    let flag = cancel.clone();
    if let Err(e) = ctrlc::set_handler(move || {
        flag.store(true, Ordering::Relaxed);
    }) {
        eprintln!("could not install cancellation handler: {e}");
        std::process::exit(3);
    }
    if let Err((code, message)) = run(args, cancel) {
        eprintln!("{message}");
        std::process::exit(code);
    }
}
