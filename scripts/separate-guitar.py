"""Offline CPU guitar extraction. Only fixed-size WAV windows enter the model."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import sys
import wave

WEIGHTS_SHA256 = '34c22ccb381c6f9fdbf324f04e1e2fe21aaaf293f5ded163a162697ff9a02ddd'


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--weights', required=True)
    parser.add_argument('--check', action='store_true')
    parser.add_argument('--input')
    parser.add_argument('--output')
    parser.add_argument('--progress')
    parser.add_argument('--threads', type=int, default=2)
    args = parser.parse_args()
    # If the host runs out of memory, the kernel should stop this helper, not the web server.
    try:
        Path('/proc/self/oom_score_adj').write_text('1000')
    except OSError:
        pass
    # All model loading is local. Block Python network access as defense against library downloads.
    def offline(event, _args):
        if event in ("socket.connect", "socket.getaddrinfo", "socket.bind"):
            raise RuntimeError("Network access is disabled in the separator")
    sys.addaudithook(offline)
    os.environ['HF_HUB_OFFLINE'] = '1'
    path = Path(args.weights)
    if hashlib.sha256(path.read_bytes()).hexdigest() != WEIGHTS_SHA256:
        raise ValueError('Weights SHA256 mismatch')
    import numpy as np
    import torch
    from demucs.states import load_model
    from demucs.apply import apply_model
    from importlib.metadata import version
    torch.set_num_threads(args.threads)
    torch.set_num_interop_threads(1)
    torch.use_deterministic_algorithms(True)
    model = load_model(path).cpu().eval()
    if model.sources != ['drums', 'bass', 'other', 'vocals', 'guitar', 'piano']:
        raise ValueError('Unexpected model sources')
    identity = dict(model='htdemucs_6s', weightsSha256=WEIGHTS_SHA256,
                    package=f'demucs {version("demucs")}', runtime=f'torch {torch.__version__} cpu',
                    shifts=0, overlap=0.25)
    if args.check:
        print(json.dumps(identity))
        return
    def progress(fraction):
        Path(args.progress).write_text(json.dumps(dict(fraction=fraction)))
    with wave.open(args.input, 'rb') as source:
        if (source.getnchannels(), source.getsampwidth(), source.getframerate()) != (2, 2, 44100):
            raise ValueError('Expected 44.1 kHz stereo s16 WAV')
        count = source.getnframes()
        # Match Demucs' global mono-reference normalization with two bounded streaming passes.
        total = squares = 0.0
        while raw := source.readframes(44100):
            ref = np.frombuffer(raw, '<i2').astype(np.float64).reshape(-1, 2).mean(axis=1) / 32768
            total += ref.sum()
            squares += (ref * ref).sum()
        mean = total / count
        std = max(((squares - total * total / count) / max(1, count - 1)) ** 0.5, 1e-8)
        stride = int((1 - 0.25) * int(model.samplerate * model.segment))
        core = stride * 4
        context = stride * 2
        with wave.open(args.output, 'wb') as output:
            output.setparams((2, 2, 44100, count, 'NONE', 'not compressed'))
            progress(0)
            for start in range(0, count, core):
                end = min(count, start + core)
                left = max(0, start - context)
                right = min(count, end + context)
                source.setpos(left)
                pcm = np.frombuffer(source.readframes(right - left), '<i2').astype(np.float32).reshape(-1, 2).T / 32768
                mix = (torch.from_numpy(pcm.copy()) - mean) / std
                def callback(info):
                    if info['state'] == 'end':
                        offset = info['segment_offset']
                        done = min(end, left + offset + stride)
                        progress(min(0.999, max(start, done) / count))
                with torch.inference_mode():
                    stems = apply_model(model, mix[None], shifts=0, overlap=0.25,
                                        split=True, device='cpu', num_workers=0, callback=callback)
                    guitar = stems[0, model.sources.index('guitar'), :, start-left:end-left] * std + mean
                output.writeframes(np.round(guitar.T.numpy().clip(-1, 1) * 32767).astype('<i2').tobytes())
                del mix, stems, guitar
                progress(end / count)
    print(json.dumps(identity))


if __name__ == '__main__':
    main()
