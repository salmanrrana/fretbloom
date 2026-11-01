"""Real backend failure controls with a disposable helper; no production or model changes."""
import json,os,socket,subprocess,time,urllib.request,urllib.error
from pathlib import Path
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[1];RUN=HERE/'runs'
identity=json.loads((HERE/'capability.json').read_text())['separation']['separator']
helper=RUN/'failure-helper.py'
source=(HERE/'source/01_Jazz3-150-C_comp-mix.wav').read_bytes()
report=[]

def api(origin,path,body=None,method=None,raw=None):
    req=urllib.request.Request(origin+'/v1'+path,data=raw if raw is not None else json.dumps(body).encode() if body else None,method=method,headers={'Content-Type':'application/json'})
    try:
        with urllib.request.urlopen(req,timeout=30) as r:return r.status,json.load(r)
    except urllib.error.HTTPError as e:return e.code,json.load(e)

for mode in ['wrong_hash','exit','bad_output','alignment','memory','disk','cancel','killed']:
    helper.write_text("import sys,json,pathlib,subprocess,time\n"+f"identity={identity!r}\n"+"if '--check' in sys.argv:\n print(json.dumps(identity));sys.exit(0)\n"+
        ("sys.exit(7)\n" if mode=='exit' else
         "pathlib.Path('separator-stem.wav').write_bytes(b'not a wav')\nprint(json.dumps(identity))\n" if mode=='bad_output' else
         "import wave\nw=wave.open('separator-stem.wav','wb');w.setparams((2,2,44100,44100,'NONE','not compressed'));w.writeframes(bytes(44100*4));w.close()\nprint(json.dumps(identity))\n" if mode=='alignment' else
         "a=bytearray(100*1024*1024);time.sleep(60)\n" if mode=='memory' else
         "pathlib.Path('oversized').write_bytes(bytes(520*1024*1024))\ntime.sleep(60)\n" if mode=='disk' else
         "child=subprocess.Popen(['/usr/bin/sleep','60']);pathlib.Path('grandchild.pid').write_text(str(child.pid));time.sleep(60)\n"))
    sock=socket.socket();sock.bind(('127.0.0.1',0));port=sock.getsockname()[1];sock.close();origin=f'http://127.0.0.1:{port}'
    temp=RUN/('failure-'+mode);temp.mkdir(exist_ok=True)
    env=dict(PATH=str(ROOT/'.tools/ffmpeg/bin')+':/usr/bin:/bin',FRETBLOOM_ANALYSIS_PORT=str(port),FRETBLOOM_ANALYSIS_TEMP_ROOT=str(temp),FRETBLOOM_SEPARATOR_PYTHON='/usr/bin/python3',FRETBLOOM_SEPARATOR_HELPER=str(helper))
    if mode=='wrong_hash':
        wrong=RUN/'wrong-weights.th';wrong.write_bytes(b'wrong weights');env['FRETBLOOM_SEPARATOR_WEIGHTS']=str(wrong)
    if mode=='memory':env['FRETBLOOM_SEPARATOR_MAX_RSS']=str(40*1024*1024)
    with (RUN/('failure-'+mode+'.log')).open('wb') as log:
        child=subprocess.Popen([str(ROOT/'target/release/fretbloom-backend')],env=env,cwd=ROOT,stdout=log,stderr=log)
        try:
            for _ in range(100):
                try:_,cap=api(origin,'/capabilities');break
                except OSError:time.sleep(.05)
            code,job=api(origin,'/jobs',dict(source=dict(kind='upload',name='dev.wav',contentType='audio/wav',byteLength=len(source)),focus='guitar'))
            if mode=='wrong_hash':
                assert not cap['separation']['available'] and code==503 and job['error']['code']=='SEPARATOR_UNAVAILABLE'
                report.append(dict(mode=mode,passed=True,error=job['error']));continue
            assert code==202,(code,job)
            id=job['id'];path='/jobs/'+id
            api(origin,path+'/media',method='PUT',raw=source)
            stages=[];grandchild=None;jobdir=None
            for _ in range(400):
                _,job=api(origin,path);stages.append(job['status'])
                if mode in ['cancel','killed'] and grandchild is None:
                    matches=list(temp.rglob('grandchild.pid'))
                    if matches:
                        jobdir=matches[0].parent;grandchild=int(matches[0].read_text())
                        if mode=='cancel':api(origin,path,method='DELETE')
                        else:
                            helper_pid=int(Path('/proc/'+str(grandchild)+'/stat').read_text().rsplit(') ',1)[1].split()[1])
                            assert Path('/proc/'+str(helper_pid)+'/cwd').resolve()==jobdir.resolve()
                            os.kill(helper_pid,9)
                if job['status'] in ['failed','canceled']:break
                time.sleep(.05)
            expected='JOB_CANCELED' if mode=='cancel' else 'SEPARATION_LIMIT' if mode in ['memory','disk'] else 'SEPARATION_FAILED'
            assert job['error']['code']==expected,job
            if mode in ['cancel','killed']:
                for _ in range(100):
                    if not list(jobdir.iterdir()) and not Path('/proc/'+str(grandchild)).exists():break
                    time.sleep(.05)
                assert not list(jobdir.iterdir()) and not Path('/proc/'+str(grandchild)).exists()
            report.append(dict(mode=mode,passed=True,error=job['error'],stages=stages,grandchild=grandchild,cleaned=mode in ['cancel','killed']))
        finally:
            child.terminate();child.wait(timeout=10)
(HERE/'failure-controls.json').write_text(json.dumps(report,indent=2))
print('All eight backend failure/cancellation controls passed')
