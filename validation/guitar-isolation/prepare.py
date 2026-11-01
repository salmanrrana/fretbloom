"""Build the predeclared DEV mixtures without consulting recognizer predictions."""
import hashlib
import json
from pathlib import Path
import shutil
import wave
import numpy as np
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
SOURCE = HERE / 'source'
SOURCE.mkdir(exist_ok=True)
sha = lambda b: hashlib.sha256(b).hexdigest()
prior = ROOT / 'validation/real-audio'
manifest_bytes = (prior/'manifest.json').read_bytes()
assert sha(manifest_bytes) == json.loads((prior/'corpus-lock.json').read_text())['manifest_sha256']
manifest = json.loads(manifest_bytes)
plan = json.loads((HERE/'predeclared.json').read_text())
selected = ['00_SS3-84-Bb_comp', '01_Jazz3-150-C_comp']
output = []
for name in selected:
    case = next(c for c in manifest['cases'] if c['id']==name)
    assert case['split']=='dev'
    for path,key in [('path','wav_sha256'),('annotation_path','annotation_sha256')]:
        assert sha((prior/case[path]).read_bytes())==case[key]
        shutil.copyfile(prior/case[path], SOURCE/Path(case[path]).name)
    with wave.open(str(prior/case['path'])) as w:
        assert w.getframerate()==44100 and w.getsampwidth()==2
        clean = np.frombuffer(w.readframes(w.getnframes()), '<i2').astype(np.float64)/32768
    rate=44100
    t=np.arange(len(clean))/rate
    rng=np.random.default_rng(20261101)
    roots=np.take([48,45,41,43],(t//4).astype(int)%4)
    # Self-authored accompaniment. No soundfont, samples or external instrument recordings.
    def tone(midi): return np.sin(2*np.pi*(440*2**((midi-69)/12))*t)
    bass=(tone(roots-12)+.2*tone(roots))*np.exp(-3*(t%0.5))
    keys=sum(tone(roots+delta) for delta in [0,4,7,12])*np.exp(-6*(t%0.5))*.3
    lead=np.sin(2*np.pi*440*2**((roots+19-69)/12)*t+.08*np.sin(2*np.pi*5*t))*.25
    beat=t%0.5
    drums=(rng.standard_normal(len(t))*np.exp(-70*beat)+tone(np.full(len(t),36))*np.exp(-35*beat))*.3
    accompaniment=bass+keys+lead+drums
    accompaniment *= np.sqrt(np.mean(clean**2)/np.mean(accompaniment**2))
    scale=.9/max(np.max(np.abs(clean+accompaniment)),np.max(np.abs(accompaniment)),np.max(np.abs(clean)))
    for condition,pcm in [('clean',clean*scale),('mix',(clean+accompaniment)*scale),('negative',accompaniment*scale)]:
        path=SOURCE/(name+'-'+condition+'.wav')
        with wave.open(str(path),'wb') as w:
            w.setparams((1,2,rate,len(pcm),'NONE','not compressed'))
            w.writeframes(np.round(pcm*32767).astype('<i2').tobytes())
        case[condition+'Sha256']=sha(path.read_bytes())
    output.append(case)
# Long input has real acoustic guitar in its repeated full mixture.
with wave.open(str(SOURCE/(selected[0]+'-mix.wav')),'rb') as w: pcm=w.readframes(w.getnframes())
pcm=(pcm*((360*44100*2)//len(pcm)+1))[:360*44100*2]
with wave.open(str(SOURCE/'six-minute.wav'),'wb') as w:
    w.setparams((1,2,44100,360*44100,'NONE','not compressed'));w.writeframes(pcm)
report=dict(predeclaredSha256=sha((HERE/'predeclared.json').read_bytes()), cases=output, sixMinuteSha256=sha((SOURCE/'six-minute.wav').read_bytes()), accompanimentLicense='CC0-1.0', datasetLicense='CC-BY-4.0', datasetAttribution='Qingyang Xi, Rachel M. Bittner, Johan Pauwels, Xuzhou Ye, Juan P. Bello. GuitarSet 1.1.0, DOI 10.5281/zenodo.3371780. Rescaled and mixed with generated accompaniment.')
(HERE/'fixtures.json').write_text(json.dumps(report,indent=2)+'\n')
print('Prepared 2 DEV fixtures and 360-second repetition; no inference.')
