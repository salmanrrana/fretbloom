"""Finish targeted acceptance serially after the inherited final-proof process exits."""
import json
import subprocess
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HERE = ROOT / 'validation/guitar-isolation'
RUN = HERE / 'runs'
PYTHON = str(ROOT / '.tools/separator/bin/python')
NODE = str(ROOT / '.tools/node-v24.22.2-linux-x64/bin/node')
RUST = '/home/xtra/.rustup/toolchains/1.89.0-x86_64-unknown-linux-gnu/bin'
env = dict(PATH=str(Path(NODE).parent) + ':' + str(ROOT / '.tools/ffmpeg/bin') +
           ':/home/xtra/.cargo/bin:/usr/local/bin:/usr/bin:/bin',
           HOME='/home/xtra', OMP_NUM_THREADS='2', OPENBLAS_NUM_THREADS='2')
proof = json.loads((HERE / 'final-proof.json').read_text())
assert len(proof) == 8 and all(x['exitCode'] == 0 for x in proof)
commands = [
    ([NODE, 'e2e-guitar-focus.mjs'], 'browser-closeout.log'),
    ([PYTHON, str(HERE / 'window-check.py')], 'window-closeout.log'),
    ([PYTHON, str(HERE / 'alignment-formats.py'), str(ROOT), str(RUN / 'alignment-formats')], 'alignment-formats.json'),
    ([PYTHON, str(HERE / 'alignment-control.py')], 'alignment-closeout.log'),
    ([RUST + '/cargo', 'fmt', '-p', 'fretbloom-backend', '--check'], 'rustfmt-closeout.log'),
]
report = []
for command, name in commands:
    start = time.monotonic()
    with (RUN / name).open('w') as out, (RUN / (name + '.stderr')).open('w') as err:
        result = subprocess.run(command, cwd=ROOT, env=env, stdout=out, stderr=err)
    report.append(dict(command=command, exitCode=result.returncode,
                       wallSeconds=time.monotonic() - start,
                       log=str((RUN / name).relative_to(ROOT))))
    (HERE / 'takeover-checks.json').write_text(json.dumps(report, indent=2) + '\n')
    print(name, result.returncode, flush=True)
    if result.returncode:
        raise SystemExit(result.returncode)
