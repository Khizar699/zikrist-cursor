# Restore live recognition

The user reports that recitation never displays a verse. Tilawa 0.1.0 and the pinned ONNX model are installed, and desktop replay works, but simulator sessions show repeated queue resets. Inspect native PCM timestamps, full Tilawa processing cost and UI delivery before declaring the core ready.

Instrument complete feed latency and gap causes. Keep serialized inference and bounded audio; coalesce contiguous pending packets without mixing speech/silence boundaries to recover from a slow cycle. Add a clearly labeled development-only local WAV replay that exercises the same native model, tracker, acceptance guard and translation lookup, without microphone capture or prayer history. Never seed recognition with expected verses. No fixture is distributed in release builds. Test actual microphone capture separately. Preserve recording opt-in and no uploads.

Checks: queue batching/order/cancellation tests, native fixture recognition and timing, silence/negative replay, native microphone test where routing permits, TypeScript/lint, exports. Record measured evidence and remaining physical-device limitations in VALIDATION.md.
