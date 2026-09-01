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

  /* What a Ten God means when it governs a stretch of *time* rather than a
     natal character. This is the layer the page was missing: a visitor told
     they are "in the Direct Wealth pillar" had nothing anywhere explaining what
     that is. Written as plainly as the material allows, and deliberately
     two-sided, because none of the ten are good or bad. */
  var GOD_PERIOD = {
    'Friend': {
      lead: 'A stretch where you run mostly on your own steam.',
      favours: 'Working independently, backing your own judgement, peers who operate the way you do',
      strains: 'Taking direction, sharing credit, depending on someone else\'s timetable',
      practice: 'A good time to bet on yourself. A harder one to sit quietly inside someone else\'s structure.'
    },
    'Rob Wealth': {
      lead: 'Competitive and fast-moving. Money and resources circulate rather than settle.',
      favours: 'Hustle, partnerships, competing openly, moving quickly on things',
      strains: 'Holding on to what you have, lending, splitting money with people',
      practice: 'Expect resources to move. Be deliberate about who you go in with and what you sign.'
    },
    'Eating God': {
      lead: 'Productive and unhurried. You make things at your own pace and enjoy them.',
      favours: 'Building, creating, cooking, teaching, raising children, quality of life',
      strains: 'Urgency, cut-throat competition, work that has to be forced',
      practice: 'Often the most comfortable period in a chart. Use it to make something that lasts.'
    },
    'Hurting Officer': {
      lead: 'Expressive and unruly. Talent comes out loudly, and rules start to chafe.',
      favours: 'Creative and public work, performing, arguing a case, doing it your own way',
      strains: 'Bosses, institutions, procedure, biting your tongue',
      practice: 'Excellent for work where a distinctive voice is the point. Friction where it is not.'
    },
    'Direct Wealth': {
      lead: 'Steady earning and accumulation. Income you work for and keep.',
      favours: 'Salaried growth, saving, property, commitments that reward consistency',
      strains: 'Speculation, sudden pivots, anything that needs a gamble to pay off',
      practice: 'A period that rewards showing up and compounding rather than swinging for a windfall.'
    },
    'Indirect Wealth': {
      lead: 'Opportunistic money. Deals, ventures, windfalls and a wider circle.',
      favours: 'Business, sales, investing, networks, spotting an opening and taking it',
      strains: 'Keeping what arrives, routine, narrow focus',
      practice: 'More comes past you than usual. The skill this period asks for is deciding what to keep.'
    },
    'Direct Officer': {
      lead: 'Structure, status and responsibility.',
      favours: 'Promotion, titles, formal roles, reputation, rules you have agreed to work inside',
      strains: 'Improvising, autonomy, anything that needs you to ignore the process',
      practice: 'Good for climbing a ladder that already exists. Confining if you need room to move.'
    },
    'Seven Killings': {
      lead: 'Pressure and challenge. Deadlines, rivals, high stakes, decisions made fast.',
      favours: 'Crisis work, competition, turnarounds, anything with a real opponent',
      strains: 'Rest, patience, situations with no clear enemy to push against',
      practice: 'Demanding, and for many charts the decade where the most actually gets done.'
    },
    'Direct Resource': {
      lead: 'Support and learning. A period to absorb rather than output.',
      favours: 'Study, credentials, mentors, care from others, consolidating what you know',
      strains: 'Fast output, self-promotion, going it alone',
      practice: 'Slower on the surface and often the groundwork that a later period spends.'
    },
    'Indirect Resource': {
      lead: 'Unconventional learning and inward focus.',
      favours: 'Niche expertise, research, intuition, solitary or specialist work',
      strains: 'Conventional paths, large groups, work that needs constant visibility',
      practice: 'Insightful, and can drift into isolation if there is nothing concrete to apply it to.'
    }
  };

  var ELEMENT_HZ = { Wood: '木', Fire: '火', Earth: '土', Metal: '金', Water: '水' };
  var ELEMENT_VAR = { Wood: '--wood', Fire: '--fire', Earth: '--earth', Metal: '--metal', Water: '--water' };
  var ELEMENTS = ['Wood', 'Fire', 'Earth', 'Metal', 'Water'];
  var GENERATES = { Wood: 'Fire', Fire: 'Earth', Earth: 'Metal', Metal: 'Water', Water: 'Wood' };
  var CONTROLS = { Wood: 'Earth', Earth: 'Water', Water: 'Fire', Fire: 'Metal', Metal: 'Wood' };

  /** The family a Ten God belongs to, and what that family is about. */
  function familyOf(godName) {
    for (var i = 0; i < FAMILIES.length; i++) {
      if (FAMILIES[i].gods.indexOf(godName) >= 0) return FAMILIES[i];
    }
    return null;
  }

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
  /** Split a Unix ms value into calendar parts, treating it as already local. */
  function localParts(ms) {
    var d = new Date(ms);
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(),
      hour: d.getUTCHours(), minute: d.getUTCMinutes() };
  }

  /** "4 February 2024, 16:24" from the engine's calendar-parts objects. */
  function fmtParts(p) {
    return p.day + ' ' + MONTHS[p.month - 1] + ' ' + p.year + ', ' + pad(p.hour) + ':' + pad(p.minute);
  }
  /** The chosen gender, or null for "rather not say". */
  function selectedGender() {
    var picked = document.querySelector('input[name="gender"]:checked');
    return picked && picked.value ? picked.value : null;
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

  /* A plain-English reading of one Ten God as a period. This is what a visitor
     gets when they select a decade or a year: what it is, what it favours, what
     it strains, and a line on what to do about it. The deep dive stays one link
     away rather than being pasted in here. */
  function periodPanel(god, heading, subheading) {
    var info = GOD_PERIOD[god.en];
    var fam = familyOf(god.en);
    if (!info) return '';
    return '<div class="meaning">' +
      '<div class="meaning-head">' +
        '<span class="meaning-title">' + esc(heading) + '</span>' +
        '<span class="meaning-sub">' + esc(subheading) + '</span>' +
      '</div>' +
      '<p class="meaning-lead"><b>' + esc(god.en) + ' <span class="hz" lang="zh">' + god.cn +
        '</span></b> ' + esc(info.lead) + '</p>' +
      (fam ? '<p class="meaning-fam">One of the <b>' + esc(fam.name) + '</b> ' +
        '<span class="hz" lang="zh">' + fam.hz + '</span> relationships: ' +
        esc(fam.what.charAt(0).toLowerCase() + fam.what.slice(1)) + '</p>' : '') +
      '<dl class="meaning-pair">' +
        '<dt class="favours">Tends to favour</dt><dd>' + esc(info.favours) + '</dd>' +
        '<dt class="strains">Tends to strain</dt><dd>' + esc(info.strains) + '</dd>' +
      '</dl>' +
      '<p class="meaning-practice">' + esc(info.practice) + '</p>' +
      '<p class="meaning-more"><a href="guide.html#ten-gods">What the Ten Gods are &rarr;</a>' +
      ' &nbsp;·&nbsp; <a href="guide.html#period-table">All ten, side by side &rarr;</a></p>' +
      '</div>';
  }

  /* The five elements as the cycle they actually are, with each one labelled by
     its relationship to the Day Master. A reader who cannot hold "Wealth is what
     I control" in their head can see the arrow instead. Node size follows the
     chart's weighted element totals, so the shape of the chart is in the picture.
     Drawn rather than described because the relationships are geometric. */
  function elementCycle(chart) {
    var order = ['Wood', 'Fire', 'Earth', 'Metal', 'Water']; // the generating cycle
    var dm = chart.dayMaster.element;
    var w = chart.elementWeights;
    var maxW = Math.max.apply(null, order.map(function (e) { return w[e] || 0; })) || 1;

    // The box has to hold the outer labels, not just the pentagon: "Authority"
    // sits well clear of the Fire node and was being clipped at 340 wide.
    var W = 420, H = 340, cx = 210, cy = 165, R = 98;
    var pts = order.map(function (el, i) {
      var a = (-90 + i * 72) * Math.PI / 180;
      return { el: el, x: cx + R * Math.cos(a), y: cy + R * Math.sin(a),
               r: 15 + 13 * ((w[el] || 0) / maxW), a: a };
    });

    /* Stop an arrow short of the node it points at, so the head sits on the
       circle's edge rather than under it. */
    function edge(from, to, pad) {
      var dx = to.x - from.x, dy = to.y - from.y;
      var d = Math.sqrt(dx * dx + dy * dy) || 1;
      return { x1: from.x + (dx / d) * (from.r + 4), y1: from.y + (dy / d) * (from.r + 4),
               x2: to.x - (dx / d) * (to.r + pad), y2: to.y - (dy / d) * (to.r + pad) };
    }

    var generates = '', controls = '';
    for (var i = 0; i < 5; i++) {
      var g = edge(pts[i], pts[(i + 1) % 5], 9);
      generates += '<line x1="' + g.x1.toFixed(1) + '" y1="' + g.y1.toFixed(1) +
        '" x2="' + g.x2.toFixed(1) + '" y2="' + g.y2.toFixed(1) +
        '" class="cyc-gen" marker-end="url(#cyc-arrow-gen)"/>';
      var c = edge(pts[i], pts[(i + 2) % 5], 9);
      controls += '<line x1="' + c.x1.toFixed(1) + '" y1="' + c.y1.toFixed(1) +
        '" x2="' + c.x2.toFixed(1) + '" y2="' + c.y2.toFixed(1) +
        '" class="cyc-ctl" marker-end="url(#cyc-arrow-ctl)"/>';
    }

    var nodes = pts.map(function (p) {
      var isDm = p.el === dm;
      var god = relationLabel(dm, p.el);
      var reach = R + p.r + 16;
      var lx = cx + reach * Math.cos(p.a);
      var ly = cy + reach * Math.sin(p.a);
      var anchor = Math.abs(lx - cx) < 12 ? 'middle' : (lx > cx ? 'start' : 'end');
      // Two label lines, stacked away from the centre so they never sit on the
      // pentagon and never run off the top or bottom of the box.
      var y1 = ly + (ly < cy ? -6 : 10);
      return '<g class="cyc-node' + (isDm ? ' is-dm' : '') + '">' +
        (isDm ? '<circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) +
                '" r="' + (p.r + 5).toFixed(1) + '" class="cyc-ring"/>' : '') +
        '<circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="' + p.r.toFixed(1) +
          '" fill="var(' + ELEMENT_VAR[p.el] + ')"/>' +
        '<text x="' + p.x.toFixed(1) + '" y="' + (p.y + 5).toFixed(1) +
          '" class="cyc-hz" lang="zh">' + ELEMENT_HZ[p.el] + '</text>' +
        '<text x="' + lx.toFixed(1) + '" y="' + y1.toFixed(1) + '" text-anchor="' + anchor +
          '" class="cyc-label">' + p.el + '</text>' +
        '<text x="' + lx.toFixed(1) + '" y="' + (y1 + 13).toFixed(1) + '" text-anchor="' + anchor +
          '" class="cyc-rel">' + esc(isDm ? 'you' : god) + '</text>' +
        '</g>';
    }).join('');

    var alt = 'Five element cycle. Your Day Master is ' + dm + '. ' +
      order.filter(function (e) { return e !== dm; }).map(function (e) {
        return relationLabel(dm, e) + ' is ' + e + ', weight ' + (w[e] || 0).toFixed(1);
      }).join('. ') + '.';

    return '<figure class="cycle">' +
      '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(alt) + '">' +
      '<defs>' +
        '<marker id="cyc-arrow-gen" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" ' +
          'markerHeight="7" orient="auto"><path d="M0 0 L8 4 L0 8 z" class="cyc-gen-head"/></marker>' +
        '<marker id="cyc-arrow-ctl" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" ' +
          'markerHeight="6" orient="auto"><path d="M0 0 L8 4 L0 8 z" class="cyc-ctl-head"/></marker>' +
      '</defs>' +
      controls + generates + nodes +
      '</svg>' +
      '<figcaption>Solid arrows are the generating cycle <span class="hz" lang="zh">生</span>: ' +
      'each element feeds the next. Dashed arrows are the controlling cycle ' +
      '<span class="hz" lang="zh">克</span>: each element restrains the one across from it. ' +
      'Circle size follows how much of each element your chart carries. Your own element is ringed.' +
      '</figcaption></figure>';
  }

  /** The Ten God family name for one element, seen from the Day Master. */
  function relationLabel(dm, other) {
    if (other === dm) return 'you';
    if (GENERATES[dm] === other) return 'Output';
    if (CONTROLS[dm] === other) return 'Wealth';
    if (CONTROLS[other] === dm) return 'Authority';
    return 'Resource';
  }

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
    $('elements').innerHTML = elementCycle(chart) + '<div class="elem-bars">' + html + '</div>';

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
    var ranked = FAMILIES.map(function (fam) {
      return {
        fam: fam,
        weight: fam.gods.reduce(function (a, g) { return a + (weights[g] ? weights[g].weight : 0); }, 0)
      };
    }).sort(function (a, b) { return b.weight - a.weight; });

    var top = ranked[0], quiet = ranked[ranked.length - 1];
    var lead = total
      ? '<div class="gods-lead">' +
          '<p class="gods-lead-line">Your chart leans hardest on <b>' + esc(top.fam.name) +
            ' <span class="hz" lang="zh">' + top.fam.hz + '</span></b> (' +
            Math.round((top.weight / total) * 100) + '%), and carries least <b>' +
            esc(quiet.fam.name) + ' <span class="hz" lang="zh">' + quiet.fam.hz + '</span></b> (' +
            Math.round((quiet.weight / total) * 100) + '%).</p>' +
          '<p class="gods-lead-note">The loudest family is the theme you keep returning to. The ' +
            'quietest is the thing you tend to build on purpose rather than inherit. Neither is ' +
            'good or bad.</p>' +
        '</div>'
      : '';

    $('gods').innerHTML = lead + html;

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
        'about five minutes, which is not fine enough to call this one. An almanac or a birth ' +
        'certificate with the minute on it will settle it.';
    }

    function fork(c, label, note, shown) {
      return '<div class="fork' + (shown ? ' is-shown' : '') + '">' +
        '<div class="fork-when">' + esc(label) + '</div>' +
        '<div class="fork-pillars" lang="zh">' +
          c.pillars.year.label + ' ' + c.pillars.month.label + '<br>' +
          c.pillars.day.label + ' ' + (c.pillars.hour ? c.pillars.hour.label : '\u3000\u3000') +
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

  /* 大运 and 流年. The luck pillars are a row of ten-year periods; the annual
     pillars are the years inside whichever one is selected. Practitioners read
     the two together, so selecting a decade swaps the year row beneath it. */

  var selectedLuck = null;   // 1-based index of the luck pillar on show
  var selectedYear = null;   // Gregorian year whose reading is on show

  function renderLuck(chart) {
    var box = $('luck');
    var L = chart.luckPillars;

    if (!L) {
      box.innerHTML =
        '<p class="luck-empty">Luck pillars need one more answer: whether the classical rule ' +
        'should treat this chart as 男 or 女. It fixes the <em>direction</em> the ten-year ' +
        'periods run, forward or backward from your month pillar, and there is no way to ' +
        'derive it from a birth moment. Choose Male or Female under <b>Gender</b> above and ' +
        'they will appear here, with the year-by-year 流年 underneath.</p>';
      return;
    }

    var birthMs = birthInstantMs(chart);
    var nowLuck = window.BaZi.currentLuckPillar(L, birthMs, Date.now());
    if (selectedLuck === null) selectedLuck = nowLuck || 1;

    var slack = L.uncertaintyMonths
      ? ' Give or take about ' + L.uncertaintyMonths + ' months, because without ' +
        (chart.input.timeKnown ? 'a birthplace' : 'a birth time') +
        ' we cannot fix the birth instant exactly.'
      : '';

    var head =
      '<p class="luck-lede"><b>' + esc(L.startAge.years) + ' years' +
      (L.startAge.months ? ' ' + esc(L.startAge.months) + ' months' : '') +
      '</b> old when the first pillar opens, in ' + esc(L.startDate.year) + '. ' +
      'Counted from your birth to ' + esc(L.anchorTerm.name) + ', the ' +
      esc(L.anchorTerm.which) + ' solar term: ' + esc(L.daysToTerm) +
      ' days, at the classical rate of three days to one year.' + esc(slack) + '</p>' +
      '<p class="luck-rule">' + esc(L.rule) + '</p>';

    var rows = L.pillars.map(function (p) {
      var isNow = p.index === nowLuck;
      var isOpen = p.index === selectedLuck;
      return '<li><button type="button" class="luck' + (isNow ? ' is-now' : '') + '"' +
        ' data-luck="' + p.index + '" aria-pressed="' + (isOpen ? 'true' : 'false') + '">' +
        (isNow ? '<span class="luck-now">Now</span>' : '') +
        '<span class="luck-ages">' + Math.floor(p.startAge) + '\u2013' + Math.floor(p.endAge) + '</span>' +
        '<span class="luck-chars" lang="zh">' + p.stem + '<br>' + p.branch + '</span>' +
        '<span class="luck-god">' + esc(p.tenGod.en) +
          '<span class="hz" lang="zh">' + p.tenGod.cn + '</span></span>' +
        '<span class="luck-years">' + p.startYear + '\u2013' + p.endYear + '</span>' +
        '</button></li>';
    }).join('');

    box.innerHTML = head +
      '<h3 class="row-label">Ten-year pillars <span class="hz" lang="zh">大运</span></h3>' +
      '<div class="luck-scroll"><ol class="luck-strip" aria-label="Ten-year luck pillars">' +
      rows + '</ol></div>' +
      (nowLuck
        ? '<p class="note">You are currently in <b lang="zh">' +
          L.pillars[nowLuck - 1].label + '</b>, ' + esc(L.pillars[nowLuck - 1].tenGod.en) +
          ', ages ' + Math.floor(L.pillars[nowLuck - 1].startAge) + ' to ' +
          Math.floor(L.pillars[nowLuck - 1].endAge) + '.</p>'
        : '<p class="note">The first luck pillar has not opened yet. Until it does, the natal ' +
          'chart stands on its own.</p>') +
      '<div id="luck-meaning"></div>' +
      '<div id="annual"></div>';

    box.querySelectorAll('[data-luck]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        selectedLuck = Number(btn.dataset.luck);
        selectedYear = null;
        renderLuck(chart);
        revealStrips();
        var again = $('luck').querySelector('[data-luck="' + selectedLuck + '"]');
        if (again) again.focus();
      });
    });

    var lp = L.pillars[selectedLuck - 1];
    $('luck-meaning').innerHTML = periodPanel(
      lp.tenGod,
      lp.label + ' \u00b7 ages ' + Math.floor(lp.startAge) + ' to ' + Math.floor(lp.endAge),
      lp.startYear + '\u2013' + lp.endYear + (lp.index === nowLuck ? ' \u00b7 you are here now' : '')
    );

    renderAnnual(chart, nowLuck);
  }

  /* Bring both marked cells into view. Deferred a frame because the results
     block has only just been unhidden, and a scroller with no layout box yet
     reports clientWidth 0, which sends the centring maths the wrong way. */
  function revealStrips() {
    var run = function () {
      revealMarked(document.querySelector('.luck-scroll'), '[aria-pressed="true"]');
      revealMarked(document.querySelector('.year-scroll'), '[data-year][aria-pressed="true"]');
    };
    if (window.requestAnimationFrame) requestAnimationFrame(run);
    else setTimeout(run, 0);
  }

  /** Scroll a strip horizontally so its marked cell is centred in view.
   *  Measured with getBoundingClientRect rather than offsetLeft, which is
   *  relative to the nearest positioned ancestor and not to the scroller. */
  function revealMarked(scroller, selector) {
    if (!scroller || !scroller.clientWidth) return;   // not laid out yet
    var mark = scroller.querySelector(selector);
    if (!mark) return;
    var m = mark.getBoundingClientRect();
    var s = scroller.getBoundingClientRect();
    var delta = (m.left - s.left) - (scroller.clientWidth - m.width) / 2;
    scroller.scrollLeft = Math.max(0, scroller.scrollLeft + delta);
  }

  /* 流年. The ten years inside the selected luck pillar, each read against the
     Day Master the same way the natal characters are. The year turns at 立春,
     not on 1 January, so a January date still belongs to the year before. */
  function renderAnnual(chart, nowLuck) {
    var box = $('annual');
    var L = chart.luckPillars;
    var lp = L.pillars[selectedLuck - 1];
    var thisYear = window.BaZi.solarYearAt(Date.now());
    var years = window.BaZi.annualPillars(lp.startYear, 10, chart.dayMaster.index);
    var birthSolarYear = window.BaZi.solarYearAt(birthInstantMs(chart));

    if (selectedYear === null || years.every(function (a) { return a.year !== selectedYear; })) {
      var here = years.filter(function (a) { return a.year === thisYear; })[0];
      selectedYear = here ? here.year : years[0].year;
    }

    var cells = years.map(function (a) {
      var isNow = a.year === thisYear;
      var isOpen = a.year === selectedYear;
      return '<li><button type="button" class="year' + (isNow ? ' is-now' : '') + '"' +
        ' data-year="' + a.year + '" aria-pressed="' + (isOpen ? 'true' : 'false') + '"' +
        (isNow ? ' aria-current="date"' : '') + '>' +
        '<span class="year-num">' + a.year + '</span>' +
        '<span class="year-chars" lang="zh">' + a.stem + a.branch + '</span>' +
        '<span class="year-god">' + esc(a.tenGod.en) +
          '<span class="hz" lang="zh">' + a.tenGod.cn + '</span></span>' +
        '<span class="year-age">age ' + (a.year - birthSolarYear) + '</span>' +
        '</button></li>';
    }).join('');

    var isCurrentDecade = selectedLuck === nowLuck;
    box.innerHTML =
      '<h3 class="row-label">Years inside <b lang="zh">' + lp.label + '</b> ' +
      '<span class="hz" lang="zh">流年</span>' +
      '<span class="row-note">' + (isCurrentDecade ? 'the decade you are in now' :
        'ages ' + Math.floor(lp.startAge) + ' to ' + Math.floor(lp.endAge)) + '</span></h3>' +
      '<div class="year-scroll"><ol class="year-strip" aria-label="Annual pillars inside ' +
      esc(lp.label) + '">' + cells + '</ol></div>' +
      '<p class="note">Each year is read against your Day Master exactly as the natal ' +
      'characters are, then weighed against the ten-year pillar it sits inside. The year ' +
      'turns at 立春 in early February, so January belongs to the year before. ' +
      'Select any year for a reading of it, or a different decade above to see its years.</p>' +
      '<div id="year-meaning"></div>';

    var chosen = years.filter(function (a) { return a.year === selectedYear; })[0];
    if (chosen) {
      $('year-meaning').innerHTML = periodPanel(
        chosen.tenGod,
        chosen.year + ' \u00b7 ' + chosen.label + ' ' + chosen.zodiac.cn + ' ' + chosen.zodiac.animal,
        'age ' + (chosen.year - birthSolarYear) +
          (chosen.year === thisYear ? ' \u00b7 this year' : '') +
          ' \u00b7 inside ' + lp.label
      );
    }

    box.querySelectorAll('[data-year]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        selectedYear = Number(btn.dataset.year);
        renderAnnual(chart, nowLuck);
        revealStrips();
        var again = $('annual').querySelector('[data-year="' + selectedYear + '"]');
        if (again) again.focus();
      });
    });
  }

  /** The birth instant in Unix ms, matching how the engine placed it. */
  function birthInstantMs(chart) {
    var i = chart.input;
    var local = Date.UTC(i.year, i.month - 1, i.day, i.timeKnown ? i.hour : 12, i.timeKnown ? i.minute : 0);
    return i.utcOffsetMinutes !== null ? local - i.utcOffsetMinutes * 60000 : local;
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
      ['Governing solar term', esc(tb.governing.name) + ' ' + esc(tb.governing.en) + ', sun at ' +
        tb.governing.longitude + '°, ' +
        (tb.governing.local
          ? esc(fmtParts(tb.governing.local)) + ' local'
          : esc(fmtParts(tb.governing.chinaStandard)) + ' China Standard Time')],
      ['Next solar term', esc(tb.next.name) + ', ' +
        (tb.next.local
          ? esc(fmtParts(tb.next.local)) + ' local'
          : esc(fmtParts(tb.next.chinaStandard)) + ' China Standard Time')],
      ['Boundary confidence', tb.ambiguous
        ? 'too close to call (±' + tb.uncertaintyMinutes + ' min)'
        : 'settled, ' + tb.hoursSinceGoverning.toFixed(0) + ' h after ' + esc(tb.governing.name) +
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
    if (chart.luckPillars) {
      var L = chart.luckPillars;
      rows.push(['Luck pillar direction', esc(L.directionCn) + ' ' + esc(L.direction) + '. ' + esc(L.rule)]);
      rows.push(['Starting age 起运', esc(L.daysToTerm) + ' days to ' + esc(L.anchorTerm.name) +
        ' ÷ 3 = ' + esc(L.startAge.years) + ' y ' + esc(L.startAge.months) + ' m' +
        (L.uncertaintyMonths ? ' (±' + L.uncertaintyMonths + ' months)' : '')]);
    }
    var solarNow = window.BaZi.solarYearAt(Date.now());
    var annualNow = window.BaZi.annualPillar(solarNow, chart.dayMaster.index);
    rows.push(['Current annual pillar 流年',
      esc(annualNow.label) + ' ' + esc(annualNow.zodiac.cn + ' ' + annualNow.zodiac.animal) +
      ', ' + esc(annualNow.tenGod.cn + ' ' + annualNow.tenGod.en) +
      '. Opened at 立春, ' + esc(fmtParts(localParts(annualNow.startsAt +
        (chart.input.utcOffsetMinutes === null ? 480 : chart.input.utcOffsetMinutes) * 60000))) +
      (chart.input.utcOffsetMinutes === null ? ' China Standard Time' : ' local') + '.']);
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
    if (chart.luckPillars) {
      var L = chart.luckPillars;
      lines.push('');
      lines.push('Luck Pillars 大运 (' + L.directionCn + ', starting at ' + L.startAge.years +
        'y ' + L.startAge.months + 'm)');
      L.pillars.forEach(function (p) {
        lines.push('  ' + String(Math.floor(p.startAge)).padStart(3) + '–' +
          String(Math.floor(p.endAge)).padEnd(3) + ' ' + p.label + '  ' +
          p.tenGod.cn + ' ' + p.tenGod.en);
      });
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

    var gender = selectedGender();
    if (gender) input.gender = gender;

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
    selectedLuck = null;
    selectedYear = null;
    renderLuck(chart);
    renderElements(chart);
    renderGods(chart);
    renderBench(chart);
    collapseForm(chart);

    $('results').hidden = false;
    revealStrips();
    $('sr-status').textContent = 'Chart cast. Day Master ' + chart.dayMaster.stem + ', ' +
      dm.name + '. Pillars: ' + chart.pillars.year.label + ', ' + chart.pillars.month.label +
      ', ' + chart.pillars.day.label +
      (chart.pillars.hour ? ', ' + chart.pillars.hour.label : ', hour unknown') + '.' +
      (chart.luckPillars
        ? ' Luck pillars run ' + chart.luckPillars.direction + ' from age ' +
          chart.luckPillars.startAge.years + '.'
        : '') +
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
    if (i.gender) when += ' · ' + (i.gender === 'male' ? 'Male' : 'Female');
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
    var g = selectedGender();
    if (g) p.set('gender', g);
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
    var g = p.get('gender');
    if (g === 'male') $('g-male').checked = true;
    else if (g === 'female') $('g-female').checked = true;
    if (p.get('dst') === '1') $('in-dst').checked = true;
    updateDstVisibility();
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
    $('g-none').checked = true;
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
