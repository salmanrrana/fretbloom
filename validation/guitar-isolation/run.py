"""Sequential real backend jobs, raw artifacts, resource sampling and frozen-metric scoring."""
import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import socket
import subprocess
import sys
import threading
import time
import urllib.request
import wave
import numpy as np
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
RUN=HERE/'runs'
RUN.mkdir(exist_ok=True)
sha=lambda b:hashlib.sha256(b).hexdigest()
sys.dont_write_bytecode = True
sys.path.insert(0,str(ROOT/'validation/real-audio'))
from score import identity, active, prf

def score(case, result):
    counts=dict(frames=0,rootCorrect=0,rootFrames=0,majorMinorCorrect=0,majorMinorFrames=0,noChord=0,unknown=0,noteTp=0,notePred=0,noteRef=0)
    for i in range(math.ceil(result['duration']/.02)):
        t=min((i+.5)*.02,result['duration']-1e-9)
        e=next(e for e in result['harmony'] if e['start']<=t<e['end'])
        pred=e['primary']['chord'] if e['kind']=='chord' else None
        ref=next((c for c in case['chords']['performed'] if c['start']<=t<c['end']),None)
        chord=identity(ref['label']) if ref else None
        counts['frames']+=1
        counts['noChord']+=e['kind']=='no_chord'
        counts['unknown']+=e['kind']=='unknown'
        if chord:
            counts['rootFrames']+=1
            counts['rootCorrect']+=bool(pred and pred['rootPc']==chord['root'])
            if chord['quality'] in ('maj','min'):
                counts['majorMinorFrames']+=1
                counts['majorMinorCorrect']+=bool(pred and pred['rootPc']==chord['root'] and pred['quality']==chord['quality'])
        notes=active(case['notes'],t)
        detected=active(result['monophonicNotes']+result['polyphonicNotes'],t)
        counts['noteTp']+=len(notes&detected);counts['notePred']+=len(detected);counts['noteRef']+=len(notes)
    return counts

def decoded(path):
    return np.frombuffer(subprocess.check_output(['ffmpeg','-v','error','-i',str(path),'-ac','1','-ar','24000','-f','f32le','pipe:1']),'<f4').astype(np.float64)

def sisdr(reference, estimate):
    assert len(reference)==len(estimate)
    r=reference-reference.mean();e=estimate-estimate.mean()
    target=r*np.dot(e,r)/np.dot(r,r)
    return float(10*np.log10((np.dot(target,target)+1e-30)/(np.dot(e-target,e-target)+1e-30)))

