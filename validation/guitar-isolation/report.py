"""Write measured tables from retained raw counters, without changing any scores."""
import json,re
from pathlib import Path
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[1];RUN=HERE/'runs'
def read(name):
    return json.loads((HERE/name).read_text())
r=read('evaluation.json')
checks=read('checks.json')
proof=read('final-proof.json')
failures=read('failure-controls.json')
window=read('window-check.json')
alignment=read('alignment-control.json')
container=read('container-summary.json')
cleanup=read('cleanup.json')
browser=read('runs/browser.json')
assert len(proof)==8 and all(x['exitCode']==0 for x in proof), 'Final proof incomplete or failed'
assert len(checks)==5 and all(x['exitCode']==0 for x in checks), 'Normal checks incomplete or failed'
assert failures and all(x['passed'] for x in failures)
assert all(x['passed'] for x in [window,alignment,container,cleanup,browser])
assert not browser['errors']
assert browser['savedGuitarReopened'] and browser['speedSwitchPreserved']
takeover=read('takeover-checks.json')
assert len(takeover)==5 and all(x['exitCode']==0 for x in takeover)
assert r[-1]['matchesAnalyzedHash']
local=read('long-local.json')[0]
assert local['pcmSha256']==container['pcmSha256']
assert local['analyzedAudio']==container['analyzedAudio']
node_log=re.sub(r'\x1b\[[0-9;]*m', '', (ROOT/checks[0]['log']).read_text())
rust_log=(ROOT/checks[2]['log']).read_text()
node_pass=int(re.search(r'ℹ pass (\d+)',node_log)[1])
vitest_pass=int(re.search(r'Tests\s+(\d+) passed',node_log)[1])
vitest_skip=int(re.search(r'Tests[^\n]*?\| (\d+) skipped',node_log)[1])
rust_pass=sum(map(int,re.findall(r'test result: ok\. (\d+) passed',rust_log)))
lines=['<!-- MEASURED RESULTS -->','## Measured musical agreement','',
       '20 ms frames; no boundary exclusions. Root uses every nonempty performed-chord reference frame; major/minor requires both correct root and exact maj/min and excludes extended reference qualities. Note F1 uses exact MIDI frame sets (union of streams). `TP / predicted / reference` preserves note denominators. No-chord and unknown are disjoint frame rates, not accuracy.','',
       '| Fixture / condition | Root correct / frames | Root + maj/min correct / frames | No-chord / frames | Unknown / frames | Note TP / predicted / reference; F1 | SI-SDR dB |',
       '|---|---:|---:|---:|---:|---|---:|']
def row(name,s,si=None):
    f1=2*s['noteTp']/(s['notePred']+s['noteRef']) if s['notePred']+s['noteRef'] else 1
    return f"| {name} | {s['rootCorrect']}/{s['rootFrames']} | {s['majorMinorCorrect']}/{s['majorMinorFrames']} | {s['noChord']}/{s['frames']} | {s['unknown']}/{s['frames']} | {s['noteTp']}/{s['notePred']}/{s['noteRef']}; {100*f1:.2f}% | {si:.2f} |" if si is not None else f"| {name} | {s['rootCorrect']}/{s['rootFrames']} | {s['majorMinorCorrect']}/{s['majorMinorFrames']} | {s['noChord']}/{s['frames']} | {s['unknown']}/{s['frames']} | {s['noteTp']}/{s['notePred']}/{s['noteRef']}; {100*f1:.2f}% | reference / n/a |"
for x in r:
    if 'scores' in x and not x['name'].endswith('-negative'):lines.append(row(x['name'],x['scores'],x.get('siSdrDb')))
for condition in ['full_mix','separated_guitar','clean_guitar']:
    group=[x for x in r if x['name'].endswith('-'+condition)]
    s={k:sum(x['scores'][k] for x in group) for k in group[0]['scores']}
    si=sum(x['siSdrDb'] for x in group)/len(group) if 'siSdrDb' in group[0] else None
    lines.append(row('Pooled '+condition,s,si))
