# Word list

`words.db` (SQLite, table `words`: `word`, `length`, `source`) is the word list for filling grids.
It holds Georgian words of 3 to 13 letters. `source` is the first source that added the word.

Rebuild it with `make words`. The command downloads the raw files into `raw/` (not committed) and runs `cmd/importwords`.

| Source | File | What is used | License |
|---|---|---|---|
| `zigzagi` | `sources/zigzagi_lemmas.csv` | 14,401 active lemmas from the zigzagi project (UD GNC, simplemma, Gemini, manual). Committed, because no other copy exists. | zigzagi project |
| `gnc` | [UD_Georgian-GNC](https://github.com/UniversalDependencies/UD_Georgian-GNC) | Word forms and lemmas of every token, except PUNCT, NUM, SYM and X | CC BY-SA 4.0 |
| `unimorph` | [unimorph/kat](https://github.com/unimorph/kat) | Lemmas and inflected forms. Nouns and adjectives are crawled from Wiktionary and unverified. | The repo has no license file. UniMorph data is reported as CC BY-SA 3.0 (not checked at the source). |

Not used: `hermitdave/FrequencyWords` `ka_full.txt`. The Georgian list is mis-decoded text (for example `ოთანთჟრ`), and only 6 to 10% of its words appear in the other sources.

A word is accepted only if it has Georgian letters only and 3 to 13 of them. This drops multi-word forms, digits and punctuation.
