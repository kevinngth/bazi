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
 * - Solar terms (节气) are computed with the standard Y*0.2422+C
 *   approximation, accurate to the day for 1901–2100. Births on a term
 *   boundary day are flagged via `nearTermBoundary` since the exact hour of
 *   the term is not modelled.
 * - The day is treated as starting at 23:00 (子时 begins the new day). Set
 *   `options.lateZiSameDay = true` to keep 23:00–23:59 on the current day
 *   (晚子时 convention).
 * - Birth time is interpreted as local clock time at the birthplace unless a
 *   True Solar Time (真太陽時) correction is requested. When both `longitude`
 *   (°E, west negative) and `utcOffsetMinutes` (the birth clock's UTC offset)
 *   are supplied AND the birth time is known, the clock time is corrected to
 *   apparent solar time (Local Mean Time offset + Equation of Time) before the
 *   hour branch, 23:00 day-rollover, and thus the day/month/year pillars are
 *   derived. See computeChart and the `solar` output block for the working.
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

  // 藏干 — hidden stems inside each branch (main qi first).
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

  const GENERATES = { Wood: 'Fire', Fire: 'Earth', Earth: 'Metal', Metal: 'Water', Water: 'Wood' };
  const CONTROLS = { Wood: 'Earth', Earth: 'Water', Water: 'Fire', Fire: 'Metal', Metal: 'Wood' };

  // The 12 节 (month-defining solar terms), one per calendar month.
  // C constants for day = floor(Y*0.2422 + C) - leapAdjustment, per the
  // standard 20th/21st-century approximation tables.
  const JIE = [
    { name: '小寒', month: 1, c20: 6.11, c21: 5.4055 },
    { name: '立春', month: 2, c20: 4.6295, c21: 3.87 },
    { name: '惊蛰', month: 3, c20: 6.318, c21: 5.63 },
    { name: '清明', month: 4, c20: 5.59, c21: 4.81 },
    { name: '立夏', month: 5, c20: 6.318, c21: 5.52 },
    { name: '芒种', month: 6, c20: 6.5, c21: 5.678 },
    { name: '小暑', month: 7, c20: 7.928, c21: 7.108 },
    { name: '立秋', month: 8, c20: 8.35, c21: 7.5 },
    { name: '白露', month: 9, c20: 8.44, c21: 7.646 },
    { name: '寒露', month: 10, c20: 9.098, c21: 8.318 },
    { name: '立冬', month: 11, c20: 8.218, c21: 7.438 },
    { name: '大雪', month: 12, c20: 7.9, c21: 7.18 },
  ];

  // Documented one-day corrections to the approximation formula.
  // Keyed by `${termName}-${year}`, value is the day offset.
  const JIE_EXCEPTIONS = {
    '小寒-1982': 1,
    '小寒-2019': -1,
    '立夏-1911': 1,
    '芒种-1902': 1,
    '小暑-1925': 1,
    '小暑-2016': 1,
    '立秋-2002': 1,
    '白露-1927': 1,
    '立冬-2089': 1,
    '大雪-1954': 1,
  };

  /** Day-of-month on which the given 节 falls in the given year. */
  function jieDay(year, jie) {
    let y, c;
    if (year <= 2000) {
      y = year - 1900; // 2000 is treated as Y=100 in the 20th-century table
      c = jie.c20;
    } else {
      y = year - 2000;
      c = jie.c21;
    }
    const leap = jie.month <= 2 ? Math.floor((y - 1) / 4) : Math.floor(y / 4);
    let day = Math.floor(y * 0.2422 + c) - leap;
    day += JIE_EXCEPTIONS[jie.name + '-' + year] || 0;
    return day;
  }

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

  // --- True Solar Time (真太陽時) helpers ---------------------------------
  //
  // Apparent solar time = clock time + ΔLMT + EoT, where:
  //
  //   ΔLMT  Local Mean Time offset. The birth clock keeps a zone time whose
  //         mean-sun meridian is (utcOffsetMinutes / 4)°E; the true mean sun at
  //         the birthplace crosses the meridian 4 minutes earlier per degree the
  //         place lies east of that zone meridian. Hence
  //           ΔLMT_minutes = 4 × longitudeEast − utcOffsetMinutes.
  //         e.g. Singapore 103.85°E on UTC+8 (480): 4×103.85 − 480 = −64.6 min.
  //
  //   EoT   Equation of Time — the difference between apparent (sundial) and
  //         mean solar time from Earth's orbital eccentricity and axial tilt.
  //         We use the widely-published low-order approximation:
  //           B = 2π(dayOfYear − 81) / 364
  //           EoT_minutes = 9.87·sin(2B) − 7.53·cos(B) − 1.5·sin(B)
  //         Accurate to roughly ±0.3 min across the year — far finer than the
  //         day-level solar-term resolution elsewhere in this engine, so it
  //         never limits pillar accuracy. (dayOfYear uses the civil date.)
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
    if (dayStemIndex === otherStemIndex) return { cn: '比肩', en: 'Friend' };
    const dm = STEM_ELEMENTS[dayStemIndex];
    const other = STEM_ELEMENTS[otherStemIndex];
    const samePolarity = dayStemIndex % 2 === otherStemIndex % 2;
    if (other === dm) return samePolarity ? { cn: '比肩', en: 'Friend' } : { cn: '劫财', en: 'Rob Wealth' };
    if (GENERATES[dm] === other) return samePolarity ? { cn: '食神', en: 'Eating God' } : { cn: '伤官', en: 'Hurting Officer' };
    if (CONTROLS[dm] === other) return samePolarity ? { cn: '偏财', en: 'Indirect Wealth' } : { cn: '正财', en: 'Direct Wealth' };
    if (CONTROLS[other] === dm) return samePolarity ? { cn: '七杀', en: 'Seven Killings' } : { cn: '正官', en: 'Direct Officer' };
    return samePolarity ? { cn: '偏印', en: 'Indirect Resource' } : { cn: '正印', en: 'Direct Resource' };
  }

  /**
   * Compute a BaZi chart.
   * @param {Object} input
   * @param {number} input.year   Gregorian year (1901–2100)
   * @param {number} input.month  1–12
   * @param {number} input.day    1–31
   * @param {number} [input.hour]   0–23, omit/null if birth time unknown
   * @param {number} [input.minute] 0–59
   * @param {number} [input.longitude]        birthplace longitude °E (west negative)
   * @param {number} [input.utcOffsetMinutes] the birth clock's UTC offset in minutes
   *   (e.g. 480 for UTC+8). When both this and `longitude` are present AND the
   *   birth time is known, a True Solar Time correction is applied.
   * @param {Object} [options]
   * @param {boolean} [options.lateZiSameDay] keep 23:00–23:59 on the current day
   */
  function computeChart(input, options) {
    options = options || {};
    const { year, month, day } = input;
    const hour = input.hour === undefined || input.hour === null ? null : input.hour;
    const minute = input.minute === undefined || input.minute === null ? 0 : input.minute;

    if (!year || !month || !day || year < 1901 || year > 2100) {
      throw new Error('computeChart requires a Gregorian date between 1901 and 2100');
    }

    // --- True Solar Time correction ---------------------------------------
    // Only when longitude AND utcOffsetMinutes are both supplied and the birth
    // time is known. Otherwise the clock time is used verbatim (legacy path).
    const lon = input.longitude;
    const utcOff = input.utcOffsetMinutes;
    const solarEligible =
      hour !== null &&
      typeof lon === 'number' && isFinite(lon) &&
      typeof utcOff === 'number' && isFinite(utcOff);

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
        longitude: typeof lon === 'number' ? lon : null,
        utcOffsetMinutes: typeof utcOff === 'number' ? utcOff : null,
        corrected: null,
        note:
          hour === null
            ? 'Birth time unknown — no hour pillar and no solar-time correction.'
            : 'Solar-time correction not applied — birth time read as local clock time.',
      };
    }

    // From here the (possibly corrected) civil date/time drives every pillar.
    const effHour = ch;

    // Effective date for the day pillar: 23:00+ rolls into the next day
    // unless lateZiSameDay is set.
    let eff = new Date(Date.UTC(cy, cm - 1, cd));
    if (effHour !== null && effHour >= 23 && !options.lateZiSameDay) {
      eff = new Date(eff.getTime() + 86400000);
    }
    const ey = eff.getUTCFullYear();
    const em = eff.getUTCMonth() + 1;
    const ed = eff.getUTCDate();

    // --- Day pillar (sexagenary day cycle via JDN; anchor: 2000-01-01 = 戊午) ---
    const dayIndex = (((jdn(ey, em, ed) + 49) % 60) + 60) % 60;
    const dayStem = dayIndex % 10;
    const dayBranch = dayIndex % 12;

    // --- Month pillar (governing 节 = most recent jie on/before the date) ---
    const monthJie = JIE[em - 1]; // the jie that falls inside calendar month `em`
    let jieYear = ey;
    let jieIdx = em - 1;
    if (ed < jieDay(ey, monthJie)) {
      // before this month's jie → governed by previous month's jie
      jieIdx = em - 2;
      if (jieIdx < 0) {
        jieIdx = 11; // December's 大雪 of the previous year
        jieYear = ey - 1;
      }
    }
    const governingJie = JIE[jieIdx];
    // Solar month number: 寅 month (立春, Feb) = 1 ... 丑 month (小寒, Jan) = 12
    const monthNumber = ((governingJie.month + 10) % 12) + 1;
    const monthBranch = (monthNumber + 1) % 12;

    // --- Year pillar (year changes at 立春) ---
    const lichun = JIE[1];
    let pillarYear = ey;
    if (em < 2 || (em === 2 && ed < jieDay(ey, lichun))) pillarYear = ey - 1;
    const yearOffset = (((pillarYear - 4) % 60) + 60) % 60;
    const yearStem = yearOffset % 10;
    const yearBranch = yearOffset % 12;

    // 五虎遁 — month stem from year stem
    const firstMonthStem = ((yearStem % 5) * 2 + 2) % 10;
    const monthStem = (firstMonthStem + monthNumber - 1) % 10;

    // --- Hour pillar (五鼠遁 — hour stem from day stem) ---
    // Uses the corrected hour (effHour) when solar time was applied.
    let hourPillar = null;
    if (effHour !== null) {
      const hourBranch = Math.floor((effHour + 1) / 2) % 12;
      // Note: the day stem used here is the effective day's stem.
      const hourStem = (dayStem * 2 + hourBranch) % 10;
      hourPillar = pillar(hourStem, hourBranch);
    }

    const pillars = {
      year: pillar(yearStem, yearBranch),
      month: pillar(monthStem, monthBranch),
      day: pillar(dayStem, dayBranch),
      hour: hourPillar,
    };

    // --- Five element distribution (visible stems + branch main elements) ---
    const elementCounts = { Wood: 0, Fire: 0, Earth: 0, Metal: 0, Water: 0 };
    for (const key of ['year', 'month', 'day', 'hour']) {
      const p = pillars[key];
      if (!p) continue;
      elementCounts[p.stemElement]++;
      elementCounts[p.branchElement]++;
    }

    // --- Ten gods for each visible stem (relative to the day master) ---
    const tenGods = {};
    for (const key of ['year', 'month', 'hour']) {
      const p = pillars[key];
      if (!p) continue;
      tenGods[key + 'Stem'] = tenGod(dayStem, STEMS.indexOf(p.stem));
    }

    // --- Boundary proximity flag (within a day of the governing or next 节) ---
    const birthJdn = jdn(ey, em, ed);
    const nextIdx = (jieIdx + 1) % 12;
    const nextYear = jieIdx === 11 ? jieYear + 1 : jieYear;
    const govJdn = jdn(jieYear, governingJie.month, jieDay(jieYear, governingJie));
    const nextJdn = jdn(nextYear, JIE[nextIdx].month, jieDay(nextYear, JIE[nextIdx]));
    const nearTermBoundary = Math.abs(birthJdn - govJdn) <= 1 || Math.abs(birthJdn - nextJdn) <= 1;

    return {
      input: {
        year, month, day,
        hour, minute: input.minute === undefined ? null : input.minute,
        timeKnown: hour !== null,
        longitude: typeof lon === 'number' ? lon : null,
        utcOffsetMinutes: typeof utcOff === 'number' ? utcOff : null,
      },
      solar,
      pillars,
      dayMaster: {
        stem: STEMS[dayStem],
        pinyin: STEM_PINYIN[dayStem],
        element: STEM_ELEMENTS[dayStem],
        polarity: dayStem % 2 === 0 ? 'Yang' : 'Yin',
      },
      zodiac: { animal: ANIMALS[yearBranch], cn: ANIMALS_CN[yearBranch] },
      elementCounts,
      tenGods,
      solarMonth: { number: monthNumber, governingTerm: governingJie.name },
      nearTermBoundary,
      conventions: {
        dayBoundary: options.lateZiSameDay ? '晚子时 (day changes at midnight)' : '子时 starts the new day (day changes at 23:00)',
        timezone: solar.applied
          ? 'true solar time (真太陽時) applied: ' + solar.correctionMinutes + ' min correction'
          : 'local clock time at birthplace, no solar-time correction',
      },
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
    STEMS,
    BRANCHES,
    ANIMALS,
    _internal: { jieDay, jdn, tenGod, equationOfTime, lmtOffset, dayOfYear },
  };
});
