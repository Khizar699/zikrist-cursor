# Real-imam pack (Cursor / friends)

Mosque-clip harness, labels, and recognition algo sessions.

| Start here | |
|---|---|
| Root tip | [`HANDOFF.md`](../../HANDOFF.md) |
| Cursor rules | `.cursor/rules/zikrist-continuity.mdc` + `zikrist-recognition-ratchet.mdc` |
| Algo standards | [`algo/README.md`](./algo/README.md) → PRODUCT-BAR, RATCHET, queue |
| Labels | [`LABELS.md`](./LABELS.md), [`labels.json`](./labels.json) |
| Manifest | [`manifest.stub.json`](./manifest.stub.json), [`MANIFEST-NOTE.md`](./MANIFEST-NOTE.md) |
| Fixtures | [`FIXTURES.md`](./FIXTURES.md) — `npm run fixtures:imam` |
| Live feel | [`LIVE-FEEL.md`](./LIVE-FEEL.md) — manual only; not a substitute for Mac replay |

**Premade suite grows:** when a Tip fail is fixed on Mac, the same PR locks a unit and/or flips a suite `ready` with `expected_sequence` ([`algo/RATCHET.md`](./algo/RATCHET.md)). The next person who opens Cursor inherits that coverage automatically via rules + tip.
