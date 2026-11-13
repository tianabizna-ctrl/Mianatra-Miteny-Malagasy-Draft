/* ============================================================
   Core: stored state, spaced repetition, progress selectors.
   No DOM here — keeps the learning logic testable and separate.
   ============================================================ */
window.Salama = window.Salama || {};
(function (S) {
  'use strict';

  var C = window.CONTENT;
  var KEY = 'salama_state_v3';
  var LEGACY_KEY = 'salama_progress_v1';

  /* ---------------- state ---------------- */
  function blank() {
    return {
      version: 3,
      cards: {},          // wordId -> { box, seen, lastGrade }
      sessions: {},       // sessionId -> timestamp completed
      quizzes: [],        // [{ date, theme, score, total }]
      streak: { last: null, days: 0, visits: 0 },
      prefs: {
        textsize: 0,
        autoplay: true,
        rate: 0.82,
        syllables: false,
        showInlineEdit: false,
        recordedVoice: 'abidi',
        voiceURI: '',
        direction: 'miteny',
        palette: 'miteny',
        font: 'fraunces',
        mode: 'auto'
      }
    };
  }

  function readJSON(key) {
    try { return JSON.parse(localStorage.getItem(key) || 'null'); }
    catch (e) { return null; }
  }

  function migrate() {
    var fresh = blank();
    var old = readJSON(LEGACY_KEY);
    if (!old) return fresh;
    // v1 kept words -> { box, seen }, quizzes, weeks and a streak.
    if (old.words) {
      Object.keys(old.words).forEach(function (id) {
        var w = old.words[id] || {};
        fresh.cards[id] = { box: w.box || 0, seen: w.seen || Date.now(), lastGrade: 2 };
      });
    }
    if (Array.isArray(old.quizzes)) fresh.quizzes = old.quizzes.slice(-40);
    if (old.weeks) {
      Object.keys(old.weeks).forEach(function (week) {
        C.sessions.forEach(function (s) {
          if (s.week === Number(week)) fresh.sessions[s.id] = Date.now();
        });
      });
    }
    if (old.streak) {
      fresh.streak = { last: old.streak.last, days: old.streak.days || 0, visits: old.streak.count || 0 };
    }
    try { localStorage.removeItem(LEGACY_KEY); } catch (e) { /* ignore */ }
    return fresh;
  }

  var state = readJSON(KEY) || migrate();
  state.cards = state.cards || {};
  state.sessions = state.sessions || {};
  state.quizzes = state.quizzes || [];
  state.streak = state.streak || { last: null, days: 0, visits: 0 };
  state.prefs = Object.assign(blank().prefs, state.prefs || {});

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch (e) { /* private mode: the session still works, it just won't persist */ }
  }

  /* ---------------- dates ---------------- */
  function dayKey(date) {
    var d = date || new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  var WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
    'August', 'September', 'October', 'November', 'December'];

  function longDate(date) {
    var d = date || new Date();
    return WEEKDAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()];
  }

  function shortDate(ts) {
    var d = new Date(ts);
    return d.getDate() + ' ' + MONTHS[d.getMonth()].slice(0, 3) + ' ' + d.getFullYear();
  }

  function touchStreak() {
    var today = dayKey();
    if (state.streak.last === today) return;
    var yesterday = dayKey(new Date(Date.now() - 864e5));
    state.streak.days = state.streak.last === yesterday ? (state.streak.days || 0) + 1 : 1;
    state.streak.last = today;
    state.streak.visits = (state.streak.visits || 0) + 1;
    save();
  }

  /* ---------------- spaced repetition ---------------- */
  var INTERVALS = [0, 0, 1, 3, 7, 16, 35]; // days, indexed by box
  var MAX_BOX = 6;

  function dueAt(card) {
    var box = Math.min(Math.max(card.box || 0, 0), 6);
    return (card.seen || 0) + INTERVALS[box] * 864e5;
  }

  function gradeWord(id, grade) {
    var card = state.cards[id] || { box: 0, seen: 0, reps: 0 };
    var box = card.box || 0;
    card.reps = (card.reps || 0) + 1;
    if (grade === 0) {
      box = 0;                                                 // try again soon
    } else if (grade === 1) {
      box = Math.max(box, 1);                                  // getting there: hold
    } else if (card.reps === 1) {
      // First sighting, rated "I knew it": establish the card, do not promote.
      // Rating a brand-new card as known used to jump it a box in the same
      // breath as introducing it, and again from a correct quiz answer, so a
      // word seen once could read as "known" without ever being recalled.
      box = Math.max(box, 1);
    } else {
      box = Math.min(box + 1, MAX_BOX);                        // knew it: promote
    }
    card.box = box;
    card.seen = Date.now();
    card.lastGrade = grade;
    state.cards[id] = card;
    save();
    return card;
  }

  /* ---------------- content selectors ---------------- */
  var byId = {};
  C.vocabulary.forEach(function (w) { byId[w.id] = w; });

  var themeById = {};
  C.themeMap.forEach(function (t) { themeById[t.id] = t; });

  var sessionById = {};
  C.sessions.forEach(function (s) { sessionById[s.id] = s; });

  var dialogueById = {};
  C.dialogues.forEach(function (d) { dialogueById[d.id] = d; });

  var grammarById = {};
  C.grammar.forEach(function (g) { grammarById[g.id] = g; });

  /* ---------------- manual edits (Malagasy & phonetics) ---------------- */
  var EDITS_KEY = 'salama_edits_v1';
  var PROOFREAD_KEY = 'salama_proofread_v1';
  var entryByKey = {};
  var keyByMg = {};
  var keyByNormMg = {};
  var keysByOrigLow = {};

  function normMg(text) {
    return String(text || '')
      .toLowerCase()
      .replace(/\(.*?\)/g, ' ')
      .replace(/^.*?→\s*/, '')
      .replace(/\b(izaho\s*\/\s*aho)\b/g, 'izaho')
      .replace(/\b(iza\s+ny\s+anaranao)\b/g, 'iza no anaranao')
      .replace(/\b(te\s*-\s*hi\s*…|te\s*-\s*hi\s*\.\.\.)/g, 'te')
      .replace(/[.!?…,;:_\/\-—–=]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function registerEntryKey(k, item, allowPrimary) {
    entryByKey[k] = item;
    if (item && item.mg) {
      if (item._orig_mg === undefined) item._orig_mg = item.mg || '';
      if (item._orig_pron === undefined) item._orig_pron = item.pron || '';
      if (item._orig_en === undefined) item._orig_en = item.en || '';
      if (item._orig_approx === undefined) item._orig_approx = Boolean(item.pron_approx);
      if (item._orig_verified === undefined) item._orig_verified = Boolean(item.pron_verified);
      var low = item.mg.trim().toLowerCase();
      var nm = normMg(item.mg);
      if (allowPrimary !== false) {
        if (!keyByMg[low]) keyByMg[low] = k;
        if (nm && !keyByNormMg[nm]) keyByNormMg[nm] = k;
      }
      if (low && item.id !== 'eny_(visible)') {
        if (!keysByOrigLow[low]) keysByOrigLow[low] = [];
        if (keysByOrigLow[low].indexOf(k) === -1) keysByOrigLow[low].push(k);
      }
    }
  }

  C.dialogues.forEach(function (d) {
    (d.lines || []).forEach(function (line, idx) {
      registerEntryKey('dlg:' + d.id + ':' + idx, line, true);
    });
    (d.swapPrompts || []).forEach(function (sp, spIdx) {
      registerEntryKey('swap:' + d.id + ':' + spIdx, sp, false);
    });
  });
  C.phrases.forEach(function (p) {
    var k = 'phrase:' + p.id;
    registerEntryKey(k, p, true);
    if (p.mg) {
      var low = p.mg.trim().toLowerCase();
      var nm = normMg(p.mg);
      keyByMg[low] = k;
      if (nm) keyByNormMg[nm] = k;
    }
  });
  C.vocabulary.forEach(function (w) {
    var k = 'word:' + w.id;
    registerEntryKey(k, w, w.id !== 'eny_(visible)');
    if (w.mg && w.id !== 'eny_(visible)') {
      var low = w.mg.trim().toLowerCase();
      var nm = normMg(w.mg);
      keyByMg[low] = k;
      if (nm) keyByNormMg[nm] = k;
    }
  });
  C.grammar.forEach(function (g) {
    (g.rules || []).forEach(function (r, ri) {
      (r.examples || []).forEach(function (ex, ei) {
        registerEntryKey('gram:' + g.id + ':' + ri + ':' + ei, ex, false);
      });
    });
  });

  var STALE_PRONS = {
    'mahn-droo-SOO-ah': true,
    'mee-peh-trah-peh-TRAH-hah': true,
    'mee-peh-trah-PEH-trah-hah': true,
    'mee-PEH-trah-PEH-trah-hah': true,
    'mahn-droo-SOO-ah mee-peh-trah-peh-TRAH-hah': true,
    'mahn-DROO-soo-ah mee-peh-trah-PEH-trah-hah': true,
    'mahn-DROO-soo-ah mee-PEH-trah-PEH-trah-hah': true,
    'mee-peh-TRAH-kah': true,
    'HOH-dee': true,
    'mah-zoo-TOO-ah mee-hee-NAH-nah': true,
    'MOO-rah ah-zah-FAH-dee': true,
    'ah-zah-FAH-dee EYE-zah ee-AH-noh': true,
    'ah-FAH-kah mah-HAH-zoo VEH-rah RAH-noo VEH AH-hoo ah-zah-FAH-dee': true
  };

  function loadEditsMap() {
    var merged = {};
    var p = readJSON(PROOFREAD_KEY) || {};
    var e = readJSON(EDITS_KEY) || {};
    Object.keys(p).forEach(function (k) { merged[k] = Object.assign({}, p[k]); });
    Object.keys(e).forEach(function (k) { merged[k] = Object.assign({}, merged[k] || {}, e[k]); });
    Object.keys(merged).forEach(function (k) {
      var m = merged[k] || {};
      if (m.pron && STALE_PRONS[m.pron]) delete m.pron;
      if (m.mg === 'Haody!' || m.mg === 'Haody') delete m.mg;
      if (m.mg === 'Mazotoa mihinana!' || m.mg === 'Mazotoa mihinana') delete m.mg;
      if (m.mg === 'Mora azafady!' || m.mg === 'Mora azafady') delete m.mg;
      if (m.mg === 'Azafady, aiza ianao?') delete m.mg;
      if (m.mg === 'Afaka mahazo vera rano ve aho azafady?') delete m.mg;
      if (k.indexOf('dlg:dlg_intro_') === 0 && m.mg && m.mg === m.mg.toUpperCase()) delete m.mg;
      if (!m.mg && !m.pron && !m.en && !m.verdict && !m.note) delete merged[k];
    });
    return merged;
  }

  var editsMap = loadEditsMap();

  function saveEditsMap() {
    try {
      localStorage.setItem(EDITS_KEY, JSON.stringify(editsMap));
      localStorage.setItem(PROOFREAD_KEY, JSON.stringify(editsMap));
    } catch (e) { /* private mode */ }
  }

  function applyEditToEntry(key, fields) {
    var item = entryByKey[key];
    if (!item || !fields) return false;
    if (item._orig_mg === undefined) item._orig_mg = item.mg || '';
    if (item._orig_pron === undefined) item._orig_pron = item.pron || '';
    if (item._orig_en === undefined) item._orig_en = item.en || '';
    if (item._orig_approx === undefined) item._orig_approx = Boolean(item.pron_approx);
    if (item._orig_verified === undefined) item._orig_verified = Boolean(item.pron_verified);

    if (fields.mg !== undefined && fields.mg !== '') {
      item.mg = fields.mg;
      keyByMg[item.mg.trim().toLowerCase()] = key;
    } else {
      item.mg = item._orig_mg;
    }
    if (fields.pron !== undefined && fields.pron !== '') {
      item.pron = fields.pron;
    } else {
      item.pron = item._orig_pron;
    }
    if (fields.en !== undefined && fields.en !== '') {
      item.en = fields.en;
    } else {
      item.en = item._orig_en;
    }

    var changed = (item.mg !== item._orig_mg) || (item.pron !== item._orig_pron);
    if (changed) {
      item.pron_edited = true;
      item.pron_verified = true;
      delete item.pron_approx;
    } else {
      delete item.pron_edited;
      if (item._orig_verified) item.pron_verified = true;
      else delete item.pron_verified;
      if (item._orig_approx && !item.pron_verified) item.pron_approx = true;
    }
    return true;
  }

  Object.keys(editsMap).forEach(function (k) {
    applyEditToEntry(k, editsMap[k]);
    var item = entryByKey[k];
    var origLow = item && item._orig_mg ? item._orig_mg.trim().toLowerCase() : '';
    if (origLow && keysByOrigLow[origLow]) {
      keysByOrigLow[origLow].forEach(function (sibKey) {
        if (sibKey !== k && !editsMap[sibKey]) {
          applyEditToEntry(sibKey, editsMap[k]);
        }
      });
    }
  });

  function entryForKey(key) { return entryByKey[key] || null; }

  function keyForText(text) {
    if (!text) return null;
    var low = String(text).trim().toLowerCase();
    if (keyByMg[low]) return keyByMg[low];
    var nm = normMg(text);
    return (nm && keyByNormMg[nm]) || null;
  }

  function getEdit(key) { return editsMap[key] || null; }

  function saveEdit(key, fields) {
    var item = entryByKey[key];
    if (!item) return false;
    if (item._orig_mg === undefined) item._orig_mg = item.mg || '';
    if (item._orig_pron === undefined) item._orig_pron = item.pron || '';
    if (item._orig_en === undefined) item._orig_en = item.en || '';

    var cur = editsMap[key] || {};
    if (fields.mg !== undefined) {
      var nextMg = String(fields.mg).trim();
      if (nextMg && nextMg !== item._orig_mg) cur.mg = nextMg;
      else delete cur.mg;
    }
    if (fields.pron !== undefined) {
      var nextPron = String(fields.pron).trim();
      if (nextPron !== item._orig_pron) cur.pron = nextPron;
      else delete cur.pron;
    }
    if (fields.en !== undefined) {
      var nextEn = String(fields.en).trim();
      if (nextEn && nextEn !== item._orig_en) cur.en = nextEn;
      else delete cur.en;
    }
    editsMap[key] = cur;
    applyEditToEntry(key, cur);
    var origLow = item._orig_mg ? item._orig_mg.trim().toLowerCase() : '';
    if (origLow && keysByOrigLow[origLow]) {
      keysByOrigLow[origLow].forEach(function (sibKey) {
        if (sibKey !== key) {
          editsMap[sibKey] = Object.assign({}, editsMap[sibKey] || {}, cur);
          applyEditToEntry(sibKey, editsMap[sibKey]);
        }
      });
    }
    saveEditsMap();
    return true;
  }

  function resetEdit(key) {
    var item = entryByKey[key];
    if (!item) return false;
    var origLow = item._orig_mg ? item._orig_mg.trim().toLowerCase() : '';
    var keysToReset = (origLow && keysByOrigLow[origLow]) ? keysByOrigLow[origLow] : [key];
    if (keysToReset.indexOf(key) === -1) keysToReset.push(key);
    keysToReset.forEach(function (rk) {
      if (editsMap[rk]) {
        delete editsMap[rk].mg;
        delete editsMap[rk].pron;
        delete editsMap[rk].en;
        if (!editsMap[rk].verdict && !editsMap[rk].note) delete editsMap[rk];
      }
      applyEditToEntry(rk, {});
    });
    saveEditsMap();
    return true;
  }

  /* ---------------- course lesson entries (for Manual edits at current course lesson) ---------------- */
  var sessionMapByEntryKey = {};
  C.sessions.forEach(function (s) {
    var tag = 'W' + s.week + ' \u00b7 S' + s.number;
    function markKey(k) {
      if (!sessionMapByEntryKey[k]) sessionMapByEntryKey[k] = [];
      if (sessionMapByEntryKey[k].indexOf(tag) === -1) sessionMapByEntryKey[k].push(tag);
    }
    var d1 = s.dialogue ? dialogueById[s.dialogue] : null;
    if (d1 && d1.lines) {
      d1.lines.forEach(function (_, idx) { markKey('dlg:' + d1.id + ':' + idx); });
    }
    (s.words || []).forEach(function (wid) { markKey('word:' + wid); });
    var rpId = s.roleplay || ('dlg_rp_' + s.id);
    var dRp = rpId ? dialogueById[rpId] : null;
    if (dRp) {
      (dRp.lines || []).forEach(function (_, idx) { markKey('dlg:' + dRp.id + ':' + idx); });
      (dRp.swapPrompts || []).forEach(function (_, idx) { markKey('swap:' + dRp.id + ':' + idx); });
    }
  });

  function sessionsForEntryKey(key) {
    return sessionMapByEntryKey[key] || [];
  }

  function sessionEntries(sessionId) {
    var s = sessionById[sessionId] || currentSession() || C.sessions[0];
    if (!s) return [];
    var rows = [];
    var seenKeys = {};
    var lessonPrefix = 'Week ' + s.week + ' \u00b7 ' + s.day.slice(0, 3) + ' \u00b7 Session ' + s.number;

    var d1 = s.dialogue ? dialogueById[s.dialogue] : null;
    if (d1 && d1.lines) {
      d1.lines.forEach(function (line, idx) {
        var key = 'dlg:' + d1.id + ':' + idx;
        seenKeys[key] = true;
        rows.push({
          key: key,
          step: 0,
          stepLabel: 'Step 1 \u00b7 Dialogue',
          kind: 'Step 1 \u00b7 Dialogue line ' + (idx + 1) + (line.speaker ? ' (' + line.speaker + ')' : ''),
          where: lessonPrefix + ' \u00b7 ' + d1.title,
          sessionId: s.id,
          item: line,
          speakOpts: { line: d1.id + ':' + idx, editKey: key }
        });
      });
    }

    var wordList = (s.words || []).map(function (wid) { return byId[wid]; }).filter(Boolean);
    wordList.forEach(function (w, idx) {
      var key = 'word:' + w.id;
      seenKeys[key] = true;
      rows.push({
        key: key,
        step: 1,
        wordIndex: idx,
        stepLabel: 'Step 2 \u00b7 New words',
        kind: 'Step 2 \u00b7 New word ' + (idx + 1) + ' of ' + wordList.length,
        where: lessonPrefix + ' \u00b7 New words',
        sessionId: s.id,
        item: w,
        speakOpts: { wordId: w.id, editKey: key }
      });
    });

    var rpId = s.roleplay || ('dlg_rp_' + s.id);
    var dRp = rpId ? dialogueById[rpId] : null;
    if (dRp) {
      (dRp.lines || []).slice(0, 10).forEach(function (line, idx) {
        var key = 'dlg:' + dRp.id + ':' + idx;
        if (seenKeys[key]) return;
        seenKeys[key] = true;
        rows.push({
          key: key,
          step: 2,
          stepLabel: 'Step 3 \u00b7 Roleplay',
          kind: 'Step 3 \u00b7 Roleplay turn ' + (idx + 1) + (line.speaker ? ' (' + line.speaker + ')' : ''),
          where: lessonPrefix + ' \u00b7 ' + (dRp.title || 'Roleplay'),
          sessionId: s.id,
          item: line,
          speakOpts: { line: dRp.id + ':' + idx, editKey: key }
        });
      });
      (dRp.swapPrompts || []).forEach(function (sp, spIdx) {
        var key = 'swap:' + dRp.id + ':' + spIdx;
        if (seenKeys[key]) return;
        seenKeys[key] = true;
        rows.push({
          key: key,
          step: 2,
          stepLabel: 'Step 3 \u00b7 Roleplay',
          kind: 'Step 3 \u00b7 Roleplay Swap ' + (spIdx + 1),
          where: lessonPrefix + ' \u00b7 Round 2 Swap',
          sessionId: s.id,
          item: sp,
          speakOpts: { wordId: sp.id, editKey: key }
        });
      });
    }
    return rows;
  }

  function editCount() {
    return Object.keys(editsMap).filter(function (k) {
      var m = editsMap[k];
      return m && (m.mg !== undefined || m.pron !== undefined || m.en !== undefined);
    }).length;
  }

  function resetAllEdits() {
    Object.keys(editsMap).forEach(function (k) {
      resetEdit(k);
    });
    editsMap = {};
    saveEditsMap();
  }

  function exportEditsTSV() {
    var keys = Object.keys(editsMap).filter(function (k) {
      var m = editsMap[k];
      return m && (m.mg !== undefined || m.pron !== undefined || m.en !== undefined || m.verdict || m.note);
    });
    if (!keys.length) return 0;
    var header = ['key', 'section', 'original_mg', 'original_en', 'original_pron', 'verdict',
                  'corrected_mg', 'corrected_en', 'corrected_pron', 'note'];
    var lines = [header.join('\t')];
    keys.sort().forEach(function (k) {
      var item = entryByKey[k] || {};
      var m = editsMap[k] || {};
      var sec = k.indexOf('dlg:') === 0 ? 'sentences'
              : k.indexOf('phrase:') === 0 ? 'phrases'
              : k.indexOf('word:') === 0 ? 'words' : 'grammar';
      var origMg = item._orig_mg !== undefined ? item._orig_mg : (item.mg || '');
      var origEn = item._orig_en !== undefined ? item._orig_en : (item.en || '');
      var origPron = item._orig_pron !== undefined ? item._orig_pron : (item.pron || '');
      lines.push([
        k, sec,
        origMg.replace(/\t/g, ' '),
        origEn.replace(/\t/g, ' '),
        origPron.replace(/\t/g, ' '),
        m.verdict || '',
        (m.mg || '').replace(/\t/g, ' '),
        (m.en || '').replace(/\t/g, ' '),
        (m.pron || '').replace(/\t/g, ' '),
        (m.note || '').replace(/\n/g, ' ').replace(/\t/g, ' ')
      ].join('\t'));
    });
    var blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/tab-separated-values' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'salama_corrections.tsv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    return keys.length;
  }

  function themeTitle(id) {
    return themeById[id] ? themeById[id].title : String(id || '').replace(/_/g, ' ');
  }

  // Words that make sense as a single review card: no blanks, no essays.
  var studyWords = C.vocabulary.filter(function (w) {
    if (!w.en || !w.mg) return false;
    if (w.en.length > 58) return false;
    if (w.en.indexOf('...') !== -1 || w.mg.indexOf('...') !== -1 || w.mg.indexOf('___') !== -1) return false;
    return true;
  });

  function wordsForTheme(theme) {
    if (!theme || theme === 'all') return studyWords;
    return studyWords.filter(function (w) { return (w.themes || []).indexOf(theme) !== -1; });
  }

  function isDue(card) { return dueAt(card) <= Date.now(); }

  function dueWords(theme) {
    return wordsForTheme(theme).filter(function (w) {
      var card = state.cards[w.id];
      return card && isDue(card);
    }).sort(function (a, b) {
      var ca = state.cards[a.id], cb = state.cards[b.id];
      return (ca.box - cb.box) || (ca.seen - cb.seen);
    });
  }

  function newWords(theme) {
    return wordsForTheme(theme).filter(function (w) { return !state.cards[w.id]; });
  }

  function dueCount() { return dueWords('all').length; }

  function knownCount() {
    return Object.keys(state.cards).filter(function (id) {
      return byId[id] && state.cards[id].box >= 3;
    }).length;
  }

  function learningCount() {
    return Object.keys(state.cards).filter(function (id) {
      return byId[id] && state.cards[id].box < 3;
    }).length;
  }

  function totalCards() { return studyWords.length; }

  function quizAverage() {
    if (!state.quizzes.length) return null;
    var sum = state.quizzes.reduce(function (acc, q) { return acc + q.score / q.total; }, 0);
    return Math.round((sum / state.quizzes.length) * 100);
  }

  /* ---------------- curriculum ---------------- */
  function isSessionDone(id) { return Boolean(state.sessions[id]); }

  function markSession(id) {
    state.sessions[id] = Date.now();
    save();
  }

  function unmarkSession(id) {
    delete state.sessions[id];
    save();
  }

  function nextSession() {
    var pending = C.sessions.filter(function (s) { return !isSessionDone(s.id); });
    return pending.length ? pending[0] : C.sessions[C.sessions.length - 1];
  }


  /* ---------------- lesson position ("you are here") ---------------- */
  var POS_KEY = 'salama_lastpos_v1';
  var STEP_SLUGS = ['dialogue', 'words', 'roleplay', 'done'];
  var STEP_NAMES = ['Dialogue', 'New words', 'Roleplay', 'Finished'];

  function lastPosition() {
    var p = readJSON(POS_KEY);
    if (p && p.id && sessionById[p.id]) {
      p.step = Math.max(0, Math.min(3, Number(p.step) || 0));
      return p;
    }
    return null;
  }

  function setPosition(id, step, index) {
    if (!sessionById[id]) return;
    try {
      localStorage.setItem(POS_KEY, JSON.stringify({ id: id, step: step || 0, index: index || 0, t: Date.now() }));
    } catch (e) { /* private mode */ }
  }

  function sessionIndex(id) {
    for (var i = 0; i < C.sessions.length; i++) if (C.sessions[i].id === id) return i;
    return -1;
  }

  function adjacentSession(id, delta) {
    var i = sessionIndex(id);
    if (i < 0) return null;
    return C.sessions[i + delta] || null;
  }

  function positionHash(pos) {
    if (!pos) return '#/today';
    var h = '#/session/' + pos.id + '/' + STEP_SLUGS[pos.step || 0];
    if ((pos.step || 0) === 1 && pos.index) h += '/' + (pos.index + 1);
    return h;
  }

  /** The lesson the teacher is on: last opened, else the first not yet finished. */
  function currentSession() {
    var p = lastPosition();
    return p ? sessionById[p.id] : nextSession();
  }

  function sessionDoneCount() {
    return C.sessions.filter(function (s) { return isSessionDone(s.id); }).length;
  }

  function weekDoneCount(week) {
    var list = C.sessions.filter(function (s) { return s.week === week; });
    return list.filter(function (s) { return isSessionDone(s.id); }).length;
  }

  function completedWeeks() {
    return C.curriculum.filter(function (w) {
      return weekDoneCount(w.week) === w.sessions.length;
    }).length;
  }

  /* ---------------- preferences + data ---------------- */
  function setPref(key, value) {
    state.prefs[key] = value;
    save();
    applyPrefs();
  }

  var PALETTES = {
    miteny:   { accent: '#123F2B', accentDeep: '#1B5B3E', accentSoft: '#FFF0B8', accent2: '#F26B1D', deep: '#0B2D1F' },
    laterite: { accent: '#b2452a', accentDeep: '#8e331c', accentSoft: '#f7e5de', accent2: '#4f8a55', deep: '#4a2418' },
    vanilla:  { accent: '#a8741c', accentDeep: '#825812', accentSoft: '#f6ecda', accent2: '#5f7f3a', deep: '#3a2a14' },
    ravinala: { accent: '#2f7d5b', accentDeep: '#215c42', accentSoft: '#e1f0e9', accent2: '#c0582f', deep: '#163a2c' },
    lamba:    { accent: '#3d5a9e', accentDeep: '#2b4278', accentSoft: '#e3e9f6', accent2: '#b5612f', deep: '#1c2440' }
  };

  var FONTS = {
    fraunces:  { display: "'Fraunces', Georgia, serif", body: "'Public Sans', system-ui, sans-serif" },
    gloock:    { display: "'Gloock', Georgia, serif", body: "'Instrument Sans', system-ui, sans-serif" },
    young:     { display: "'Young Serif', Georgia, serif", body: "'Work Sans', system-ui, sans-serif" },
    bricolage: { display: "'Bricolage Grotesque', system-ui, sans-serif", body: "'Bricolage Grotesque', system-ui, sans-serif" }
  };

  function applyPrefs() {
    var root = document.documentElement;
    if (!root || !root.setAttribute) return;
    root.setAttribute('data-textsize', String(state.prefs.textsize || 0));
    var dir = state.prefs.direction || 'miteny';
    var rawMode = state.prefs.mode || 'auto';
    var mode = rawMode === 'auto' ? (dir === 'dusk' ? 'dark' : 'light') : rawMode;
    root.setAttribute('data-dir', dir);
    root.setAttribute('data-mode', mode);
    if (root.style && root.style.setProperty) {
      var pal = PALETTES[state.prefs.palette] || PALETTES.miteny;
      root.style.setProperty('--accent', pal.accent);
      root.style.setProperty('--accent-deep', pal.accentDeep);
      root.style.setProperty('--accent-soft', pal.accentSoft);
      root.style.setProperty('--accent-2', pal.accent2);
      if (mode === 'light' && dir !== 'dusk') {
        root.style.setProperty('--deep', pal.deep);
      } else {
        root.style.removeProperty('--deep');
      }
      var f = FONTS[state.prefs.font] || FONTS.fraunces;
      root.style.setProperty('--f-display', f.display);
      root.style.setProperty('--f-body', f.body);
    }
  }

  function exportData() {
    var payload = {
      app: 'Salama! — Learn Malagasy',
      exportedAt: new Date().toISOString(),
      state: state
    };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'salama-progress-' + dayKey() + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }

  /**
   * Restore a file written by exportData(). Accepts both shapes: the wrapped
   * {app, exportedAt, state} and a bare state object. Returns a short summary
   * or throws with a readable reason, so Settings can tell the learner what
   * happened instead of a silent no-op.
   */
  function importData(text) {
    var payload;
    try { payload = JSON.parse(text); }
    catch (e) { throw new Error('That file is not JSON.'); }
    var incoming = payload && payload.state ? payload.state : payload;
    if (!incoming || typeof incoming !== 'object' || !incoming.cards) {
      throw new Error('That file does not look like a Salama! backup.');
    }
    var fresh = blank();
    fresh.cards = incoming.cards || {};
    fresh.sessions = incoming.sessions || {};
    fresh.quizzes = Array.isArray(incoming.quizzes) ? incoming.quizzes.slice(-40) : [];
    fresh.streak = incoming.streak || fresh.streak;
    fresh.prefs = Object.assign(fresh.prefs, incoming.prefs || {});
    Object.keys(state).forEach(function (k) { delete state[k]; });
    Object.keys(fresh).forEach(function (k) { state[k] = fresh[k]; });
    save();
    applyPrefs();
    return {
      sessions: Object.keys(state.sessions).length,
      words: Object.keys(state.cards).length
    };
  }

  function resetData() {
    // Mutate in place so every view holding S.core.state sees the reset.
    var fresh = blank();
    Object.keys(state).forEach(function (k) { delete state[k]; });
    Object.keys(fresh).forEach(function (k) { state[k] = fresh[k]; });
    save();
    applyPrefs();
  }

  S.core = {
    data: C,
    state: state,
    save: save,
    gradeWord: gradeWord,
    dueAt: dueAt,
    dueWords: dueWords,
    newWords: newWords,
    dueCount: dueCount,
    knownCount: knownCount,
    learningCount: learningCount,
    totalCards: totalCards,
    quizAverage: quizAverage,
    wordsForTheme: wordsForTheme,
    themeTitle: themeTitle,
    themeById: themeById,
    wordById: function (id) { return byId[id]; },
    session: function (id) { return sessionById[id]; },
    sessionById: sessionById,
    dialogue: function (id) { return dialogueById[id]; },
    grammar: function (id) { return grammarById[id]; },
    isSessionDone: isSessionDone,
    markSession: markSession,
    unmarkSession: unmarkSession,
    nextSession: nextSession,
    currentSession: currentSession,
    lastPosition: lastPosition,
    setPosition: setPosition,
    sessionIndex: sessionIndex,
    adjacentSession: adjacentSession,
    positionHash: positionHash,
    STEP_SLUGS: STEP_SLUGS,
    STEP_NAMES: STEP_NAMES,
    sessionDoneCount: sessionDoneCount,
    weekDoneCount: weekDoneCount,
    completedWeeks: completedWeeks,
    touchStreak: touchStreak,
    longDate: longDate,
    shortDate: shortDate,
    dayKey: dayKey,
    setPref: setPref,
    applyPrefs: applyPrefs,
    exportData: exportData,
    importData: importData,
    resetData: resetData,
    entryForKey: entryForKey,
    keyForText: keyForText,
    getEdit: getEdit,
    saveEdit: saveEdit,
    resetEdit: resetEdit,
    resetAllEdits: resetAllEdits,
    editCount: editCount,
    exportEditsTSV: exportEditsTSV,
    sessionEntries: sessionEntries,
    sessionsForEntryKey: sessionsForEntryKey,
    reload: function (nextState) { state = nextState; }
  };
})(window.Salama);
