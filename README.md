# BaZi Calculator: standalone webapp

A self-contained BaZi (八字 / Four Pillars of Destiny) calculator. Seven static
files, no build step, no dependencies, no network calls. Everything runs in
the visitor's browser.

| File         | What it is                                                     |
| ------------ | -------------------------------------------------------------- |
| `index.html` | The calculator                                                 |
| `guide.html` | Plain-English guide to how a chart is cast and how to read one |
| `styles.css` | 新中式 styling, light + dark, shared by both pages             |
| `app.js`     | UI logic, plain-English interpretation copy                    |
| `bazi.js`    | The calculation engine                                         |
| `cities.js`  | 315 cities for solar time                                      |

## What it does

- Casts the four pillars from a Gregorian birth date/time, using classical
  rules: solar terms (节气) for the month and year boundaries, the sexagenary
  day cycle via Julian Day Number, 五虎遁 / 五鼠遁 for the month and hour stems.
- Solar terms are solved **astronomically**, from the sun's apparent geocentric
  longitude with planetary and lunar perturbations and a ΔT correction, so
  the year and month pillars turn at the right _moment_, not merely on the
  right day. 立春 2025 fell at 22:09 on 3 February; a birth that morning gets
  the previous year's pillar, as it should.
- Optional **true solar time (真太陽時)** correction when a city is picked.
  Local-mean-time offset plus equation of time, applied to the hour branch
  _and_ the 23:00 day rollover. Always shown, never applied silently.
- Handles **unknown birth time** (three pillars) and **unlisted birthplaces**
  (no correction, stated plainly) without blocking anyone.
- Explains the **Ten Gods (十神)** in plain English, grouped into the five
  relationships. This is the layer most calculators leave untranslated.
- Casts the **luck pillars (大运)**: ten ten-year periods stepping forward or
  backward from the month pillar per 阳男阴女顺行 / 阴男阳女逆行, with the
  starting age (起运) counted to the adjacent 节 at three days to the year.
  Each carries its Ten God, its age range and its calendar years, and the
  period the visitor is in right now is marked. Needs one extra answer, gender,
  because the classical direction rule is stated as a binary of 男 / 女 and
  cannot be derived from a birth moment. Declining it costs only this section.
- When a birth genuinely cannot be placed either side of a solar term, whether
  because the time zone is unknown, the birth time is unknown, or it falls
  within minutes of the term, shows **both readings side by side** and says
  what would settle it, rather than picking one silently.
- Counts the five elements two ways: at face value, and with hidden stems
  (藏干) weighted 本气 / 中气 / 余气 so every branch is worth one unit. The Ten
  Gods use the weighted basis, so the two panels reconcile.
- Shareable URLs carry the birthplace as coordinates, not a bare name:
  `?date=1990-06-15&time=07:24&city=Singapore&country=Singapore&lon=103.8&tz=480&gender=male`.

Nothing on the page is AI-generated. The interpretation text is a fixed
lookup table keyed off the computed chart.

`disclaimer.html` holds the full disclaimer: what is computed (the eight
characters, arithmetic and shown with their working) versus what is
interpretation (everything after them, a traditional framework that predicts
nothing), the accuracy limits, what it must not be used for, how birth data is
handled, what to do if a reading is distressing, and a limitation of liability
disclaiming warranty and damages. Every page carries a condensed version in its
footer with a link to the full page.

The liability section is written in plain English and has **not** been reviewed
by a lawyer. If this is published commercially, or anywhere with consumer
protection rules that bite, have counsel check it.

House style: no em dashes anywhere in the repo. Use a colon where a clause
explains, a comma where it is an aside, or split the sentence.

## Accuracy notes

- Valid for births **1901 to 2100**.
- Solar-term instants are accurate to about **five minutes**, verified against
  published almanac times across the range (max deviation 5 min, mean 2.5 min).
  A birth within that window of a term is flagged rather than guessed.
- Placing a birth either side of a term needs the birth clock's UTC offset,
  which comes from the chosen city. **Without a city, a birth within 15 hours
  of a term cannot be placed**, since no time zone is further from UTC than
  that, and both readings are shown.
- City longitudes are accurate to ~0.1 to 0.5° (finer than a minute of solar
  time). UTC offsets are **standard** time. Historical daylight saving is not
  inferred, so a summer birth may need the DST toggle.
- The support-balance figure is a simple element ratio, not a full
  strong/weak verdict. Season and branch interactions are not modelled, and
  the page says so.
- The luck-pillar starting age inherits the birth instant's precision: exact
  with a birth time and a city, ±2 to ±5 months without. At three days to the
  year, a solar term wrong by a day would move it four months, which is why
  the term instants are computed rather than tabulated.
- Casts the **annual pillars (流年)** under each luck pillar: the ten years
  inside whichever decade is selected, each read against the Day Master, with
  the current year marked. The year turns at 立春, not on 1 January.
- **Not implemented:** branch combinations and clashes (六合 / 三合 / 六冲 /
  刑 / 害), and the useful god (用神). `guide.html` states these limits to the
  reader, and `disclaimer.html` carries the full disclaimer.
