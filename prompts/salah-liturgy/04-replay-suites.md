# Salah liturgy replay suites (Sim QA harness)

## Goal

Register **headless liturgy replay suites** (stub-first, like real-imam) so Sim QA can score phrase locks overnight without founder mic. Stubs **skip** with `missing_fixture` — never fake PASS. Default `npm run test:replay -- all` stays the original **14** Quran suites.

## Depends on (landed / landing)

- Corpus + matcher on main (`924e175` lineage): `SalahLiturgyLockEvent`, pack 18 phrases
- Display PR #11 (Mac-verifying): UI not required for harness gates, but event kind is stable
- Pattern to mirror: real-imam pack — `prompts/real-imam/manifest.stub.json` + `artifacts/recitation/imam/` + skip-not-PASS

## Hard gate

- Mac: `npm run test:replay -- all` = **14/14**
- Soft nas wsr may remain — do not worsen
- Do **not** retune Quran follower or liturgy matcher thresholds this session

## Suite ids (stable)

| suite_id | expect |
|----------|--------|
| `liturgy-takbeer` | lock `takbeer`; no Quran verse_match |
| `liturgy-thana` | lock `thana` |
| `liturgy-ruku` | lock `ruku_tasbih` |
| `liturgy-sujood` | lock `sujood_tasbih` |
| `liturgy-tashahhud` | lock `tashahhud` (allow partial milestones / multi-window) |
| `liturgy-then-fatiha` | liturgy then Fatiha still 1:2–7 |
| `fatiha-then-takbeer` | after 1:7, takbeer → liturgy lock, **not** wrong ayah |
| `liturgy-english-negative` | English / non-Arabic → no Quran + no liturgy (or document if liturgy none-only) |

## Layout

- Manifest (committed): `prompts/salah-liturgy/manifest.stub.json` (or extend overnight queue with same schema as real-imam: `status: stub|ready`, `phrase_id` / expected liturgy sequence, `clip_path`, `license_status`)
- Audio staging (gitignored): `artifacts/recitation/liturgy/<suite-id>/…wav`
- Founder/TTS drop notes in README — **do not commit** evaluation audio; no silent fake WAV that would PASS
- CLI: `npm run test:replay -- liturgy` (or `salah-liturgy`) lists/runs these; stubs skip exit 0 with `missing_fixture`

## Harness notes

- Replay path today is follower-only for Quran; liturgy scoring needs the matcher on the replay/listening path (token or acoustic). Prefer **token-fixture** or PCM→same pipeline as live if already wired — document what was chosen
- JSON report fields: `phraseId`, `audioSeconds`, `failureMode`, plus existing clocks where useful
- Reuse EveryAyah WAVs only for mixed suites (`liturgy-then-fatiha`, `fatiha-then-takbeer`)

## Out of scope

- Matcher threshold retunes  
- UI polish  
- Real-imam clip fills  
- Claiming mosque/device liturgy accuracy  

## Success criteria

1. Suite registry + stub manifest committed; `test:replay -- all` still 14 names  
2. `test:replay -- liturgy` skips stubs (`missing_fixture`, not PASS) when audio absent  
3. Units cover selection/skip; docs in README/VALIDATION  
4. Mac 14/14 confirmed if any shared code touched  

## Deliverable

PR: commands, suite list, stub manifest, which phrases still lack audio, sample skip JSON.