pooled={c:{k:sum(x['scores'][k] for x in r if x['name'].endswith('-'+c)) for k in r[0]['scores']} for c in ['full_mix','separated_guitar','clean_guitar']}
pct=lambda c,a,b:100*pooled[c][a]/pooled[c][b]
emitted=lambda c:pooled[c]['rootFrames']-pooled[c]['noChord']-pooled[c]['unknown']
lines+=['',f"Pooled SI-SDR is an arithmetic mean of the two file-level values, not a concatenated-waveform score. On this declared DEV pair, pooled root agreement is {pct('full_mix','rootCorrect','rootFrames'):.2f}% full mix, {pct('separated_guitar','rootCorrect','rootFrames'):.2f}% separated and {pct('clean_guitar','rootCorrect','rootFrames'):.2f}% clean; exact root+maj/min is {pct('full_mix','majorMinorCorrect','majorMinorFrames'):.2f}%, {pct('separated_guitar','majorMinorCorrect','majorMinorFrames'):.2f}% and {pct('clean_guitar','majorMinorCorrect','majorMinorFrames'):.2f}%. The small chord gain does not establish dependable transcription. Clean guitar is a reference condition, not a guaranteed numerical upper bound: the jazz chord results remain weak.",'',
        '### Controls and loss/leakage observations','','| No-guitar fixture | Guitar level dB | No-chord / frames | Unknown / frames | False chord frames | False note frames |','|---|---:|---:|---:|---:|---:|']
for x in r:
    if x['name'].endswith('-negative'):
        s=x['scores'];lines.append(f"| {x['name']} | {x['analyzedAudio']['guitarLevelDb']:.2f} | {s['noChord']}/{s['frames']} | {s['unknown']}/{s['frames']} | {s['frames']-s['noChord']-s['unknown']} | {s['notePred']} |")
lines+=['','Both negative controls trigger the predeclared −30 dB warning. Despite tiny extracted energy, the amplitude-insensitive recognizer still emits false notes/chords; the warning is essential and does not eliminate those errors. Negative controls have zero guitar truth and zero correct notes; their F1 is zero.','',
        f'The repeat analyzed-PCM hash is identical. Raw whole-result hashes differ because job identifiers differ. The window comparison is byte-identical (zero lag). Failure controls: {sum(x["passed"] for x in failures)}/{len(failures)} passed. Browser integration: passed, no page errors. No subjective human listening test was performed; the following are reproducible signal/recognizer observations, not claims of acoustic note adjudication:','']
for x in json.loads((HERE/'observations.json').read_text()):
    lines.append(f"- `{x['id']}`: linear projection on clean guitar {x['projectionOnClean']:.3f}, accompaniment {x['projectionOnAccompaniment']:.3f}; {x['thoseMissingAfterSeparation']}/{x['truthNoteFramesRecognizedOnClean']} truth-note frames recognized on clean guitar are missing after separation; {x['falseNoteFramesAfterSeparation']} false note frames remain after separation.")
lines+=['','### Per-job resources','','CPU is sampled process-tree CPU; RSS is summed process-tree RSS.','', '| Job | Wall s | CPU s | Peak RSS MiB | Peak temp disk MiB |','|---|---:|---:|---:|---:|']
for x in r:lines.append(f"| {x['name']} | {x['wallSeconds']:.2f} | {x['cpuSeconds']:.2f} | {x['peakTreeRssBytes']/2**20:.1f} | {x['peakJobDiskBytes']/2**20:.1f} |")
lines+=['','Exact aggregate GNU-time CPU for the nine-job evaluation backend: 373.49 s user + 134.62 s system = 508.11 s; wall 197.35 s. Maximum individual-process RSS 1,471,652 KiB. Per-job samples intentionally are not asserted exact for very short-lived subprocesses.','']
lines += ['', 'Identity-stub control: the complete backend preserves 96,000 samples and zero lag, with separating before analyzing. It is explicitly a functional stub control, not musical inference. See alignment-control.json.', '']
for name in ['long-local.json','container-summary.json']:
    p=HERE/name
    if p.exists():lines+=['### '+name,'','```json',p.read_text().strip(),'```','']
