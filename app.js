/* ============================================================
   Router + chrome. Views live in js/views and register themselves
   on Salama.views; this file only decides which one is on screen.
   ============================================================ */
(function (S) {
  'use strict';

  var core = S.core;
  var ui = S.ui;

  function parseHash() {
    var raw = location.hash.replace(/^#\/?/, '');
    if (!raw) return ['today'];
    return raw.split('/').filter(Boolean);
  }

  function pickView(parts) {
    if (parts[0] === 'dictionary') {
      return S.views.words;
    }
    if (parts[0] === 'reference') {
      var sub = parts[1] || 'words';
      if (sub === 'dictionary') sub = 'words';
      return S.views[sub] || S.views.words;
    }
    return S.views[parts[0]] || S.views.today;
  }

  function markNav(view) {
    var links = document.querySelectorAll('.appnav a');
    Array.prototype.forEach.call(links, function (link) {
      if (view.nav && link.getAttribute('data-nav') === view.nav) {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
    });
  }

  function render() {
    var parts = parseHash();
    var view = pickView(parts);
    var main = document.getElementById('main');
    var html;

    try {
      html = view.render(parts);
    } catch (error) {
      console.error('[Salama] render failed', error);
      html = '<div class="view-narrow"><h1>This screen could not load</h1>' +
        '<p class="lead">Reloading the page usually fixes it.</p>' +
        '<div class="btn-row"><a class="btn" href="#/today">Back to Today</a></div></div>';
    }

    main.innerHTML = html;
    if (typeof view.mount === 'function') view.mount(main, parts);
    markNav(view);
    resumeChip(parts);
    closeHeaderSyllabus();
    window.scrollTo(0, 0);
  }

  function renderHeaderSyllabusHtml() {
    var pos = core.lastPosition ? core.lastPosition() : null;
    var activeId = pos ? pos.id : '';
    return '<div class="shell header-syllabus-inner">' +
      '<div class="header-syllabus-head">' +
        '<div>' +
          '<p class="section-eyebrow" style="margin:0 0 2px">SYLLABUS &amp; CURRICULUM TITLE MENU</p>' +
          '<strong>All 12 Weeks \u00b7 36 Sessions (Lessons 1\u201336)</strong>' +
        '</div>' +
        '<div style="display:flex;gap:8px;align-items:center">' +
          '<a class="btn btn-secondary btn-sm" href="#/course">Open Full Course Page \u2192</a>' +
          '<button class="btn btn-quiet btn-sm" type="button" id="closeSyllabusDrawerBtn">Close \u2715</button>' +
        '</div>' +
      '</div>' +
      '<div class="lc-syllabus-grid">' +
        core.data.curriculum.map(function (week) {
          var list = core.data.sessions.filter(function (s) { return s.week === week.week; });
          return '<div class="lc-syllabus-week">' +
            '<a class="lc-syllabus-week-head" href="#/course/' + week.week + '" style="text-decoration:none;color:inherit">' +
              '<span class="lc-sw-badge">Month ' + week.month + ' \u00b7 Week ' + week.week + '</span>' +
              '<strong>' + ui.esc(week.title) + '</strong>' +
            '</a>' +
            '<div class="lc-syllabus-sessions">' +
              list.map(function (s) {
                var lno = (s.week - 1) * 3 + s.number;
                var cur = s.id === activeId;
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
    '</div>';
  }

  function closeHeaderSyllabus() {
    try {
      var drawer = document.getElementById('headerSyllabusDrawer');
      var btn = document.getElementById('syllabusMenuBtn');
      if (drawer) drawer.hidden = true;
      if (btn) btn.setAttribute('aria-expanded', 'false');
    } catch (e) {}
  }

  function toggleHeaderSyllabus() {
    try {
      var drawer = document.getElementById('headerSyllabusDrawer');
      var btn = document.getElementById('syllabusMenuBtn');
      if (!drawer) return;
      var willOpen = Boolean(drawer.hidden);
      if (willOpen) {
        drawer.innerHTML = renderHeaderSyllabusHtml();
        drawer.hidden = false;
        if (btn) btn.setAttribute('aria-expanded', 'true');
        var closeBtn = document.getElementById('closeSyllabusDrawerBtn');
        if (closeBtn) closeBtn.addEventListener('click', closeHeaderSyllabus);
      } else {
        closeHeaderSyllabus();
      }
    } catch (e) {}
  }

  /* ---------------- floating "you are here" chip ---------------- */
  // Shown on every screen except the lesson itself, so a teacher who wanders off to
  // the dictionary or recorder during a call can get back to the exact step.
  function syncHeaderCta() {
    try {
      var cta = document.querySelector && document.querySelector('.header-cta');
      var prevBtn = document.getElementById('headerPrevSession');
      var nextBtn = document.getElementById('headerNextSession');
      var sel = document.getElementById('headerSessionSelect');
      var pos = core.lastPosition ? core.lastPosition() : null;
      var s = (pos ? core.session(pos.id) : null) || core.currentSession() || core.session('w1s1');

      if (cta && s) {
        if (pos && pos.id === s.id) {
          cta.href = core.positionHash(pos);
          cta.innerHTML = 'Continue W' + s.week + ' \u00b7 S' + s.number + ' &#9654;';
          cta.title = 'Back to ' + s.focus + ' (' + core.STEP_NAMES[pos.step] + ')';
        } else {
          cta.href = '#/session/' + s.id + '/dialogue';
          cta.innerHTML = 'Start W' + s.week + ' \u00b7 S' + s.number + ' &#9654;';
          cta.title = s.focus;
        }
      }

      if (prevBtn && s) {
        var prev = core.adjacentSession ? core.adjacentSession(s.id, -1) : null;
        if (prev) {
          prevBtn.hidden = false;
          prevBtn.href = '#/session/' + prev.id + '/dialogue';
          prevBtn.innerHTML = '&#9664; W' + prev.week + '\u00b7S' + prev.number;
          prevBtn.title = 'Previous session: Week ' + prev.week + ' \u00b7 ' + prev.day + ' \u00b7 Session ' + prev.number + ' (' + prev.focus + ')';
        } else {
          prevBtn.hidden = true;
        }
      }

      if (nextBtn && s) {
        var next = core.adjacentSession ? core.adjacentSession(s.id, 1) : null;
        if (next) {
          nextBtn.hidden = false;
          nextBtn.href = '#/session/' + next.id + '/dialogue';
          nextBtn.innerHTML = 'W' + next.week + '\u00b7S' + next.number + ' &#9654;';
          nextBtn.title = 'Next session: Week ' + next.week + ' \u00b7 ' + next.day + ' \u00b7 Session ' + next.number + ' (' + next.focus + ')';
        } else {
          nextBtn.hidden = true;
        }
      }

      if (sel && s && core.data && core.data.curriculum) {
        if (!sel.options || sel.options.length === 0) {
          sel.innerHTML = core.data.curriculum.map(function (week) {
            var list = core.data.sessions.filter(function (item) { return item.week === week.week; });
            return '<optgroup label="Week ' + week.week + ' \u2014 ' + ui.esc(week.title) + '">' +
              list.map(function (item) {
                var lno = (item.week - 1) * 3 + item.number;
                return '<option value="' + ui.esc(item.id) + '">' +
                  'W' + item.week + '\u00b7S' + item.number + ' (L' + lno + ') \u2014 ' + ui.esc(item.focus) +
                  '</option>';
              }).join('') +
            '</optgroup>';
          }).join('');
        }
        sel.value = s.id;
      }
    } catch (e) { /* optional */ }
  }

  function resumeChip(parts) {
    syncHeaderCta();
    try {
      if (typeof document === 'undefined' || !document.body || !document.createElement) return;
      var chip = document.getElementById('resumeChip');
      var pos = core.lastPosition ? core.lastPosition() : null;
      var s = pos ? core.session(pos.id) : null;
      if (!s || parts[0] === 'session') { if (chip) chip.hidden = true; return; }
      if (!chip) {
        chip = document.createElement('div');
        chip.id = 'resumeChip';
        chip.className = 'resume-chip-bar';
        document.body.appendChild(chip);
      }
      var prev = core.adjacentSession ? core.adjacentSession(s.id, -1) : null;
      var next = core.adjacentSession ? core.adjacentSession(s.id, 1) : null;
      chip.hidden = false;
      chip.innerHTML =
        (prev ? '<a class="rc-adj" href="#/session/' + prev.id + '/dialogue" title="Previous: ' + ui.esc(prev.focus) + '">\u25C0 W' + prev.week + '\u00b7S' + prev.number + '</a>' : '') +
        '<a class="resume-chip" href="' + core.positionHash(pos) + '">' +
          '<span class="rc-dot">\u25B6</span><span><small>Back to lesson</small>W' + s.week + ' \u00b7 ' +
          ui.esc(s.day.slice(0, 3)) + ' S' + s.number + ' \u00b7 ' + core.STEP_NAMES[pos.step] + '</span>' +
        '</a>' +
        (next ? '<a class="rc-adj" href="#/session/' + next.id + '/dialogue" title="Next: ' + ui.esc(next.focus) + '">W' + next.week + '\u00b7S' + next.number + ' \u25B6</a>' : '');
    } catch (e) { /* chip is a convenience only */ }
  }

  /* ---------------- versions ---------------- */
  // One number for the service worker cache, the About panel and the state key.
  // It used to be typed into three files and drifted; sw.js reads the same
  // string from here via data/content.js's meta.version.
  var VERSION = '3.1';

  /* ---------------- header chrome ---------------- */
  var SIZE_LABEL = ['normal', 'large', 'larger'];

  function syncChrome() {
    var pref = core.state.prefs;
    var textBtn = document.getElementById('textSizeBtn');
    if (textBtn) textBtn.textContent = 'Text: ' + SIZE_LABEL[pref.textsize || 0];

    var soundBtn = document.getElementById('soundBtn');
    var soundLabel = document.getElementById('soundLabel');
    if (soundBtn) {
      soundBtn.setAttribute('aria-pressed', pref.autoplay ? 'true' : 'false');
      soundBtn.querySelector('use').setAttribute('href', pref.autoplay ? '#i-volume' : '#i-muted');
    }
    if (soundLabel) soundLabel.textContent = pref.autoplay ? 'Auto-play on' : 'Auto-play off';
  }

  function bindChrome() {
    var syllabusBtn = document.getElementById('syllabusMenuBtn');
    if (syllabusBtn) {
      syllabusBtn.addEventListener('click', toggleHeaderSyllabus);
    }

    var headerSel = document.getElementById('headerSessionSelect');
    if (headerSel) {
      headerSel.addEventListener('change', function () {
        if (headerSel.value) {
          location.hash = '#/session/' + headerSel.value + '/dialogue';
        }
      });
    }

    var textBtn = document.getElementById('textSizeBtn');
    if (textBtn) {
      textBtn.addEventListener('click', function () {
        var next = ((core.state.prefs.textsize || 0) + 1) % 3;
        core.setPref('textsize', next);
        syncChrome();
        ui.toast('Text size: ' + SIZE_LABEL[next]);
      });
    }

    var soundBtn = document.getElementById('soundBtn');
    if (soundBtn) {
      soundBtn.addEventListener('click', function () {
        core.setPref('autoplay', !core.state.prefs.autoplay);
        syncChrome();
        if (!S.speech.ttsAvailable()) {
          ui.toast('This browser has no speech voice; session recordings still play.');
        }
      });
    }

    document.addEventListener('salama:prefs', syncChrome);
  }

  /* ---------------- boot ---------------- */
  function boot() {
    core.applyPrefs();
    core.touchStreak();
    bindChrome();
    syncChrome();

    // Say once, plainly, why a phone can be silent even though the app is not:
    // the iOS silent switch mutes speechSynthesis but not audio elements.
    if (!S.speech.ttsAvailable() && !core.state.prefs.noVoiceNotice) {
      core.setPref('noVoiceNotice', true);
      ui.toast('No speech voice found: recorded audio will still play.');
    }
    window.addEventListener('hashchange', render);
    render();

    if ('caches' in window) {
      caches.keys().then(function (keys) {
        keys.forEach(function (k) {
          if (k !== 'salama-v4.5.9') caches.delete(k);
        });
      }).catch(function () {});
    }

    if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
      var refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', function () {
        if (refreshing) return;
        refreshing = true;
        location.reload();
      });
      navigator.serviceWorker.register('sw.js?v=4.5.9').then(function (registration) {
        if (registration && typeof registration.update === 'function') {
          registration.update();
        }
      }).catch(function (error) {
        // The app works without the cache; it just needs a connection.
        console.warn('[Salama] Offline cache not installed:', error && error.message);
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window.Salama);
