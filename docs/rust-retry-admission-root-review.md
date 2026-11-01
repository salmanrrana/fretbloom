# Root review: do not implement the proposed two-slot package as written

The source-only proposal in `rust-retry-admission-design.md` correctly identifies
the unresolved lifetime: terminate-return and a rejected RPC do not prove that
the old worker has dropped its input. A real release acknowledgement must follow
payload-handler drainage, and stale replies must never discharge a new owner.
The proposed design has not been implemented or tested. It does not establish
an actual memory-cap violation in the existing candidate.

Root does not approve implementation of the full package as written. It changes
the runtime and worker protocols, verification, ordinary operation completion,
WAV ownership, UI cleanup and document-wide admission at once. Its limited
capture retirement path can permanently block audio until reload when a genuine
end barrier is missing, including ordinary active-capture teardown. That is a
material product behavior change, not a small accounting repair. The proposed
100 ms cleanup policy also needs separate availability and actual CPU-stop
evidence; it cannot be accepted merely because it leaves nominal time before
the 250 ms requirement. A more elaborate lifetime protocol does not itself
make the performance or musical failures disappear.

Keep the useful observation: a canceled-refinement retry currently exports or
reuses the PCM Blob, discards ingestion, then restores that same recording into
a fresh ingestion realm. The narrower alternative to examine is preserving the
already verified canonical recording across this retry and retiring only its
canceled analysis child, with genuine input-release proof before another large
analysis copy. Such an approach still requires strict request/owner fencing,
proof of helper drainage, preserved explicit engine-upgrade behavior, and a
bounded failure outcome. It is not yet a validated design or an authorized
product patch. It must not reset `refineUsed` casually, treat a result message as
release, assume termination timing, or hide retained bytes in another budget.

A follow-up should first establish whether that narrower path is compatible
with the actual facade/UI retry semantics and whether it materially reduces
the changed surface. If it cannot safely close the named retry interval, retain
the incomplete verdict instead of silently introducing the larger framework.
Verification-abort and arbitrary cross-session ownership remain separately
scoped; neither may inherit a pass from the already verified maximum Save path.

No product files changed in this review. The source-only design owner is
finished. The separately granted Firefox explicit-audio-service confirmation
retains its execution window. Root has started no new build, browser, benchmark
or implementation agent from this design completion.
