# Stop Al-Fatihah locking Ibrahim 14:40

## Goal

Reciting Al-Fatihah from Alhamdulillah must show 1:2 and then follow 1:3–1:7. It must not display Ibrahim 14:39/14:40 and freeze there for the rest of the surah.

## Scope

Inspected: `AGENTS.md`, `src/core/{follower,continuation-gate,basmala,display-hold,passage}.ts`, `tests/follower.test.ts`, live `quran.json` phonemes for 1:2, 14:39 and 14:40, Tilawa `bestJoint03Match` / `fragmentScore`.

Device report: first verse of Al-Fatihah immediately showed 14:40 (`رب اجعلني مقيم الصلوة…` / “My Lord, make me steadfast in prayer…”) with 14:39 as the dim previous row, and the screen stayed there through the surah.

Root causes (measured on the live corpus, not a guess):

1. Only two ayahs open `الحمد لله`: 1:2 and 14:39. Acquire can lock a long ayah from opening score alone, so `الحمد لله` is enough for 14:39 without the unique `الذي وهب`.
2. 14:40 opens `رب`, which is also word 3 of 1:2. After a 14:39 lock, leftover `رب العلمين` is treated as 14:40. `العلمين` fuzzy-matches `اجعلني` at ~0.77 (bar 0.7), so follow commits 14:40.
3. The passage window always shows mushaf-previous/next, so 14:39 appears above 14:40 even if only 14:40 was confirmed.
4. Once on 14:40, neighborhood `fragmentScore` of 1:2 against 14:39 (previous) stays ~0.65 from the shared `الحمد لله`, and 1:6 `الصرط` still fuzzy-matches `الصلوه` at ~0.73. Mismatches never reach reacquire, so the wrong lock lasts the whole recitation.

Clean `الحمد لله رب العلمين` already locates 1:2 in Tilawa. This pass does not retune ONNX. Keep: 1:2 first lock after its unique `رب`, 1:3–1:6 advances, 1:6 not committing 1:7 from sirat, Basmala hold, An-Nas vs 2:109, salah prior as tie-break only.

## Files

`src/core/follower.ts`, `tests/follower.test.ts`, `prompts/fatiha-ibrahim-false-lock.md`, `README.md`, `VALIDATION.md`.

## Architecture / security

- Do not first-lock or advance from a prefix that also opens a different ayah. Shared `الحمد لله` needs the next unique word (`رب` vs `الذي`); a lone `رب` cannot claim 14:40.
- Word alignment for follow/advance must not treat `العلمين` as `اجعلني`. Keep real stems such as `الصرط` / `صرط`.
- A window that only matches a shared prefix must not keep neighborhood score high enough to block reacquire. Mid-ayah audio of a long ayah may still keep via substring score when the opening is no longer in the 1.2 s window.
- Private local capture only. Scores stay similarity scores.

## Acceptance

- `الحمد لله` with a 14:39 champion does not lock 14:39 or 14:40.
- Full 1:2, even when 14:39 is the engine champion, locks 1:2.
- After a 14:39 lock, leftover 1:2 `رب العلمين` does not commit 14:40.
- A wrong 14:40 lock then unique Al-Fatihah words (1:5) leaves Ibrahim.
- 14:40 can still lock from its own `رب اجعلني`. 1:2 still advances to 1:3; 1:5 still advances to 1:6.
- Typecheck, lint, tests. No physical-device accuracy claim.

## Checks and device tests

`npm run typecheck`, `npm run lint`, `npm test`. Manual: recite Al-Fatihah from Alhamdulillah through 1:7. Simulator is not mosque evidence.
