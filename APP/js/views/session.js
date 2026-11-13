/* Session runner: warm-up dialogue → new words → roleplay → finish. */
(function (S) {
  'use strict';
  var core = S.core;
  var ui = S.ui;
  var speech = S.speech;

  var STEPS = ['Dialogue', 'New words', 'Roleplay'];

  var run = {
    id: null,
    step: 0,
    index: 0,
    role: null,
    revealed: {},   // turn index -> true once the learner shows their reply
    words: [],
    editsOpen: false,
    editsFilter: 'step' // 'step' | 'all' | '0' | '1' | '2'
  };

  function reset(session) {
    run.id = session.id;
    run.step = 0;
    run.index = 0;
    run.role = null;
    run.revealed = {};
    run.words = wordsFor(session);
    run.editsFilter = 'step';
  }

  function wordsFor(session) {
    if (session && Array.isArray(session.words) && session.words.length) {
      var explicit = session.words.map(function (id) { return core.wordById(id); }).filter(Boolean);
      if (explicit.length) return explicit;
    }
    var seen = {};
    var out = [];
    (session.themes || []).forEach(function (theme) {
      core.wordsForTheme(theme).forEach(function (w) {
        if (!seen[w.id]) { seen[w.id] = true; out.push(w); }
      });
    });
    out.sort(function (a, b) {
      var ca = core.state.cards[a.id];
      var cb = core.state.cards[b.id];
      if (!ca && cb) return -1;
      if (ca && !cb) return 1;
      return (a.level || 1) - (b.level || 1);
    });
    var offset = ((session && session.number ? session.number : 1) - 1) * 6;
    var slice = out.slice(offset, offset + 6);
    return slice.length ? slice : out.slice(0, 6);
  }

  function speakButton(text, wordId) {
    return ui.speakButtons(text, { wordId: wordId, label: 'Listen' });
  }

  function stepHref(step) {
    var h = '#/session/' + run.id + '/' + core.STEP_SLUGS[step];
    if (step === 1 && run.index) h += '/' + (run.index + 1);
    return h;
  }

  function stepList(active) {
    return '<ol class="runner-steps" aria-label="Lesson steps">' + STEPS.map(function (name, i) {
      var state = i === active ? 'active' : (i < active ? 'done' : 'todo');
      return '<li data-state="' + state + '">' +
        '<a href="' + stepHref(i) + '"' + (i === active ? ' aria-current="step"' : '') + '>' +
          '<span class="rs-num">' + (i < active ? '\u2713' : (i + 1)) + '</span>' +
          '<span class="rs-name">' + name + '</span>' +
          (i === active ? '<span class="rs-here">You are here</span>' : '') +
        '</a></li>';
    }).join('') + '</ol>';
  }

  /* ---------------- step 1: dialogue ---------------- */
  function dialogueStep(session) {
    var dialogue = session.dialogue ? core.dialogue(session.dialogue) : null;

    if (!dialogue) {
      return '<p class="empty">No dialogue is mapped to this session yet.</p>';
    }

    return '<h2 style="margin-top:0">' + ui.esc(dialogue.title) + '</h2>' +
      '<div class="dialogue">' + dialogue.lines.map(function (line, index) {
        return '<div class="turn">' +
          '<span class="who"><span class="line-no">' + (index + 1) + '/' + dialogue.lines.length + '</span> ' + ui.esc(line.speaker || 'A') +
            (line.stage ? ' <span class="stage">(' + ui.esc(line.stage) + ')</span>' : '') + '</span>' +
          '<p class="line" lang="mg">' + ui.esc(line.mg) + '</p>' +
          (line.pron ? '<p class="say">' + ui.esc(line.pron) + ui.pronunciationTag(line) + '</p>' : '') +
          '<p class="trans">' + ui.esc(line.en) + '</p>' +
          '<div class="turn-tools">' + ui.speakButtons(line.mg, { line: dialogue.id + ':' + index }) + '</div>' +
          '</div>';
      }).join('') + '</div>';
  }

  /* ---------------- step 2: new words ---------------- */
  function wordStep() {
    if (!run.words.length) {
      return '<p class="empty">No words for this session.</p>';
    }
    var word = run.words[run.index];
    var alt = (word.alt || []).filter(function (a) { return a; });
    return '<div class="word-focus">' +
      '<p class="word" lang="mg">' + ui.esc(word.mg) + '</p>' +
      (word.pron ? '<p class="say">' + ui.esc(word.pron) +
        ui.pronunciationTag(word) + '</p>' : '') +
      '<p class="gloss">' + ui.esc(word.en) + '</p>' +
      (word.mg_alt && word.mg_alt.length ? '<p class="alt">Also written: <span lang="mg">' + ui.esc(word.mg_alt.join(', ')) + '</span></p>' : '') +
      (alt.length ? '<p class="alt">Also: ' + ui.esc(alt.join('; ')) + '</p>' : '') +
      (word.note ? '<p class="alt">' + ui.esc(word.note) + '</p>' : '') +
      '<div class="btn-row" style="justify-content:center;margin-top:16px">' +
        speakButton(word.mg, word.id) +
        '<button class="icon-btn" type="button" data-word-prev="true"' +
          (run.index === 0 ? ' disabled' : '') + '>Previous word</button>' +
        '<button class="icon-btn" type="button" data-word-next="true"' +
          (run.index >= run.words.length - 1 ? ' disabled' : '') + '>Next word</button>' +
      '</div>' +
      '<p class="meta" style="margin-top:16px">Word ' + (run.index + 1) + ' of ' + run.words.length + '</p>' +
      '<div class="word-chips" role="group" aria-label="Jump to a word">' + run.words.map(function (w, i) {
        return '<button type="button" class="word-chip" data-word-go="' + i + '"' +
          (i === run.index ? ' aria-current="true"' : '') + '><span>' + (i + 1) + '</span> ' + ui.esc(w.mg) + '</button>';
      }).join('') + '</div>' +
      '</div>';
  }

  /* ---------------- step 3: roleplay ---------------- */
  function roleplayStep(session) {
    var rpId = session.roleplay || ('dlg_rp_' + session.id);
    var dialogue = (rpId && core.dialogue(rpId)) || (session.dialogue ? core.dialogue(session.dialogue) : null);
    if (!dialogue) return '<p class="empty">No roleplay scenario is mapped to this session yet.</p>';

    var speakers = [];
    dialogue.lines.forEach(function (line) {
      if (line.speaker && speakers.indexOf(line.speaker) === -1) speakers.push(line.speaker);
    });

    var scenarioCard = '<div class="roleplay-scenario">' +
      '<div class="roleplay-kicker">Roleplay Scenario \u00b7 New Situation</div>' +
      '<h3 class="roleplay-title">' + ui.esc(dialogue.title || 'Roleplay Practice') + '</h3>' +
      (dialogue.scenario ? '<p class="roleplay-setting">' + ui.esc(dialogue.scenario) + '</p>' : '') +
      (dialogue.task ? '<p class="roleplay-instruction"><strong>How to practice:</strong> ' + ui.esc(dialogue.task) + '</p>' : '') +
    '</div>';

    var chooser = '<div class="chips" role="group" aria-label="Choose your part" style="margin-bottom:12px;">' +
      '<button class="chip" type="button" data-role="" aria-pressed="' + (!run.role ? 'true' : 'false') + '">Both roles (Read together)</button>' +
      speakers.map(function (name) {
        return '<button class="chip" type="button" data-role="' + ui.esc(name) + '" ' +
          'aria-pressed="' + (run.role === name ? 'true' : 'false') + '">Play as ' + ui.esc(name) + '</button>';
      }).join('') +
      (run.role ? '<button class="chip" type="button" data-role="' + ui.esc(run.role) + '" title="Hide your lines again to practice another round">\u21bb Hide my lines again</button>' : '') +
    '</div>';

    var lines = dialogue.lines.slice(0, 10).map(function (line, i) {
      var mine = run.role && line.speaker === run.role;
      if (mine && !run.revealed[i]) {
        return '<div class="turn turn-cue">' +
          '<span class="who">' + ui.esc(line.speaker) + ' \u00b7 your turn to speak</span>' +
          '<p class="trans roleplay-cue">Cue: \u201c' + ui.esc(line.en) + '\u201d</p>' +
          '<button class="icon-btn" type="button" data-reveal="' + i + '">Show Malagasy reply</button>' +
          '</div>';
      }
      return '<div class="turn">' +
        '<span class="who">' + ui.esc(line.speaker) +
          (mine ? ' \u00b7 your part' : '') +
          (line.stage ? ' <span class="stage">(' + ui.esc(line.stage) + ')</span>' : '') + '</span>' +
        '<p class="line" lang="mg">' + ui.esc(line.mg) + '</p>' +
        (line.pron ? '<p class="pron">[' + ui.esc(line.pron) + ']</p>' : '') +
        '<p class="trans">' + ui.esc(line.en) + '</p>' +
        '<div class="turn-tools">' + ui.speakButtons(line.mg, { line: dialogue.id + ':' + i }) + '</div>' +
        '</div>';
    }).join('');

    var swapSection = '';
    if (dialogue.swapPrompts && dialogue.swapPrompts.length) {
      swapSection = '<div class="roleplay-round">' +
        '<div class="roleplay-kicker">Round 2 \u00b7 Improvise &amp; Swap Words</div>' +
        '<p class="roleplay-round-help">Run the roleplay a second time and swap in these expressions from this lesson:</p>' +
        '<div class="stack">' +
          dialogue.swapPrompts.map(function (sp, spIdx) {
            return '<div class="row-card entry" style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;padding:8px 10px;border:1px solid var(--border,#e6dec8);border-radius:10px;">' +
              '<div>' +
                '<strong lang="mg">' + ui.esc(sp.mg) + '</strong>' +
                (sp.pron ? ' <span class="pron">[' + ui.esc(sp.pron) + ']' + ui.pronunciationTag(sp) + '</span>' : '') +
                '<div class="roleplay-translation">' + ui.esc(sp.en) + '</div>' +
              '</div>' +
              '<div class="turn-tools">' + ui.speakButtons(sp.mg, { wordId: sp.id, editKey: 'swap:' + dialogue.id + ':' + spIdx }) + '</div>' +
            '</div>';
          }).join('') +
        '</div>' +
      '</div>';
    }

    return '<div class="roleplay">' + scenarioCard +
      '<p class="roleplay-help">' +
        (run.role
          ? 'Playing as <strong>' + ui.esc(run.role) + '</strong> \u2014 say each Malagasy line from the English cue, then click <em>Show Malagasy reply</em> to check and listen.'
          : 'Choose a character below to test yourself from English cues, or read both parts together:') +
      '</p>' +
      chooser +
      '<div class="dialogue">' + lines + '</div>' +
      swapSection + '</div>';
  }

  /* ---------------- "you are here" compass ---------------- */
  function shortName(sess) {
    return 'Week ' + sess.week + ' \u00b7 ' + sess.day.slice(0, 3) + ' \u00b7 Session ' + sess.number;
  }

  function jumpSelect(session) {
    return '<select class="lc-select" data-jump="true" aria-label="Syllabus curriculum menu — jump to any lesson">' +
      core.data.curriculum.map(function (week) {
        var list = core.data.sessions.filter(function (s) { return s.week === week.week; });
        return '<optgroup label="Month ' + week.month + ' \u00b7 Week ' + week.week + ' \u2014 ' + ui.esc(week.title) + '">' +
          list.map(function (s) {
            var lno = (s.week - 1) * 3 + s.number;
            return '<option value="' + s.id + '"' + (s.id === session.id ? ' selected' : '') + '>' +
              (core.isSessionDone(s.id) ? '\u2713 ' : '') + 'Lesson ' + lno + ' (W' + s.week + ' \u00b7 ' + s.day.slice(0, 3) + ' S' + s.number + ') \u2014 ' + ui.esc(s.focus) +
              '</option>';
          }).join('') + '</optgroup>';
      }).join('') + '</select>';
  }

  function syllabusDrawer(session) {
    return '<details class="lc-syllabus-drawer">' +
      '<summary class="lc-syllabus-toggle">\u2630 Full Syllabus &amp; Curriculum Title Menu (All 12 Weeks \u00b7 36 Sessions)</summary>' +
      '<div class="lc-syllabus-grid">' +
        core.data.curriculum.map(function (week) {
          var list = core.data.sessions.filter(function (s) { return s.week === week.week; });
          var isCurWeek = week.week === session.week;
          return '<div class="lc-syllabus-week' + (isCurWeek ? ' is-cur-week' : '') + '">' +
            '<div class="lc-syllabus-week-head">' +
              '<span class="lc-sw-badge">Month ' + week.month + ' \u00b7 Week ' + week.week + '</span>' +
              '<strong>' + ui.esc(week.title) + '</strong>' +
            '</div>' +
            '<div class="lc-syllabus-sessions">' +
              list.map(function (s) {
                var lno = (s.week - 1) * 3 + s.number;
                var cur = s.id === session.id;
                var done = core.isSessionDone(s.id);
                return '<div class="lc-syllabus-item' + (cur ? ' is-cur' : '') + '">' +
                  '<a class="lc-si-main" href="#/session/' + s.id + '/dialogue">' +
                    '<span class="lc-si-num">L' + lno + (done ? ' \u2713' : '') + '</span>' +
                    '<span class="lc-si-text"><strong>' + ui.esc(s.day.slice(0, 3)) + ' S' + s.number + ':</strong> ' + ui.esc(s.focus) + '</span>' +
                  '</a>' +
                  '<span class="lc-si-steps">' +
                    '<a href="#/session/' + s.id + '/dialogue" title="Dialogue">Dlg</a>' +
                    '<a href="#/session/' + s.id + '/words" title="New Words">Words</a>' +
                    '<a href="#/session/' + s.id + '/roleplay" title="Roleplay">RP</a>' +
                  '</span>' +
                '</div>';
              }).join('') +
            '</div>' +
          '</div>';
        }).join('') +
      '</div>' +
    '</details>';
  }

  function compass(session, step) {
    var idx = core.sessionIndex(session.id);
    var total = core.data.sessions.length;
    var prev = core.adjacentSession(session.id, -1);
    var next = core.adjacentSession(session.id, 1);
    var weekSessions = core.data.sessions.filter(function (s) { return s.week === session.week; });
    var pct = Math.round(((idx + (Math.min(step, 3) / 3)) / total) * 100);
    var prevWeekNo = session.week > 1 ? session.week - 1 : 0;
    var nextWeekNo = session.week < core.data.curriculum.length ? session.week + 1 : 0;

    return '<nav class="lesson-compass" aria-label="Where you are in the course">' +
      '<div class="lc-crumbs">' +
        '<a href="#/course">Course</a><span class="lc-sep">\u203a</span>' +
        '<a href="#/course/' + session.week + '">Week ' + session.week + ': ' + ui.esc(session.week_title || '') + '</a><span class="lc-sep">\u203a</span>' +
        '<strong>' + ui.esc(session.day) + ' \u00b7 Session ' + session.number + '</strong><span class="lc-sep">\u203a</span>' +
        '<span class="lc-step">' + core.STEP_NAMES[step] + '</span>' +
      '</div>' +
      '<div class="lc-week-strip" role="navigation" aria-label="Switch week">' +
        (prevWeekNo ? '<a class="lc-wk-chip lc-wk-adj" href="#/session/w' + prevWeekNo + 's1/dialogue" title="Go to Week ' + prevWeekNo + '">\u2190 W' + prevWeekNo + '</a>' : '') +
        core.data.curriculum.map(function (w) {
          var isCur = w.week === session.week;
          return '<a class="lc-wk-chip' + (isCur ? ' is-cur' : '') + '" href="#/session/w' + w.week + 's1/dialogue" title="Week ' + w.week + ': ' + ui.esc(w.title) + '">W' + w.week + '</a>';
        }).join('') +
        (nextWeekNo ? '<a class="lc-wk-chip lc-wk-adj" href="#/session/w' + nextWeekNo + 's1/dialogue" title="Go to Week ' + nextWeekNo + '">W' + nextWeekNo + ' \u2192</a>' : '') +
      '</div>' +
      '<div class="lc-progress" title="Lesson ' + (idx + 1) + ' of ' + total + '">' +
        '<span class="lc-bar"><span style="width:' + pct + '%"></span></span>' +
        '<span class="lc-count">Lesson <strong>' + (idx + 1) + '</strong> of ' + total + '</span>' +
      '</div>' +
      '<div class="lc-week" role="group" aria-label="Sessions this week">' +
        weekSessions.map(function (s) {
          var cur = s.id === session.id;
          return '<a class="lc-pill" href="#/session/' + s.id + '/dialogue"' + (cur ? ' aria-current="page"' : '') + '>' +
            '<span class="lc-pill-day">W' + s.week + ' \u00b7 ' + ui.esc(s.day.slice(0, 3)) + ' \u00b7 S' + s.number + (core.isSessionDone(s.id) ? ' \u2713' : '') + '</span>' +
            '<span class="lc-pill-focus">' + ui.esc(s.focus) + '</span>' +
          '</a>';
        }).join('') +
      '</div>' +
      '<div class="lc-row">' +
        (prev
          ? '<a class="lc-nav lc-prev" href="#/session/' + prev.id + '/dialogue"><span class="lc-arrow">\u2190</span><span><small>Previous lesson</small>' + shortName(prev) + '</span></a>'
          : '<span class="lc-nav lc-prev" aria-disabled="true"><span class="lc-arrow">\u2190</span><span><small>Previous lesson</small>This is the first lesson</span></span>') +
        '<label class="lc-jump"><small>Jump to any lesson</small>' + jumpSelect(session) + '</label>' +
        (next
          ? '<a class="lc-nav lc-next" href="#/session/' + next.id + '/dialogue"><span><small>Next lesson</small>' + shortName(next) + '</span><span class="lc-arrow">\u2192</span></a>'
          : '<span class="lc-nav lc-next" aria-disabled="true"><span><small>Next lesson</small>Last lesson of the course</span><span class="lc-arrow">\u2192</span></span>') +
      '</div>' +
    '</nav>';
  }

  /* ---------------- embedded Manual edits (Malagasy & phonetics) for this course lesson ---------------- */
  function filteredLessonEntries(session) {
    var all = (core.sessionEntries ? core.sessionEntries(session.id) : []).slice();
    var f = run.editsFilter || 'step';
    var filtered = all;
    if (f === 'step') {
      filtered = all.filter(function (r) { return r.step === run.step; });
      if (!filtered.length) filtered = all;
    } else if (f === '0' || f === '1' || f === '2') {
      var targetStep = Number(f);
      filtered = all.filter(function (r) { return r.step === targetStep; });
    }
    if (run.step === 1) {
      // Put the currently displayed word right at the top when editing New Words
      filtered.sort(function (a, b) {
        var aCur = (a.step === 1 && a.wordIndex === run.index) ? 0 : 1;
        var bCur = (b.step === 1 && b.wordIndex === run.index) ? 0 : 1;
        if (aCur !== bCur) return aCur - bCur;
        return 0;
      });
    }
    return { all: all, list: filtered };
  }

  function renderLessonEditRow(r) {
    var item = r.item || {};
    var hasAudio = S.speech && S.speech.hasCustomAudio ? S.speech.hasCustomAudio(r.key, item.mg) : false;
    var edited = Boolean(item.pron_edited || hasAudio);
    var isCurrentWord = (run.step === 1 && r.step === 1 && r.wordIndex === run.index);
    var extra = (r.speakOpts && r.speakOpts.wordId ? ' data-word-id="' + ui.esc(r.speakOpts.wordId) + '"' : '') +
                (r.speakOpts && r.speakOpts.line ? ' data-line="' + ui.esc(r.speakOpts.line) + '"' : '');
    return '<article class="entry edit-card lesson-edit-card' + (isCurrentWord ? ' is-active-word' : '') + '" data-lesson-row-key="' + ui.esc(r.key) + '">' +
      '<div style="width:100%">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px">' +
          '<span class="meta">' +
            (isCurrentWord ? '<span class="here-tag" style="margin-right:6px">\u25CF On screen now</span>' : '') +
            '<strong>' + ui.esc(r.kind) + '</strong>' +
            (item.en ? ' \u2014 <span>' + ui.esc(item.en) + '</span>' : '') +
            ' <span class="checked" data-lesson-status-for="' + ui.esc(r.key) + '"' + (edited ? '' : ' hidden') + '>\u2713 ' + (item.pron_edited ? 'Edited' : 'Recorded') + '</span>' +
          '</span>' +
          '<div class="entry-tools">' +
            '<button class="icon-btn hear-btn" type="button" data-speak="' + ui.esc(item.mg) + '"' + extra + '>' +
              ui.icon('play') + '<span>' + (hasAudio ? 'Hear My Voice' : 'Listen') + '</span></button>' +
            '<button class="icon-btn slow" type="button" data-slow="' + ui.esc(item.mg) + '"' + extra + '>' +
              ui.icon('volume') + '<span>Syllables</span></button>' +
            '<button class="icon-btn rec-btn" type="button" data-mic-record="' + ui.esc(r.key) + '" style="border-color:#c93b2b;color:#c93b2b;font-weight:700">' +
              '\u25CF<span>' + (hasAudio ? 'Re-record' : 'Record') + '</span></button>' +
            '<button class="icon-btn" type="button" data-lesson-live-reset="' + ui.esc(r.key) + '"' + (item.pron_edited ? '' : ' hidden') + '>Reset text</button>' +
          '</div>' +
        '</div>' +
        '<div class="inline-edit-fields">' +
          '<label class="inline-edit-field">' +
            '<span>Malagasy (type to edit)</span>' +
            '<input type="text" class="inline-edit-mg" lang="mg" data-lesson-live-field="mg" data-lesson-live-key="' + ui.esc(r.key) + '" value="' + ui.esc(item.mg || '') + '">' +
          '</label>' +
          '<label class="inline-edit-field">' +
            '<span>Phonetics / pronunciation (type to edit)</span>' +
            '<input type="text" class="inline-edit-pron" data-lesson-live-field="pron" data-lesson-live-key="' + ui.esc(r.key) + '" placeholder="e.g. sah-LAH-mah" value="' + ui.esc(item.pron || '') + '">' +
          '</label>' +
        '</div>' +
      '</div>' +
    '</article>';
  }

  function renderLessonEditsInner(session) {
    var data = filteredLessonEntries(session);
    var f = run.editsFilter || 'step';
    var stepName = STEPS[run.step] || 'Current step';
    var filterTabs = [
      ['step', 'Current step: ' + stepName],
      ['all', 'All in this lesson (' + data.all.length + ')'],
      ['0', '1 Dialogue'],
      ['1', '2 New words (' + run.words.length + ')'],
      ['2', '3 Roleplay']
    ];
    return '<div class="lesson-edits-body">' +
      '<div class="lesson-edits-toolbar">' +
        '<div class="chips" style="margin:0">' +
          filterTabs.map(function (t) {
            return '<button class="chip" type="button" data-lesson-edit-filter="' + t[0] + '" aria-pressed="' +
              (f === t[0] ? 'true' : 'false') + '">' + ui.esc(t[1]) + '</button>';
          }).join('') +
        '</div>' +
        '<div class="btn-row" style="margin:0">' +
          '<a class="btn btn-secondary btn-sm" href="#/edit/session/' + ui.esc(session.id) + '">\u270E Open in Full Course Editor &rarr;</a>' +
          '<button class="btn btn-quiet btn-sm" type="button" data-export-lesson-edits="true">' + ui.icon('download') + 'Export edits (.tsv)</button>' +
        '</div>' +
      '</div>' +
      '<p class="meta" style="margin:8px 0 12px">Type in any <strong>Malagasy</strong> or <strong>Phonetics / pronunciation</strong> box below \u2014 your edits save automatically and update the lesson card above.</p>' +
      '<div class="entry-list" id="lessonEditsList">' +
        (data.list.length ? data.list.map(renderLessonEditRow).join('') : '<p class="empty">No items in this step.</p>') +
      '</div>' +
    '</div>';
  }

  function renderLessonEditsPanel(session) {
    return '<details class="panel lesson-manual-edits" id="lessonManualEditsPanel"' + (run.editsOpen ? ' open' : '') + '>' +
      '<summary class="lesson-manual-edits-summary">' +
        '<span>\u270E <strong>Manual edits (Malagasy &amp; phonetics)</strong> \u2014 Week ' + session.week + ' \u00b7 ' + ui.esc(session.day) + ' \u00b7 Session ' + session.number + ' (' + ui.esc(STEPS[run.step] || 'Lesson') + ')</span>' +
        '<span class="lesson-manual-edits-pill">Edit here in this lesson \u25BE</span>' +
      '</summary>' +
      '<div id="lessonManualEditsMount">' + renderLessonEditsInner(session) + '</div>' +
    '</details>';
  }

  /* ---------------- render ---------------- */
  function stepFromParts(parts) {
    var slug = parts && parts[2];
    var i = core.STEP_SLUGS.indexOf(slug);
    return i < 0 ? 0 : i;
  }

  function render(parts) {
    var session = core.session(parts && parts[1]);
    if (!session) return '<p class="empty">That session does not exist.</p>';
    if (run.id !== session.id) reset(session);
    run.step = stepFromParts(parts);
    if (run.step === 1 && parts[3]) {
      run.index = Math.max(0, Math.min(run.words.length - 1, (Number(parts[3]) || 1) - 1));
    }
    if (run.step === 3 && !core.isSessionDone(session.id)) core.markSession(session.id);
    core.setPosition(session.id, run.step, run.index);

    if (run.step === 3) {
      return '<div class="view-narrow">' + completionPanel(session) + '</div>';
    }

    var body;
    if (run.step === 0) body = dialogueStep(session);
    else if (run.step === 1) body = wordStep();
    else body = roleplayStep(session);

    var prev = core.adjacentSession(session.id, -1);
    var canEdit = Boolean(core.state && core.state.prefs && core.state.prefs.showInlineEdit);

    return '<div class="view-narrow">' +
      '<div class="runner-head runner-head-compact">' +
        '<p class="meta" style="margin:0"><strong>Week ' + session.week + ' \u00b7 ' + ui.esc(session.day) + ' \u00b7 Session ' + session.number + ' of 3</strong> \u2014 ' + ui.esc(session.focus) + '</p>' +
        '<div class="runner-head-actions">' +
          (canEdit ? '<button class="icon-btn lesson-edit-jump-btn" type="button" data-open-lesson-edits="true" title="Edit Malagasy &amp; phonetics for this lesson">\u270E<span>Manual edits (this lesson)</span></button>' : '') +
          '<a class="cta-link" href="#/course/' + session.week + '">Week ' + session.week + ' outline</a>' +
        '</div>' +
      '</div>' +
      stepList(run.step) +
      '<div class="runner-body">' + body + '</div>' +
      '<div class="runner-foot">' +
        '<button class="btn btn-quiet" type="button" data-back="true">' +
          ui.icon('arrow-left') + backLabel(prev) + '</button>' +
        '<span class="position">Step ' + (run.step + 1) + ' of 3 \u00b7 <kbd>\u2190</kbd> <kbd>\u2192</kbd> keys work too</span>' +
        '<button class="btn" type="button" data-next="true">' + nextLabel() + ui.icon('arrow-right') + '</button>' +
      '</div>' +
      (canEdit ? renderLessonEditsPanel(session) : '') +
      '</div>';
  }

  function backLabel(prev) {
    if (run.step === 1) return 'Back: Dialogue';
    if (run.step === 2) return 'Back: New words';
    return prev ? 'Previous lesson' : 'Week outline';
  }

  function nextLabel() {
    if (run.step === 0) return 'Next: New words';
    if (run.step === 1) return 'Next: Roleplay';
    return 'Finish lesson';
  }

  function completionPanel(session) {
    var doneCount = core.sessionDoneCount();
    var next = core.adjacentSession(session.id, 1);
    return '<section class="panel lesson-done" aria-labelledby="doneTitle">' +
      '<p class="section-eyebrow" style="margin:0 0 6px">\u2713 Lesson finished</p>' +
      '<h1 id="doneTitle" style="margin-top:0">' + ui.esc(session.focus) + '</h1>' +
      '<p class="meta">Week ' + session.week + ' \u00b7 ' + ui.esc(session.day) + ' \u00b7 Session ' + session.number + ' \u00b7 ' + doneCount + ' of ' + core.data.sessions.length + ' lessons done</p>' +
      (next
        ? '<a class="next-lesson-card" href="#/session/' + next.id + '/dialogue">' +
            '<small>Up next \u2192 ' + shortName(next) + '</small>' +
            '<strong>' + ui.esc(next.focus) + '</strong>' +
          '</a>'
        : '<p><strong>That was the last lesson of the course.</strong></p>') +
      '<div class="btn-row" style="margin-top:16px">' +
        (next ? '<a class="btn btn-lg" href="#/session/' + next.id + '/dialogue">Start next lesson' + ui.icon('arrow-right') + '</a>' : '') +
        '<a class="btn btn-secondary" href="#/session/' + session.id + '/roleplay">' + ui.icon('arrow-left') + 'Back to roleplay</a>' +
        '<a class="btn btn-secondary" href="#/session/' + session.id + '/dialogue">Replay this lesson</a>' +
        '<a class="btn btn-quiet" href="#/course/' + session.week + '">Week ' + session.week + ' outline</a>' +
        '<button class="btn btn-quiet" type="button" data-undo="' + ui.esc(session.id) + '">Mark as not done</button>' +
      '</div>' +
      '</section>';
  }

  function go(hash) {
    if (location.hash === hash) rerender();
    else location.hash = hash;
  }

  function rerender() {
    var main = document.getElementById('main');
    if (core.session(run.id)) {
      main.innerHTML = render(['session', run.id, core.STEP_SLUGS[run.step], run.step === 1 ? String(run.index + 1) : '']);
      mount(main);
    }
  }

  /** Word changes update the address quietly so a refresh lands on the same word. */
  function setWord(i) {
    run.index = Math.max(0, Math.min(run.words.length - 1, i));
    core.setPosition(run.id, run.step, run.index);
    try {
      if (window.history && history.replaceState) history.replaceState(null, '', stepHref(1));
    } catch (e) { /* sandboxed */ }
    rerender();
  }

  function goBack(session) {
    if (run.step === 0) {
      var prev = core.adjacentSession(session.id, -1);
      go(prev ? '#/session/' + prev.id + '/roleplay' : '#/course/' + session.week);
      return;
    }
    go(stepHref(run.step - 1));
  }

  function goNext() {
    go('#/session/' + run.id + '/' + core.STEP_SLUGS[Math.min(3, run.step + 1)]);
  }

  var keysBound = false;
  function bindKeys() {
    if (keysBound || typeof document === 'undefined' || !document.addEventListener) return;
    keysBound = true;
    document.addEventListener('keydown', function (event) {
      if (!/^#\/session\//.test(location.hash || '')) return;
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      var tag = (event.target && event.target.tagName) || '';
      if (/INPUT|TEXTAREA|SELECT/.test(tag) || (event.target && event.target.isContentEditable)) return;
      var session = core.session(run.id);
      if (!session || run.step === 3) return;
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        if (run.step === 1 && run.index < run.words.length - 1) setWord(run.index + 1);
        else goNext();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        if (run.step === 1 && run.index > 0) setWord(run.index - 1);
        else goBack(session);
      }
    });
  }

  function mount(root, parts) {
    // The rendered container is replaced on every step change, so binding to it
    // (rather than to #main) keeps exactly one listener alive at a time.
    var sessionId = parts && parts[1];
    if (sessionId && run.id !== sessionId && core.session(sessionId)) reset(core.session(sessionId));
    var scope = root.querySelector('.view-narrow') || root;
    if (!core.session(run.id)) return;
    bindKeys();

    var jump = scope.querySelector && scope.querySelector('[data-jump]');
    if (jump && jump.addEventListener) {
      jump.addEventListener('change', function () {
        if (jump.value) location.hash = '#/session/' + jump.value + '/dialogue';
      });
    }

    var detailsEl = scope.querySelector && scope.querySelector('#lessonManualEditsPanel');
    if (detailsEl && detailsEl.addEventListener) {
      detailsEl.addEventListener('toggle', function () {
        run.editsOpen = Boolean(detailsEl.open);
      });
    }

    function refreshRunnerBodyOnly() {
      var session = core.session(run.id);
      var rb = scope.querySelector && scope.querySelector('.runner-body');
      if (!session || !rb) return;
      if (run.step === 0) rb.innerHTML = dialogueStep(session);
      else if (run.step === 1) rb.innerHTML = wordStep();
      else if (run.step === 2) rb.innerHTML = roleplayStep(session);
    }

    function refreshLessonEditsMount() {
      var session = core.session(run.id);
      var em = scope.querySelector && scope.querySelector('#lessonManualEditsMount');
      if (session && em) em.innerHTML = renderLessonEditsInner(session);
    }

    if (typeof document !== 'undefined' && document.addEventListener && !scope._boundEditSync) {
      scope._boundEditSync = true;
      document.addEventListener('salama:edit-saved', function () {
        if (!/^#\/session\//.test(location.hash || '')) return;
        refreshLessonEditsMount();
      });
    }

    scope.addEventListener('input', function (event) {
      var key = event.target && event.target.getAttribute ? event.target.getAttribute('data-lesson-live-key') : null;
      var field = event.target && event.target.getAttribute ? event.target.getAttribute('data-lesson-live-field') : null;
      if (!key || !field) return;
      var card = event.target.closest('[data-lesson-row-key]');
      var mgInput = card ? card.querySelector('[data-lesson-live-field="mg"]') : null;
      var pronInput = card ? card.querySelector('[data-lesson-live-field="pron"]') : null;
      core.saveEdit(key, {
        mg: mgInput ? mgInput.value : undefined,
        pron: pronInput ? pronInput.value : undefined
      });
      var item = core.entryForKey(key);
      var edited = Boolean(item && item.pron_edited);
      if (card) {
        var status = card.querySelector('[data-lesson-status-for]');
        if (status) {
          status.hidden = !edited;
          status.textContent = '\u2713 Saved';
        }
        var rst = card.querySelector('[data-lesson-live-reset]');
        if (rst) rst.hidden = !edited;
        var spk = card.querySelectorAll('[data-speak]');
        for (var i = 0; i < spk.length; i++) spk[i].setAttribute('data-speak', item ? (item.mg || '') : '');
        var slw = card.querySelectorAll('[data-slow]');
        for (var j = 0; j < slw.length; j++) slw[j].setAttribute('data-slow', item ? (item.mg || '') : '');
      }
      refreshRunnerBodyOnly();
    });

    scope.addEventListener('click', function (event) {
      var session = core.session(run.id);
      if (!session) return;

      var openEditsBtn = event.target.closest('[data-open-lesson-edits]');
      if (openEditsBtn) {
        var panel = scope.querySelector('#lessonManualEditsPanel');
        if (panel) {
          panel.open = true;
          run.editsOpen = true;
          run.editsFilter = 'step';
          refreshLessonEditsMount();
          if (panel.scrollIntoView) panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          var firstInput = panel.querySelector('.inline-edit-pron, .inline-edit-mg');
          if (firstInput && firstInput.focus) firstInput.focus();
        }
        return;
      }

      var filterBtn = event.target.closest('[data-lesson-edit-filter]');
      if (filterBtn) {
        run.editsFilter = filterBtn.getAttribute('data-lesson-edit-filter') || 'step';
        refreshLessonEditsMount();
        return;
      }

      var resetLessonItemBtn = event.target.closest('[data-lesson-live-reset]');
      if (resetLessonItemBtn) {
        var rKey = resetLessonItemBtn.getAttribute('data-lesson-live-reset');
        core.resetEdit(rKey);
        refreshLessonEditsMount();
        refreshRunnerBodyOnly();
        ui.toast('Restored original Malagasy & phonetics.');
        return;
      }

      if (event.target.closest('[data-export-lesson-edits]')) {
        var count = core.exportEditsTSV ? core.exportEditsTSV() : 0;
        if (!count) ui.toast('No manual edits to export yet \u2014 type in any box first.');
        else ui.toast('Exported ' + count + ' manual edit(s) to salama_corrections.tsv.');
        return;
      }

      if (ui.speakFrom(event)) return;
      var target = event.target.closest('[data-next],[data-back],[data-role],[data-reveal],[data-word-next],[data-word-prev],[data-word-go],[data-undo]');
      if (!target) return;

      if (target.hasAttribute('data-role')) {
        run.role = target.getAttribute('data-role');
        run.revealed = {};
        rerender();
        return;
      }
      if (target.hasAttribute('data-reveal')) {
        run.revealed[target.getAttribute('data-reveal')] = true;
        rerender();
        return;
      }
      if (target.hasAttribute('data-word-next')) { setWord(run.index + 1); return; }
      if (target.hasAttribute('data-word-prev')) { setWord(run.index - 1); return; }
      if (target.hasAttribute('data-word-go')) { setWord(Number(target.getAttribute('data-word-go')) || 0); return; }
      if (target.hasAttribute('data-undo')) {
        core.unmarkSession(target.getAttribute('data-undo'));
        go('#/session/' + session.id + '/dialogue');
        return;
      }
      if (target.hasAttribute('data-back')) { goBack(session); return; }
      if (target.hasAttribute('data-next')) { goNext(); }
    });

    // Auto-pronounce a new word when the learner arrives at the words step.
    if (run.step === 1 && core.state.prefs.autoplay && run.words.length) {
      speech.speakWord(run.words[run.index]);
    }
  }

  S.views = S.views || {};
  S.views.session = { render: render, mount: mount, nav: 'course' };
})(window.Salama);
