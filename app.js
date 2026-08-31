/* The Four Pillars: BaZi calculator UI.
   All calculation is deterministic and happens in bazi.js. This file is
   presentation only: no network calls, no tracking, no build step. */
(function () {
  'use strict';

  if (!window.BaZi) throw new Error('bazi.js must load before app.js');

  // ── Interpretation copy (fixed lookups, nothing generated) ─────────────

  var DAY_MASTER = {
    '甲': { name: 'Yang Wood', image: 'the tall tree',
      desc: 'Upright, principled and steady. You grow in one direction, and you would rather lead by example than by persuasion.' },
    '乙': { name: 'Yin Wood', image: 'the vine',
      desc: 'Adaptable, gentle and quietly persistent. You make your way around obstacles rather than through them, and you grow through people.' },
    '丙': { name: 'Yang Fire', image: 'the sun',
      desc: 'Radiant, warm and hard to overlook. You give energy generously and tend to brighten whatever room you are in.' },
    '丁': { name: 'Yin Fire', image: 'the lamp',
      desc: 'A focused, considered warmth. You illuminate detail rather than flood a room, and your attention lands exactly where it is needed.' },
    '戊': { name: 'Yang Earth', image: 'the mountain',
      desc: 'Steadfast, grounded and protective. People lean on you, and you change slowly and deliberately.' },
    '己': { name: 'Yin Earth', image: 'the field',
      desc: 'Nurturing, accommodating and quietly productive. You make things grow by tending them, not by forcing them.' },
    '庚': { name: 'Yang Metal', image: 'the blade',
      desc: 'Direct, decisive and justice-minded. You cut through noise, and would rather be honest than comfortable.' },
    '辛': { name: 'Yin Metal', image: 'the jewel',
      desc: 'Precise, discerning and quietly exacting. You notice what others miss, and you care how things are finished.' },
    '壬': { name: 'Yang Water', image: 'the ocean',
      desc: 'Expansive, strategic and always in motion. You think in wide horizons and are difficult to contain.' },
    '癸': { name: 'Yin Water', image: 'the rain',
      desc: 'Perceptive, intuitive and subtle. You sense undercurrents early and work quietly, reaching everywhere.' }
  };

  // Five relationships to the Day Master. The alarming English names are
  // literal translations of old terms. They describe, they do not judge.
  var FAMILIES = [
    { name: 'Peers', hz: '比劫', gods: ['Friend', 'Rob Wealth'],
      what: 'Your own drive. Independence, confidence, competitiveness, and the allies and rivals around you.' },
    { name: 'Output', hz: '食伤', gods: ['Eating God', 'Hurting Officer'],
      what: 'What you create and express: talent, originality, and doing things your own way.' },
    { name: 'Wealth', hz: '财', gods: ['Direct Wealth', 'Indirect Wealth'],
      what: 'What you control and turn into results. Money, resources, and the material world.' },
    { name: 'Authority', hz: '官杀', gods: ['Direct Officer', 'Seven Killings'],
      what: 'What structures you: discipline, duty, status, pressure and self-control.' },
    { name: 'Resource', hz: '印', gods: ['Direct Resource', 'Indirect Resource'],
      what: 'What supports you. Learning, knowledge, nurture, and having something behind you.' }
  ];

  var GLOSS = {
    'Friend':            'Your own willpower and independence. People who work the way you do.',
    'Rob Wealth':        'Bold, competitive drive. Resources tend to move rather than sit still.',
    'Eating God':        'Easy, generous creativity. Making and enjoying things at your own pace.',
    'Hurting Officer':   'Original, expressive talent that resists being boxed in by rules.',
    'Direct Wealth':     'Steady, earned income and careful stewardship of what you have.',
    'Indirect Wealth':   'Opportunistic money sense: deals, ventures and windfalls.',
    'Direct Officer':    'Structure and duty; status earned by playing within the rules.',
    'Seven Killings':    'Pressure and challenge; decisive action when the stakes are high.',
    'Direct Resource':   'Formal learning, mentors, and steady support behind you.',
    'Indirect Resource': 'Unconventional learning: intuition, niche expertise, self-teaching.'
  };

  // Chinese for each god, so a reader can check this chart against any other
  // calculator. The engine returns these too; this table keeps the order fixed.
  var GOD_HZ = {
    'Friend': '比肩', 'Rob Wealth': '劫财',
    'Eating God': '食神', 'Hurting Officer': '伤官',
    'Direct Wealth': '正财', 'Indirect Wealth': '偏财',
    'Direct Officer': '正官', 'Seven Killings': '七杀',
    'Direct Resource': '正印', 'Indirect Resource': '偏印'
  };

  var ELEMENT_HZ = { Wood: '木', Fire: '火', Earth: '土', Metal: '金', Water: '水' };
  var ELEMENT_VAR = { Wood: '--wood', Fire: '--fire', Earth: '--earth', Metal: '--metal', Water: '--water' };
  var ELEMENTS = ['Wood', 'Fire', 'Earth', 'Metal', 'Water'];
  var GENERATES = { Wood: 'Fire', Fire: 'Earth', Earth: 'Metal', Metal: 'Water', Water: 'Wood' };

  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

  // ── Small helpers ──────────────────────────────────────────────────────

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function fmtOffset(min) {
    var sign = min < 0 ? '-' : '+';
    var a = Math.abs(min);
    return 'UTC' + sign + pad(Math.floor(a / 60)) + ':' + pad(a % 60);
  }
  function fmtLon(lon) {
    return Math.abs(lon).toFixed(1) + '°' + (lon < 0 ? 'W' : 'E');
  }
  /** "4 February 2024, 16:24" from the engine's calendar-parts objects. */
  function fmtParts(p) {
    return p.day + ' ' + MONTHS[p.month - 1] + ' ' + p.year + ', ' + pad(p.hour) + ':' + pad(p.minute);
  }
  function reduceMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /* Clipboard with a fallback: navigator.clipboard is undefined outside a
     secure context, which includes opening this file straight from disk. */
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      ok ? resolve() : reject(new Error('copy unavailable'));
    });
  }

  function flash(btn, msg) {
    var original = btn.dataset.label || btn.textContent;
    btn.dataset.label = original;
    btn.textContent = msg;
    setTimeout(function () { btn.textContent = original; }, 1800);
  }

  /** A simple, transparent support ratio. Not a full strength verdict, which
   *  needs season, combinations and clashes that this page does not model.
   *  Reads the weighted distribution, the same basis the Ten Gods use. */
  function supportBalance(chart) {
    var dm = chart.dayMaster.element;
    var resource = Object.keys(GENERATES).filter(function (k) { return GENERATES[k] === dm; })[0];
    var w = chart.elementWeights;
    var supporting = (w[dm] || 0) + (w[resource] || 0);
    var total = ELEMENTS.reduce(function (a, k) { return a + (w[k] || 0); }, 0);
    return { supporting: supporting, total: total, resource: resource,
      pct: total ? Math.round((supporting / total) * 100) : 0 };
  }

  // ── City typeahead (ARIA 1.2 combobox) ─────────────────────────────────

  var selectedCity = null;
  var activeIndex = -1;
  var currentMatches = [];
  var placeInput = $('in-place');
  var cityResults = $('city-results');
  var dstWrap = $('dst-wrap');
  var PLACE_HINT_DEFAULT =
    'Optional, but it makes the chart exact. Your city gives us the longitude for ' +
    'true solar time (真太陽時) and the time zone that places your birth against the solar terms.';

  function closeCityList() {
    cityResults.className = 'city-results';
    cityResults.innerHTML = '';
    placeInput.setAttribute('aria-expanded', 'false');
    placeInput.removeAttribute('aria-activedescendant');
    activeIndex = -1;
    currentMatches = [];
  }

  function pickCity(city) {
    selectedCity = city;
    placeInput.value = city.name + ', ' + city.country;
    closeCityList();
    $('place-hint').textContent =
      'True solar time will be applied using ' + fmtLon(city.longitude) +
      ', ' + fmtOffset(city.utcOffsetMinutes) + ' (standard time).';
    updateDstVisibility();
  }

  /* The daylight-saving toggle used to appear only alongside a chosen city.
     That hid it from exactly the people it helps most: someone whose birthplace
     is not in the table still had their clock read an hour fast, silently
     shifting the hour branch. It now follows the birth time alone. */
  function updateDstVisibility() {
    var timeKnown = !$('in-time-unknown').checked && !!$('in-time').value;
    dstWrap.hidden = !timeKnown;
    if (dstWrap.hidden) $('in-dst').checked = false;
  }

  function setActive(i) {
    var opts = cityResults.querySelectorAll('.city-btn');
    if (!opts.length) return;
    if (activeIndex >= 0 && opts[activeIndex]) opts[activeIndex].setAttribute('aria-selected', 'false');
    activeIndex = (i + opts.length) % opts.length;
    opts[activeIndex].setAttribute('aria-selected', 'true');
    placeInput.setAttribute('aria-activedescendant', opts[activeIndex].id);
    opts[activeIndex].scrollIntoView({ block: 'nearest' });
  }

  function renderCityList(matches) {
    currentMatches = matches;
    cityResults.innerHTML = '';
    matches.forEach(function (c, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'city-btn';
      b.id = 'city-opt-' + i;
      b.setAttribute('role', 'option');
      b.setAttribute('aria-selected', 'false');
      b.innerHTML = esc(c.name) + ', ' + esc(c.country) +
        ' <span class="lon">' + fmtLon(c.longitude) + ' · ' + fmtOffset(c.utcOffsetMinutes) + '</span>';
      b.addEventListener('click', function () { pickCity(c); placeInput.focus(); });
      cityResults.appendChild(b);
    });
    cityResults.className = 'city-results open';
    placeInput.setAttribute('aria-expanded', 'true');
    activeIndex = -1;
    $('city-count').textContent =
      matches.length + (matches.length === 1 ? ' city matches' : ' cities match') +
      '. Use the up and down arrows to review, Enter to choose.';
  }

  placeInput.addEventListener('input', function () {
    if (selectedCity && placeInput.value !== selectedCity.name + ', ' + selectedCity.country) {
      selectedCity = null;                    // typed away from the locked-in city
      $('place-hint').textContent = PLACE_HINT_DEFAULT;
    }
    var q = placeInput.value.trim();
    if (!window.BaZiCities || q.length < 2 || selectedCity) return closeCityList();
    var matches = window.BaZiCities.search(q, 6);
    if (!matches.length) {
      closeCityList();
      $('city-count').textContent = 'No matching city. Leave it blank and the chart is cast from your clock time.';
      return;
    }
    renderCityList(matches);
  });

  placeInput.addEventListener('keydown', function (e) {
    var open = cityResults.classList.contains('open');
    if (e.key === 'Escape') { closeCityList(); return; }
    if (!open) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(activeIndex + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(activeIndex - 1); }
    else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      pickCity(currentMatches[activeIndex]);
    } else if (e.key === 'Tab' && activeIndex >= 0) {
      pickCity(currentMatches[activeIndex]);
    }
  });

  // Close after focus genuinely leaves the field and its listbox.
  document.addEventListener('focusin', function (e) {
    if (!cityResults.contains(e.target) && e.target !== placeInput) closeCityList();
  });

  $('in-time').addEventListener('input', updateDstVisibility);
  $('in-time-unknown').addEventListener('change', function () {
    $('in-time').disabled = this.checked;
    if (this.checked) $('in-time').value = '';
    updateDstVisibility();
  });

  // ── Rendering ──────────────────────────────────────────────────────────

  function renderPillars(chart) {
    var labels = { year: 'Year 年', month: 'Month 月', day: 'Day 日', hour: 'Hour 时' };
    var html = '';
    ['year', 'month', 'day', 'hour'].forEach(function (key) {
      var p = chart.pillars[key];
      html += '<div class="pillar' + (key === 'day' ? ' is-day' : '') + '">' +
        '<div class="p-label">' + labels[key] + '</div>';
      if (p) {
        html += '<div class="p-chars" lang="zh">' + p.stem + '<br>' + p.branch + '</div>' +
          '<div class="p-el">' + ELEMENT_HZ[p.stemElement] + ' ' + p.stemElement + '<br>' +
          ELEMENT_HZ[p.branchElement] + ' ' + p.branchElement + '</div>' +
          '<div class="p-hidden">藏干<br><b lang="zh">' + p.hiddenStems.join(' ') + '</b></div>';
      } else {
        html += '<div class="p-chars">·<br>·</div><div class="p-el">time unknown</div>';
      }
      html += '</div>';
    });
    $('pillars').innerHTML = html;
  }

  /* Two views of the same eight characters. `face` counts each character once;
     `weighted` splits every branch's single unit across its hidden stems by
     本气 / 中气 / 余气 strength. The Ten Gods panel uses the weighted basis, so
     the toggle exists to make the two panels reconcilable rather than leaving
     a reader to discover they disagree. */
  var elementBasis = 'weighted';

  function renderElements(chart) {
    var counts = elementBasis === 'face' ? chart.elementCounts : chart.elementWeights;
    var max = Math.max.apply(null, ELEMENTS.map(function (k) { return counts[k] || 0; })) || 1;
    var html = '';
    ELEMENTS.forEach(function (el) {
      var n = counts[el] || 0;
      var shown = elementBasis === 'face' ? n : (Math.round(n * 10) / 10).toFixed(1);
      html += '<div class="elem-row">' +
        '<span class="elem-name">' + ELEMENT_HZ[el] + ' ' + el + '</span>' +
        '<span class="elem-bar"><span class="elem-fill" style="width:' + (n / max * 100) +
        '%;background:var(' + ELEMENT_VAR[el] + ')"></span></span>' +
        '<span class="elem-count">' + shown + '</span></div>';
    });
    $('elements').innerHTML = html;

    $('basis-weighted').setAttribute('aria-pressed', String(elementBasis === 'weighted'));
    $('basis-face').setAttribute('aria-pressed', String(elementBasis === 'face'));

    var bal = supportBalance(chart);
    $('support-note').textContent =
      (elementBasis === 'face'
        ? 'Face value counts each of the eight characters once. Hidden stems are listed under each pillar but not tallied here. '
        : 'Hidden stems are weighted 本气 / 中气 / 余气, so every branch is worth exactly one unit however many stems it conceals. ') +
      'On the weighted basis, ' + bal.supporting.toFixed(1) + ' of ' + bal.total.toFixed(0) +
      ' units (' + bal.pct + '%) support your ' + chart.dayMaster.element + ' Day Master: ' +
      chart.dayMaster.element + ' itself plus ' + bal.resource +
      ', which feeds it. A full strength assessment also weighs the season and the ' +
      'interactions between branches, which this calculator does not model.';
  }

  function renderGods(chart) {
    var weights = chart.tenGodWeights;
    var total = chart.tenGodTotal;
    var html = '';
    FAMILIES.forEach(function (fam) {
      var famWeight = fam.gods.reduce(function (a, g) {
        return a + (weights[g] ? weights[g].weight : 0);
      }, 0);
      var pct = total ? Math.round((famWeight / total) * 100) : 0;
      var allZero = famWeight === 0;
      html += '<div class="god-family' + (allZero ? ' all-zero' : '') + '">' +
        '<div class="gf-head"><span class="gf-name">' + fam.name + ' <span class="hz" lang="zh">' +
        fam.hz + '</span></span><span class="gf-pct">' + pct + '%</span></div>' +
        '<p class="gf-what">' + esc(fam.what) + '</p>' +
        '<div class="gf-bar"><span class="gf-fill" style="width:' + pct + '%"></span></div>';
      fam.gods.forEach(function (g) {
        var w = weights[g] ? weights[g].weight : 0;
        var shown = w === 0 ? '0' : (Math.round(w * 10) / 10).toFixed(1);
        html += '<div class="god' + (w === 0 ? ' zero' : '') + '">' +
          '<span class="god-count">' + shown + '</span>' +
          '<span class="god-body"><span class="god-name">' + g +
          '<span class="hz" lang="zh">' + GOD_HZ[g] + '</span></span>' +
          '<span class="god-gloss">' + esc(GLOSS[g]) + '</span></span></div>';
      });
      html += '</div>';
    });
    $('gods').innerHTML = html;

    var hidden = $('gods').querySelectorAll('.god.zero').length;
    var btn = $('btn-gods-all');
    btn.hidden = hidden === 0;
    btn.textContent = $('gods').classList.contains('show-all')
      ? 'Hide the ' + hidden + ' absent'
      : 'Show all ten, including the ' + hidden + ' absent';
  }

  /* When a birth sits too close to a solar term to place with confidence, show
     both readings rather than picking one and printing a caveat underneath. */
  function renderBoundary(chart, input) {
    var box = $('boundary-note');
    var tb = chart.termBoundary;
    if (!tb.ambiguous) {
      box.hidden = true;
      box.innerHTML = '';
      return;
    }

    var nearTerm = tb.nearer === 'next' ? tb.next : tb.governing;
    var alt;
    try {
      alt = window.BaZi.computeChart(input, { useAlternateTerm: true });
    } catch (e) {
      alt = null;
    }

    var when = nearTerm.local
      ? fmtParts(nearTerm.local) + ' local time'
      : fmtParts(nearTerm.chinaStandard) + ' China Standard Time';

    var why;
    if (tb.precision === 'zone-unknown' || tb.precision === 'zone-and-time-unknown') {
      why = 'A solar term happens at one instant everywhere on earth, so placing your birth ' +
        'either side of it needs to know your birth time zone. Add your birthplace above and ' +
        'this resolves to a single chart.';
    } else if (tb.precision === 'time-unknown') {
      why = 'The term falls on your birth date, so which side of it you were born depends on ' +
        'the hour. If you can find your birth time, this resolves to a single chart.';
    } else {
      why = 'Your birth is within a few minutes of the term. Our term instants are accurate to ' +
        'about five minutes, which is not fine enough to call this one — an almanac or a birth ' +
        'certificate with the minute on it will settle it.';
    }

    function fork(c, label, note, shown) {
      return '<div class="fork' + (shown ? ' is-shown' : '') + '">' +
        '<div class="fork-when">' + esc(label) + '</div>' +
        '<div class="fork-pillars" lang="zh">' +
          c.pillars.year.label + ' ' + c.pillars.month.label + '<br>' +
          c.pillars.day.label + ' ' + (c.pillars.hour ? c.pillars.hour.label : '——') +
        '</div>' +
        '<div class="fork-note">' + esc(note) + '</div></div>';
    }

    var beforeChart, afterChart;
    if (tb.nearer === 'next') {
      beforeChart = chart;                    // the cast chart precedes the term
      afterChart = alt;
    } else {
      beforeChart = alt;
      afterChart = chart;
    }

    var html =
      '<h3>Your birth sits on the ' + esc(nearTerm.name) + ' boundary</h3>' +
      '<p>' + esc(nearTerm.name) + ' (' + esc(nearTerm.en) + ') falls at <b>' + esc(when) +
      '</b>. It is the moment the month pillar turns' +
      (nearTerm.name === '立春' ? ', and with it the year pillar' : '') +
      '. ' + esc(why) + '</p>';

    if (beforeChart && afterChart) {
      html += '<div class="forks">' +
        fork(beforeChart, 'If born before ' + nearTerm.name,
             'Day Master ' + beforeChart.dayMaster.stem + ' · ' + beforeChart.zodiac.animal,
             beforeChart === chart) +
        fork(afterChart, 'If born after ' + nearTerm.name,
             'Day Master ' + afterChart.dayMaster.stem + ' · ' + afterChart.zodiac.animal,
             afterChart === chart) +
        '</div>' +
        '<p>The reading below uses the highlighted column.</p>';
    }

    box.innerHTML = html;
    box.hidden = false;
  }

  function renderSolarNote(chart) {
    var s = chart.solar;
    var el = $('solar-note');
    if (s && s.applied) {
      var c = s.corrected;
      el.textContent = 'True solar time 真太陽時: ' + s.correctionMinutes + ' min applied (' +
        fmtLon(s.longitude) + ', ' + fmtOffset(s.utcOffsetMinutes) + '). Your clock time reads as ' +
        pad(c.hour) + ':' + pad(c.minute) + ' solar, and the hour pillar follows the corrected time.';
    } else if (chart.input.timeKnown) {
      el.textContent = 'No solar time correction applied, so your birth time is read as local ' +
        'clock time. Pick your city above for a longitude-corrected chart.';
    } else {
      el.textContent = 'Birth time unknown, so the hour pillar is left open. Six of the eight ' +
        'characters are still fully determined.';
    }
  }

  function renderBench(chart) {
    var s = chart.solar;
    var tb = chart.termBoundary;
    var rows = [
      ['Solar month', chart.solarMonth.number + ', governed by ' + esc(chart.solarMonth.governingTerm)],
      ['Governing solar term', esc(tb.governing.name) + ' ' + esc(tb.governing.en) + ' — sun at ' +
        tb.governing.longitude + '°, ' +
        (tb.governing.local
          ? esc(fmtParts(tb.governing.local)) + ' local'
          : esc(fmtParts(tb.governing.chinaStandard)) + ' China Standard Time')],
      ['Next solar term', esc(tb.next.name) + ' — ' +
        (tb.next.local
          ? esc(fmtParts(tb.next.local)) + ' local'
          : esc(fmtParts(tb.next.chinaStandard)) + ' China Standard Time')],
      ['Boundary confidence', tb.ambiguous
        ? 'too close to call (±' + tb.uncertaintyMinutes + ' min)'
        : 'settled — ' + tb.hoursSinceGoverning.toFixed(0) + ' h after ' + esc(tb.governing.name) +
          ', ' + tb.hoursUntilNext.toFixed(0) + ' h before ' + esc(tb.next.name)],
      ['Day boundary', esc(chart.conventions.dayBoundary)],
      ['Time basis', esc(chart.conventions.timezone)],
      ['Hidden stems', esc(chart.conventions.hiddenStems)]
    ];
    if (s && s.applied) {
      rows.push(['Local mean time offset', s.lmtMinutes + ' min <code>(4 × longitude − UTC offset)</code>']);
      rows.push(['Equation of time', s.eotMinutes + ' min']);
      rows.push(['Total correction', s.correctionMinutes + ' min']);
    }
    rows.push(['Zodiac', esc(chart.zodiac.cn + ' ' + chart.zodiac.animal) + ' (from the year branch)']);
    rows.push(['Engine', 'Deterministic. Solar terms are solved from the sun’s apparent ' +
      'longitude (Meeus, with ΔT), accurate to about five minutes. The sexagenary day cycle ' +
      'uses the Julian Day Number. Valid 1901 to 2100.']);

    $('bench').innerHTML = '<dl>' + rows.map(function (r) {
      return '<dt>' + esc(r[0]) + '</dt><dd>' + r[1] + '</dd>';
    }).join('') + '</dl>';
  }

  function chartAsText(chart) {
    var p = chart.pillars;
    var lines = [
      'Four Pillars 八字',
      '',
      'Year  年   ' + p.year.label,
      'Month 月   ' + p.month.label,
      'Day   日   ' + p.day.label,
      'Hour  时   ' + (p.hour ? p.hour.label : '(unknown)'),
      '',
      'Day Master 日主: ' + chart.dayMaster.stem + ' (' + chart.dayMaster.polarity + ' ' +
        chart.dayMaster.element + ')',
      'Zodiac: ' + chart.zodiac.cn + ' ' + chart.zodiac.animal,
      'Elements (weighted): ' + ELEMENTS.map(function (e) {
        return e + ' ' + (chart.elementWeights[e] || 0).toFixed(1);
      }).join(' · '),
      'Governing term: ' + chart.termBoundary.governing.name + ' ' +
        (chart.termBoundary.governing.local
          ? fmtParts(chart.termBoundary.governing.local) + ' local'
          : fmtParts(chart.termBoundary.governing.chinaStandard) + ' CST')
    ];
    if (chart.solar && chart.solar.applied) {
      lines.push('True solar time: ' + chart.solar.correctionMinutes + ' min correction applied');
    }
    if (chart.termBoundary.ambiguous) {
      lines.push('NOTE: this birth sits on a solar-term boundary and could not be placed with ' +
        'confidence. See the calculator for both readings.');
    }
    return lines.join('\n');
  }

  // ── Compute and drive ──────────────────────────────────────────────────

  var lastChart = null;

  /** Read the form into an engine input object, or throw with a plain message. */
  function readForm() {
    var dateVal = $('in-date').value;
    if (!dateVal) throw new Error('Please enter your date of birth.');

    var parts = dateVal.split('-').map(Number);
    if (parts.length !== 3 || parts.some(function (n) { return !isFinite(n); })) {
      throw new Error('That date could not be read. Use the date picker, or type it as YYYY-MM-DD.');
    }
    var input = { year: parts[0], month: parts[1], day: parts[2] };

    if (!$('in-time-unknown').checked && $('in-time').value) {
      var t = $('in-time').value.split(':').map(Number);
      if (t.length < 2 || !isFinite(t[0]) || !isFinite(t[1])) {
        throw new Error('That time could not be read. Use the time picker, or type it as HH:MM.');
      }
      input.hour = t[0];
      input.minute = t[1];
    }

    var dstMinutes = $('in-dst').checked && !dstWrap.hidden ? 60 : 0;
    if (selectedCity && input.hour !== undefined) {
      input.longitude = selectedCity.longitude;
      input.utcOffsetMinutes = selectedCity.utcOffsetMinutes + dstMinutes;
    } else if (input.hour !== undefined && dstMinutes) {
      // No city, but the user knows daylight saving was in force. Wind the
      // clock back an hour so the hour branch is read from standard time.
      var wound = new Date(Date.UTC(input.year, input.month - 1, input.day, input.hour, input.minute) - 3600000);
      input.year = wound.getUTCFullYear();
      input.month = wound.getUTCMonth() + 1;
      input.day = wound.getUTCDate();
      input.hour = wound.getUTCHours();
      input.minute = wound.getUTCMinutes();
    }
    return input;
  }

  function calculate() {
    var err = $('form-err');
    err.hidden = true;

    var input, chart;
    try {
      input = readForm();
      chart = window.BaZi.computeChart(input);
    } catch (e) {
      err.textContent = e.message || 'That date could not be computed. Supported range: 1901 to 2100.';
      err.hidden = false;
      $('sr-status').textContent = err.textContent;
      return;
    }

    lastChart = chart;
    var dm = DAY_MASTER[chart.dayMaster.stem];
    $('dm-char').textContent = chart.dayMaster.stem;
    $('dm-name').textContent = dm.name + ', ' + dm.image;
    $('dm-desc').textContent = dm.desc;

    renderPillars(chart);
    renderSolarNote(chart);
    renderBoundary(chart, input);
    renderElements(chart);
    renderGods(chart);
    renderBench(chart);
    collapseForm(chart);

    $('results').hidden = false;
    $('sr-status').textContent = 'Chart cast. Day Master ' + chart.dayMaster.stem + ', ' +
      dm.name + '. Pillars: ' + chart.pillars.year.label + ', ' + chart.pillars.month.label +
      ', ' + chart.pillars.day.label +
      (chart.pillars.hour ? ', ' + chart.pillars.hour.label : ', hour unknown') + '.' +
      (chart.termBoundary.ambiguous
        ? ' This birth sits on a solar-term boundary; two readings are shown.'
        : '');
    writeUrl();
    $('results').scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' });
  }

  /* Once a chart exists the form is a wall between the visitor and the answer,
     especially for anyone opening a shared link. Fold it into one line. */
  function collapseForm(chart) {
    var i = chart.input;
    var when = i.day + ' ' + MONTHS[i.month - 1] + ' ' + i.year;
    if (i.timeKnown) when += ', ' + pad(i.hour) + ':' + pad(i.minute);
    else when += ', time unknown';
    if (selectedCity) when += ' · ' + selectedCity.name;
    $('recap-line').innerHTML = '<b>' + esc(when) + '</b>';
    $('form-card').classList.add('is-collapsed');
    $('form-details').hidden = true;
    $('recap').hidden = false;
  }

  function expandForm() {
    $('form-card').classList.remove('is-collapsed');
    $('form-details').hidden = false;
    $('recap').hidden = true;
    $('in-date').focus();
  }

  /* Shareable URL carrying everything needed to re-cast the chart. The city is
     stored as coordinates rather than a bare name: `?city=Newcastle` cannot say
     which hemisphere, and used to resolve to whichever entry came first. */
  function writeUrl() {
    var p = new URLSearchParams();
    p.set('date', $('in-date').value);
    if (!$('in-time-unknown').checked && $('in-time').value) p.set('time', $('in-time').value);
    if (selectedCity) {
      p.set('city', selectedCity.name);
      p.set('country', selectedCity.country);
      p.set('lon', String(selectedCity.longitude));
      p.set('tz', String(selectedCity.utcOffsetMinutes));
    }
    if ($('in-dst').checked && !dstWrap.hidden) p.set('dst', '1');
    try {
      history.replaceState(null, '', location.pathname + '?' + p.toString());
    } catch (e) { /* file:// or a sandboxed frame: the chart still works */ }
  }

  function readUrl() {
    var p = new URLSearchParams(location.search);
    if (!p.get('date')) return;
    $('in-date').value = p.get('date');
    if (p.get('time')) {
      $('in-time').value = p.get('time');
    } else {
      $('in-time-unknown').checked = true;
      $('in-time').disabled = true;
    }

    if (p.get('city') && window.BaZiCities) {
      // Prefer the exact name + country pair; fall back to the coordinates the
      // link carries, so a link keeps working even if the table changes.
      var city = window.BaZiCities.lookup(p.get('city'), p.get('country'));
      if (!city && p.get('lon') && p.get('tz')) {
        var lon = Number(p.get('lon'));
        var tz = Number(p.get('tz'));
        if (isFinite(lon) && isFinite(tz) && Math.abs(lon) <= 180 && Math.abs(tz) <= 840) {
          city = { name: p.get('city'), country: p.get('country') || '', longitude: lon, utcOffsetMinutes: tz };
        }
      }
      if (city) pickCity(city);
    }
    if (p.get('dst') === '1') $('in-dst').checked = true;
    updateDstVisibility();
    if (p.get('dst') === '1') $('in-dst').checked = true;
    calculate();
  }

  $('bazi-form').addEventListener('submit', function (e) { e.preventDefault(); calculate(); });

  $('btn-edit').addEventListener('click', expandForm);

  $('basis-weighted').addEventListener('click', function () {
    elementBasis = 'weighted';
    if (lastChart) renderElements(lastChart);
  });
  $('basis-face').addEventListener('click', function () {
    elementBasis = 'face';
    if (lastChart) renderElements(lastChart);
  });

  $('btn-gods-all').addEventListener('click', function () {
    $('gods').classList.toggle('show-all');
    if (lastChart) renderGods(lastChart);
  });

  $('btn-copy').addEventListener('click', function () {
    if (!lastChart) return;
    var btn = this;
    copyText(chartAsText(lastChart)).then(
      function () { flash(btn, 'Copied'); },
      function () { flash(btn, 'Copy failed'); }
    );
  });

  $('btn-link').addEventListener('click', function () {
    var btn = this;
    copyText(location.href).then(
      function () { flash(btn, 'Link copied'); },
      function () { flash(btn, 'Copy failed'); }
    );
  });

  $('btn-reset').addEventListener('click', function () {
    $('bazi-form').reset();
    selectedCity = null;
    lastChart = null;
    $('in-time').disabled = false;
    $('place-hint').textContent = PLACE_HINT_DEFAULT;
    closeCityList();
    updateDstVisibility();
    expandForm();
    $('results').hidden = true;
    $('sr-status').textContent = 'Form cleared.';
    try { history.replaceState(null, '', location.pathname); } catch (e) { /* see writeUrl */ }
    window.scrollTo({ top: 0, behavior: reduceMotion() ? 'auto' : 'smooth' });
  });

  updateDstVisibility();
  readUrl();
})();
