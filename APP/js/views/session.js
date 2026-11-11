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
    words: []
  };

  function reset(session) {
    run.id = session.id;
    run.step = 0;
    run.index = 0;
    run.role = null;
    run.revealed = {};
    run.words = wordsFor(session);
  }

  function wordsFor(session) {
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
    return out.slice(0, 6);
  }

  function speakButton(text, wordId) {
    return ui.speakButtons(text, { wordId: wordId, label: 'Listen' });
  }

  function stepList(active) {
    return '<ol class="runner-steps">' + STEPS.map(function (name, i) {
      var attrs = '';
      if (i === active) attrs = ' data-active="true"';
      else if (i < active) attrs = ' data-done="true"';
      return '<li' + attrs + '>' + name + '</li>';
    }).join('') + '</ol>';
  }

  /* ---------------- step 1: dialogue ---------------- */
  function dialogueStep(session) {
    var dialogue = session.dialogue ? core.dialogue(session.dialogue) : null;
    var pcUrl = session.peace_corps_url || 'https://www.livelingua.com/course/peace-corps/malagasy_language_lessons';
    var audio = '<div class="audio-player">' +
      '<span class="label">Peace Corps Madagascar Audio</span>' +
      '<a class="cta-link" href="' + ui.esc(pcUrl) + '" target="_blank" rel="noopener noreferrer">' +
        'Listen to the Peace Corps Madagascar audio lessons online' +
        ui.icon('arrow-right', 'icon-sm') +
      '</a>' +
      '</div>';

    if (!dialogue) {
      return audio + '<p class="empty">No dialogue is mapped to this session yet.</p>';
    }

    return audio +
      '<h2 style="margin-top:0">' + ui.esc(dialogue.title) + '</h2>' +
      '<div class="dialogue">' + dialogue.lines.map(function (line, index) {
        return '<div class="turn">' +
          '<span class="who">' + ui.esc(line.speaker || 'A') +
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
      '</div>';
  }

  /* ---------------- step 3: roleplay ---------------- */
  function roleplayStep(session) {
    var dialogue = session.dialogue ? core.dialogue(session.dialogue) : null;
    if (!dialogue) return '<p class="empty">No dialogue is mapped to this session yet.</p>';

    var speakers = [];
    dialogue.lines.forEach(function (line) {
      if (line.speaker && speakers.indexOf(line.speaker) === -1) speakers.push(line.speaker);
    });

    var chooser = '<div class="chips" role="group" aria-label="Choose your part">' +
      speakers.map(function (name) {
        return '<button class="chip" type="button" data-role="' + ui.esc(name) + '" ' +
          'aria-pressed="' + (run.role === name ? 'true' : 'false') + '">' + ui.esc(name) + '</button>';
      }).join('') + '</div>';

    var lines = dialogue.lines.slice(0, 8).map(function (line, i) {
      var mine = run.role && line.speaker === run.role;
      if (mine && !run.revealed[i]) {
        return '<div class="turn">' +
          '<span class="who">' + ui.esc(line.speaker) + ' · your part</span>' +
          '<button class="icon-btn" type="button" data-reveal="' + i + '">Show reply</button>' +
          '</div>';
      }
      return '<div class="turn">' +
        '<span class="who">' + ui.esc(line.speaker) +
          (line.stage ? ' <span class="stage">(' + ui.esc(line.stage) + ')</span>' : '') + '</span>' +
        '<p class="line" lang="mg">' + ui.esc(line.mg) + '</p>' +
        '<p class="trans">' + ui.esc(line.en) + '</p>' +
        '<div class="turn-tools">' + ui.speakButtons(line.mg, { line: dialogue.id + ':' + i }) + '</div>' +
        '</div>';
    }).join('');

    return (run.role ? '' : '<p class="meta">Choose the part you want to say.</p>') +
      chooser +
      '<div class="dialogue">' + lines + '</div>';
  }

  /* ---------------- orientation (v4.4.1) ---------------- */
  /* Every visit records "you are here" so Today, the course outline and the
     cloud copy all agree on where the class stands. */
  function crumbs(session) {
    var idx = core.sessionIndexOf ? core.sessionIndexOf(session.id) : -1;
    var week = core.data.curriculum.filter(function (w) { return w.week === session.week; })[0];
    return '<nav class="crumbs" aria-label="Where you are in the course">' +
      '<a href="#/today">⌂ Today</a> › ' +
      '<a href="#/course">Course</a> › ' +
      '<a href="#/course/' + session.week + '">Week ' + session.week + (week ? ': ' + ui.esc(week.title) : '') + '</a> › ' +
      '<strong>' + ui.esc(session.day || '') + ' · Session ' + session.number + ' of ' + (session.total_sessions || 3) + '</strong>' +
      (idx >= 0 ? ' <span class="crumbs-overall">#' + (idx + 1) + ' of ' + core.data.sessions.length + '</span>' : '') +
      (core.isSessionDone(session.id) ? ' <span class="crumbs-done">✓ complete</span>' : '') +
    '</nav>';
  }

  function pagerCard(session, dir) {
    var other = dir === 'prev'
      ? (core.prevSession ? core.prevSession(session.id) : null)
      : (core.nextSessionAfter ? core.nextSessionAfter(session.id) : null);
    if (dir === 'prev') {
      return other
        ? '<a class="pager-card" href="#/session/' + other.id + '" title="Go back one lesson">' +
            '<span class="pager-dir">← Previous lesson</span>' +
            '<span class="pager-title">W' + other.week + 'S' + other.number + ' · ' + ui.esc(other.focus) + '</span></a>'
        : '<span class="pager-card pager-empty"><span class="pager-dir">← Previous lesson</span>' +
            '<span class="pager-title">This is the very first lesson of the course</span></span>';
    }
    return other
      ? '<a class="pager-card pager-next" href="#/session/' + other.id + '" title="Go to the next lesson">' +
          '<span class="pager-dir">Next lesson →</span>' +
          '<span class="pager-title">W' + other.week + 'S' + other.number + ' · ' + ui.esc(other.focus) + '</span></a>'
      : '<span class="pager-card pager-empty pager-next"><span class="pager-dir">Next lesson →</span>' +
          '<span class="pager-title">End of the 12-week course — well done! 🎉</span></span>';
  }

  function sessionPager(session) {
    return '<div class="session-pager">' + pagerCard(session, 'prev') + pagerCard(session, 'next') + '</div>' +
      '<p class="pager-tip">Tip: press <kbd>←</kbd> / <kbd>→</kbd> to jump between lessons, like slides.</p>';
  }

  var keysBound = false;
  function bindSessionKeys() {
    if (keysBound || typeof document === 'undefined' || !document.addEventListener) return;
    keysBound = true;
    document.addEventListener('keydown', function (event) {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      var t = event.target;
      var tag = ((t && t.tagName) || '').toUpperCase();
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) return;
      var match = /^#\/session\/([\w-]+)/.exec((typeof location !== 'undefined' && location.hash) || '');
      if (!match) return;
      var cur = core.session(match[1]);
      if (!cur) return;
      var jump = event.key === 'ArrowLeft'
        ? (core.prevSession ? core.prevSession(cur.id) : null)
        : (core.nextSessionAfter ? core.nextSessionAfter(cur.id) : null);
      if (jump) { location.hash = '#/session/' + jump.id; event.preventDefault(); }
    });
  }

  /* ---------------- completion ---------------- */
  function render(parts) {
    var session = core.session(parts && parts[1]);
    if (!session) return '<p class="empty">That session does not exist.</p>';
    if (core.noteVisit) core.noteVisit(session.id);
    if (run.id !== session.id) reset(session);

    if (run.step === 3) {
      return '<div class="view-narrow">' + completionPanel(session) + '</div>';
    }

    var body;
    if (run.step === 0) body = dialogueStep(session);
    else if (run.step === 1) body = wordStep();
    else body = roleplayStep(session);

    var img = ui.photoForIndex ? ui.photoForIndex((session.week - 1) * 3 + session.number - 1) : 'img/highlands.jpg';

    var posIdx = core.sessionIndexOf ? core.sessionIndexOf(session.id) : -1;
    return '<div class="view-narrow">' +
      crumbs(session) +
      '<div class="session-hero-photo"><img src="' + img + '" alt="Madagascar landscape" loading="lazy"></div>' +
      '<div class="runner-head">' +
        '<div>' +
          '<p class="meta">Week ' + session.week + ' · ' + ui.esc(session.day) + ' · Session ' + session.number +
            ' of ' + (session.total_sessions || 3) +
            (posIdx >= 0 ? ' <span class="crumbs-overall">#' + (posIdx + 1) + ' of ' + core.data.sessions.length + '</span>' : '') + '</p>' +
          '<h1>' + ui.esc(session.focus) + '</h1>' +
        '</div>' +
        '<a class="cta-link" href="#/course/' + session.week + '">▣ All lessons of Week ' + session.week + '</a>' +
      '</div>' +
      '<div class="session-nav-top">' + sessionPager(session) + '</div>' +
      stepList(run.step) +
      '<div class="runner-body">' + body + '</div>' +
      sessionPager(session) +
      '<div class="runner-foot">' +
        '<button class="btn btn-quiet" type="button" data-back="true">' +
          ui.icon('arrow-left') + 'Back</button>' +
        '<span class="position">Step ' + (run.step + 1) + ' of 3</span>' +
        '<button class="btn" type="button" data-next="true">' + nextLabel() + ui.icon('arrow-right') + '</button>' +
      '</div>' +
      '</div>';
  }

  function nextLabel() {
    if (run.step === 0) return 'New words';
    if (run.step === 1) return 'Roleplay';
    return 'Finish session';
  }

  function completionPanel(session) {
    var doneCount = core.sessionDoneCount();
    var total = core.data.sessions.length;
    /* "Next" now means the *next lesson in the curriculum*, not "the first
       undone thing anywhere" — that older rule could bounce a teacher back
       to Week 1 after one missed tick. */
    var next = (core.nextSessionAfter ? core.nextSessionAfter(session.id) : null) ||
      core.data.sessions.filter(function (s) { return !core.isSessionDone(s.id); })[0] || null;
    if (next && next.id === session.id) next = null;
    var prev = core.prevSession ? core.prevSession(session.id) : null;
    var pct = total ? Math.round((doneCount / total) * 100) : 0;
    return '<div class="done-wrap">' + crumbs(session) +
      '<section class="panel" aria-labelledby="doneTitle">' +
      '<h1 id="doneTitle" style="margin-top:0">✓ Session complete</h1>' +
      '<p class="meta">Week ' + session.week + ' · ' + ui.esc(session.day) + ' · Session ' + session.number +
        ' of ' + (session.total_sessions || 3) + ' — ' + ui.esc(session.focus) + '</p>' +
      '<div class="progress-meter" style="margin:10px 0 4px"><i style="width:' + pct + '%"></i></div>' +
      '<p class="meta">' + doneCount + ' of ' + total + ' lessons done · ' + pct + '% of the course</p>' +
      (next
        ? '<div class="panel next-lesson-card">' +
            '<p class="section-eyebrow" style="margin:0 0 4px;color:#C8500D">UP NEXT — WEEK ' + next.week + '</p>' +
            '<h3 style="margin:0 0 6px">' + ui.esc(next.focus) + '</h3>' +
            '<p class="meta" style="margin:0">' + ui.esc(next.day || '') + ' · Week ' + next.week + ' · Session ' + next.number + ' of ' + (next.total_sessions || 3) + '</p>' +
            '<div class="btn-row" style="margin-top:12px"><a class="btn btn-lg" href="#/session/' + next.id + '">Go to the next lesson' + ui.icon('arrow-right') + '</a></div>' +
          '</div>'
        : '<p class="meta">That was the final lesson of the 12 weeks — well done! 🎉</p>') +
      '<div class="btn-row" style="margin-top:16px">' +
        (prev ? '<a class="btn btn-quiet" href="#/session/' + prev.id + '">← Replay previous lesson</a>' : '') +
        '<a class="btn btn-secondary" href="#/course/' + session.week + '">Week ' + session.week + ' outline</a>' +
        '<a class="btn btn-secondary" href="#/today">Back to Today</a>' +
        '<button class="btn btn-quiet" type="button" data-undo="' + ui.esc(session.id) + '">Mark as not done</button>' +
      '</div>' +
      '</section></div>';
  }

  function rerender() {
    var main = document.getElementById('main');
    if (core.session(run.id)) {
      main.innerHTML = render(['session', run.id]);
      mount(main);
    }
  }

  function mount(root, parts) {
    // The rendered container is replaced on every step change, so binding to it
    // (rather than to #main) keeps exactly one listener alive at a time.
    bindSessionKeys();
    var sessionId = parts && parts[1];
    if (sessionId && run.id !== sessionId && core.session(sessionId)) reset(core.session(sessionId));
    var scope = root.querySelector('.view-narrow') || root;
    if (!core.session(run.id)) return;

    scope.addEventListener('click', function (event) {
      var session = core.session(run.id);
      if (ui.speakFrom(event)) return;
      var target = event.target.closest('[data-next],[data-back],[data-role],[data-reveal],[data-word-next],[data-word-prev],[data-undo]');
      if (!target || !session) return;

      if (ui.speakFrom(event)) return;
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
      if (target.hasAttribute('data-word-next')) { run.index = Math.min(run.index + 1, run.words.length - 1); rerender(); return; }
      if (target.hasAttribute('data-word-prev')) { run.index = Math.max(run.index - 1, 0); rerender(); return; }
      if (target.hasAttribute('data-undo')) {
        core.unmarkSession(target.getAttribute('data-undo'));
        run.step = 0;
        rerender();
        return;
      }
      if (target.hasAttribute('data-back')) {
        if (run.step === 0) { location.hash = '#/course/' + session.week; return; }
        run.step -= 1;
        rerender();
        return;
      }
      if (target.hasAttribute('data-next')) {
        if (run.step === 2) {
          core.markSession(session.id);
          run.step = 3;
          rerender();
          window.scrollTo(0, 0);
          return;
        }
        run.step += 1;
        rerender();
        window.scrollTo(0, 0);
      }
    });

    // Auto-pronounce a new word when the learner arrives at the words step.
    if (run.step === 1 && core.state.prefs.autoplay && run.words.length) {
      speech.speakWord(run.words[run.index]);
    }
  }

  S.views = S.views || {};
  S.views.session = { render: render, mount: mount, nav: 'course' };
})(window.Salama);
