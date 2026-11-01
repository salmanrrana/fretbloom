"""Measure residual leakage and lost truth-supported note frames without subjective listening claims."""
import json,math
from pathlib import Path
import numpy as np
from run import HERE,RUN,decoded,active
fixtures=json.loads((HERE/'fixtures.json').read_text())['cases']
report=[]
for case in fixtures:
    name=case['id'];clean=decoded(HERE/'source'/(name+'-clean.wav'));mix=decoded(HERE/'source'/(name+'-mix.wav'))
    stem=decoded(RUN/(name+'-separated_guitar-guitar-audio.wav'));accompaniment=mix-clean
    basis=np.array([[clean@clean,clean@accompaniment],[clean@accompaniment,accompaniment@accompaniment]])
    coefficients=np.linalg.solve(basis,np.array([stem@clean,stem@accompaniment]))
    clean_result=json.loads((RUN/(name+'-clean_guitar.json')).read_text())['analysis']
    stem_result=json.loads((RUN/(name+'-separated_guitar.json')).read_text())['analysis']
    supported=missing=extra=0
    for i in range(math.ceil(case['duration']/.02)):
        t=min((i+.5)*.02,case['duration']-1e-9)
        truth=active(case['notes'],t)
        before=active(clean_result['monophonicNotes']+clean_result['polyphonicNotes'],t)
        after=active(stem_result['monophonicNotes']+stem_result['polyphonicNotes'],t)
        supported+=len(before&truth);missing+=len((before&truth)-after);extra+=len(after-truth)
    report.append(dict(id=name,projectionOnClean=float(coefficients[0]),projectionOnAccompaniment=float(coefficients[1]),truthNoteFramesRecognizedOnClean=supported,thoseMissingAfterSeparation=missing,falseNoteFramesAfterSeparation=extra,interpretation='Linear projection and recognizer-frame observations only; not human listening or acoustic note adjudication. Negative control separately measures bleed with no guitar present.'))
(HERE/'observations.json').write_text(json.dumps(report,indent=2))
