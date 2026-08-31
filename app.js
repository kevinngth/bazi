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

  var ELEMENT_HZ = { Wood: '木', Fire: '火', Earth: '土', Metal: '金', Water: '水' };
  var ELEMENT_VAR = { Wood: '--wood', Fire: '--fire', Earth: '--earth', Metal: '--metal', Water: '--water' };
  var GENERATES = { Wood: 'Fire', Fire: 'Earth', Earth: 'Metal', Metal: 'Water', Water: 'Wood' };

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

  /** Ten Gods across the whole chart: the three non-day stems plus every
   *  hidden stem (藏干) in the four branches, classified against the Day
   *  Master. The day stem is the reference itself, so it is not counted. */
  function tenGodDistribution(chart) {
    var stems = window.BaZi.STEMS;
    var tenGod = window.BaZi._internal.tenGod;
    var dmIndex = stems.indexOf(chart.dayMaster.stem);
    var counts = {};
    var total = 0;

    function add(stemChar) {
      var i = stems.indexOf(stemChar);
      if (i < 0) return;
      var g = tenGod(dmIndex, i);
      counts[g.en] = (counts[g.en] || 0) + 1;
      total++;
    }

    ['year', 'month', 'day', 'hour'].forEach(function (key) {
      var p = chart.pillars[key];
      if (!p) return;
      if (key !== 'day') add(p.stem);           // the day stem is the Day Master
      (p.hiddenStems || []).forEach(add);
    });

    return { counts: counts, total: total };
  }

  /** A simple, transparent support ratio. Not a full strength verdict, which
   *  needs season, combinations and clashes that this page does not model. */
  function supportBalance(chart) {
    var dm = chart.dayMaster.element;
    var resource = Object.keys(GENERATES).filter(function (k) { return GENERATES[k] === dm; })[0];
    var counts = chart.elementCounts;
    var supporting = (counts[dm] || 0) + (counts[resource] || 0);
    var total = Object.keys(counts).reduce(function (a, k) { return a + counts[k]; }, 0);
    return { supporting: supporting, total: total, resource: resource,
      pct: total ? Math.round((supporting / total) * 100) : 0 };
  }

  // ── City typeahead ─────────────────────────────────────────────────────

  var selectedCity = null;
  var placeInput = $('in-place');
  var cityResults = $('city-results');
  var dstWrap = $('dst-wrap');
  var PLACE_HINT_DEFAULT =
    'Optional. Picking your city enables true solar time (真太陽時) correction.';

  function closeCityList() { cityResults.className = 'city-results'; cityResults.innerHTML = ''; }

  function pickCity(city) {
    selectedCity = city;
    placeInput.value = city.name + ', ' + city.country;
    closeCityList();
    $('place-hint').textContent =
      'True solar time will be applied using ' + fmtLon(city.longitude) +
      ', ' + fmtOffset(city.utcOffsetMinutes) + ' (standard time).';
    updateDstVisibility();
  }

  function updateDstVisibility() {
    var timeKnown = !$('in-time-unknown').checked && $('in-time').value;
    dstWrap.hidden = !(selectedCity && timeKnown);
    if (dstWrap.hidden) $('in-dst').checked = false;
  }

  placeInput.addEventListener('input', function () {
    if (selectedCity && placeInput.value !== selectedCity.name + ', ' + selectedCity.country) {
      selectedCity = null;                    // typed away from the locked-in city
      $('place-hint').textContent = PLACE_HINT_DEFAULT;
      updateDstVisibility();
    }
    var q = placeInput.value.trim();
    if (!window.BaZiCities || q.length < 2 || selectedCity) return closeCityList();
    var matches = window.BaZiCities.search(q, 5);
    if (!matches.length) return closeCityList();
    cityResults.innerHTML = '';
    matches.forEach(function (c) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'city-btn';
      b.innerHTML = esc(c.name) + ', ' + esc(c.country) +
        ' <span class="lon">' + fmtLon(c.longitude) + ' · ' + fmtOffset(c.utcOffsetMinutes) + '</span>';
      b.addEventListener('click', function () { pickCity(c); });
      cityResults.appendChild(b);
    });
    cityResults.className = 'city-results open';
  });

  // Close on Escape, and after focus genuinely leaves the group.
  placeInput.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeCityList();
  });
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

  function renderElements(chart) {
    var counts = chart.elementCounts;
    var max = Math.max.apply(null, Object.keys(counts).map(function (k) { return counts[k]; })) || 1;
    var html = '';
    ['Wood', 'Fire', 'Earth', 'Metal', 'Water'].forEach(function (el) {
      var n = counts[el] || 0;
      html += '<div class="elem-row">' +
        '<span class="elem-name">' + ELEMENT_HZ[el] + ' ' + el + '</span>' +
        '<span class="elem-bar"><span class="elem-fill" style="width:' + (n / max * 100) +
        '%;background:var(' + ELEMENT_VAR[el] + ')"></span></span>' +
        '<span class="elem-count">' + n + '</span></div>';
    });
    $('elements').innerHTML = html;

    var bal = supportBalance(chart);
    $('support-note').textContent =
      'Of your ' + bal.total + ' element readings, ' + bal.supporting + ' (' + bal.pct +
      '%) support your ' + chart.dayMaster.element + ' Day Master: ' +
      chart.dayMaster.element + ' itself plus ' + bal.resource +
      ', which feeds it. A full strength assessment also weighs the season and the ' +
      'interactions between branches, which this calculator does not model.';
  }

  function renderGods(chart) {
    var dist = tenGodDistribution(chart);
    var html = '';
    FAMILIES.forEach(function (fam) {
      var famCount = fam.gods.reduce(function (a, g) { return a + (dist.counts[g] || 0); }, 0);
      var pct = dist.total ? Math.round((famCount / dist.total) * 100) : 0;
      html += '<div class="god-family">' +
        '<div class="gf-head"><span class="gf-name">' + fam.name + ' <span class="hz" lang="zh">' +
        fam.hz + '</span></span><span class="gf-pct">' + pct + '%</span></div>' +
        '<p class="gf-what">' + esc(fam.what) + '</p>' +
        '<div class="gf-bar"><span class="gf-fill" style="width:' + pct + '%"></span></div>';
      fam.gods.forEach(function (g) {
        var n = dist.counts[g] || 0;
        html += '<div class="god' + (n === 0 ? ' zero' : '') + '">' +
          '<span class="god-count">' + n + '</span>' +
          '<span class="god-body"><span class="god-name">' + g + '</span>' +
          '<span class="god-gloss">' + esc(GLOSS[g]) + '</span></span></div>';
      });
      html += '</div>';
    });
    $('gods').innerHTML = html;
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
    $('boundary-note').hidden = !chart.nearTermBoundary;
    if (chart.nearTermBoundary) {
      $('boundary-note').textContent = 'Note: your birth falls within a day of a solar-term ' +
        '(节气) boundary, where the month or year pillar changes. Term times are computed to ' +
        'day-level accuracy here, so this chart is worth verifying against an almanac.';
    }
  }

  function renderBench(chart) {
    var s = chart.solar;
    var rows = [
      ['Solar month', chart.solarMonth.number + ', governed by ' + chart.solarMonth.governingTerm],
      ['Day boundary', chart.conventions.dayBoundary],
      ['Time basis', chart.conventions.timezone]
    ];
    if (s && s.applied) {
      rows.push(['Local mean time offset', s.lmtMinutes + ' min <code>(4 × longitude − UTC offset)</code>']);
      rows.push(['Equation of time', s.eotMinutes + ' min']);
      rows.push(['Total correction', s.correctionMinutes + ' min']);
    }
    rows.push(['Zodiac', chart.zodiac.cn + ' ' + chart.zodiac.animal + ' (from the year branch)']);
    rows.push(['Engine', 'Deterministic. Solar terms use the standard Y×0.2422+C approximation ' +
      'and the sexagenary day cycle uses the Julian Day Number. Valid 1901 to 2100.']);

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
      'Elements: ' + ['Wood', 'Fire', 'Earth', 'Metal', 'Water'].map(function (e) {
        return e + ' ' + (chart.elementCounts[e] || 0);
      }).join(' · ')
    ];
    if (chart.solar && chart.solar.applied) {
      lines.push('True solar time: ' + chart.solar.correctionMinutes + ' min correction applied');
    }
    return lines.join('\n');
  }

  // ── Compute and drive ──────────────────────────────────────────────────

  var lastChart = null;

  function calculate() {
    var err = $('form-err');
    err.hidden = true;

    var dateVal = $('in-date').value;
    if (!dateVal) { err.textContent = 'Please enter your date of birth.'; err.hidden = false; return; }

    var parts = dateVal.split('-').map(Number);
    var input = { year: parts[0], month: parts[1], day: parts[2] };

    if (!$('in-time-unknown').checked && $('in-time').value) {
      var t = $('in-time').value.split(':').map(Number);
      input.hour = t[0];
      input.minute = t[1];
    }

    if (selectedCity && input.hour !== undefined) {
      input.longitude = selectedCity.longitude;
      input.utcOffsetMinutes = selectedCity.utcOffsetMinutes + ($('in-dst').checked ? 60 : 0);
    }

    var chart;
    try {
      chart = window.BaZi.computeChart(input);
    } catch (e) {
      err.textContent = e.message || 'That date could not be computed. Supported range: 1901 to 2100.';
      err.hidden = false;
      return;
    }

    lastChart = chart;
    var dm = DAY_MASTER[chart.dayMaster.stem];
    $('dm-char').textContent = chart.dayMaster.stem;
    $('dm-name').textContent = dm.name + ', ' + dm.image;
    $('dm-desc').textContent = dm.desc;

    renderPillars(chart);
    renderSolarNote(chart);
    renderElements(chart);
    renderGods(chart);
    renderBench(chart);

    $('results').hidden = false;
    $('sr-status').textContent = 'Chart cast. Day Master ' + chart.dayMaster.stem + ', ' +
      dm.name + '. Pillars: ' + chart.pillars.year.label + ', ' + chart.pillars.month.label +
      ', ' + chart.pillars.day.label +
      (chart.pillars.hour ? ', ' + chart.pillars.hour.label : ', hour unknown') + '.';
    writeUrl();
    $('results').scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' });
  }

  /* Shareable URL carrying everything needed to re-cast the chart. Guarded
     because history.replaceState throws on the file:// protocol. */
  function writeUrl() {
    var p = new URLSearchParams();
    p.set('date', $('in-date').value);
    if (!$('in-time-unknown').checked && $('in-time').value) p.set('time', $('in-time').value);
    if (selectedCity) p.set('city', selectedCity.name);
    if ($('in-dst').checked) p.set('dst', '1');
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
      var m = window.BaZiCities.search(p.get('city'), 1);
      if (m.length) pickCity(m[0]);
    }
    if (p.get('dst') === '1') $('in-dst').checked = true;
    updateDstVisibility();
    calculate();
  }

  $('bazi-form').addEventListener('submit', function (e) { e.preventDefault(); calculate(); });

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
    updateDstVisibility();
    $('results').hidden = true;
    $('sr-status').textContent = 'Form cleared.';
    try { history.replaceState(null, '', location.pathname); } catch (e) { /* see writeUrl */ }
    window.scrollTo({ top: 0, behavior: reduceMotion() ? 'auto' : 'smooth' });
  });

  readUrl();
})();