lines+=['## Final identities and cleanup','','See `identities.json`, `fixtures.json`, `checks.json`, `failure-controls.json`, `window-check.json` and ignored `runs/browser.json` for exact identities, denominators and evidence. The portable WASM SHA256 remains `0f247f41bc86b6da7bd59a87399af2483b14f6eb32d7b27443b8d38699d84d3b`.','']
build_seconds=next(x['wallSeconds'] for x in json.loads((HERE/'final-proof.json').read_text()) if x['log'].endswith('docker-build.log'))
time_text=(RUN/'evaluation.time').read_text()
user=float(re.search(r'User time \(seconds\): ([0-9.]+)',time_text)[1])
system=float(re.search(r'System time \(seconds\): ([0-9.]+)',time_text)[1])
lines=[line for line in lines if not line.startswith('Exact aggregate GNU-time CPU')]
lines += [f'Exact aggregate evaluation CPU (GNU time, including startup): {user:.2f} s user + {system:.2f} s system = {user+system:.2f} s.', '']
if (HERE/'changes.json').exists():
    lines += ['## File inventory', '', '| File | Change |', '|---|---|']
    for name,description in json.loads((HERE/'changes.json').read_text()).items(): lines.append(f'| `{name}` | {description} |')
if (HERE/'cleanup.json').exists(): lines += ['', '## Cleanup', '', '```json', (HERE/'cleanup.json').read_text().strip(), '```']
lines += ['', '## Verification summary', '', '| Command / control | Final result |', '|---|---|', f'| `npm run check:fast` | {node_pass} Node + {vitest_pass} Vitest passed; {vitest_skip} skipped, 0 failed |', '| `npm run build` | Passed, including strict WASM verification |', f'| `cargo test --release -p fretbloom-backend` | {rust_pass} passed, 0 failed (includes the stub guitar pipeline test) |', '| `cargo build --release --workspace` | Passed |', '| `cargo clippy -p fretbloom-backend --all-targets -- -D warnings` | Passed |', '| `node e2e-guitar-focus.mjs` | 1 complete real browser scenario passed |', f'| `failure-controls.py` | {len(failures)}/{len(failures)} passed |', '| `alignment-control.py` | Zero lag, equal 96,000 samples, correct stages |', '| `window-check.py` | 30 seconds crossing outer seam; byte-identical 1,323,000 stereo frames |', f'| `run.py` | {len(r)}/{len(r)} real backend jobs; repeat PCM identical |', '| `run.py --long` | Native six-minute real job passed |', f"| `docker buildx build --no-cache --load ...` | Fresh serial build passed in {build_seconds:.2f} s |", '| `container-proof.py` | Non-root offline six-minute job passed at 2 CPUs / 2.5 GiB |', '| `cleanup.py`; `git diff --check` | Passed |', '', 'Normal checks were rerun sequentially after takeover. The inherited final-proof run completed the real inference, browser, failure controls and fresh container proof after the lead fixes. The seam and multi-format alignment controls were also rerun at takeover; see the review for their scope and source identities. No heavy builds or inference overlapped.', '', f"Root coverage improved on this DEV pair, but conditional root precision among emitted chord frames fell from {pooled['full_mix']['rootCorrect']}/{emitted('full_mix')} ({100*pooled['full_mix']['rootCorrect']/emitted('full_mix'):.1f}%) to {pooled['separated_guitar']['rootCorrect']}/{emitted('separated_guitar')} ({100*pooled['separated_guitar']['rootCorrect']/emitted('separated_guitar'):.1f}%). This is a coverage/error tradeoff, not a blanket accuracy improvement. No acceptance holdout or human listening study is claimed.", '', '## Exact fixture identities', '', 'The dataset is CC BY 4.0; generated accompaniment is CC0-1.0. Full original, annotation, clean, mixed and negative-control hashes:', '']
for case in json.loads((HERE/'fixtures.json').read_text())['cases']:
    lines += ['```text', case['id']]
    for key in ['wav_sha256','annotation_sha256','cleanSha256','mixSha256','negativeSha256']: lines.append(key+': '+case[key])
    lines += ['```', '']
lines += ['Native and container original/analyzed PCM identities match exactly. The final image is retained locally; no container is retained. Local implementation verification is complete; deployment remains gated on weights permission and resource provisioning. Musical errors, the small DEV sample, the declared accompaniment construction discrepancy, Linux-only packaging, and the weights restrictions remain limitations.', '']
report=ROOT/'docs/guitar-isolation-validation.md';s=report.read_text().split('<!-- MEASURED RESULTS -->')[0].rstrip();report.write_text(s+'\n\n'+'\n'.join(lines)+'\n')