class Backend:
    def __init__(self, origin=None):
        self.process=None
        self.peak=0;self.disk=0;self.stop=False;self.cpu={}
        if origin: self.origin=origin;return
        s=socket.socket();s.bind(('127.0.0.1',0));port=s.getsockname()[1];s.close()
        self.origin=f'http://127.0.0.1:{port}'
        temp=RUN/'backend-temp';temp.mkdir(exist_ok=True)
        env=dict(PATH=str(ROOT/'.tools/ffmpeg/bin')+':/home/xtra/.local/bin:/usr/bin:/bin',FRETBLOOM_ANALYSIS_PORT=str(port),FRETBLOOM_ANALYSIS_TEMP_ROOT=str(temp))
        self.log=open(RUN/'backend.stderr','wb')
        self.process=subprocess.Popen(['/usr/bin/time','-v','-o',str(RUN/'backend.time'),str(ROOT/'target/release/fretbloom-backend')],cwd=ROOT,env=env,stdout=self.log,stderr=self.log)
        self.thread=threading.Thread(target=self.monitor,args=(temp,),daemon=True);self.thread.start()
        for _ in range(600):
            try:
                self.api('/capabilities');return
            except Exception:
                if self.process.poll() is not None: raise RuntimeError('Backend exited; see backend.stderr')
                time.sleep(.1)
        raise RuntimeError('Backend startup timeout')
    def monitor(self,temp):
        while not self.stop:
            stats={}
            for p in Path('/proc').iterdir():
                if not p.name.isdigit():continue
                try:
                    fields=(p/'stat').read_text().rsplit(') ',1)[1].split()
                    stats[int(p.name)]=(int(fields[1]),int(fields[21])*4096, (int(fields[11])+int(fields[12]))/os.sysconf('SC_CLK_TCK'))
                except (OSError,ValueError,IndexError):pass
            tree={self.process.pid}
            while True:
                more={pid for pid,(parent,_,_) in stats.items() if parent in tree}
                if more<=tree:break
                tree|=more
            self.peak=max(self.peak,sum(stats[p][1] for p in tree if p in stats))
            for pid in tree:
                if pid in stats:self.cpu[pid]=max(self.cpu.get(pid,0),stats[pid][2])
            self.disk=max(self.disk,sum(p.stat().st_size for p in temp.rglob('*') if p.is_file()))
            time.sleep(.2)
    def api(self,path,body=None,method=None):
        data=json.dumps(body).encode() if body is not None else None
        req=urllib.request.Request(self.origin+'/v1'+path,data=data,method=method,headers={'Content-Type':'application/json'})
        with urllib.request.urlopen(req,timeout=30) as r:return json.load(r)
    def job(self,path,focus,name):
        raw=path.read_bytes()
        started=time.monotonic()
        self.peak=0;self.disk=0;cpu_start=sum(self.cpu.values())
        job=self.api('/jobs',dict(source=dict(kind='upload',name=path.name,byteLength=len(raw),contentType='audio/wav'),focus=focus))
        id=job['id'];base='/jobs/'+id
        request=urllib.request.Request(self.origin+'/v1'+base+'/media',data=raw,method='PUT',headers={'Content-Type':'application/octet-stream'})
        with urllib.request.urlopen(request,timeout=125) as r:json.load(r)
        stages=[]
        while True:
            j=self.api(base)
            stage=dict(status=j['status'],fraction=j['progress']['fraction'],seconds=time.monotonic()-started)
            stages.append(stage)
            if j['status'] in ('failed','canceled','succeeded'):break
            time.sleep(.5)
        if j['status']!='succeeded':raise RuntimeError(j)
        result=self.api(base+'/result')
        (RUN/(name+'.json')).write_text(json.dumps(result))
        for artifact in ['audio']+(['guitar-audio'] if focus=='guitar' else []):
            with urllib.request.urlopen(self.origin+'/v1'+base+'/'+artifact) as r: data=r.read()
            (RUN/(name+'-'+artifact+'.wav')).write_bytes(data)
        elapsed=time.monotonic()-started
        record=dict(name=name,inputSha256=sha(raw),focus=focus,wallSeconds=elapsed,cpuSeconds=sum(self.cpu.values())-cpu_start,peakTreeRssBytes=self.peak,peakJobDiskBytes=self.disk,stages=stages,resultSha256=sha((RUN/(name+'.json')).read_bytes()),analyzedAudio=result['analyzedAudio'],pcmSha256=result['pcmSha256'])
        (RUN/(name+'-run.json')).write_text(json.dumps(record,indent=2))
        self.api(base,method='DELETE')
        return result,record
    def close(self):
        if self.process:
            # time is only a wrapper: signal its direct backend child, never unrelated processes.
            children=Path(f'/proc/{self.process.pid}/task/{self.process.pid}/children').read_text().split()
            for pid in children:os.kill(int(pid),15)
            self.process.wait(timeout=15)
            self.stop=True;self.thread.join();self.log.close()

def main():
    p=argparse.ArgumentParser();p.add_argument('--long',action='store_true');p.add_argument('--origin');a=p.parse_args()
    fixtures=json.loads((HERE/'fixtures.json').read_text())
    backend=Backend(a.origin)
    report=[]
    try:
        capability=backend.api('/capabilities');assert capability['separation']['available'],capability
        (HERE/'capability.json').write_text(json.dumps(capability,indent=2))
        if a.long:
            _,record=backend.job(HERE/'source/six-minute.wav','guitar','six-minute'+('-container' if a.origin else '-local'))
            report.append({k:v for k,v in record.items() if k != 'stages'})
        else:
            for case in fixtures['cases']:
                for condition,focus,source in [('full_mix','full_mix','mix'),('separated_guitar','guitar','mix'),('clean_guitar','full_mix','clean'),('negative','guitar','negative')]:
                    name=case['id']+'-'+condition
                    result,record=backend.job(HERE/'source'/(case['id']+'-'+source+'.wav'),focus,name)
                    record['scores']=score({**case, 'notes':[], 'chords':{'performed':[]}} if condition=='negative' else case,result['analysis'])
                    if condition in ('full_mix','separated_guitar'):
                        estimate=decoded(RUN/(name+('-guitar-audio.wav' if focus=='guitar' else '-audio.wav')))
                        record['siSdrDb']=sisdr(decoded(HERE/'source'/(case['id']+'-clean.wav')),estimate)
                    report.append({k:v for k,v in record.items() if k != 'stages'})
                    (HERE/'evaluation.json').write_text(json.dumps(report,indent=2))
            case=fixtures['cases'][0]
            result,record=backend.job(HERE/'source'/(case['id']+'-mix.wav'),'guitar','determinism-repeat')
            record['matchesAnalyzedHash']=record['analyzedAudio']['pcmSha256']==next(r for r in report if r['name']==case['id']+'-separated_guitar')['analyzedAudio']['pcmSha256']
            report.append({k:v for k,v in record.items() if k != 'stages'})
        (HERE/('long-container.json' if a.long and a.origin else 'long-local.json' if a.long else 'evaluation.json')).write_text(json.dumps(report,indent=2))
    finally:backend.close()

if __name__=='__main__':main()
