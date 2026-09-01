/**
 * BaZi (八字 / Four Pillars of Destiny) calculation engine.
 *
 * Computes the year, month, day and hour pillars (heavenly stem + earthly
 * branch) from a Gregorian birth date/time, plus derived data used for
 * readings: day master, five-element distribution, hidden stems, ten gods
 * and the zodiac animal.
 *
 * Works both as a browser script (exposes `window.BaZi`) and as a CommonJS
 * module in Node.
 *
 * Conventions and accuracy:
 * - Solar terms (节气) are computed astronomically: the sun's apparent
 *   geocentric longitude (Meeus, with planetary and lunar perturbation terms)
 *   is solved for each 15° multiple, then shifted from Terrestrial Time to UT
 *   with the Espenak–Meeus ΔT polynomials. Term instants are accurate to a
 *   couple of minutes over 1901–2100, so the month and year pillars turn at
 *   the correct *moment*, not merely on the correct day.
 * - Because a solar term is an instant in absolute time, resolving which side
 *   of it a birth falls on requires the birth clock's UTC offset. When
 *   `utcOffsetMinutes` is supplied the answer is exact. When it is not, a
 *   birth within 15 hours of a term instant cannot be placed (time zones span
 *   UTC−12 to UTC+14), and `termBoundary.ambiguous` is set with both candidate
 *   readings returned in `termBoundary.alternative`.
 * - The day is treated as starting at 23:00 (子时 begins the new day). Set
 *   `options.lateZiSameDay = true` to keep 23:00–23:59 on the current day
 *   (晚子时 convention).
 * - Birth time is interpreted as local clock time at the birthplace unless a
 *   True Solar Time (真太陽時) correction is requested. When both `longitude`
 *   (°E, west negative) and `utcOffsetMinutes` (the birth clock's UTC offset)
 *   are supplied AND the birth time is known, the clock time is corrected to
 *   apparent solar time (Local Mean Time offset + Equation of Time) before the
 *   hour branch and the 23:00 day-rollover are derived. The solar-term
 *   boundary is NOT shifted by this correction: a term is an absolute instant,
 *   so it is compared against the absolute birth instant.
 */
