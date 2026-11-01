#!/usr/bin/env python3
"""Bounded local CLI/resource checks using generated development tones, never corpus labels."""
from array import array
import json
import math
from pathlib import Path
import signal
import subprocess
import sys
import tempfile
import time

ROOT = Path(__file__).resolve().parents[3]
BINARY = ROOT / 'target/release/analyze-pcm'

def main():
    with tempfile.TemporaryDirectory(prefix='dsp-probe-', dir=ROOT/'target') as scratch:
        folder = Path(scratch)
        # Four second harmonic chord; a repeated block bounds fixture-generation memory.
        block = array('f', (sum(0.035/h*math.sin(2*math.pi*440*2**((m-69)/12)*h*i/24000)
                           for m in [48,52,55,60] for h in [1,2,3]) for i in range(96000)))
        if sys.byteorder != 'little':
            block.byteswap()
        report = []
        for seconds in [30,600]:
            pcm = folder/f'{seconds}.f32le'
            with pcm.open('wb') as stream:
                remaining = seconds*24000*4
                while remaining:
                    chunk = block.tobytes()[:remaining]
                    stream.write(chunk)
                    remaining -= len(chunk)
            output = folder/f'{seconds}.json'
            timing = folder/f'{seconds}.time'
            command = [str(BINARY),'--input',str(pcm),'--output',str(output)]
            run = subprocess.run(['/usr/bin/time','-f','%e %U %S %M','-o',str(timing),*command],
                                 capture_output=True,text=True,timeout=110)
            row = dict(seconds=seconds,exit=run.returncode,timing=timing.read_text().strip(),stderr=run.stderr)
            if run.returncode == 0:
                data=json.loads(output.read_text())
                row.update(output_bytes=output.stat().st_size,
                           harmony_events=len(data['result']['harmony']),
                           mono_events=len(data['result']['monophonicNotes']),
                           poly_events=len(data['result']['polyphonicNotes']),
                           feature_frames=len(data['features']['frames']))
                assert data['result']['duration']==seconds
                assert len(data['features']['frames'])==math.ceil(seconds/.08)
            report.append(row)
        # Interrupt real DSP work and ensure no partial destination is published.
        output = folder/'canceled.json'
        proc=subprocess.Popen([str(BINARY),'--input',str(pcm),'--output',str(output)],stderr=subprocess.PIPE)
        time.sleep(.15)
        before=time.monotonic()
        proc.send_signal(signal.SIGINT)
        _,stderr=proc.communicate(timeout=3)
        report.append(dict(cancellation_exit=proc.returncode,cancellation_seconds=time.monotonic()-before,
                           output_exists=output.exists(),stderr=stderr.decode()))
        assert proc.returncode==130 and not output.exists()
        # Invalid raw length and NaN must return invalid-input without output.
        for name,raw in [('partial',b'123'),('nan',bytes.fromhex('0000c07f'))]:
            inp=folder/f'{name}.pcm';inp.write_bytes(raw);out=folder/f'{name}.json'
            run=subprocess.run([str(BINARY),'--input',str(inp),'--output',str(out)],capture_output=True,timeout=3)
            assert run.returncode==2 and not out.exists(),(name,run.returncode)
        print(json.dumps(report,indent=2))

if __name__=='__main__':
    main()
