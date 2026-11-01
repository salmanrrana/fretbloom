"""Lead review: identity-stub alignment for 48 kHz WAV and Opus sources (no model inference)."""
import json, socket, subprocess, sys, time, urllib.request, wave
from pathlib import Path
import numpy as np
ROOT = Path(sys.argv[1]); OUT = Path(sys.argv[2]); OUT.mkdir(parents=True, exist_ok=True)
identity = json.loads((ROOT/'validation/guitar-isolation/capability.json').read_text())['separation']['separator']
helper = OUT/'identity-helper.py'
helper.write_text("import sys,json,pathlib,shutil\n"+f"identity={identity!r}\n"+"if '--check' not in sys.argv:\n shutil.copyfile('separator-input.wav','separator-stem.wav')\n pathlib.Path('separator-progress.json').write_text('{\"fraction\":1}')\nprint(json.dumps(identity))\n")
rate = 48000; n = rate*6; t = np.arange(n)/rate
rng = np.random.default_rng(7)
sig = np.zeros((n, 2))
for k, c in enumerate([0.5, 1.25, 2.0, 3.3, 4.7]):
    i = int(c*rate); sig[i:i+48, :] += np.hanning(48)[:, None]*0.8*(1 if k % 2 else -1)
pluck = np.exp(-6*(t % 1.5))*np.sin(2*np.pi*196*t)*0.3
sig[:, 0] += pluck; sig[:, 1] += 0.6*pluck + 0.05*rng.standard_normal(n)
wav = OUT/'src48.wav'
with wave.open(str(wav), 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(rate)
    w.writeframes((np.clip(sig, -1, 1)*32767).astype('<i2').tobytes())
mono = OUT/'mono44.wav'
with wave.open(str(mono), 'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(44100)
    w.writeframes((np.clip(sig[::1, 0][:int(6*44100)], -1, 1)*32767).astype('<i2').tobytes())
cancel = OUT/'cancel48.wav'
with wave.open(str(cancel), 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(rate)
    st = np.stack([sig[:, 0], -0.9*sig[:, 0]], axis=1)
    w.writeframes((np.clip(st, -1, 1)*32767).astype('<i2').tobytes())
ff = str(ROOT/'.tools/ffmpeg/bin/ffmpeg')
opus = OUT/'src48.webm'
subprocess.run([ff, '-y', '-loglevel', 'error', '-i', str(wav), '-c:a', 'libopus', '-b:a', '128k', str(opus)], check=True)
mp3 = OUT/'src44.mp3'
subprocess.run([ff, '-y', '-loglevel', 'error', '-i', str(wav), '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', '192k', str(mp3)], check=True)
sock = socket.socket(); sock.bind(('127.0.0.1', 0)); port = sock.getsockname()[1]; sock.close()
origin = f'http://127.0.0.1:{port}/v1'
def api(path, data=None, method=None, ctype='application/json'):
    req = urllib.request.Request(origin+path, data=data, method=method, headers={'Content-Type': ctype})
    with urllib.request.urlopen(req, timeout=30) as r: return r.read()
def js(path, data=None, method=None): return json.loads(api(path, json.dumps(data).encode() if data else None, method))
env = dict(PATH=str(ROOT/'.tools/ffmpeg/bin')+':/usr/bin:/bin', FRETBLOOM_ANALYSIS_PORT=str(port),
           FRETBLOOM_ANALYSIS_TEMP_ROOT=str(OUT/'temp'), FRETBLOOM_SEPARATOR_PYTHON='/usr/bin/python3',
           FRETBLOOM_SEPARATOR_HELPER=str(helper))
def frac_lag(x, y):
    m = 1 << (2*len(x)-1).bit_length()
    c = np.fft.irfft(np.fft.rfft(y, m)*np.conj(np.fft.rfft(x, m)), m)
    p = int(np.argmax(c)); a, b, d = c[p-1], c[p], c[(p+1) % m]
    off = 0.5*(a-d)/(a-2*b+d); lag = p if p <= m//2 else p-m
    return lag + off
report = {}
log = (OUT/'backend.log').open('wb')
child = subprocess.Popen([str(ROOT/'target/release/fretbloom-backend')], cwd=ROOT, env=env, stdout=log, stderr=log)
try:
    for _ in range(200):
        try: cap = js('/capabilities'); break
        except OSError: time.sleep(.05)
    assert cap['separation']['available'], cap
    for src in [wav, opus, mp3, mono, cancel]:
        raw = src.read_bytes()
        job = js('/jobs', dict(source=dict(kind='upload', name=src.name, byteLength=len(raw), contentType='audio/x'), focus='guitar'))
        path = '/jobs/'+job['id']; api(path+'/media', raw, 'PUT', 'application/octet-stream')
        for _ in range(3000):
            job = js(path)
            if job['status'] in ('succeeded', 'failed', 'canceled'): break
            time.sleep(.01)
        assert job['status'] == 'succeeded', job
        arr = []
        for art in ('audio', 'guitar-audio'):
            p = OUT/f'{src.stem}-{art}.wav'; p.write_bytes(api(path+'/'+art))
            with wave.open(str(p)) as w: arr.append(np.frombuffer(w.readframes(w.getnframes()), '<i2').astype(np.float64))
        x, y = arr
        lag = frac_lag(x, y)
        g = float(np.dot(x, y)/np.dot(x, x)); resid = y - g*x
        snr = 10*np.log10(np.sum((g*x)**2)/max(np.sum(resid**2), 1e-12))
        report[src.name] = dict(samples=[len(x), len(y)], fractionalLagSamplesAt24k=round(float(lag), 4), gain=round(g, 4), residualSnrDb=round(float(snr), 2))
        js(path, method='DELETE')
finally:
    child.terminate(); child.wait(timeout=10)
for result in report.values():
    assert result['samples'][0] == result['samples'][1]
    assert abs(result['fractionalLagSamplesAt24k']) < 0.05, result
    assert abs(result['gain'] - 1) < 0.001, result
    assert result['residualSnrDb'] > 60, result
print(json.dumps(report, indent=2))
