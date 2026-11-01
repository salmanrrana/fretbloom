"""Run the real six-minute job in a non-root, networkless, resource-limited runtime container."""
import json,subprocess,time
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];HERE=ROOT/'validation/guitar-isolation';RUN=HERE/'runs'
env=dict(PATH='/usr/local/bin:/usr/bin:/bin',HOME='/tmp',DOCKER_CONFIG=str(ROOT/'.tools/guitar-docker-config'))
def command(args):return subprocess.check_output(['docker',*args],env=env,cwd=ROOT,text=True).strip()
container=None
try:
    image=json.loads(command(['image','inspect','fretbloom-guitar-runtime:local']))[0]
    args=['run','-d','--name','fretbloom-guitar-offline','--network','none','--cpus','2','--memory','2560m','--mount',f'type=bind,source={HERE}/source,target=/input,readonly','--mount',f'type=bind,source={HERE}/container-job.mjs,target=/container-job.mjs,readonly','-e','FRETBLOOM_ANALYSIS_PORT=53147','-e','FRETBLOOM_ANALYSIS_TEMP_ROOT=/tmp/guitar-jobs','-e',f'FRETBLOOM_SEPARATOR_MAX_RSS={2*1024**3}','fretbloom-guitar-runtime:local','/app/target/release/fretbloom-backend']
    container=command(args)
    (RUN/'container-id').write_text(container)
    command(['exec',container,'node','-e',"(async()=>{for(let i=0;i<600;i++){try{const r=await fetch('http://127.0.0.1:53147/v1/capabilities');if(r.ok){const c=await r.json();if(!c.separation.available)throw Error(JSON.stringify(c));console.log(JSON.stringify(c));return}}catch{}await new Promise(r=>setTimeout(r,100))}process.exit(1)})()"])
    def cpu():return dict(line.split() for line in command(['exec',container,'cat','/sys/fs/cgroup/cpu.stat']).splitlines())
    before=int(cpu()['usage_usec'])
    start=time.monotonic()
    with (RUN/'container-job.log').open('w') as out:
        subprocess.run(['docker','exec',container,'node','/container-job.mjs'],env=env,cwd=ROOT,stdout=out,stderr=subprocess.STDOUT,check=True)
    elapsed=time.monotonic()-start
    after=int(cpu()['usage_usec'])
    peak=int(command(['exec',container,'cat','/sys/fs/cgroup/memory.peak']))
    result=json.loads((RUN/'container-job.log').read_text())
    assert result['passed'] and result['uid']!=0
    summary=dict(passed=True,command=['docker',*args],containerId=container,imageId=image['Id'],imageSizeBytes=image['Size'],user=image['Config']['User'],uid=result['uid'],network='none',cpus=2,memoryLimitBytes=2560*1024**2,helperRssLimitBytes=2*1024**3,wallSeconds=result['wallSeconds'],execWallSeconds=elapsed,cpuSeconds=(after-before)/1e6,peakCgroupMemoryBytes=peak,peakJobDiskBytes=result['peakDiskBytes'],inputSha256=result['inputSha256'],pcmSha256=result['pcmSha256'],analyzedAudio=result['analyzedAudio'],previewSha256=result['previewSha256'])
    (HERE/'container-summary.json').write_text(json.dumps(summary,indent=2))
    print(json.dumps(summary,indent=2),flush=True)
finally:
    if container:
        (RUN/'container.stderr').write_text(command(['logs',container]))
        command(['rm','-f',container])
