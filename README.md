# BaZi Calculator: standalone webapp

A self-contained BaZi (八字 / Four Pillars of Destiny) calculator. Five static
files, no build step, no dependencies, no network calls. Everything runs in
the visitor's browser.

| File | What it is |
|---|---|
| `index.html` | The page |
| `styles.css` | 新中式 styling, light + dark |
| `app.js` | UI logic, plain-English interpretation copy |
| `bazi.js` | **Generated.** Copy of `src/bazi.js` (the calculation engine) |
| `cities.js` | **Generated.** Copy of `src/cities.js` (315 cities for solar time) |

## What it does

- Casts the four pillars from a Gregorian birth date/time, using classical
  rules: solar terms (节气) for the month and year boundaries, the sexagenary
  day cycle via Julian Day Number, 五虎遁 / 五鼠遁 for the month and hour stems.
- Optional **true solar time (真太陽時)** correction when a city is picked.
  Local-mean-time offset plus equation of time, applied to the hour branch
  *and* the 23:00 day rollover. Always shown, never applied silently.
- Handles **unknown birth time** (three pillars) and **unlisted birthplaces**
  (no correction, stated plainly) without blocking anyone.
- Explains the **Ten Gods (十神)** in plain English, grouped into the five
  relationships. This is the layer most calculators leave untranslated.
- Flags births near a solar-term boundary, where the chart is worth
  double-checking against an almanac.
- Shareable URLs: `?date=1990-06-15&time=07:24&city=Singapore` re-casts the
  same chart.

Nothing on the page is AI-generated. The interpretation text is a fixed
lookup table keyed off the computed chart.

## Deploying to GitHub Pages

### Recommended: a separate public repo

This repository also holds business plans, pricing, and channel strategy, so
publish the calculator on its own:

```sh
# from the repo root
./scripts/sync-webapp.sh          # refresh the engine copies first

mkdir -p ../bazi-calculator
cp webapp/index.html webapp/styles.css webapp/app.js webapp/bazi.js webapp/cities.js ../bazi-calculator/
cp webapp/README.md ../bazi-calculator/README.md

cd ../bazi-calculator
git init -b main
git add .
git commit -m "BaZi calculator"
gh repo create bazi-calculator --public --source=. --push
```

Then: repo **Settings → Pages → Source: Deploy from a branch → `main` / `/ (root)`**.
It goes live at `https://<your-username>.github.io/bazi-calculator/` within a
minute or two.

### Alternative: serve from this repo

Only if you make this repository public, which would also expose `docs/`,
`marketing/`, and `channels/`. If you do: **Settings → Pages → branch `main`,
folder `/webapp`**.

### After deploying

1. Update the `canonical` URL and `og:` tags at the top of `index.html` to the
   real address. They currently point at a placeholder.
2. To send visitors to the shop, add one link in the footer of `index.html`.
   Keep it soft; the calculator earns trust by being genuinely free and good.

## Keeping the engine in sync

`bazi.js` and `cities.js` are copies. After editing `src/bazi.js` or
`src/cities.js`, re-run:

```sh
./scripts/sync-webapp.sh
```

Then re-copy them into the published repo. The engine's test suite
(`npm test` at the repo root) covers the calculation itself, so a synced copy
is a tested copy.

## Local preview

```sh
python3 -m http.server 4173
```

Then open <http://localhost:4173/webapp/>.

## Accuracy notes

- Valid for births **1901 to 2100**.
- Solar terms are computed to **day-level** accuracy; a birth on a term day
  gets a warning in the UI.
- City longitudes are accurate to ~0.1 to 0.5° (finer than a minute of solar
  time). UTC offsets are **standard** time. Historical daylight saving is not
  inferred, so a summer birth may need the DST toggle.
- The support-balance figure is a simple element ratio, not a full
  strong/weak verdict. Season and branch interactions are not modelled, and
  the page says so.
