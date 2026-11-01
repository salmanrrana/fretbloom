# Root triage of the portable stack review

2026-10-31. Root accepts R1–R7 in `rust-cancel-stack-review.md` as requirements
for the next isolated candidate. The reviewed input was the immutable source
preparation, not an adopted product artifact. No guarded portable WASM existed
in that preparation. These findings must not be described as active-product
exploits or as executed counterexamples.

The current completion builder owns all implementation in
`target/cancel-portable-completion/**` and the exclusive heavy window under
`target/cancel-portable-next-coordination.json`. It may repair the structural
postprocessor or use the proposed narrow, reproducibly pinned writer patch.
The choice must reduce or close the actual proof obligations; there is no
authorization for a general compiler rewrite, unreviewed access omissions,
multi-memory/browser-floor changes, or bypassing source/artifact association.

The two high-priority requirements are complete approved-role classification
of every saved-stack/header use, including explicit-zero and alias cases, and
zero guest calls after a trap anywhere in initialization, allocation, analysis
or cleanup. Capture one immutable raw input, validate controls/header ownership,
remove repeated export scans, retain failed-build evidence and generate accurate
final declarations as described in R3–R7. Pin counts only after actual exhaustive
coverage and meaningful controls establish them. A count produced by the same
recognizer is not independent proof of complete coverage.

Root is assigning separate source-only preparation of (1) adversarial stack and
trap controls and (2) product/browser acceptance. Those owners may write only
their new validation/test/report paths. They must not build, traverse full WAT,
run DSP, launch browsers or benchmark while the completion builder owns the
window. Root will mediate actual execution against its immutable handoff after
the explicit release; no child-to-child scheduling dependency is required.

The newer single-portable-backend decision remains authoritative. The review's
dual-backend discussion describes its earlier frozen input; it does not revive
the rejected JSPI production path. The active request-identity fix is already
verified and must be preserved. All original numerical/music failures and the
failed JSPI measurements remain in their prior reports.

## Independent controls handoff

The source-only controls are frozen in `rust-cancel-stack-controls.md` and
`target/cancel-stack-controls/preparation.json`. Root read the handoff and
verified every entry in `target/cancel-stack-controls/SHA256SUMS`. This checks
file integrity only; syntax, tests, real-instance execution and the independent
assembled-access proof have not run. The controls establish no new defect in
the completion builder's evolving source.

Root forwarded the frozen expectations to the active builder. The builder
retains its exclusive heavy window. After its explicit release and immutable
source/artifact handoff, a new independent executor must bind the controls to
the actual chosen implementation, exercise the mutants, audit real emitted
accesses, and run the trap/build/declaration checks. Writer fixtures must use
the real patched writer's output. Missing bindings or proof remain incomplete,
not skipped passes. Product/browser acceptance is a separate pending gate.

The product acceptance preparation has also been delivered in
`rust-cancel-portable-acceptance.md`. Root verified its 33 frozen file hashes,
including protocol SHA-256
`83f821e4b0b04377e106ee60a246574400932c0a30bdd3c22cfbadcc9b68366b`,
and forwarded the handoff requirements to the builder. Its harness has not
executed. Final ABI bindings, observation-only hooks, tool/browser identities
and check recipes must be reviewed and frozen before independent execution.
Both preparation owners have finished; the completion builder retains the
heavy window. No elapsed-time or preparation completion grants test clearance.
