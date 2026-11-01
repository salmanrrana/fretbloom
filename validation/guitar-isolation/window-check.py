"""Compare a short helper window with the independent unwindowed Demucs call, settings unchanged."""
import hashlib,json,os,resource,subprocess,time,wave
from pathlib import Path
import numpy as np
import torch
from demucs.states import load_model
from demucs.apply import apply_model
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[1];RUN=HERE/'runs'
weights=ROOT/'.tools/separator/5c90dfd2-34c22ccb.th'
input=RUN/'window-input.wav';output=RUN/'window-output.wav'
subprocess.run(['ffmpeg','-y','-v','error','-i',str(HERE/'source/00_SS3-84-Bb_comp-mix.wav'),'-t','30','-ac','2','-ar','44100','-c:a','pcm_s16le',str(input)],check=True)
start=time.monotonic()
subprocess.run([str(ROOT/'.tools/separator/bin/python'),'-I','-B',str(ROOT/'scripts/separate-guitar.py'),'--weights',str(weights),'--input',str(input),'--output',str(output),'--progress',str(RUN/'window-progress.json')],check=True)
# Release the helper entirely before loading the reference model.
torch.set_num_threads(2);torch.set_num_interop_threads(1);torch.use_deterministic_algorithms(True)
model=load_model(weights).cpu().eval()
with wave.open(str(input)) as w:pcm=np.frombuffer(w.readframes(w.getnframes()),'<i2').astype(np.float32).reshape(-1,2).T/32768
ref=pcm.astype(np.float64).mean(axis=0);mean=ref.mean();std=ref.std(ddof=1)
mix=(torch.from_numpy(pcm.copy())-mean)/std
with torch.inference_mode():
    stem=apply_model(model,mix[None],shifts=0,overlap=.25,split=True,num_workers=0,device='cpu')[0,model.sources.index('guitar')]*std+mean
expected=np.round(stem.T.numpy().clip(-1,1)*32767).astype('<i2').tobytes()
with wave.open(str(output)) as w:actual=w.readframes(w.getnframes())
assert actual==expected
# Byte equality implies zero lag and equal sample count, without a fitted alignment.
report=dict(passed=True,samples=len(actual)//4,lagSamples=0,expectedSha256=hashlib.sha256(expected).hexdigest(),actualSha256=hashlib.sha256(actual).hexdigest(),wallSeconds=time.monotonic()-start,peakRssKiB=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss)
(HERE/'window-check.json').write_text(json.dumps(report,indent=2))
