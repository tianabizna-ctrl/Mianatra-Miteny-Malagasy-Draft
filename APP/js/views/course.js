/* Course: Full 12-Week / 36-Session Syllabus & Curriculum Title Menu. */
(function (S) {
  'use strict';
  var core = S.core;
  var ui = S.ui;

  var MONTH_TITLES = {
    1: 'Month 1 \u2014 Foundations: Greetings, Introductions, Numbers & Sentences (Weeks 1\u20134 \u00b7 Lessons 1\u201312)',
    2: 'Month 2 \u2014 Daily Life: Food, Directions, Family & Time (Weeks 5\u20138 \u00b7 Lessons 13\u201324)',
    3: 'Month 3 \u2014 Fluency: Tenses, Health, Weather & Real-World Travel (Weeks 9\u201312 \u00b7 Lessons 25\u201336)'
  };

  var state = {
    month: 0, // 0 = all months, 1..3 = specific month
    q: ''
  };

  function lessonNumberFor(session) {
    return (session.week - 1) * 3 + session.number;
  }

  function syllabusSelectHtml(activeSessionId) {
    return '<select class="lc-select syllabus-jump-select" id="syllabusQuickJump" aria-label="Syllabus curriculum menu — jump to any lesson">' +
      '<option value="">\u2630 Syllabus Curriculum Menu \u2014 Jump to any of the 36 Lessons\u2026</option>' +
      core.data.curriculum.map(function (week) {
        var list = core.data.sessions.filter(function (s) { return s.week === week.week; });
        return '<optgroup label="Month ' + week.month + ' \u00b7 Week ' + week.week + ' \u2014 ' + ui.esc(week.title) + '">' +
          list.map(function (s) {
            var lno = lessonNumberFor(s);
            var done = core.isSessionDone(s.id);
            return '<option value="' + ui.esc(s.id) + '"' + (s.id === activeSessionId ? ' selected' : '') + '>' +
              (done ? '\u2713 ' : '') + 'Lesson ' + lno + ' (W' + s.week + ' \u00b7 ' + s.day.slice(0, 3) + ' S' + s.number + '): ' + ui.esc(s.focus) +
              '</option>';
          }).join('') +
        '</optgroup>';
      }).join('') +
    '</select>';
  }

  function curriculumTitleMenu(selectedWeek) {
    return '<nav class="syllabus-title-menu panel" aria-label="Syllabus Curriculum Title Menu">' +
      '<div class="syllabus-menu-top">' +
        '<div>' +
          '<p class="section-eyebrow" style="margin:0 0 4px">SYLLABUS &amp; CURRICULUM TITLE MENU</p>' +
          '<h2 style="margin:0;font-size:1.25rem">12 Weeks \u00b7 36 Sessions \u2014 Complete Course Outline</h2>' +
        '</div>' +
        '<div class="syllabus-menu-actions">' +
          '<button class="btn btn-quiet btn-sm" type="button" id="syllabusExpandAll">Expand all 12 weeks</button>' +
          '<button class="btn btn-quiet btn-sm" type="button" id="syllabusCollapseAll">Collapse all</button>' +
        '</div>' +
      '</div>' +
      '<div class="syllabus-jump-bar">' +
        syllabusSelectHtml(core.lastPosition() ? core.lastPosition().id : '') +
        '<div class="search-wrap syllabus-search-wrap">' + ui.icon('search') +
          '<input type="search" id="syllabusSearch" placeholder="Filter syllabus by topic, week, or Malagasy phrase\u2026" aria-label="Filter syllabus" value="' + ui.esc(state.q) + '">' +
        '</div>' +
      '</div>' +
      '<div class="chips syllabus-month-chips" role="group" aria-label="Filter by month">' +
        '<button type="button" class="chip' + (state.month === 0 ? ' active' : '') + '" data-syllabus-month="0">All 3 Months (36 Lessons)</button>' +
        '<button type="button" class="chip' + (state.month === 1 ? ' active' : '') + '" data-syllabus-month="1">Month 1: Foundations (W1\u2013W4)</button>' +
        '<button type="button" class="chip' + (state.month === 2 ? ' active' : '') + '" data-syllabus-month="2">Month 2: Daily Life (W5\u2013W8)</button>' +
        '<button type="button" class="chip' + (state.month === 3 ? ' active' : '') + '" data-syllabus-month="3">Month 3: Fluency (W9\u2013W12)</button>' +
      '</div>' +
      '<div class="syllabus-week-grid" role="navigation" aria-label="Jump to week curriculum">' +
        core.data.curriculum.map(function (week) {
          var done = core.weekDoneCount(week.week);
          var isSelected = week.week === selectedWeek;
          return '<a class="syllabus-week-pill' + (isSelected ? ' is-active' : '') + (done === 3 ? ' is-done' : '') + '" href="#/course/' + week.week + '" data-week-jump="' + week.week + '">' +
            '<span class="swp-num">W' + week.week + '</span>' +
            '<span class="swp-title">' + ui.esc(week.title) + '</span>' +
            '<span class="swp-lessons">L' + ((week.week - 1) * 3 + 1) + '\u2013' + (week.week * 3) + (done === 3 ? ' \u2713' : '') + '</span>' +
          '</a>';
        }).join('') +
      '</div>' +
    '</nav>';
  }

  function sessionSyllabusRow(session, pos) {
    var done = core.isSessionDone(session.id);
    var here = pos && pos.id === session.id;
    var lno = lessonNumberFor(session);
    var img = ui.photoForIndex ? ui.photoForIndex(lno - 1) : 'img/highlands.jpg';
    var dlg = session.dialogue ? core.dialogue(session.dialogue) : null;
    var rp = session.roleplay ? core.dialogue(session.roleplay) : null;
    var mainHref = here ? core.positionHash(pos) : '#/session/' + session.id + '/dialogue';

    return '<div class="syllabus-session-card' + (here ? ' is-here' : '') + (done ? ' is-done' : '') + '" id="syllabus-' + ui.esc(session.id) + '">' +
      '<a class="syllabus-session-main" href="' + mainHref + '">' +
        '<img class="session-row-thumb" src="' + img + '" alt="" loading="lazy">' +
        '<div class="syllabus-session-info">' +
          '<div class="syllabus-session-topline">' +
            '<span class="syllabus-lesson-badge">Lesson ' + lno + '</span>' +
            '<span class="day">Week ' + session.week + ' \u00b7 ' + ui.esc(session.day) + ' \u00b7 Session ' + session.number + '</span>' +
            (here ? '<span class="here-tag">\u25CF You are here \u00b7 ' + core.STEP_NAMES[pos.step] + '</span>' : '') +
            (done ? '<span class="done-tag">\u2713 Completed</span>' : '') +
          '</div>' +
          '<p class="focus syllabus-focus-title">' + ui.esc(session.focus) + '</p>' +
          '<div class="syllabus-subtitles">' +
            (dlg ? '<span><strong>Dialogue:</strong> ' + ui.esc(dlg.title) + '</span>' : '') +
            (rp ? '<span><strong>Roleplay:</strong> ' + ui.esc(rp.title) + '</span>' : '') +
          '</div>' +
        '</div>' +
      '</a>' +
      '<div class="syllabus-step-links" aria-label="Lesson ' + lno + ' steps">' +
        '<a class="syllabus-step-btn' + (here && pos.step === 0 ? ' active' : '') + '" href="#/session/' + session.id + '/dialogue">1. Dialogue</a>' +
        '<a class="syllabus-step-btn' + (here && pos.step === 1 ? ' active' : '') + '" href="#/session/' + session.id + '/words">2. New Words</a>' +
        '<a class="syllabus-step-btn' + (here && pos.step === 2 ? ' active' : '') + '" href="#/session/' + session.id + '/roleplay">3. Roleplay</a>' +
      '</div>' +
    '</div>';
  }

  function matchesFilter(week, sessions, q) {
    if (state.month && week.month !== state.month) return false;
    if (!q) return true;
    if (ui.norm(week.title).indexOf(q) !== -1) return true;
    if (('week ' + week.week).indexOf(q) !== -1) return true;
    return sessions.some(function (s) {
      var dlg = s.dialogue ? core.dialogue(s.dialogue) : null;
      var rp = s.roleplay ? core.dialogue(s.roleplay) : null;
      return ui.norm(s.focus).indexOf(q) !== -1 ||
        ui.norm(s.day).indexOf(q) !== -1 ||
        ('lesson ' + lessonNumberFor(s)).indexOf(q) !== -1 ||
        (dlg && ui.norm(dlg.title).indexOf(q) !== -1) ||
        (rp && ui.norm(rp.title).indexOf(q) !== -1);
    });
  }

  function fullSyllabusList(selectedWeek, pos) {
    var q = ui.norm(state.q);
    var months = [1, 2, 3];
    var html = '';

    months.forEach(function (m) {
      var weeks = core.data.curriculum.filter(function (w) {
        var sessions = core.data.sessions.filter(function (s) { return s.week === w.week; });
        return w.month === m && matchesFilter(w, sessions, q);
      });
      if (!weeks.length) return;

      html += '<section class="syllabus-month-block" aria-label="Month ' + m + '">' +
        '<h2 class="syllabus-month-heading">' + ui.esc(MONTH_TITLES[m]) + '</h2>' +
        weeks.map(function (week) {
          var sessions = core.data.sessions.filter(function (s) { return s.week === week.week; });
          var done = core.weekDoneCount(week.week);
          var stateLabel = done === sessions.length ? '\u2713 Complete (3/3)'
            : (done ? done + ' of ' + sessions.length + ' complete' : '3 sessions');
          var img = ui.photoForIndex ? ui.photoForIndex(week.week - 1) : 'img/highlands.jpg';
          var isFocusedWeek = selectedWeek === week.week || (pos && pos.id && core.session(pos.id) && core.session(pos.id).week === week.week);

          return '<details class="syllabus-week-accordion' + (isFocusedWeek ? ' is-current-week' : '') + '" id="weekBlock' + week.week + '" open>' +
            '<summary class="syllabus-week-summary">' +
              '<span class="week-thumb"><img src="' + img + '" alt="" loading="lazy"><span class="week-badge">' + week.week + '</span></span>' +
              '<span class="week-body">' +
                '<span class="week-no">Week ' + week.week + ' \u2022 Month ' + week.month + ' \u2022 Lessons ' + ((week.week - 1) * 3 + 1) + '\u2013' + (week.week * 3) + '</span>' +
                '<span class="week-title">' + ui.esc(week.title) + '</span>' +
              '</span>' +
              '<span class="week-state">' + stateLabel + '</span>' +
            '</summary>' +
            '<div class="syllabus-week-sessions">' +
              sessions.map(function (s) { return sessionSyllabusRow(s, pos); }).join('') +
            '</div>' +
          '</details>';
        }).join('') +
      '</section>';
    });

    return html || '<p class="empty">No syllabus sessions match that search. Try clearing the search box.</p>';
  }

  function render(parts) {
    var pos = core.lastPosition();
    var posSession = pos ? core.session(pos.id) : null;
    var weekNo = Number(parts[1]) || (posSession ? posSession.week : 0);
    var doneTotal = core.sessionDoneCount();
    var totalSessions = core.data.sessions.length;

    var resume = posSession
      ? '<a class="resume-card" href="' + core.positionHash(pos) + '">' +
          '<span class="resume-dot">\u25B6</span>' +
          '<span class="resume-text"><small>You are here \u2014 continue where you left off (Lesson ' + lessonNumberFor(posSession) + ' of ' + totalSessions + ')</small>' +
          '<strong>Week ' + posSession.week + ' (' + ui.esc(posSession.week_title || '') + ') \u00b7 ' + ui.esc(posSession.day) + ' \u00b7 Session ' + posSession.number + ' \u00b7 ' + core.STEP_NAMES[pos.step] + '</strong>' +
          '<span>' + ui.esc(posSession.focus) + '</span></span>' +
          '<span class="resume-go">Continue \u2192</span>' +
        '</a>'
      : '';

    return '<div class="view-narrow">' +
      '<div class="syllabus-page-head">' +
        '<div>' +
          '<p class="section-eyebrow" style="margin:0 0 4px">SALAMA! COURSE SYLLABUS &amp; CURRICULUM</p>' +
          '<h1 style="margin:0">Course Syllabus &amp; Curriculum</h1>' +
        '</div>' +
        '<span class="entry-badge">' + doneTotal + ' of ' + totalSessions + ' lessons completed</span>' +
      '</div>' +
      '<p class="lead">Twelve weeks, three sessions a week (36 lessons total), organized by curriculum topic from first greetings to full Malagasy conversation.</p>' +
      resume +
      curriculumTitleMenu(weekNo) +
      '<div id="syllabusBody">' +
        fullSyllabusList(weekNo, pos) +
      '</div>' +
    '</div>';
  }

  function repaintBody(root, selectedWeek) {
    var body = root.querySelector('#syllabusBody');
    if (body) {
      body.innerHTML = fullSyllabusList(selectedWeek, core.lastPosition());
    }
    Array.prototype.forEach.call(root.querySelectorAll('[data-syllabus-month]'), function (btn) {
      var m = Number(btn.getAttribute('data-syllabus-month')) || 0;
      btn.classList.toggle('active', m === state.month);
    });
  }

  function mount(root, parts) {
    if (!root) return;
    var selectedWeek = Number(parts && parts[1]) || 0;

    var jumpSelect = root.querySelector('#syllabusQuickJump');
    if (jumpSelect) {
      jumpSelect.addEventListener('change', function () {
        if (jumpSelect.value) {
          location.hash = '#/session/' + jumpSelect.value + '/dialogue';
        }
      });
    }

    var searchInput = root.querySelector('#syllabusSearch');
    if (searchInput) {
      searchInput.addEventListener('input', function () {
        state.q = searchInput.value || '';
        repaintBody(root, selectedWeek);
      });
    }

    Array.prototype.forEach.call(root.querySelectorAll('[data-syllabus-month]'), function (btn) {
      btn.addEventListener('click', function () {
        state.month = Number(btn.getAttribute('data-syllabus-month')) || 0;
        repaintBody(root, selectedWeek);
      });
    });

    var expandBtn = root.querySelector('#syllabusExpandAll');
    if (expandBtn) {
      expandBtn.addEventListener('click', function () {
        Array.prototype.forEach.call(root.querySelectorAll('.syllabus-week-accordion'), function (d) {
          d.open = true;
        });
      });
    }

    var collapseBtn = root.querySelector('#syllabusCollapseAll');
    if (collapseBtn) {
      collapseBtn.addEventListener('click', function () {
        Array.prototype.forEach.call(root.querySelectorAll('.syllabus-week-accordion'), function (d) {
          d.open = false;
        });
      });
    }

    Array.prototype.forEach.call(root.querySelectorAll('[data-week-jump]'), function (link) {
      link.addEventListener('click', function (e) {
        var wk = Number(link.getAttribute('data-week-jump'));
        if (state.month !== 0) {
          state.month = 0;
          repaintBody(root, wk);
        }
        var target = root.querySelector('#weekBlock' + wk);
        if (target) {
          e.preventDefault();
          target.open = true;
          if (target.scrollIntoView) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });

    if (selectedWeek) {
      var wkBlock = root.querySelector('#weekBlock' + selectedWeek);
      if (wkBlock) {
        wkBlock.open = true;
        if (wkBlock.scrollIntoView) wkBlock.scrollIntoView({ block: 'start' });
      }
    }
  }

  S.views = S.views || {};
  S.views.course = { render: render, mount: mount, nav: 'course' };
})(window.Salama);
