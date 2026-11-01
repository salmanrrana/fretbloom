# Firefox test audio-service discovery

Root, 2026-11-01 UTC. The plain Firefox control stalled without Fretbloom.
Root then checked the existing audio service using read-only libpulse contexts,
with daemon autospawn disabled and no playback/record stream or settings changes.
The retained browser environment was reproduced with writable roots relocated
to new owned directories. Neither XDG_RUNTIME_DIR nor PULSE_SERVER was present.

Default discovery failed immediately with `Connection refused`. Connecting to
`unix:/run/user/1000/pulse/native` reached READY, completed sink enumeration and
reported one sink. Both contexts were disconnected and freed; both subprocesses
exited normally. No service was started or stopped, and no device, volume or
system configuration was changed. Sink names and contents were not collected.

This demonstrates a discovery difference for libpulse under this isolated
environment. It does not yet prove the cause of Firefox's suspended context or
pass Fretbloom capture. The next controlled browser comparison may add only the
explicit existing server to its isolated environment, leaving the browser,
policies, page, trusted activation and product unchanged.

Evidence and the prospectively recorded three-second-per-case protocol are in
`target/firefox-audio-service-check/`. `probe.py` binds the documented context,
mainloop and sink-list interfaces; Python ctypes calls no stream or mutation API.
The outer subprocess deadline was five seconds. Root consulted the official
PulseAudio [context](https://www.freedesktop.org/software/pulseaudio/doxygen/context_8h.html),
[mainloop](https://www.freedesktop.org/software/pulseaudio/doxygen/mainloop_8h.html),
[introspection](https://www.freedesktop.org/software/pulseaudio/doxygen/introspect_8h.html)
and [flags](https://www.freedesktop.org/software/pulseaudio/doxygen/def_8h.html)
references before execution. No browser, DSP, benchmark or production access
occurred in this check. Prior failed controls remain unchanged.
