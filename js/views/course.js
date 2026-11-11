/* Course: the 12-week outline, and one week's three sessions.
   v4.4.1 — orientation first: a "you are here" panel, per-week progress, a
   prev/next week pager inside a week, and an overall #n of 36 position on
   every lesson row, so nobody has to wonder where the class left off. */
(function (S) {
  'use strict';
  var core = S.core;
  var ui = S.ui;

  function hereSession() {
    return core.state.lastSession ? core.session(core.state.lastSession) : null;
  }

  function positionTag(session) {
    var idx = core.sessionIndexOf ? core.sessionIndexOf(session.id) : -1;
    return idx >= 0 ? '#\u200a' + (idx + 1) + ' of ' + core.data.sessions.length : '';
  }

  function resumePanel() {
    var resume = core.resumeSession ? core.resumeSession() : core.nextSession();
    var here = hereSession();
    var done = core.sessionDoneCount();
    var total = core.data.sessions.length;
    var pct = total ? Math.round((done / total) * 100) : 0;
    var prev = here && core.prevSession ? core.prevSession(here.id) : null;
    var next = here && core.nextSessionAfter ? core.nextSessionAfter(here.id) : null;

    return '<section class="panel resume-panel">' +
      '<div class="resume-head">' +
        '<p class="section-eyebrow" style="margin:0 0 4px;color:#C8500D">\uD83D\uDCCD ' +
          (here ? 'YOU ARE HERE' : 'START OF THE COURSE') + '</p>' +
        '<h2 style="margin:0">Week ' + resume.week + ' \u00b7 ' + ui.esc(resume.day || '') +
          ' \u00b7 Session ' + resume.number + ' of ' + (resume.total_sessions || 3) +
          ' <span class="where-overall">' + positionTag(resume) + '</span></h2>' +
        '<p class="resume-focus" lang="mg">' + ui.esc(resume.focus) + '</p>' +
      '</div>' +
      '<div class="resume-actions">' +
        '<a class="btn btn-lg" href="#/session/' + resume.id + '">' +
          (core.isSessionDone(resume.id) ? 'Replay this lesson' : 'Continue here') + ui.icon('arrow-right') + '</a>' +
        (prev ? '<a class="btn btn-quiet btn-sm" href="#/session/' + prev.id + '" title="' + ui.esc(prev.focus) + '">\u2190 Previous: W' + prev.week + 'S' + prev.number + '</a>' : '') +
        (next ? '<a class="btn btn-quiet btn-sm" href="#/session/' + next.id + '" title="' + ui.esc(next.focus) + '">Next: W' + next.week + 'S' + next.number + ' \u2192</a>' : '') +
      '</div>' +
      '<div class="resume-meter">' +
        '<div class="progress-meter"><i style="width:' + pct + '%"></i></div>' +
        '<span class="meta">' + done + ' of ' + total + ' lessons \u00b7 ' + pct + '%</span>' +
      '</div>' +
    '</section>';
  }

  function weekList(selectedWeek) {
    var here = hereSession();
    return '<div class="week-list">' + core.data.curriculum.map(function (week) {
      var done = core.weekDoneCount(week.week);
      var isHere = here && here.week === week.week;
      var state = done === week.sessions.length ? '\u2713 Complete'
        : (done ? done + ' of ' + week.sessions.length : 'Not started');
      var img = ui.photoForIndex ? ui.photoForIndex(week.week - 1) : 'img/highlands.jpg';
      return '<a class="week-row week-row-photo' + (isHere ? ' week-row-here' : '') + '" href="#/course/' + week.week + '"' +
        (week.week === selectedWeek ? ' aria-current="true"' : '') + '>' +
        '<span class="week-thumb"><img src="' + img + '" alt="" loading="lazy"><span class="week-badge">' + week.week + '</span></span>' +
        '<span class="week-body">' +
          '<span class="week-no">Week ' + week.week + ' \u2022 Month ' + week.month +
            (isHere ? ' \u00b7 <span class="you-here-badge">\uD83D\uDCCD You are here</span>' : '') + '</span>' +
          '<span class="week-title">' + ui.esc(week.title) + '</span>' +
        '</span>' +
        '<span class="week-state">' + state + '</span>' +
        ui.icon('chevron-right', 'icon-sm') +
        '</a>';
    }).join('') + '</div>';
  }

  function weekPager(week) {
    var prev = week.week > 1 ? core.data.curriculum[week.week - 2] : null;
    var next = week.week < core.data.curriculum.length ? core.data.curriculum[week.week] : null;
    return '<div class="week-pager">' +
      (prev
        ? '<a class="btn btn-quiet btn-sm" href="#/course/' + prev.week + '">\u2190 Week ' + prev.week + ': ' + ui.esc(prev.title) + '</a>'
        : '<span class="btn btn-quiet btn-sm" aria-disabled="true">\u2190 First week</span>') +
      '<a class="cta-link" href="#/today">\u2302 Today</a>' +
      (next
        ? '<a class="btn btn-quiet btn-sm" href="#/course/' + next.week + '">Week ' + next.week + ': ' + ui.esc(next.title) + ' \u2192</a>'
        : '<span class="btn btn-quiet btn-sm" aria-disabled="true">Last week</span>') +
      '</div>';
  }

  function weekDetail(week) {
    var here = hereSession();
    var sessions = core.data.sessions.filter(function (s) { return s.week === week.week; });
    var doneN = core.weekDoneCount(week.week);
    return '<section class="panel" aria-labelledby="weekTitle">' +
      '<div class="session-meta"><span class="week">Month ' + week.month + '</span> ' +
      '<span>' + doneN + ' of ' + sessions.length + ' sessions complete</span>' +
      (here && here.week === week.week ? ' <span class="you-here-badge inline">\uD83D\uDCCD current week</span>' : '') + '</div>' +
      '<h2 id="weekTitle" style="margin-top:0">Week ' + week.week + ' \u2014 ' + ui.esc(week.title) + '</h2>' +
      weekPager(week) +
      sessions.map(function (session) {
        var done = core.isSessionDone(session.id);
        var isHere = here && here.id === session.id;
        var img = ui.photoForIndex ? ui.photoForIndex((session.week - 1) * 3 + session.number - 1) : 'img/highlands.jpg';
        return '<a class="session-row session-row-photo' + (isHere ? ' session-row-here' : '') + '" href="#/session/' + session.id + '">' +
          '<span class="session-row-left">' +
            '<img class="session-row-thumb" src="' + img + '" alt="" loading="lazy">' +
            '<span><span class="day">' + ui.esc(session.day) + ' \u00b7 Session ' + session.number +
              ' <span class="session-overall">' + positionTag(session) + '</span>' +
              (isHere ? ' <span class="you-here-badge">\uD83D\uDCCD You are here</span>' : '') +
            '</span>' +
            '<p class="focus">' + ui.esc(session.focus) + '</p></span>' +
          '</span>' +
          '<span class="state">' + (done ? ui.icon('check', 'icon-sm') + ' Done' : (isHere ? 'Resume' : 'Start')) +
          ui.icon('chevron-right', 'icon-sm') + '</span></a>';
      }).join('') +
      weekPager(week) +
      '</section>';
  }

  function render(parts) {
    var weekNo = Number(parts[1]);
    var week = core.data.curriculum.filter(function (w) { return w.week === weekNo; })[0] || null;

    return '<div class="view-narrow">' +
      '<h1>Course</h1>' +
      '<p class="lead">Twelve weeks, three sessions a week, from first greetings to a full conversation. ' +
      'The app always knows which lesson you last opened \u2014 pick up right there.</p>' +
      resumePanel() +
      (week ? weekDetail(week) : '') +
      '<h2>' + (week ? 'All weeks' : 'Weeks') + '</h2>' +
      weekList(week ? week.week : 0) +
      '</div>';
  }

  function mount(root) {
    // Selecting a week scrolls the outline into view so the detail is visible.
    if (root && root.querySelector('[aria-current="true"]')) {
      var el = root.querySelector('#weekTitle');
      if (el && window.innerWidth < 760) el.scrollIntoView({ block: 'start' });
    }
  }

  S.views = S.views || {};
  S.views.course = { render: render, mount: mount, nav: 'course' };
})(window.Salama);
