"""Exercise the complete backend with an identity separator, checking zero lag and equal playback length."""
import hashlib,json,os,socket,subprocess,time,urllib.request,wave
from pathlib import Path
import numpy as np
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[1];RUN=HERE/'runs'
identity=json.loads((HERE/'capability.json').read_text())['separation']['separator']
helper=RUN/'identity-helper.py'
helper.write_text("import sys,json,pathlib,shutil\n"+f"identity={identity!r}\n"+"if '--check' not in sys.argv:\n shutil.copyfile('separator-input.wav','separator-stem.wav')\n pathlib.Path('separator-progress.json').write_text('{\"fraction\":1}')\nprint(json.dumps(identity))\n")
source=RUN/'identity-input.wav'
with wave.open(str(HERE/'source/01_Jazz3-150-C_comp-mix.wav')) as w:
    params=w.getparams();raw=w.readframes(4*44100)
with wave.open(str(source),'wb') as w:w.setparams(params);w.writeframes(raw)
raw=source.read_bytes();sock=socket.socket();sock.bind(('127.0.0.1',0));port=sock.getsockname()[1];sock.close()
origin=f'http://127.0.0.1:{port}/v1'
def api(path,data=None,method=None):
    req=urllib.request.Request(origin+path,data=data,method=method,headers={'Content-Type':'application/json'})
    with urllib.request.urlopen(req,timeout=30) as r:return r.read()
def js(path,data=None,method=None):return json.loads(api(path,json.dumps(data).encode() if data else None,method))
env=dict(PATH=str(ROOT/'.tools/ffmpeg/bin')+':/usr/bin:/bin',FRETBLOOM_ANALYSIS_PORT=str(port),FRETBLOOM_ANALYSIS_TEMP_ROOT=str(RUN/'identity-temp'),FRETBLOOM_SEPARATOR_PYTHON='/usr/bin/python3',FRETBLOOM_SEPARATOR_HELPER=str(helper))
with (RUN/'identity-backend.log').open('wb') as log:
    child=subprocess.Popen([str(ROOT/'target/release/fretbloom-backend')],cwd=ROOT,env=env,stdout=log,stderr=log)
    try:
        for _ in range(100):
            try:cap=js('/capabilities');break
            except OSError:time.sleep(.05)
        assert cap['separation']['available']
        job=js('/jobs',dict(source=dict(kind='upload',name=source.name,byteLength=len(raw),contentType='audio/wav'),focus='guitar'))
        path='/jobs/'+job['id'];json.loads(api(path+'/media',raw,'PUT'));stages=[]
        for _ in range(400):
            job=js(path);stages.append(job['status'])
            if job['status'] in ['succeeded','failed','canceled']:break
            time.sleep(.001)
        assert job['status']=='succeeded',job
        arrays=[]
        for artifact in ['audio','guitar-audio']:
            data=api(path+'/'+artifact);p=RUN/('identity-'+artifact+'.wav');p.write_bytes(data)
            with wave.open(str(p)) as w:
                assert w.getframerate()==24000 and w.getnchannels()==1
                arrays.append(np.frombuffer(w.readframes(w.getnframes()),'<i2').astype(np.float64))
        x,y=arrays;assert len(x)==len(y)==96000
        n=1<<(2*len(x)-1).bit_length();correlation=np.fft.irfft(np.fft.rfft(y,n)*np.conj(np.fft.rfft(x,n)),n)
        peak=int(np.argmax(correlation));lag=peak if peak<=n//2 else peak-n
        assert lag==0,lag
        assert 'separating' in stages and 'analyzing' in stages and stages.index('separating')<stages.index('analyzing')
        result=js(path+'/result')
        report=dict(passed=True,separator='identity validation stub, not real inference',samples=len(x),lagSamples=lag,stages=stages,originalPcmSha256=result['pcmSha256'],analyzedPcmSha256=result['analyzedAudio']['pcmSha256'],originalPreviewSha256=hashlib.sha256((RUN/'identity-audio.wav').read_bytes()).hexdigest(),guitarPreviewSha256=hashlib.sha256((RUN/'identity-guitar-audio.wav').read_bytes()).hexdigest())
        (HERE/'alignment-control.json').write_text(json.dumps(report,indent=2))
        print('Identity separator: equal 96000-sample previews, zero lag, correct stage order')
    finally:child.terminate();child.wait(timeout=10)