(function (global, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    global.BaZi = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
  const STEM_PINYIN = ['Jiǎ', 'Yǐ', 'Bǐng', 'Dīng', 'Wù', 'Jǐ', 'Gēng', 'Xīn', 'Rén', 'Guǐ'];
  const STEM_ELEMENTS = ['Wood', 'Wood', 'Fire', 'Fire', 'Earth', 'Earth', 'Metal', 'Metal', 'Water', 'Water'];

  const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  const BRANCH_PINYIN = ['Zǐ', 'Chǒu', 'Yín', 'Mǎo', 'Chén', 'Sì', 'Wǔ', 'Wèi', 'Shēn', 'Yǒu', 'Xū', 'Hài'];
  const BRANCH_ELEMENTS = ['Water', 'Earth', 'Wood', 'Wood', 'Earth', 'Fire', 'Fire', 'Earth', 'Metal', 'Metal', 'Earth', 'Water'];
  const ANIMALS = ['Rat', 'Ox', 'Tiger', 'Rabbit', 'Dragon', 'Snake', 'Horse', 'Goat', 'Monkey', 'Rooster', 'Dog', 'Pig'];
  const ANIMALS_CN = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];

  // 藏干 — hidden stems inside each branch, main qi (本气) first.
  const HIDDEN_STEMS = {
    子: ['癸'],
    丑: ['己', '癸', '辛'],
    寅: ['甲', '丙', '戊'],
    卯: ['乙'],
    辰: ['戊', '乙', '癸'],
    巳: ['丙', '庚', '戊'],
    午: ['丁', '己'],
    未: ['己', '丁', '乙'],
    申: ['庚', '壬', '戊'],
    酉: ['辛'],
    戌: ['戊', '辛', '丁'],
    亥: ['壬', '甲'],
  };

  // Hidden-stem strength by position: 本气 / 中气 / 余气. Each branch is worth
  // exactly 1 whatever it hides, so a 丑 (three hidden stems) never outweighs a
  // 子 (one) merely by containing more names. Chosen to match the common
  // 6 : 3 : 1 teaching while keeping every branch's total at 1.
  const HIDDEN_WEIGHTS = {
    1: [1],
    2: [0.7, 0.3],
    3: [0.6, 0.3, 0.1],
  };

  const GENERATES = { Wood: 'Fire', Fire: 'Earth', Earth: 'Metal', Metal: 'Water', Water: 'Wood' };
  const CONTROLS = { Wood: 'Earth', Earth: 'Water', Water: 'Fire', Fire: 'Metal', Metal: 'Wood' };

  // The 12 节 (month-defining solar terms), in calendar order, with the sun's
  // apparent longitude that defines each. `month` is the Gregorian month the
  // term always falls in, used only as a search seed.
  const JIE = [
    { name: '小寒', en: 'Minor Cold',      month: 1,  longitude: 285 },
    { name: '立春', en: 'Start of Spring', month: 2,  longitude: 315 },
    { name: '惊蛰', en: 'Awakening Insects', month: 3, longitude: 345 },
    { name: '清明', en: 'Clear and Bright', month: 4, longitude: 15 },
    { name: '立夏', en: 'Start of Summer', month: 5,  longitude: 45 },
    { name: '芒种', en: 'Grain in Ear',    month: 6,  longitude: 75 },
    { name: '小暑', en: 'Minor Heat',      month: 7,  longitude: 105 },
    { name: '立秋', en: 'Start of Autumn', month: 8,  longitude: 135 },
    { name: '白露', en: 'White Dew',       month: 9,  longitude: 165 },
    { name: '寒露', en: 'Cold Dew',        month: 10, longitude: 195 },
    { name: '立冬', en: 'Start of Winter', month: 11, longitude: 225 },
    { name: '大雪', en: 'Major Snow',      month: 12, longitude: 255 },
  ];

  const RAD = Math.PI / 180;
  const JD_UNIX_EPOCH = 2440587.5; // JD at 1970-01-01T00:00:00Z
  const DAY_MS = 86400000;

  /** Julian Day Number for a Gregorian calendar date. */
  function jdn(y, m, d) {
    const a = Math.floor((14 - m) / 12);
    const yy = y + 4800 - a;
    const mm = m + 12 * a - 3;
    return (
      d +
      Math.floor((153 * mm + 2) / 5) +
      365 * yy +
      Math.floor(yy / 4) -
      Math.floor(yy / 100) +
      Math.floor(yy / 400) -
      32045
    );
  }

  // --- Astronomical solar terms (节气) ------------------------------------

  /**
   * ΔT = TT − UT in seconds. Espenak & Meeus polynomial expressions, the set
   * NASA publishes with its eclipse canon. Covers 1901–2100 comfortably.
   */
  function deltaTSeconds(year) {
    let t;
    if (year < 1920) {
      t = year - 1900;
      return -2.79 + 1.494119 * t - 0.0598939 * t * t +
        0.0061966 * Math.pow(t, 3) - 0.000197 * Math.pow(t, 4);
    }
    if (year < 1941) {
      t = year - 1920;
      return 21.20 + 0.84493 * t - 0.076100 * t * t + 0.0020936 * Math.pow(t, 3);
    }
    if (year < 1961) {
      t = year - 1950;
      return 29.07 + 0.407 * t - (t * t) / 233 + Math.pow(t, 3) / 2547;
    }
    if (year < 1986) {
      t = year - 1975;
      return 45.45 + 1.067 * t - (t * t) / 260 - Math.pow(t, 3) / 718;
    }
    if (year < 2005) {
      t = year - 2000;
      return 63.86 + 0.3345 * t - 0.060374 * t * t + 0.0017275 * Math.pow(t, 3) +
        0.000651814 * Math.pow(t, 4) + 0.00002373599 * Math.pow(t, 5);
    }
    if (year < 2050) {
      t = year - 2000;
      return 62.92 + 0.32217 * t + 0.005589 * t * t;
    }
    // 2050–2150
    return -20 + 32 * Math.pow((year - 1820) / 100, 2) - 0.5628 * (2150 - year);
  }

  /**
   * The sun's apparent geocentric longitude in degrees for a Julian Ephemeris
   * Day (Terrestrial Time). Meeus's solar position: geometric mean longitude,
   * equation of the centre, the five planetary/lunar perturbation terms, then
   * nutation and aberration. Good to a few thousandths of a degree, which is
   * a couple of minutes of time.
   */
  function sunApparentLongitude(jde) {
    const T = (jde - 2451545.0) / 36525;
    const T2 = T * T;

    const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T2;
    const M = (357.52911 + 35999.05029 * T - 0.0001537 * T2) * RAD;

    const C =
      (1.914602 - 0.004817 * T - 0.000014 * T2) * Math.sin(M) +
      (0.019993 - 0.000101 * T) * Math.sin(2 * M) +
      0.000289 * Math.sin(3 * M);

    let theta = L0 + C;

    // Perturbations by Venus, Jupiter and the Moon. Meeus publishes these
    // arguments on the 1900.0 epoch (T counted from JD 2415020.0), one Julian
    // century earlier than the J2000 T used above — hence U = T + 1. Feeding
    // them J2000 T instead roughly doubles the residual error, which is how
    // this was caught.
    const U = T + 1;
    const U2 = U * U;
    const A = (153.23 + 22518.7541 * U) * RAD;
    const B = (216.57 + 45037.5082 * U) * RAD;
    const Cp = (312.69 + 32964.3577 * U) * RAD;
    const D = (350.74 + 445267.1142 * U - 0.00144 * U2) * RAD;
    const E = (231.19 + 20.20 * U) * RAD;

    theta +=
      0.00134 * Math.cos(A) +
      0.00154 * Math.cos(B) +
      0.00200 * Math.cos(Cp) +
      0.00179 * Math.sin(D) +
      0.00178 * Math.sin(E);

    // Nutation in longitude + aberration.
    const omega = (125.04 - 1934.136 * T) * RAD;
    const lambda = theta - 0.00569 - 0.00478 * Math.sin(omega);

    return ((lambda % 360) + 360) % 360;
  }

  /** Signed difference a − b folded into (−180, 180]. */
  function norm180(deg) {
    let x = ((deg % 360) + 360) % 360;
    if (x > 180) x -= 360;
    return x;
  }

  /**
   * Instant, as Unix milliseconds UTC, at which the sun reaches
   * `targetLongitude`, searching outward from 00:00 on the seed date. The sun
   * covers ~0.9856°/day, so one Newton step per degree of error converges in
   * three or four iterations.
   */
  function solarLongitudeInstant(year, seedMonth, seedDay, targetLongitude) {
    let jde = jdn(year, seedMonth, seedDay) - 0.5;
    for (let i = 0; i < 20; i++) {
      const diff = norm180(targetLongitude - sunApparentLongitude(jde));
      if (Math.abs(diff) < 1e-8) break;
      jde += diff * (365.2422 / 360);
    }
    const jdUT = jde - deltaTSeconds(year) / 86400;
    return Math.round((jdUT - JD_UNIX_EPOCH) * DAY_MS);
  }

  // Term instants are pure functions of the year, so memoise them. A chart
  // touches at most three years, and a page session a handful.
  const termCache = {};

  /** The 12 节 of a Gregorian year, as `{ ...JIE[i], index, year, utcMs }`. */
  function termsForYear(year) {
    if (termCache[year]) return termCache[year];
    const out = JIE.map(function (jie, index) {
      return {
        index: index,
        name: jie.name,
        en: jie.en,
        longitude: jie.longitude,
        year: year,
        utcMs: solarLongitudeInstant(year, jie.month, 6, jie.longitude),
      };
    });
    termCache[year] = out;
    return out;
  }

  /** The most recent 节 at or before `utcMs`. */
  function governingTerm(utcMs, aroundYear) {
    const window = termsForYear(aroundYear - 1)
      .concat(termsForYear(aroundYear))
      .concat(termsForYear(aroundYear + 1));
    let governing = window[0];
    for (const t of window) {
      if (t.utcMs <= utcMs && t.utcMs > governing.utcMs) governing = t;
    }
    return governing;
  }

  /** The next 节 strictly after `utcMs`. */
  function nextTerm(utcMs, aroundYear) {
    const window = termsForYear(aroundYear - 1)
      .concat(termsForYear(aroundYear))
      .concat(termsForYear(aroundYear + 1));
    let next = null;
    for (const t of window) {
      if (t.utcMs > utcMs && (next === null || t.utcMs < next.utcMs)) next = t;
    }
    return next;
  }

  // --- True Solar Time (真太陽時) helpers ---------------------------------
  //
  // Apparent solar time = clock time + ΔLMT + EoT, where:
  //
  //   ΔLMT  Local Mean Time offset. The birth clock keeps a zone time whose
  //         mean-sun meridian is (utcOffsetMinutes / 4)°E; the true mean sun at
  //         the birthplace crosses the meridian 4 minutes earlier per degree the
  //         place lies east of that zone meridian. Hence
  //           ΔLMT_minutes = 4 × longitudeEast − utcOffsetMinutes.
  //         e.g. Singapore 103.8°E on UTC+8 (480): 4×103.8 − 480 = −64.8 min.
  //
  //   EoT   Equation of Time — the difference between apparent (sundial) and
  //         mean solar time from Earth's orbital eccentricity and axial tilt.
  //         We use the widely-published low-order approximation:
  //           B = 2π(dayOfYear − 81) / 364
  //           EoT_minutes = 9.87·sin(2B) − 7.53·cos(B) − 1.5·sin(B)
  //         Accurate to roughly ±0.3 min across the year — negligible against a
  //         two-hour 时辰.
  //
  // DST is NOT inferred here: pass the clock's actual UTC offset at birth
  // (the widget offers the user a +1h daylight-saving toggle for this).

  /** Day of the year (1–366) for a Gregorian date. */
  function dayOfYear(y, m, d) {
    return jdn(y, m, d) - jdn(y, 1, 1) + 1;
  }

  /** Equation of Time in minutes (apparent − mean), ±~0.3 min. */
  function equationOfTime(y, m, d) {
    const B = (2 * Math.PI * (dayOfYear(y, m, d) - 81)) / 364;
    return 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);
  }

  /** Local Mean Time offset in minutes for a longitude / UTC offset pair. */
  function lmtOffset(longitudeEast, utcOffsetMinutes) {
    return 4 * longitudeEast - utcOffsetMinutes;
  }

  function pillar(stemIndex, branchIndex) {
    return {
      stem: STEMS[stemIndex],
      branch: BRANCHES[branchIndex],
      stemPinyin: STEM_PINYIN[stemIndex],
      branchPinyin: BRANCH_PINYIN[branchIndex],
      stemElement: STEM_ELEMENTS[stemIndex],
      branchElement: BRANCH_ELEMENTS[branchIndex],
      stemPolarity: stemIndex % 2 === 0 ? 'Yang' : 'Yin',
      hiddenStems: HIDDEN_STEMS[BRANCHES[branchIndex]],
      label: STEMS[stemIndex] + BRANCHES[branchIndex],
    };
  }

  /** 十神 — relationship of another stem to the day master stem. */
  function tenGod(dayStemIndex, otherStemIndex) {
    const dm = STEM_ELEMENTS[dayStemIndex];
    const other = STEM_ELEMENTS[otherStemIndex];
    const samePolarity = dayStemIndex % 2 === otherStemIndex % 2;
    if (other === dm) return samePolarity ? { cn: '比肩', en: 'Friend' } : { cn: '劫财', en: 'Rob Wealth' };
    if (GENERATES[dm] === other) return samePolarity ? { cn: '食神', en: 'Eating God' } : { cn: '伤官', en: 'Hurting Officer' };
    if (CONTROLS[dm] === other) return samePolarity ? { cn: '偏财', en: 'Indirect Wealth' } : { cn: '正财', en: 'Direct Wealth' };
    if (CONTROLS[other] === dm) return samePolarity ? { cn: '七杀', en: 'Seven Killings' } : { cn: '正官', en: 'Direct Officer' };
    return samePolarity ? { cn: '偏印', en: 'Indirect Resource' } : { cn: '正印', en: 'Direct Resource' };
  }

  // --- 大运 — the ten-year luck pillars ------------------------------------
  //
  // Direction (阳男阴女顺行 / 阴男阳女逆行): a yang year stem with a male
  // subject, or a yin year stem with a female subject, steps *forward* through
  // the sexagenary cycle from the month pillar. The other two combinations step
  // back. The month pillar itself is not a luck pillar — the first one is the
  // next step along.
  //
  // Starting age (起运数): the distance from birth to the adjacent 节 — the one
  // ahead when stepping forward, the one behind when stepping back — converted
  // at the classical rate of three days to one year. One day is therefore four
  // months and one hour is five days, which is why exact term instants matter
  // here: a term time wrong by a day moves the starting age by four months.
  //
  // The rule is stated in the classical texts as a binary of 男 and 女, and it
  // is the only place in this engine where that input is used. Without it the
  // luck pillars are simply not computed.

  const YEARS_PER_DAY_TO_TERM = 1 / 3;
  const TROPICAL_YEAR_MS = 365.2422 * DAY_MS;

  /** The 0–59 position of a stem/branch pair in the sexagenary cycle. */
  function sexagenaryIndex(stemIndex, branchIndex) {
    for (let n = 0; n < 60; n++) {
      if (n % 10 === stemIndex && n % 12 === branchIndex) return n;
    }
    return -1; // unreachable for a pair the engine produced
  }

  function computeLuckPillars(o) {
    const yangYear = o.yearStem % 2 === 0;
    const male = o.gender === 'male';
    const forward = yangYear === male;
    const dir = forward ? 1 : -1;

    // Distance to the 节 we count against.
    const msToTerm = forward
      ? o.nextTermUtcMs - o.birthUtcMs
      : o.birthUtcMs - o.governingTermUtcMs;
    const daysToTerm = msToTerm / DAY_MS;
    const totalYears = daysToTerm * YEARS_PER_DAY_TO_TERM;

    let years = Math.floor(totalYears);
    let months = Math.round((totalYears - years) * 12);
    if (months >= 12) { years += 1; months = 0; }

    // Calendar date the first luck pillar opens.
    const start = new Date(Date.UTC(o.birthYear + years, o.birthMonth - 1 + months, o.birthDay));

    const monthIndex = sexagenaryIndex(o.monthStem, o.monthBranch);
    const pillars = [];
    for (let k = 1; k <= o.count; k++) {
      const idx = (((monthIndex + dir * k) % 60) + 60) % 60;
      const p = pillar(idx % 10, idx % 12);
      const fromAge = totalYears + (k - 1) * 10;
      const fromYear = start.getUTCFullYear() + (k - 1) * 10;
      pillars.push({
        index: k,
        stem: p.stem,
        branch: p.branch,
        label: p.label,
        stemElement: p.stemElement,
        branchElement: p.branchElement,
        hiddenStems: p.hiddenStems,
        tenGod: tenGod(o.dayStem, STEMS.indexOf(p.stem)),
        startAge: Math.round(fromAge * 10) / 10,
        endAge: Math.round((fromAge + 10) * 10) / 10,
        startYear: fromYear,
        endYear: fromYear + 10,
      });
    }

    // How much slack the inputs leave in the starting age. Three days is one
    // year, so an unknown hour (±12 h) is worth ±2 months and an unknown time
    // zone (±15 h) about ±5 months.
    let ageSlackMonths = 0;
    if (o.precision === 'exact') ageSlackMonths = 0;
    else if (o.precision === 'time-unknown') ageSlackMonths = 2;
    else if (o.precision === 'zone-unknown') ageSlackMonths = 3;
    else ageSlackMonths = 5;

    return {
      gender: o.gender,
      direction: forward ? 'forward' : 'backward',
      directionCn: forward ? '顺行' : '逆行',
      rule: (yangYear ? 'Yang' : 'Yin') + ' year stem ' + STEMS[o.yearStem] + ' with a ' +
        (male ? 'male' : 'female') + ' subject — ' +
        (yangYear
          ? (male ? '阳男顺行' : '阳女逆行')
          : (male ? '阴男逆行' : '阴女顺行')) +
        ', so the pillars step ' + (forward ? 'forward' : 'backward') +
        ' from the month pillar.',
      anchorTerm: {
        name: forward ? o.nextTermName : o.governingTermName,
        which: forward ? 'next' : 'previous',
      },
      daysToTerm: Math.round(daysToTerm * 100) / 100,
      startAge: {
        years: years,
        months: months,
        total: Math.round(totalYears * 100) / 100,
      },
      startDate: {
        year: start.getUTCFullYear(),
        month: start.getUTCMonth() + 1,
        day: start.getUTCDate(),
      },
      uncertaintyMonths: ageSlackMonths,
      pillars: pillars,
    };
  }

  /** Which luck pillar covers `atMs`, or null before the first one opens. */
  function currentLuckPillar(luck, birthUtcMs, atMs) {
    if (!luck) return null;
    const ageYears = (atMs - birthUtcMs) / TROPICAL_YEAR_MS;
    for (const p of luck.pillars) {
      if (ageYears >= p.startAge && ageYears < p.endAge) return p.index;
    }
    return null;
  }

  // --- Input validation ---------------------------------------------------

  function wholeNumber(value, name, lo, hi) {
    if (typeof value !== 'number' || !isFinite(value) || Math.floor(value) !== value) {
      throw new Error(name + ' must be a whole number');
    }
    if (value < lo || value > hi) {
      throw new Error(name + ' must be between ' + lo + ' and ' + hi + ' (got ' + value + ')');
    }
    return value;
  }

  function finiteNumber(value, name, lo, hi) {
    if (typeof value !== 'number' || !isFinite(value)) {
      throw new Error(name + ' must be a finite number');
    }
    if (value < lo || value > hi) {
      throw new Error(name + ' must be between ' + lo + ' and ' + hi + ' (got ' + value + ')');
    }
    return value;
  }

  /**
   * Compute a BaZi chart.
   * @param {Object} input
   * @param {number} input.year   Gregorian year (1901–2100)
   * @param {number} input.month  1–12
   * @param {number} input.day    1–31, must exist in that month
   * @param {number} [input.hour]   0–23, omit/null if birth time unknown
   * @param {number} [input.minute] 0–59
   * @param {number} [input.longitude]        birthplace longitude °E (west negative)
   * @param {number} [input.utcOffsetMinutes] the birth clock's UTC offset in minutes
   *   (e.g. 480 for UTC+8). Enables an exact solar-term boundary, and — together
   *   with `longitude` and a known birth time — the True Solar Time correction.
   * @param {string} [input.gender] 'male' or 'female'. Used only to fix the
   *   direction of the luck pillars (大运), whose classical rule is stated as a
   *   binary of 男 / 女. Omit it and `luckPillars` comes back null.
   * @param {Object} [options]
   * @param {number} [options.luckPillarCount] how many luck pillars to return (default 10)
   * @param {boolean} [options.lateZiSameDay] keep 23:00–23:59 on the current day
   * @param {boolean} [options.useAlternateTerm] internal: cast the chart on the
   *   other side of an ambiguous solar-term boundary
   */
  function computeChart(input, options) {
    options = options || {};
    if (!input || typeof input !== 'object') throw new Error('computeChart requires an input object');

    const year = wholeNumber(input.year, 'year', 1901, 2100);
    const month = wholeNumber(input.month, 'month', 1, 12);
    const day = wholeNumber(input.day, 'day', 1, 31);

    // Reject dates the calendar does not contain (30 February and friends),
    // which Date.UTC would otherwise roll silently into the next month.
    const probe = new Date(Date.UTC(year, month - 1, day));
    if (probe.getUTCFullYear() !== year || probe.getUTCMonth() + 1 !== month || probe.getUTCDate() !== day) {
      throw new Error(
        year + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0') + ' is not a real date'
      );
    }

    const timeKnown = input.hour !== undefined && input.hour !== null;
    const hour = timeKnown ? wholeNumber(input.hour, 'hour', 0, 23) : null;
    const minute =
      input.minute === undefined || input.minute === null ? 0 : wholeNumber(input.minute, 'minute', 0, 59);

    const lon =
      input.longitude === undefined || input.longitude === null
        ? null
        : finiteNumber(input.longitude, 'longitude', -180, 180);
    const utcOff =
      input.utcOffsetMinutes === undefined || input.utcOffsetMinutes === null
        ? null
        : finiteNumber(input.utcOffsetMinutes, 'utcOffsetMinutes', -12 * 60, 14 * 60);

    // Only the luck pillars use this, and only because the classical direction
    // rule is stated as a binary. Omit it and they are not computed.
    let gender = input.gender === undefined || input.gender === null ? null : input.gender;
    if (gender !== null) {
      gender = String(gender).toLowerCase();
      if (gender === 'm' || gender === '男') gender = 'male';
      if (gender === 'f' || gender === '女') gender = 'female';
      if (gender !== 'male' && gender !== 'female') {
        throw new Error("gender must be 'male', 'female', or omitted");
      }
    }

    // --- True Solar Time correction ---------------------------------------
    // Only when longitude AND utcOffsetMinutes are both supplied and the birth
    // time is known. Otherwise the clock time is used verbatim.
    const solarEligible = timeKnown && lon !== null && utcOff !== null;

    // These start as the raw clock date/time and are overwritten if corrected.
    let cy = year, cm = month, cd = day, ch = hour, cmin = minute;
    let solar;
    if (solarEligible) {
      const lmtMinutes = lmtOffset(lon, utcOff);
      const eotMinutes = equationOfTime(year, month, day);
      const correctionMinutes = lmtMinutes + eotMinutes;
      // Add the correction to the clock time and re-normalise the calendar,
      // so a correction crossing midnight also shifts the effective date.
      const base = Date.UTC(year, month - 1, day, hour, minute);
      const corrected = new Date(base + correctionMinutes * 60000);
      cy = corrected.getUTCFullYear();
      cm = corrected.getUTCMonth() + 1;
      cd = corrected.getUTCDate();
      ch = corrected.getUTCHours();
      cmin = corrected.getUTCMinutes();
      solar = {
        applied: true,
        correctionMinutes: Math.round(correctionMinutes * 10) / 10,
        lmtMinutes: Math.round(lmtMinutes * 10) / 10,
        eotMinutes: Math.round(eotMinutes * 10) / 10,
        longitude: lon,
        utcOffsetMinutes: utcOff,
        corrected: { year: cy, month: cm, day: cd, hour: ch, minute: cmin },
        note:
          'True solar time (真太陽時): clock time + local-mean-time offset + equation of time. ' +
          'DST is taken as given in the UTC offset, not inferred.',
      };
    } else {
      solar = {
        applied: false,
        correctionMinutes: 0,
        lmtMinutes: null,
        eotMinutes: null,
        longitude: lon,
        utcOffsetMinutes: utcOff,
        corrected: null,
        note: !timeKnown
          ? 'Birth time unknown — no hour pillar and no solar-time correction.'
          : 'Solar-time correction not applied — birth time read as local clock time.',
      };
    }

    // --- Day pillar ---------------------------------------------------------
    // The sexagenary day cycle, keyed off the (possibly solar-corrected) civil
    // date, with 23:00+ rolling into the next day. Anchor: 2000-01-01 = 戊午.
    const effHour = ch;
    let eff = new Date(Date.UTC(cy, cm - 1, cd));
    if (effHour !== null && effHour >= 23 && !options.lateZiSameDay) {
      eff = new Date(eff.getTime() + DAY_MS);
    }
    const dayIndex = (((jdn(eff.getUTCFullYear(), eff.getUTCMonth() + 1, eff.getUTCDate()) + 49) % 60) + 60) % 60;
    const dayStem = dayIndex % 10;
    const dayBranch = dayIndex % 12;

    // --- Solar-term boundary ------------------------------------------------
    // A term is an instant in absolute time, so it is compared against the
    // absolute birth instant — never against the solar-corrected clock, and
    // never against the 23:00-rolled day.
    //
    // Placing the birth on an absolute timeline needs the clock's UTC offset.
    // Without it we can still answer confidently as long as the birth is more
    // than 15 hours from the term, because no time zone is further from UTC
    // than that. Inside that window the question is genuinely open, and both
    // candidate readings are returned.
    const nominalHour = timeKnown ? hour : 12;
    const nominalMinute = timeKnown ? minute : 0;
    const localMs = Date.UTC(year, month - 1, day, nominalHour, nominalMinute);
    const birthUtcMs = utcOff !== null ? localMs - utcOff * 60000 : localMs;

    const ZONE_SLACK_MS = 15 * 3600000;         // widest possible zone offset
    const UNKNOWN_HOUR_SLACK_MS = 12 * 3600000; // ±12h around the nominal noon
    const TERM_ACCURACY_MS = 5 * 60000;         // our own term-instant precision

    let slack = TERM_ACCURACY_MS;
    let precision = 'exact';
    if (utcOff === null) {
      slack = ZONE_SLACK_MS;
      precision = 'zone-unknown';
    }
    if (!timeKnown) {
      slack = Math.max(slack, UNKNOWN_HOUR_SLACK_MS);
      precision = utcOff === null ? 'zone-and-time-unknown' : 'time-unknown';
    }

    let governing = governingTerm(birthUtcMs, year);
    let upcoming = nextTerm(birthUtcMs, year);

    // Which term is in doubt, if any: the one we are within `slack` of.
    const gapBehind = birthUtcMs - governing.utcMs;
    const gapAhead = upcoming.utcMs - birthUtcMs;
    const ambiguous = gapBehind < slack || gapAhead < slack;
    const slackMinutes = Math.round(slack / 60000);

    // `useAlternateTerm` casts the other candidate: if the nearer term is the
    // one just passed, step back to the previous 节; if it is the one coming,
    // step forward.
    if (options.useAlternateTerm) {
      if (gapAhead <= gapBehind) {
        governing = upcoming;
        upcoming = nextTerm(governing.utcMs, governing.year);
      } else {
        const previous = governingTerm(governing.utcMs - 1, governing.year);
        upcoming = governing;
        governing = previous;
      }
    }

    // --- Month and year pillars from the governing 节 ------------------------
    // Solar month: 寅 month (立春) = 1 … 丑 month (小寒) = 12. A birth governed
    // by 小寒 sits in January, before 立春, so it belongs to the previous
    // sexagenary year.
    const monthNumber = ((JIE[governing.index].month + 10) % 12) + 1;
    const monthBranch = (monthNumber + 1) % 12;
    const pillarYear = governing.index === 0 ? governing.year - 1 : governing.year;

    const yearOffset = (((pillarYear - 4) % 60) + 60) % 60;
    const yearStem = yearOffset % 10;
    const yearBranch = yearOffset % 12;

    // 五虎遁 — month stem from year stem
    const firstMonthStem = ((yearStem % 5) * 2 + 2) % 10;
    const monthStem = (firstMonthStem + monthNumber - 1) % 10;

    // --- Hour pillar (五鼠遁 — hour stem from day stem) ---------------------
    // Uses the corrected hour (effHour) when solar time was applied.
    let hourPillar = null;
    if (effHour !== null) {
      const hourBranch = Math.floor((effHour + 1) / 2) % 12;
      const hourStem = (dayStem * 2 + hourBranch) % 10;
      hourPillar = pillar(hourStem, hourBranch);
    }

    const pillars = {
      year: pillar(yearStem, yearBranch),
      month: pillar(monthStem, monthBranch),
      day: pillar(dayStem, dayBranch),
      hour: hourPillar,
    };

    // --- Element distributions ----------------------------------------------
    // Two views of the same chart, both totalling one unit per character:
    //   elementCounts   the eight characters at face value (integers)
    //   elementWeights  each branch's unit split across its hidden stems by
    //                   本气 / 中气 / 余气 strength
    const elementCounts = { Wood: 0, Fire: 0, Earth: 0, Metal: 0, Water: 0 };
    const elementWeights = { Wood: 0, Fire: 0, Earth: 0, Metal: 0, Water: 0 };
    // 十神 across the whole chart, on the same weighted basis. The day stem is
    // the reference itself, so it is not counted.
    const tenGodWeights = {};
    let tenGodTotal = 0;

    function addGod(stemChar, weight) {
      const i = STEMS.indexOf(stemChar);
      if (i < 0) return;
      const g = tenGod(dayStem, i);
      if (!tenGodWeights[g.en]) tenGodWeights[g.en] = { cn: g.cn, en: g.en, weight: 0 };
      tenGodWeights[g.en].weight += weight;
      tenGodTotal += weight;
    }

    for (const key of ['year', 'month', 'day', 'hour']) {
      const p = pillars[key];
      if (!p) continue;

      elementCounts[p.stemElement]++;
      elementCounts[p.branchElement]++;

      elementWeights[p.stemElement] += 1;
      if (key !== 'day') addGod(p.stem, 1);

      const hidden = p.hiddenStems;
      const weights = HIDDEN_WEIGHTS[hidden.length];
      hidden.forEach(function (stemChar, i) {
        const w = weights[i];
        elementWeights[STEM_ELEMENTS[STEMS.indexOf(stemChar)]] += w;
        addGod(stemChar, w);
      });
    }

    for (const el of Object.keys(elementWeights)) {
      elementWeights[el] = Math.round(elementWeights[el] * 100) / 100;
    }

    // --- 大运 ---------------------------------------------------------------
    const luck = gender
      ? computeLuckPillars({
          gender: gender,
          yearStem: yearStem,
          monthStem: monthStem,
          monthBranch: monthBranch,
          dayStem: dayStem,
          birthYear: year, birthMonth: month, birthDay: day,
          birthUtcMs: birthUtcMs,
          governingTermUtcMs: governing.utcMs,
          nextTermUtcMs: upcoming.utcMs,
          governingTermName: governing.name,
          nextTermName: upcoming.name,
          precision: precision,
          count: options.luckPillarCount || 10,
        })
      : null;

    // Legacy shape: the visible-stem ten gods, keyed by pillar.
    const tenGods = {};
    for (const key of ['year', 'month', 'hour']) {
      const p = pillars[key];
      if (!p) continue;
      tenGods[key + 'Stem'] = tenGod(dayStem, STEMS.indexOf(p.stem));
    }

    function describeTerm(t) {
      return {
        name: t.name,
        en: t.en,
        longitude: t.longitude,
        utcMs: t.utcMs,
        utcIso: new Date(t.utcMs).toISOString(),
        local: utcOff !== null ? localParts(t.utcMs + utcOff * 60000) : null,
        chinaStandard: localParts(t.utcMs + 480 * 60000),
      };
    }

    return {
      input: {
        year, month, day,
        hour, minute: timeKnown ? minute : null,
        timeKnown: timeKnown,
        longitude: lon,
        utcOffsetMinutes: utcOff,
        gender: gender,
      },
      solar,
      pillars,
      luckPillars: luck,
      dayMaster: {
        stem: STEMS[dayStem],
        pinyin: STEM_PINYIN[dayStem],
        element: STEM_ELEMENTS[dayStem],
        polarity: dayStem % 2 === 0 ? 'Yang' : 'Yin',
      },
      zodiac: { animal: ANIMALS[yearBranch], cn: ANIMALS_CN[yearBranch] },
      elementCounts,
      elementWeights,
      tenGods,
      tenGodWeights,
      tenGodTotal: Math.round(tenGodTotal * 100) / 100,
      solarMonth: { number: monthNumber, governingTerm: governing.name },
      termBoundary: {
        governing: describeTerm(governing),
        next: describeTerm(upcoming),
        hoursSinceGoverning: Math.round((gapBehind / 3600000) * 10) / 10,
        hoursUntilNext: Math.round((gapAhead / 3600000) * 10) / 10,
        precision: precision,
        ambiguous: ambiguous,
        uncertaintyMinutes: slackMinutes,
        nearer: gapAhead <= gapBehind ? 'next' : 'governing',
      },
      // Kept for compatibility: true when the birth sits within a day of a term.
      nearTermBoundary: gapBehind < DAY_MS || gapAhead < DAY_MS,
      conventions: {
        dayBoundary: options.lateZiSameDay
          ? '晚子时 (day changes at midnight)'
          : '子时 starts the new day (day changes at 23:00)',
        timezone: solar.applied
          ? 'true solar time (真太陽時) applied: ' + solar.correctionMinutes + ' min correction'
          : 'local clock time at birthplace, no solar-time correction',
        hiddenStems: 'branches weighted 本气/中气/余气, each branch totalling one unit',
      },
    };
  }

  /** Break a Unix ms value into calendar parts, treating it as already local. */
  function localParts(ms) {
    const d = new Date(ms);
    return {
      year: d.getUTCFullYear(),
      month: d.getUTCMonth() + 1,
      day: d.getUTCDate(),
      hour: d.getUTCHours(),
      minute: d.getUTCMinutes(),
    };
  }

  /** One-line text summary, e.g. for cart line-item properties. */
  function chartSummary(chart) {
    const p = chart.pillars;
    const parts = [
      '年柱 ' + p.year.label,
      '月柱 ' + p.month.label,
      '日柱 ' + p.day.label,
      '时柱 ' + (p.hour ? p.hour.label : '未知'),
    ];
    return parts.join(' | ') + ' | 日主 ' + chart.dayMaster.stem + ' (' + chart.dayMaster.polarity + ' ' + chart.dayMaster.element + ')';
  }

  return {
    computeChart,
    chartSummary,
    termsForYear,
    currentLuckPillar,
    STEMS,
    BRANCHES,
    ANIMALS,
    JIE,
    HIDDEN_STEMS,
    _internal: {
      jdn,
      tenGod,
      equationOfTime,
      lmtOffset,
      dayOfYear,
      sunApparentLongitude,
      solarLongitudeInstant,
      deltaTSeconds,
      governingTerm,
      nextTerm,
    },
  };
});
