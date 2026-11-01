"""Verify owned servers, subprocesses, job directories and containers are gone; never kill others."""
import hashlib,json,os,socket,subprocess
from pathlib import Path
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[1];RUN=HERE/'runs'
env=dict(PATH='/usr/local/bin:/usr/bin:/bin',HOME='/tmp',DOCKER_CONFIG=str(ROOT/'.tools/guitar-docker-config'))
processes=[]
for p in Path('/proc').iterdir():
    if not p.name.isdigit():continue
    try:
        args=(p/'cmdline').read_bytes().split(b'\0');first=os.fsdecode(args[0])
        owned=first==str(ROOT/'target/release/fretbloom-backend') or (str(ROOT/'scripts/separate-guitar.py').encode() in args)
        if Path(first).name=='node' and b'server/index.ts' in args and (p/'cwd').resolve()==ROOT:owned=True
        if owned:processes.append(int(p.name))
    except (OSError,IndexError):pass
containers=subprocess.check_output(['docker','ps','-a','--filter','name=fretbloom-guitar-','--format','{{.ID}} {{.Names}}'],cwd=ROOT,env=env,text=True).splitlines()
ports=json.loads((RUN/'browser.json').read_text())['ports'];free={}
for label,port in ports.items():
    s=socket.socket()
    try:s.bind(('127.0.0.1',port));free[label]=True
    except OSError:free[label]=False
    finally:s.close()
jobdirs=[str(p.relative_to(ROOT)) for p in RUN.rglob('job-*') if p.is_dir()]
branch=subprocess.check_output(['git','branch','--show-current'],cwd=ROOT,text=True).strip();head=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()
diff=subprocess.check_output(['git','diff','--name-only'],cwd=ROOT,text=True).splitlines()
forbidden=[p for p in diff if p.startswith(('crates/fretbloom-analysis/','src/audio/live/','src/generated/')) or p in ['src/audio/analysisV1.ts','docs/guitar-isolation-plan.md','docs/guitar-isolation-review.md']]
wasm=hashlib.sha256((ROOT/'src/generated/analysis-wasm/portable/fretbloom_wasm_bg.wasm').read_bytes()).hexdigest()
report=dict(passed=not processes and not containers and all(free.values()) and not jobdirs and not forbidden,remainingOwnedProcessIds=processes,remainingTaskContainers=containers,browserPorts=ports,browserPortsFree=free,remainingJobDirectories=jobdirs,branch=branch,head=head,forbiddenTrackedChanges=forbidden,portableWasmSha256=wasm,retainedImage='fretbloom-guitar-runtime:local',noCommitsPushesDeploymentCredentialsOrLiveDatabases=True)
(HERE/'cleanup.json').write_text(json.dumps(report,indent=2))
assert report['passed'],report
assert head=='a696d54809ee27b75679255a7f7a927e47de55c2' and branch=='feat/guitar-isolation'
assert wasm=='0f247f41bc86b6da7bd59a87399af2483b14f6eb32d7b27443b8d38699d84d3b'
print('Owned processes, ports, job directories and containers are clear; forbidden source and HEAD unchanged.')
