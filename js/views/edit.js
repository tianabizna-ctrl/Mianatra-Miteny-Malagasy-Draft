/* ============================================================
   Edit Malagasy, Phonetics & Record My Voice (#/edit) —
   Course-first live editor and microphone voice recorder
   organized around the learner's current Course Lesson
   (Week 1–12 · Session 1–3) as well as all words, phrases,
   and dialogue sentences.
   ============================================================ */
(function (S) {
  'use strict';
  var core = S.core;
  var ui = S.ui;

  var PAGE = 40;
  var state = {
    tab: 'course', // 'course' | 'words' | 'phrases' | 'sentences' | 'voice' | 'edited'
    sessionId: '',
    stepFilter: 'all', // 'all' | '0' | '1' | '2'
    q: '',
    limit: PAGE
  };

  function activeSession() {
    if (state.sessionId && core.session(state.sessionId)) {
      return core.session(state.sessionId);
    }
    var cur = (core.currentSession && core.currentSession()) || core.session('w1s1');
    if (cur) state.sessionId = cur.id;
    return cur;
  }

  function allRowsForTab(tab) {
    var rows = [];
    if (tab === 'course') {
      var sess = activeSession();
      rows = (core.sessionEntries && sess) ? core.sessionEntries(sess.id).slice() : [];
      if (state.stepFilter === '0' || state.stepFilter === '1' || state.stepFilter === '2') {
        var targetStep = Number(state.stepFilter);
        rows = rows.filter(function (r) { return r.step === targetStep; });
      }
    } else {
      if (tab === 'words' || tab === 'voice' || tab === 'edited') {
        core.data.vocabulary.forEach(function (w) {
          var key = 'word:' + w.id;
          var sTags = core.sessionsForEntryKey ? core.sessionsForEntryKey(key) : [];
          rows.push({
            key: key,
            kind: 'Word' + (sTags.length ? ' \u00b7 ' + sTags.join(', ') : ''),
            where: (w.themes && w.themes[0]) ? core.themeTitle(w.themes[0]) : (w.pos || 'Dictionary'),
            item: w,
            speakOpts: { wordId: w.id, editKey: key }
          });
        });
      }
      if (tab === 'phrases' || tab === 'voice' || tab === 'edited') {
        core.data.phrases.forEach(function (p) {
          var key = 'phrase:' + p.id;
          var sTags = core.sessionsForEntryKey ? core.sessionsForEntryKey(key) : [];
          rows.push({
            key: key,
            kind: 'Phrase' + (sTags.length ? ' \u00b7 ' + sTags.join(', ') : ''),
            where: p.group || '',
            item: p,
            speakOpts: { wordId: p.id, phraseId: p.id, editKey: key }
          });
        });
      }
      if (tab === 'sentences' || tab === 'voice' || tab === 'edited') {
        core.data.dialogues.forEach(function (d) {
          (d.lines || []).forEach(function (line, idx) {
            var key = 'dlg:' + d.id + ':' + idx;
            var sTags = core.sessionsForEntryKey ? core.sessionsForEntryKey(key) : [];
            rows.push({
              key: key,
              kind: 'Sentence' + (sTags.length ? ' \u00b7 ' + sTags.join(', ') : ''),
              where: d.title,
              item: line,
              speakOpts: { line: d.id + ':' + idx, editKey: key }
            });
          });
        });
      }
      if (tab === 'voice') {
        rows = rows.filter(function (r) {
          return Boolean(S.speech && S.speech.hasCustomAudio && S.speech.hasCustomAudio(r.key));
        });
      } else if (tab === 'edited') {
        rows = rows.filter(function (r) {
          var hasAud = S.speech && S.speech.hasCustomAudio && S.speech.hasCustomAudio(r.key);
          return Boolean(r.item.pron_edited || core.getEdit(r.key) || hasAud);
        });
      }
    }

    var q = ui.norm(state.q);
    if (q) {
      rows = rows.filter(function (r) {
        return ui.norm(r.item.mg).indexOf(q) !== -1 ||
               ui.norm(r.item.id || '').indexOf(q) !== -1 ||
               ui.norm(r.item.pron || '').indexOf(q) !== -1 ||
               ui.norm(r.item.en || '').indexOf(q) !== -1 ||
               ui.norm(r.where || '').indexOf(q) !== -1 ||
               ui.norm(r.kind || '').indexOf(q) !== -1;
      });
    }
    return rows;
  }

  function renderCard(r) {
    var item = r.item;
    var ed = core.getEdit ? (core.getEdit(r.key) || {}) : {};
    var hasAudio = S.speech && S.speech.hasCustomAudio ? S.speech.hasCustomAudio(r.key, item.mg) : false;
    var edited = Boolean(item.pron_edited || ed.note || hasAudio);
    var extra = (r.speakOpts.wordId ? ' data-word-id="' + ui.esc(r.speakOpts.wordId) + '"' : '') +
                (r.speakOpts.line ? ' data-line="' + ui.esc(r.speakOpts.line) + '"' : '');
    return '<article class="entry edit-card" data-row-key="' + ui.esc(r.key) + '">' +
      '<div style="width:100%">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px">' +
          '<span class="meta"><strong>' + ui.esc(r.kind) + '</strong>' +
            (r.where ? ' \u00b7 ' + ui.esc(r.where) : '') +
            ' \u00b7 <code>' + ui.esc(r.key) + '</code>' +
            ' <span class="checked" data-status-for="' + ui.esc(r.key) + '"' + (edited ? '' : ' hidden') + '>\u2713 ' + (item.pron_edited ? 'Saved' : (hasAudio ? 'Using My Recorded Voice' : 'Saved')) + '</span>' +
          '</span>' +
          '<div class="entry-tools">' +
            '<button class="icon-btn hear-btn" type="button" data-speak="' + ui.esc(item.mg) + '"' + extra + '>' +
              ui.icon('play') + '<span>' + (hasAudio ? 'Hear My Voice' : 'Listen') + '</span></button>' +
            '<button class="icon-btn slow" type="button" data-slow="' + ui.esc(item.mg) + '"' + extra + '>' +
              ui.icon('volume') + '<span>Syllables</span></button>' +
            '<button class="icon-btn record-mic-btn" type="button" data-record-audio-key="' + ui.esc(r.key) + '" style="border-color:#c93b2b;color:#c93b2b;font-weight:700">' +
              '\u25CF <span>' + (hasAudio ? 'Re-record my voice' : 'Record my voice') + '</span></button>' +
            '<label class="icon-btn" style="cursor:pointer">' +
              ui.icon('download') + '<span>' + (hasAudio ? 'Replace file' : 'Upload audio') + '</span>' +
              '<input type="file" accept="audio/*" data-upload-audio-key="' + ui.esc(r.key) + '" hidden>' +
            '</label>' +
            '<button class="icon-btn" type="button" data-download-audio-key="' + ui.esc(r.key) + '"' + (hasAudio ? '' : ' hidden') + ' title="Download your .wav recording">\u2B07 <span>.wav</span></button>' +
            '<button class="icon-btn" type="button" data-clear-audio-key="' + ui.esc(r.key) + '"' + (hasAudio ? '' : ' hidden') + '>Reset voice</button>' +
            '<button class="icon-btn" type="button" data-live-reset="' + ui.esc(r.key) + '"' + (item.pron_edited ? '' : ' hidden') + '>Reset text</button>' +
          '</div>' +
        '</div>' +
        '<div class="inline-edit-fields">' +
          '<label class="inline-edit-field">' +
            '<span>Malagasy (type to edit)</span>' +
            '<input type="text" class="inline-edit-mg" lang="mg" data-live-field="mg" data-live-key="' + ui.esc(r.key) + '" value="' + ui.esc(item.mg || '') + '">' +
          '</label>' +
          '<label class="inline-edit-field">' +
            '<span>Phonetics / pronunciation (type to edit)</span>' +
            '<input type="text" class="inline-edit-pron" data-live-field="pron" data-live-key="' + ui.esc(r.key) + '" placeholder="e.g. fah-hah-sah-lah-MAH-nah" value="' + ui.esc(item.pron || '') + '">' +
          '</label>' +
        '</div>' +
        '<p class="en" style="margin-top:8px">' + ui.esc(item.en || '') + '</p>' +
      '</div>' +
    '</article>';
  }

  function renderCoursePickerBar() {
    var sess = activeSession();
    if (!sess) return '';
    var pos = core.lastPosition ? core.lastPosition() : null;
    var backHref = (pos && pos.id === sess.id) ? core.positionHash(pos) : ('#/session/' + sess.id + '/dialogue');
    var weekSessions = core.data.sessions.filter(function (s) { return s.week === sess.week; });
    var sessEntries = core.sessionEntries ? core.sessionEntries(sess.id) : [];

    var stepPills = [
      ['all', 'All in this lesson (' + sessEntries.length + ')'],
      ['0', '1 Dialogue'],
      ['1', '2 New words (6)'],
      ['2', '3 Roleplay']
    ];

    return '<section class="panel course-edit-picker" style="margin:14px 0 18px;padding:16px 18px">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:10px">' +
        '<div>' +
          '<p class="section-eyebrow" style="margin:0 0 2px">EDITING BY CORRESPONDING COURSE LESSON</p>' +
          '<strong style="font-size:1.08rem">Week ' + sess.week + ' \u00b7 ' + ui.esc(sess.day) + ' \u00b7 Session ' + sess.number + ' \u2014 ' + ui.esc(sess.focus) + '</strong>' +
        '</div>' +
        '<div class="btn-row" style="margin:0">' +
          '<a class="btn btn-sm" href="' + backHref + '">&larr; Back to This Lesson (W' + sess.week + ' \u00b7 S' + sess.number + ')</a>' +
          '<select id="editSessionSelect" class="header-session-select" aria-label="Choose course lesson to edit">' +
            core.data.curriculum.map(function (week) {
              var list = core.data.sessions.filter(function (item) { return item.week === week.week; });
              return '<optgroup label="Week ' + week.week + ' \u2014 ' + ui.esc(week.title) + '">' +
                list.map(function (item) {
                  var lno = (item.week - 1) * 3 + item.number;
                  return '<option value="' + ui.esc(item.id) + '"' + (item.id === sess.id ? ' selected' : '') + '>' +
                    'W' + item.week + '\u00b7S' + item.number + ' (L' + lno + ') \u2014 ' + ui.esc(item.focus) +
                    '</option>';
                }).join('') +
              '</optgroup>';
            }).join('') +
          '</select>' +
        '</div>' +
      '</div>' +
      '<div class="lc-week-strip" style="margin-bottom:10px" role="group" aria-label="Choose week to edit">' +
        core.data.curriculum.map(function (w) {
          var isCur = w.week === sess.week;
          return '<button type="button" class="lc-wk-chip' + (isCur ? ' is-cur' : '') + '" data-edit-pick-week="' + w.week + '" title="Week ' + w.week + ': ' + ui.esc(w.title) + '">W' + w.week + '</button>';
        }).join('') +
      '</div>' +
      '<div class="chips" style="margin:0 0 10px" role="group" aria-label="Choose session in Week ' + sess.week + '">' +
        weekSessions.map(function (s) {
          var isCur = s.id === sess.id;
          return '<button type="button" class="chip" data-edit-pick-session="' + ui.esc(s.id) + '" aria-pressed="' + (isCur ? 'true' : 'false') + '">' +
            'W' + s.week + ' \u00b7 ' + ui.esc(s.day.slice(0, 3)) + ' \u00b7 S' + s.number + ' \u2014 ' + ui.esc(s.focus) +
          '</button>';
        }).join('') +
      '</div>' +
      '<div class="chips" style="margin:0" role="group" aria-label="Filter lesson step">' +
        stepPills.map(function (sp) {
          return '<button type="button" class="chip" data-edit-step-filter="' + sp[0] + '" aria-pressed="' + (state.stepFilter === sp[0] ? 'true' : 'false') + '">' +
            ui.esc(sp[1]) +
          '</button>';
        }).join('') +
      '</div>' +
    '</section>';
  }

  function tabBar() {
    var sess = activeSession();
    var sessCount = (core.sessionEntries && sess) ? core.sessionEntries(sess.id).length : 0;
    var lineCount = core.data.dialogues.reduce(function (n, d) { return n + (d.lines ? d.lines.length : 0); }, 0);
    var voiceCount = (S.speech && S.speech.customAudioCount) ? S.speech.customAudioCount() : 0;
    var tabs = [
      ['course', '\uD83D\uDCCD Current Course Lesson: W' + (sess ? sess.week + '\u00b7S' + sess.number : '1\u00b7S1') + ' (' + sessCount + ')'],
      ['words', 'All Words (' + core.data.vocabulary.length.toLocaleString() + ')'],
      ['phrases', 'All Phrases (' + core.data.phrases.length + ')'],
      ['sentences', 'All Dialogue sentences (' + lineCount + ')'],
      ['voice', 'My Voice Recordings (' + voiceCount + ')'],
      ['edited', 'Edited (' + core.editCount() + ')']
    ];
    return tabs.map(function (t) {
      return '<button class="chip" type="button" data-edit-tab="' + t[0] + '" aria-pressed="' +
        (state.tab === t[0] ? 'true' : 'false') + '">' + ui.esc(t[1]) + '</button>';
    }).join('');
  }

  function paintList(scope) {
    var pickerHolder = scope.querySelector('#editCoursePicker');
    if (pickerHolder) {
      pickerHolder.innerHTML = state.tab === 'course' ? renderCoursePickerBar() : '';
    }
    var list = allRowsForTab(state.tab);
    var shown = list.slice(0, state.limit);
    var holder = scope.querySelector('#editList');
    var countNode = scope.querySelector('#editCount');
    var moreBtn = scope.querySelector('#editMore');
    var tabsNode = scope.querySelector('#editTabs');
    if (tabsNode) tabsNode.innerHTML = tabBar();
    if (!holder) return;
    holder.innerHTML = shown.length
      ? shown.map(renderCard).join('')
      : '<p class="empty">No entries match this filter.</p>';
    if (countNode) {
      var vCount = (S.speech && S.speech.customAudioCount) ? S.speech.customAudioCount() : 0;
      countNode.textContent = list.length.toLocaleString() + ' ' + ui.plural(list.length, 'entry', 'entries') +
        (list.length > shown.length ? ', showing ' + shown.length : '') +
        ' \u00b7 ' + vCount + ' custom voice recording(s) \u00b7 ' + core.editCount() + ' manual text edit(s)';
    }
    if (moreBtn) moreBtn.hidden = list.length <= shown.length;
  }

  function render(parts) {
    var curSess = (core.currentSession && core.currentSession()) || core.session('w1s1');
    if (!state.sessionId && curSess) state.sessionId = curSess.id;

    if (parts && parts[1]) {
      var p1 = parts[1];
      if (p1 === 'session' && parts[2] && core.session(parts[2])) {
        state.tab = 'course';
        state.sessionId = parts[2];
        state.stepFilter = parts[3] !== undefined ? String(parts[3]) : 'all';
      } else if (core.session(p1)) {
        state.tab = 'course';
        state.sessionId = p1;
      } else if (p1 === 'course' || p1 === 'words' || p1 === 'phrases' || p1 === 'sentences' || p1 === 'voice' || p1 === 'edited') {
        state.tab = p1;
        if (parts[2] !== undefined) state.q = decodeURIComponent(parts[2]);
      } else {
        state.q = decodeURIComponent(p1);
      }
    } else if (curSess) {
      // Whenever opening #/edit directly, default to the exact lesson where the learner is!
      state.sessionId = curSess.id;
    }

    var sess = activeSession();
    var pos = core.lastPosition ? core.lastPosition() : null;
    var backToLessonHref = (pos && sess && pos.id === sess.id)
      ? core.positionHash(pos)
      : ('#/session/' + (sess ? sess.id : 'w1s1') + '/dialogue');

    return '<div>' +
      '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:8px">' +
        '<a class="cta-link" href="' + backToLessonHref + '">&larr; Back to Current Lesson (' + (sess ? 'Week ' + sess.week + ' \u00b7 Session ' + sess.number : 'Course') + ')</a>' +
        '<a class="cta-link" href="#/settings">Settings &rarr;</a>' +
      '</div>' +
      '<div style="display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:12px">' +
        '<div>' +
          '<h1>Manual Edits (Malagasy &amp; Phonetics) &amp; Voice</h1>' +
          '<p class="lead">Showing the words, dialogue lines, and roleplay sentences for your current course lesson first so you never have to hunt for a word.</p>' +
        '</div>' +
        '<div class="btn-row">' +
          '<button class="btn" type="button" id="exportEditsBtn">' +
            ui.icon('download') + 'Export text edits (.tsv)</button>' +
          '<button class="btn btn-secondary" type="button" id="exportVoiceBtn">' +
            ui.icon('download') + 'Export My Voice (.json)</button>' +
          '<label class="btn btn-quiet" style="cursor:pointer">' +
            'Import Voice (.json)' +
            '<input type="file" accept=".json,application/json" id="importVoiceInput" hidden>' +
          '</label>' +
        '</div>' +
      '</div>' +

      '<div class="chips" id="editTabs" style="margin-top:12px">' + tabBar() + '</div>' +
      '<div id="editCoursePicker">' + (state.tab === 'course' ? renderCoursePickerBar() : '') + '</div>' +

      '<div class="filter-row">' +
        '<div class="search-wrap">' + ui.icon('search') +
          '<input type="search" id="editSearch" placeholder="Filter within this view or search any word (e.g. mazotoa, fahasalamana, salama)\u2026" aria-label="Search entries" value="' + ui.esc(state.q) + '">' +
        '</div>' +
      '</div>' +
      '<p class="result-count" id="editCount"></p>' +
      '<div class="entry-list" id="editList"></div>' +
      '<div style="margin-top:24px"><button class="btn btn-quiet" type="button" id="editMore" hidden>Show more entries</button></div>' +
    '</div>';
  }

  function mount(root) {
    var scope = root.firstElementChild || root;
    paintList(scope);

    scope.addEventListener('click', function (event) {
      var pickWeekBtn = event.target.closest('[data-edit-pick-week]');
      if (pickWeekBtn) {
        var wk = Number(pickWeekBtn.getAttribute('data-edit-pick-week')) || 1;
        state.sessionId = 'w' + wk + 's1';
        state.tab = 'course';
        state.limit = PAGE;
        paintList(scope);
        return;
      }

      var pickSessBtn = event.target.closest('[data-edit-pick-session]');
      if (pickSessBtn) {
        state.sessionId = pickSessBtn.getAttribute('data-edit-pick-session') || 'w1s1';
        state.tab = 'course';
        state.limit = PAGE;
        paintList(scope);
        return;
      }

      var stepFilterBtn = event.target.closest('[data-edit-step-filter]');
      if (stepFilterBtn) {
        state.stepFilter = stepFilterBtn.getAttribute('data-edit-step-filter') || 'all';
        state.limit = PAGE;
        paintList(scope);
        return;
      }

      var recBtn = event.target.closest('[data-record-audio-key]');
      if (recBtn) {
        var rKey = recBtn.getAttribute('data-record-audio-key');
        if (S.speech && S.speech.toggleMicRecording) {
          S.speech.toggleMicRecording(rKey, recBtn, function () {
            paintList(scope);
          });
        }
        return;
      }

      var dlBtn = event.target.closest('[data-download-audio-key]');
      if (dlBtn) {
        var dKey = dlBtn.getAttribute('data-download-audio-key');
        if (S.speech && S.speech.downloadCustomWav) {
          S.speech.downloadCustomWav(dKey);
        }
        return;
      }

      var tabBtn = event.target.closest('[data-edit-tab]');
      if (tabBtn) {
        state.tab = tabBtn.getAttribute('data-edit-tab');
        state.limit = PAGE;
        paintList(scope);
        return;
      }
      if (event.target.closest('#editMore')) {
        state.limit += PAGE;
        paintList(scope);
        return;
      }
      if (event.target.closest('#exportVoiceBtn')) {
        var vc = (S.speech && S.speech.exportCustomAudioBundle) ? S.speech.exportCustomAudioBundle() : 0;
        if (!vc) ui.toast('No voice recordings yet \u2014 click "Record my voice" on any word first.');
        else ui.toast('Exported ' + vc + ' voice recording(s) to salama_my_voice_recordings.json.');
        return;
      }
      if (event.target.closest('#exportEditsBtn')) {
        var n = core.exportEditsTSV();
        if (!n) ui.toast('No manual edits to export yet \u2014 type in any box first.');
        else ui.toast('Exported ' + n + ' edit(s) to salama_corrections.tsv.');
        return;
      }
      var clearAudioBtn = event.target.closest('[data-clear-audio-key]');
      if (clearAudioBtn) {
        var cKey = clearAudioBtn.getAttribute('data-clear-audio-key');
        if (S.speech && S.speech.removeCustomAudio) {
          S.speech.removeCustomAudio(cKey, function () {
            paintList(scope);
            ui.toast('Restored default audio recording.');
          });
        }
        return;
      }
      var resetBtn = event.target.closest('[data-live-reset]');
      if (resetBtn) {
        var resetKey = resetBtn.getAttribute('data-live-reset');
        core.resetEdit(resetKey);
        paintList(scope);
        ui.toast('Restored original Malagasy & phonetics.');
        return;
      }
      var speakNode = event.target.closest('[data-speak],[data-slow]');
      if (speakNode) {
        ui.speakFrom(event);
      }
    });

    scope.addEventListener('change', function (event) {
      if (event.target.id === 'editSessionSelect') {
        state.sessionId = event.target.value || 'w1s1';
        state.tab = 'course';
        state.limit = PAGE;
        paintList(scope);
        return;
      }
      if (event.target.id === 'importVoiceInput' && event.target.files && event.target.files[0]) {
        var vFile = event.target.files[0];
        var vReader = new FileReader();
        vReader.onload = function () {
          if (S.speech && S.speech.importCustomAudioBundle) {
            S.speech.importCustomAudioBundle(String(vReader.result), function (count) {
              paintList(scope);
              ui.toast('Imported ' + count + ' custom voice recording(s)!');
            });
          }
        };
        vReader.readAsText(vFile);
        return;
      }
      var upKey = event.target.getAttribute && event.target.getAttribute('data-upload-audio-key');
      if (upKey && event.target.files && event.target.files[0]) {
        var file = event.target.files[0];
        var reader = new FileReader();
        reader.onload = function () {
          if (S.speech && S.speech.saveCustomAudio) {
            S.speech.saveCustomAudio(upKey, String(reader.result), function () {
              paintList(scope);
              ui.toast('Saved your custom audio recording for ' + upKey + '!');
            });
          }
        };
        reader.readAsDataURL(file);
      }
    });

    scope.addEventListener('input', function (event) {
      if (event.target.id === 'editSearch') {
        state.q = event.target.value;
        state.limit = PAGE;
        paintList(scope);
        return;
      }
      var key = event.target.getAttribute('data-live-key');
      var field = event.target.getAttribute('data-live-field');
      if (!key || !field) return;
      var card = event.target.closest('[data-row-key]');
      var mgInput = card ? card.querySelector('[data-live-field="mg"]') : null;
      var pronInput = card ? card.querySelector('[data-live-field="pron"]') : null;
      var noteInput = card ? card.querySelector('[data-live-field="note"]') : null;
      core.saveEdit(key, {
        mg: mgInput ? mgInput.value : undefined,
        pron: pronInput ? pronInput.value : undefined,
        note: noteInput ? noteInput.value : undefined
      });
      var item = core.entryForKey(key);
      var edited = Boolean(item && item.pron_edited);
      if (card) {
        var status = card.querySelector('[data-status-for]');
        if (status) status.hidden = !edited;
        var rst = card.querySelector('[data-live-reset]');
        if (rst) rst.hidden = !edited;
        var spk = card.querySelectorAll('[data-speak]');
        for (var i = 0; i < spk.length; i++) spk[i].setAttribute('data-speak', item.mg || '');
        var slw = card.querySelectorAll('[data-slow]');
        for (var j = 0; j < slw.length; j++) slw[j].setAttribute('data-slow', item.mg || '');
      }
      var tabsNode = scope.querySelector('#editTabs');
      if (tabsNode) tabsNode.innerHTML = tabBar();
    });
  }

  S.views = S.views || {};
  S.views.edit = { render: render, mount: mount, nav: 'edit' };
})(window.Salama);
