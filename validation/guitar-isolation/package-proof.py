"""Sequential final checks and a fresh, isolated, serial BuildKit build."""
import json,subprocess,time
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];HERE=ROOT/'validation/guitar-isolation';RUN=HERE/'runs'
node=str(ROOT/'.tools/node-v24.22.2-linux-x64/bin')
env=dict(PATH=node+':/home/xtra/.cargo/bin:'+str(ROOT/'.tools/ffmpeg/bin')+':/usr/local/bin:/usr/bin:/bin',HOME='/home/xtra',DOCKER_CONFIG=str(ROOT/'.tools/guitar-docker-config'))
commands=[(['npm','run','check:fast'],'check-fast-final.log'),(['npm','run','setup:separator'],'setup-final.log'),(['docker','buildx','create','--name','fretbloom-guitar-builder','--driver','docker-container','--buildkitd-config',str(HERE/'buildkit.toml')],'builder-create.log'),(['docker','buildx','build','--builder','fretbloom-guitar-builder','--no-cache','--load','--progress=plain','--tag','fretbloom-guitar-runtime:local','--metadata-file',str(RUN/'build-metadata.json'),'.'],'docker-build.log')]
report=[]
for command,name in commands:
    start=time.monotonic()
    with (RUN/name).open('wb') as f:r=subprocess.run(command,cwd=ROOT,env=env,stdout=f,stderr=f)
    report.append(dict(command=command,exitCode=r.returncode,wallSeconds=time.monotonic()-start,log='validation/guitar-isolation/runs/'+name))
    (HERE/'packaging-checks.json').write_text(json.dumps(report,indent=2))
    print(command,r.returncode,flush=True)
    if r.returncode:raise SystemExit(r.returncode)
