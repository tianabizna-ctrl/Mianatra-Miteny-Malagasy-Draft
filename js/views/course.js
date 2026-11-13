/* Course: the 12-week outline, and one week's three sessions. */
(function (S) {
  'use strict';
  var core = S.core;
  var ui = S.ui;

  function weekList(selectedWeek) {
    return '<div class="week-list">' + core.data.curriculum.map(function (week) {
      var done = core.weekDoneCount(week.week);
      var state = done === week.sessions.length ? 'Complete'
        : (done ? done + ' of ' + week.sessions.length : '3 sessions');
      var img = ui.photoForIndex ? ui.photoForIndex(week.week - 1) : 'img/highlands.jpg';
      return '<a class="week-row week-row-photo" href="#/course/' + week.week + '"' +
        (week.week === selectedWeek ? ' aria-current="true"' : '') + '>' +
        '<span class="week-thumb"><img src="' + img + '" alt="" loading="lazy"><span class="week-badge">' + week.week + '</span></span>' +
        '<span class="week-body">' +
          '<span class="week-no">Week ' + week.week + ' \u2022 Month ' + week.month + '</span>' +
          '<span class="week-title">' + ui.esc(week.title) + '</span>' +
        '</span>' +
        '<span class="week-state">' + state + '</span>' +
        ui.icon('chevron-right', 'icon-sm') +
        '</a>';
    }).join('') + '</div>';
  }

  function weekDetail(week) {
    var sessions = core.data.sessions.filter(function (s) { return s.week === week.week; });
    return '<section class="panel" aria-labelledby="weekTitle">' +
      '<div class="session-meta"><span class="week">Month ' + week.month + '</span> ' +
      '<span>' + core.weekDoneCount(week.week) + ' of ' + sessions.length + ' sessions complete</span></div>' +
      '<h2 id="weekTitle" style="margin-top:0">Week ' + week.week + ' — ' + ui.esc(week.title) + '</h2>' +
      '<div class="week-pager">' +
        (week.week > 1 ? '<a class="btn btn-quiet btn-sm" href="#/course/' + (week.week - 1) + '">\u2190 Week ' + (week.week - 1) + '</a>' : '<span></span>') +
        '<span class="meta">Week ' + week.week + ' of ' + core.data.curriculum.length + '</span>' +
        (week.week < core.data.curriculum.length ? '<a class="btn btn-quiet btn-sm" href="#/course/' + (week.week + 1) + '">Week ' + (week.week + 1) + ' \u2192</a>' : '<span></span>') +
      '</div>' +
      sessions.map(function (session) {
        var done = core.isSessionDone(session.id);
        var pos = core.lastPosition();
        var here = pos && pos.id === session.id;
        var img = ui.photoForIndex ? ui.photoForIndex((session.week - 1) * 3 + session.number - 1) : 'img/highlands.jpg';
        return '<div class="session-row-wrap">' +
          '<a class="session-row session-row-photo' + (here ? ' is-here' : '') + '" href="' + (here ? core.positionHash(pos) : '#/session/' + session.id + '/dialogue') + '">' +
            '<span class="session-row-left">' +
              '<img class="session-row-thumb" src="' + img + '" alt="" loading="lazy">' +
              '<span><span class="day">' + ui.esc(session.day) + ' · Session ' + session.number +
                (here ? ' <span class="here-tag">\u25CF You are here \u00b7 ' + core.STEP_NAMES[pos.step] + '</span>' : '') + '</span>' +
              '<p class="focus">' + ui.esc(session.focus) + '</p></span>' +
            '</span>' +
            '<span class="state">' + (here ? 'Continue' : (done ? ui.icon('check', 'icon-sm') + ' Done' : 'Start')) +
            ui.icon('chevron-right', 'icon-sm') + '</span></a>' +
          '<a class="course-session-edit-link" href="#/edit/session/' + ui.esc(session.id) + '" title="Manual edits (Malagasy &amp; phonetics) for Week ' + session.week + ' \u00b7 Session ' + session.number + '">\u270E Manual edits (W' + session.week + '\u00b7S' + session.number + ')</a>' +
        '</div>';
      }).join('') +
      '</section>';
  }

  function render(parts) {
    var pos = core.lastPosition();
    var posSession = pos ? core.session(pos.id) : null;
    var weekNo = Number(parts[1]) || (posSession ? posSession.week : 0);
    var week = core.data.curriculum.filter(function (w) { return w.week === weekNo; })[0] || null;
    var prev = posSession ? core.adjacentSession(posSession.id, -1) : null;
    var next = posSession ? core.adjacentSession(posSession.id, 1) : null;
    var resume = posSession
      ? '<div class="resume-wrap" style="margin-bottom:18px">' +
          (prev ? '<a class="resume-side" href="#/session/' + prev.id + '/dialogue"><small>Previous lesson</small>\u2190 Week ' + prev.week + ' \u00b7 ' + ui.esc(prev.day.slice(0, 3)) + ' S' + prev.number + '</a>' : '') +
          '<a class="resume-card" href="' + core.positionHash(pos) + '">' +
            '<span class="resume-dot">\u25B6</span>' +
            '<span class="resume-text"><small>You are here \u2014 continue where you left off</small>' +
            '<strong>Week ' + posSession.week + ' \u00b7 ' + ui.esc(posSession.day) + ' \u00b7 Session ' + posSession.number + ' \u00b7 ' + core.STEP_NAMES[pos.step] + '</strong>' +
            '<span>' + ui.esc(posSession.focus) + '</span></span>' +
            '<span class="resume-go">Continue \u2192</span>' +
          '</a>' +
          (next ? '<a class="resume-side" href="#/session/' + next.id + '/dialogue"><small>Next lesson</small>Week ' + next.week + ' \u00b7 ' + ui.esc(next.day.slice(0, 3)) + ' S' + next.number + ' \u2192</a>' : '') +
        '</div>'
      : '';

    return '<div class="view-narrow">' +
      '<h1>Course</h1>' +
      '<p class="lead">Twelve weeks, three sessions a week, from first greetings to a full conversation.</p>' +
      resume +
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
