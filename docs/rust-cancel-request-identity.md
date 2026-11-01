# Refinement completion request identity — root preparation

The independent JSPI evaluation reproduced adoption of a canceled request's
real refinement event while a later same-generation refinement request was
pending. The old success reply did not settle that new request. The facade's
event fence checked whether **any** refinement was pending, rather than tying
completion to the request that produced it. Evidence and the declared control
remain under `target/cancel-repair-test/browser/playwright-canceled-queued-reply-first/`
and `validation/cancel-repair/canceled-queued-reply-expectations.json`.

Root prepared a small [isolated patch](../target/cancel-request-identity/request-identity.patch).
Only an exact still-pending successful RPC reply can announce refinement.
Untagged worker completion events are ignored, including those arriving while
another request is pending. Validated replies produce the same public event;
the session schema, numerical engine, worker request format and recognition
algorithm do not change. Invalid success data is validated before removing the
pending request, so failure still rejects it and terminates the invalid transport.

The controls exercise both AbortSignal and explicit cancellation, replay of the
canceled request while another is pending, preservation of that pending request,
the expected same-generation rejection, old-generation rejection, successful
fresh-generation refinement, duplicate completion and malformed successful
replies. Identical controls are prepared against baseline and proposed code.

**Correctness fix integrated; focused, browser and project checks pass.** No unit
test, typecheck, browser or DSP run was executed while the independent tester
owned its timing window. After its explicit release at 21:21:09.698974 UTC, root
ran identical controls against both copies: the baseline failed both canceled
request replay cases and the malformed-reply transport control; the candidate
passed all nine tests and strict TypeScript. Logs and exact commands are in
[checks.json](../target/cancel-request-identity/checks.json).

Root then regenerated from a fresh owned Cargo target through the normal build
and `--check`. All four WASM/glue artifacts remain byte-identical to the JSPI
freeze; the new source association is
`5c9a187c93c3d55ceb248064db1103cab99985af5e76deefa32437dd7e9d3bda`.
The original independent real-browser canceled-request replay passes against
that copy: the actual Rust event and success reply are withheld, the pending
original request is aborted, and replay while another request is pending causes
no refinement adoption. The later request stays forbidden; an old-generation
event is ignored; fresh-generation refinement succeeds. All owned browser and
server processes closed. See [browser summary](../target/cancel-request-identity/browser-summary.json)
and its raw evidence directory. This verifies the request-identity repair, not
processing-stop timing, JSPI cost or portable-backend acceptance.

The first browser attempt failed before DSP entry because root copied the source
harness without its separately staged PCM seed. The exact immutable tester seed
was then copied and hash-checked, and the same assertions ran in a new evidence
directory. The initial failure and explicit setup correction are retained in
`browser-setup-correction.json`; no result, threshold or product change was made
between those attempts.
The new portable source preparation also needs this fix; its old facade is the
same JSPI baseline. Both immutable preparation snapshots remain unchanged.
After confirming that active facade source differs only in the superseded fence
and its comment, root integrated the verified `runtime.ts` and `runtime.test.ts`
into the working branch. The active numerical engine and generated WASM remain
unchanged; no JSPI or portable candidate is adopted by this repair. Exact before/
after hashes are in `active-adoption.json`.

Pinned Node24.22.2 `npm run check:fast` and the normal `npm run build` both pass.
The build explicitly writes only to `target/cancel-request-identity/dist`; the
default preview/build channel is untouched. Full logs and commands are retained
in `active-checks.json` and the adjacent logs. No commit, push or deployment was
performed. All root-owned browsers, servers and build processes are stopped;
root releases its focused heavy window for the next explicitly assigned run.

Preparation: `python3 target/cancel-request-identity/prepare.py`.
Inventory: [preparation.json](../target/cancel-request-identity/preparation.json).
Patch SHA-256: `f3439877cdbd5f3d848945db7dd5af3f1bd0bf5dd3d47b0a49ade2233c2c90ad`.

The commands used the pinned Node Vitest CLI against each owned
`baseline`/`candidate` root and its `vitest.config.ts` with `--configLoader native`,
then typechecked the candidate's `tsconfig.json`. Both outcomes are preserved.

The independent cost failure remains open. The portable owner's stopped WAT
scan has a conservatively recorded possible-contention interval of
21:13:21–21:17:33 UTC. The current cost JSON file's last modification is
21:11:54.806346 UTC, earlier than that interval. That scan cannot explain an
earlier completed file on this evidence. The tester retains responsibility for
its actual command/block timestamps and measurement qualifications; no failed
distribution is discarded or replaced by this note.
