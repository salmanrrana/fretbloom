"""Run final-code acceptance evidence sequentially; never overlap builds and inference."""
import hashlib,json,shutil,subprocess,time
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];HERE=ROOT/'validation/guitar-isolation';RUN=HERE/'runs';PYTHON=str(ROOT/'.tools/separator/bin/python');NODE=str(ROOT/'.tools/node-v24.22.2-linux-x64/bin/node')
env=dict(PATH=str(ROOT/'.tools/node-v24.22.2-linux-x64/bin')+':'+str(ROOT/'.tools/ffmpeg/bin')+':/usr/local/bin:/usr/bin:/bin',HOME='/home/xtra',DOCKER_CONFIG=str(ROOT/'.tools/guitar-docker-config'),OMP_NUM_THREADS='2',OPENBLAS_NUM_THREADS='2')
archive=RUN/'before-parent-exit-fix';archive.mkdir(exist_ok=True)
for name in ['evaluation.json','long-local.json','identities.json']:
    if (HERE/name).exists():shutil.copyfile(HERE/name,archive/name)
identity=json.loads((HERE/'identities.json').read_text());identity['backendBinarySha256']=hashlib.sha256((ROOT/'target/release/fretbloom-backend').read_bytes()).hexdigest();identity['backendSources']={str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted((ROOT/'crates/fretbloom-backend/src').glob('*.rs'))};(HERE/'identities.json').write_text(json.dumps(identity,indent=2))
commands=[([PYTHON,str(HERE/'failure-controls.py')],'failure-controls.log'),([NODE,'e2e-guitar-focus.mjs'],'browser.log'),([PYTHON,str(HERE/'run.py')],'evaluation.log'),([PYTHON,str(HERE/'observations.py')],'observations.log'),([PYTHON,str(HERE/'run.py'),'--long'],'long-local.log'),(['docker','buildx','build','--builder','fretbloom-guitar-builder','--no-cache','--load','--progress=plain','--tag','fretbloom-guitar-runtime:local','--metadata-file',str(RUN/'build-metadata.json'),'.'],'docker-build.log'),(['docker','buildx','rm','fretbloom-guitar-builder'],'builder-cleanup.log'),(['/usr/bin/python3',str(HERE/'container-proof.py')],'container-proof.log')]
report=[]
for command,name in commands:
    if name=='docker-build.log':
        (ROOT/'.tools/guitar-docker-config').mkdir(parents=True,exist_ok=True)
        exists=subprocess.run(['docker','buildx','inspect','fretbloom-guitar-builder'],cwd=ROOT,env=env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode==0
        if not exists:subprocess.run(['docker','buildx','create','--name','fretbloom-guitar-builder','--driver','docker-container','--buildkitd-config',str(HERE/'buildkit.toml')],cwd=ROOT,env=env,check=True)
    start=time.monotonic();print('Starting',name,flush=True)
    with (RUN/name).open('wb') as f:r=subprocess.run(command,cwd=ROOT,env=env,stdout=f,stderr=f)
    if name in ['evaluation.log','long-local.log'] and r.returncode==0:shutil.copyfile(RUN/'backend.time',RUN/('evaluation.time' if name=='evaluation.log' else 'six-minute-local.time'))
    report.append(dict(command=command,exitCode=r.returncode,wallSeconds=time.monotonic()-start,log='validation/guitar-isolation/runs/'+name));(HERE/'final-proof.json').write_text(json.dumps(report,indent=2));print('Finished',name,r.returncode,flush=True)
    if r.returncode:raise SystemExit(r.returncode)
