# Cancellation candidate container preparation

Root prepared the container-only correction against the frozen JSPI candidate
with source hash `3b248453e4f5d5d5702c6718f7fbdd9113bba4043132288df1574c0255084d1b`.
Active packaging, source, generated artifacts and the builder's freeze were not
changed. Independent cancellation and compatibility acceptance remain separate.

The proposed [patch](../target/cancel-repair-packaging/container.patch) copies the
generated-glue adapter into both build stages, supplies the live runtime and
alignment validator to the WASM stage, and includes the live tests required by
the canonical source manifest. These tests enter build stages; the runtime image
still copies built assets, dependencies, server files and the backend executable.
The strict verifier and its source inventory are unchanged.

`python3 target/cancel-repair-packaging/prepare.py` reproduced missing canonical
inputs in both original stages. The proposed COPY coverage includes all 43
canonical files. Running the real verifier on separately materialized source
closures for both stages passed with the frozen source hash. Every copied source
was checked against the frozen manifest, and active packaging hashes remained
unchanged. See [evidence](../target/cancel-repair-packaging/verification.json).

This is source-coverage and association verification, **not a Docker build**.
Actual Docker ignore/COPY behavior, fresh container WASM byte identity, the Node
build and the final runtime image still need execution after independent timing
work releases the machine. Apply the patch only alongside the accepted candidate;
the current active source does not contain its new adapter. A portable fallback
may introduce additional build inputs, which must be covered before final build.

Patch SHA-256:
`c08e634e5ff3509abe4b958fc72a44e50bda716be5dc31d49c9f2e009171ed75`.

The first preparation attempt stopped while parsing a continued Docker RUN line.
The checker was narrowed to FROM/COPY lines, then the complete check passed.
No failed attempt was counted as Docker or runtime validation.
