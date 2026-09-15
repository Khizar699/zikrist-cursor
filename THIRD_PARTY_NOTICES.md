# Third-party assets and dependencies

This inventory documents the evaluation build. It is not a blanket redistribution or commercial-use license.

| Component | Source / version | Terms and status |
| --- | --- | --- |
| Tilawa core | [yazinsai/tilawa](https://github.com/yazinsai/tilawa), npm 0.1.0 | MIT; preserve the package LICENSE. Local patch attributed below. |
| fastest-levenshtein | [ka-weihe/fastest-levenshtein](https://github.com/ka-weihe/fastest-levenshtein) 1.0.16 | MIT. Required by Tilawa's scoring kernel (global distance). The local patch also adapts its bit-vector method for substring alignment. |
| Acoustic model, vocabulary and CTC table | [Tilawa v0.2.0 release](https://github.com/yazinsai/tilawa/releases/tag/v0.2.0) | Export metadata identifies Cyberistic/offline-quran-validation as the source. Base model terms and intermediate model/training provenance must be reviewed separately from Tilawa's MIT code before release. Checksums are pinned in assets/manifest.json. |
| Canonical Arabic display | [Tanzil Uthmani 1.1](https://tanzil.net/docs/Text_License) | CC BY 3.0 plus the publisher's verbatim-copy conditions. Preserve exact text, link to Tanzil and include the copyright block. Original text and its full block are in assets/content/quran-uthmani.txt; generated display JSON preserves the text and notice. Recognition normalization is separate. |
| Salah liturgy Arabic | Traditional salah formulas (Hanafi thana; Ibn Masʿūd tashahhud per Bukhari 831 / Muslim 402; Ibrahimiyyah salawat per Bukhari 3370 / Muslim 406; common tasbih/takbeer/tasleem) | Not Tanzil Quran text. Not a published salah-booklet edition. Vocalized Arabic in `assets/content/salah-liturgy.json` is an editorial presentation of well-known formulas. A publicly known wording is not a commercial redistribution grant for a specific printed edition. |
| Salah liturgy English | Zikrist editorial glosses in `assets/content/salah-liturgy.json` | Liturgy/prayer glosses for future on-screen display. **Not** a Quran translation. Commercial clearance is unreviewed and remains a release blocker. |
| English translation | [Rowwad Translation Center](https://quranenc.com/en/browse/english_rwwad), QuranEnc 1.0.19 | Downloaded only when selected. Edition-specific offline redistribution/commercial permission and update obligations remain a release gate. No permission is inferred solely from the public download URL. |
| Urdu translation | [Muhammad Ibrahim Junagarhi](https://quranenc.com/en/browse/urdu_junagarhi), QuranEnc 1.1.3 | Downloaded only when selected; keep full footnotes. Same permission review as English. Do not silently relabel other editions as this translation. |
| Inter font | [rsms/inter 4.1 Medium](https://github.com/rsms/inter/releases/tag/v4.1) | SIL Open Font License 1.1. Used for English translation. Included assets/fonts/Inter-LICENSE.txt. Inter has no Arabic glyphs. |
| Tajawal font | [Boutros Tajawal Medium](https://fonts.google.com/specimen/Tajawal) | SIL Open Font License 1.1. Used for Arabic (and Urdu) display as an Inter-like grotesque. Included assets/fonts/Tajawal-OFL.txt. |
| ONNX Runtime | [Microsoft ONNX Runtime](https://github.com/microsoft/onnxruntime), JS/native 1.24.3 | MIT. The iOS C runtime is explicitly pinned because the React Native package's pod dependency is otherwise unbounded. |
| Native audio | [Software Mansion react-native-audio-api](https://github.com/software-mansion/react-native-audio-api), 0.13.3 | MIT package. FFmpeg support is disabled. Audit bundled native codec notices with the release artifact. |
| Expo / React Native / React | Versions in package-lock.json | Their upstream notices remain in node_modules and native dependencies. Include a generated full dependency notice inventory before public release. |

The Tilawa memory patch follows upstream PR 18 at commit `0856cd1491a08c3c437f52add6a07ca22acc3183`. It changes n-gram storage and scratch-buffer allocation, not the intended scoring. It is not represented as an upstream published release.

Manual development evaluation used Alafasy recordings served by EveryAyah (`SSSAAA` verse files, including Al-Fatihah, Al-Baqarah 2:1–5, Al-Asr, Quraysh, Al-Kawthar, Al-Ikhlas, Al-Falaq, and An-Nas). Those recordings are not bundled with the app and are ignored by Git under artifacts/. Restore locally with `npm run fixtures:recitation`. `english-negative.wav` is synthesized with espeak-ng when available, otherwise taken from the Open Speech Repository. An accessible recording URL is not permission to train or redistribute a dataset.

Real-imam / live-tilawah evaluation clips stay local and gitignored under `artifacts/recitation/imam/`. They are not app assets and are not in git (no Git LFS). Friends restore a public GitHub Release zip with `npm run fixtures:imam` (tag `imam-fixtures-v1`, asset `zikrist-imam-fixtures-v1.zip`; see `HANDOFF.md`). Founder labels in `prompts/real-imam/LABELS.md` are ground truth. Rights for imam or bystander recordings remain unresolved until reviewed; a public Release URL is not a redistribution or training grant.

Future stories and explanations must have a separately permitted, attributable source. This build includes no fabricated verse histories, generated translations, or claims that every verse has an independently established revelation occasion.
