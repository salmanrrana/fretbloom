"""Run heavy verification commands sequentially and retain exit codes/logs."""
import json,os,subprocess,time
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];HERE=ROOT/'validation/guitar-isolation'
node=str(ROOT/'.tools/node-v24.22.2-linux-x64/bin')
rust='/home/xtra/.rustup/toolchains/1.89.0-x86_64-unknown-linux-gnu/bin'
env=dict(PATH=node+':/home/xtra/.cargo/bin:'+str(ROOT/'.tools/ffmpeg/bin')+':/usr/bin:/bin',HOME='/home/xtra',RUSTC=rust+'/rustc',FRETBLOOM_CARGO=rust+'/cargo')
commands=[['npm','run','check:fast'],['npm','run','build'],[rust+'/cargo','test','--release','-p','fretbloom-backend'],[rust+'/cargo','build','--release','--workspace'],[rust+'/cargo','clippy','-p','fretbloom-backend','--all-targets','--','-D','warnings']]
report=[]
for i,command in enumerate(commands):
    start=time.monotonic();log=HERE/f'check-{i+1}.log'
    with log.open('wb') as f:r=subprocess.run(command,cwd=ROOT,env=env,stdout=f,stderr=f)
    report.append(dict(command=command,exitCode=r.returncode,wallSeconds=time.monotonic()-start,log=str(log.relative_to(ROOT))))
    (HERE/'checks.json').write_text(json.dumps(report,indent=2))
    print(command,r.returncode,flush=True)
