# Root correction of the partial retained-retry candidate

The first builder correctly stopped on an inconsistent grant: TypeScript files
under `src/audio/live`, including tests, participate in the build's source
identity, but root had forbidden the manifest update. Root authorizes normal
pinned regeneration in the next owned copy. No hand-edited manifest, omitted
source inputs, verifier bypass or tool/guard/Rust change is authorized. The
existing numerical WASM/glue must remain byte-identical; new association metadata
must come from the real build. The original failed build remains retained.

Root separately reproduced and repaired the small dispatcher finding in a fresh
ordinary copy at `target/retained-retry-root-fix/source`. A second refinement RPC
could overwrite `activeRefinement` before being refused, losing the first
request's cancellation route. The dispatcher now rejects that competing owner
before assignment. An explicit retry may still take over a canceled attempt's
route; the earlier attempt's finally cannot clear its successor.

Two controls execute the actual worker RPC dispatcher with mocked asynchronous
refinement methods. Both fail on the original partial source: canceling the
first request invokes no cancellation handler. Both pass after the guard. An
extended green control also admits an explicit retry after cancellation, settles
the old attempt, and verifies that cancellation still reaches the retry.
`red.log`, `green.log`, `green-handoff.log` and exact command records retain this
evidence. This is dispatcher evidence, not genuine PCM drainage or CPU-stop proof.

The immutable builder handoff and original frozen candidate are untouched.
`source-inventory.json` pins the root copy. Strict full checks, normal regenerated
build, actual worker release controls and real retained-retry memory/CPU evidence
remain unfinished. Lint's earlier zero-file outcome is not a pass. No adoption,
active-source change, commit, deployment or new musical claim occurred.
