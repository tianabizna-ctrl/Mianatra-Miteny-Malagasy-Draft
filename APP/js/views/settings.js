/* Settings: reading comfort, how words are spoken, and the learner's own data. */
(function (S) {
  'use strict';
  var core = S.core;
  var ui = S.ui;
  var speech = S.speech;

  var RATES = [['0.62', 'Slow'], ['0.82', 'Normal'], ['1', 'Brisk']];
  var advOpen = false;
  var DIRECTIONS = [['miteny', 'Miteny (forest & gold)'], ['laterite', 'Laterite (red earth)'], ['raffia', 'Raffia (woven warm)'], ['dusk', 'Baobab dusk (dark)']];
  var PALETTE_LIST = [['miteny', 'Miteny Forest'], ['laterite', 'Laterite'], ['vanilla', 'Vanilla'], ['ravinala', 'Ravinala'], ['lamba', 'Lamba']];
  var FONT_LIST = [['fraunces', 'Fraunces + Public Sans'], ['gloock', 'Gloock + Instrument'], ['young', 'Young Serif + Work'], ['bricolage', 'Bricolage']];
  var MODES = [['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']];

  function directionChips() {
    var current = core.state.prefs.direction || 'miteny';
    return DIRECTIONS.map(function (pair) {
      return '<button class="chip" type="button" data-direction="' + pair[0] + '" aria-pressed="' +
        (current === pair[0] ? 'true' : 'false') + '">' + pair[1] + '</button>';
    }).join('');
  }

  function paletteChips() {
    var current = core.state.prefs.palette || 'miteny';
    return PALETTE_LIST.map(function (pair) {
      return '<button class="chip" type="button" data-palette="' + pair[0] + '" aria-pressed="' +
        (current === pair[0] ? 'true' : 'false') + '">' + pair[1] + '</button>';
    }).join('');
  }

  function fontChips() {
    var current = core.state.prefs.font || 'fraunces';
    return FONT_LIST.map(function (pair) {
      return '<button class="chip" type="button" data-font="' + pair[0] + '" aria-pressed="' +
        (current === pair[0] ? 'true' : 'false') + '">' + pair[1] + '</button>';
    }).join('');
  }

  function modeChips() {
    var current = core.state.prefs.mode || 'auto';
    return MODES.map(function (pair) {
      return '<button class="chip" type="button" data-mode="' + pair[0] + '" aria-pressed="' +
        (current === pair[0] ? 'true' : 'false') + '">' + pair[1] + '</button>';
    }).join('');
  }

  function textSizes() {
    var current = core.state.prefs.textsize || 0;
    return [['0', 'Normal'], ['1', 'Large'], ['2', 'Larger']].map(function (pair) {
      return '<button class="chip" type="button" data-textsize="' + pair[0] + '" aria-pressed="' +
        (String(current) === pair[0] ? 'true' : 'false') + '">' + pair[1] + '</button>';
    }).join('');
  }

  function rateChips() {
    var current = String(core.state.prefs.rate || 0.82);
    return RATES.map(function (pair) {
      return '<button class="chip" type="button" data-rate="' + pair[0] + '" aria-pressed="' +
        (current === pair[0] ? 'true' : 'false') + '">' + pair[1] + '</button>';
    }).join('');
  }

  var RECORDED_VOICES = [
    ['abidi', 'Abidi — Malagasy Neural Voice (22 kHz)'],
    ['coral', 'OpenAI gpt-4o-mini-tts — "Coral" (Warm female)'],
    ['sage', 'OpenAI gpt-4o-mini-tts — "Sage" (Calm)'],
    ['ash', 'OpenAI gpt-4o-mini-tts — "Ash" (Male)'],
    ['mms', 'Meta MMS — Malagasy TTS (16 kHz)']
  ];

  function recordedVoiceChips() {
    var current = core.state.prefs.recordedVoice || 'abidi';
    return RECORDED_VOICES.map(function (pair) {
      return '<button class="chip" type="button" data-recorded-voice="' + pair[0] + '" aria-pressed="' +
        (current === pair[0] ? 'true' : 'false') + '">' + ui.esc(pair[1]) + '</button>';
    }).join('');
  }
  function voiceChooser() {
    var voices = speech.voices();
    var preferred = ['mg', 'fr', 'ro', 'it', 'es', 'pt', 'ca', 'en'];
    var sorted = voices.slice().sort(function (a, b) {
      var ai = preferred.indexOf(String(a.lang).slice(0, 2).toLowerCase());
      var bi = preferred.indexOf(String(b.lang).slice(0, 2).toLowerCase());
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
    var current = core.state.prefs.voiceURI || '';
    var fallbackOptions = sorted.length
      ? '<optgroup label="Device fallback voices (used only when no recording exists)">' +
          sorted.map(function (voice) {
            return '<option value="' + ui.esc(voice.voiceURI) + '"' +
              (current === voice.voiceURI ? ' selected' : '') + '>' +
              ui.esc(voice.name + ' (' + voice.lang + ')') + '</option>';
          }).join('') +
        '</optgroup>'
      : '';
    return '<select id="voiceURI" aria-label="Voice">' +
      '<option value=""' + (!current || current === 'abidi' ? ' selected' : '') + '>' +
        'Abidi — Malagasy Neural Voice (Artifisialy, 22 kHz) — Default</option>' +
      fallbackOptions +
      '</select>';
  }

  function render() {
    var prefs = core.state.prefs;
    var report = speech.voiceReport();
    var counts = core.data.meta && core.data.meta.counts ? core.data.meta.counts : {};
    var clips = (counts.rendered_word_clips || 0) + (counts.rendered_phrase_clips || 0) + (counts.rendered_line_clips || 0);

    return '<div class="view-narrow">' +
      '<h1>Settings</h1>' +

      '<div class="panel">' +
        '<div class="setting">' +
          '<div><div class="k">Visual direction</div>' +
          '<div class="h">Choose between Laterite editorial paper, Raffia woven warm, or Baobab dusk.</div></div>' +
          '<div class="chips" style="margin:0">' + directionChips() + '</div>' +
        '</div>' +
        '<div class="setting">' +
          '<div><div class="k">Color palette</div>' +
          '<div class="h">Accent and deep tones across headers, buttons, and cards.</div></div>' +
          '<div class="chips" style="margin:0">' + paletteChips() + '</div>' +
        '</div>' +
        '<div class="setting">' +
          '<div><div class="k">Typography</div>' +
          '<div class="h">Display and body font pairing.</div></div>' +
          '<div class="chips" style="margin:0">' + fontChips() + '</div>' +
        '</div>' +
        '<div class="setting">' +
          '<div><div class="k">Appearance mode</div>' +
          '<div class="h">Auto follows the visual direction, or force Light or Dark.</div></div>' +
          '<div class="chips" style="margin:0">' + modeChips() + '</div>' +
        '</div>' +
        '<div class="setting">' +
          '<div><div class="k">Text size</div>' +
          '<div class="h">Affects every screen, including flashcards.</div></div>' +
          '<div class="chips" style="margin:0">' + textSizes() + '</div>' +
        '</div>' +
        '<div class="setting">' +
          '<div><div class="k">Speaking speed</div>' +
          '<div class="h">How fast a word or phrase is read aloud.</div></div>' +
          '<div class="chips" style="margin:0">' + rateChips() + '</div>' +
        '</div>' +
        '<div class="setting">' +
          '<div><div class="k">Auto-play pronunciation</div>' +
          '<div class="h">Speaks a word when it appears in a review or a session.</div></div>' +
          '<button class="btn ' + (prefs.autoplay ? '' : 'btn-quiet') + '" type="button" data-autoplay="true" aria-pressed="' +
            (prefs.autoplay ? 'true' : 'false') + '">' + (prefs.autoplay ? 'On' : 'Off') + '</button>' +
        '</div>' +
        '<div class="setting">' +
          '<div><div class="k">Syllable mode for every word</div>' +
          '<div class="h">Says each word one syllable at a time. Easier to imitate, slower to hear.</div></div>' +
          '<button class="btn ' + (prefs.syllables ? '' : 'btn-quiet') + '" type="button" data-syllables="true" aria-pressed="' +
            (prefs.syllables ? 'true' : 'false') + '">' + (prefs.syllables ? 'On' : 'Off') + '</button>' +
        '</div>' +
      '</div>' +

      '<h2>Voice</h2>' +
      '<div class="panel">' +
        '<div class="setting">' +
          '<div>' +
            '<div class="k">My Recorded Voice (Embedded Native Malagasy Audio)</div>' +
            '<div class="h">This site uses your own recorded Malagasy voice embedded directly across lessons, words, phrases, dialogues, and roleplays. Whenever you record a word or sentence once, your voice is automatically propagated everywhere that word or phrase appears across all 12 weeks.</div>' +
          '</div>' +
          '<div class="chips" style="margin:0">' +
            '<span class="chip active">\u2713 My Recorded Voice (Active)</span>' +
          '</div>' +
        '</div>' +
        '<p class="setting-note" style="margin-top:12px">' +
          'Your embedded voice recordings play automatically on every device without needing any external setup. You can record or update any word, phrase, or dialogue line directly on its card or in the Voice Recorder Studio.' +
        '</p>' +
        '<p class="setting-note">On an iPhone or iPad the side switch silences the device voice ' +
          'but not recorded audio. If a word is silent and a lesson recording is not, check that switch.</p>' +
        '<div class="btn-row" style="margin-top:12px;display:flex;flex-wrap:wrap;gap:8px">' +
          '<a class="btn" href="#/record/fahasalamana">\u25CF Open Voice Recorder Studio</a>' +
          '<button class="btn btn-secondary" type="button" data-test-voice="dlg">' +
            ui.icon('volume') + 'Hear sample (“Salama tompoko! Manao ahoana?”)</button>' +
          '<button class="btn btn-quiet" type="button" data-test-voice="salama">' +
            ui.icon('volume') + 'Hear “Salama”</button>' +
          '<button class="btn btn-quiet" type="button" data-test-voice="misaotra">' +
            ui.icon('volume') + 'Hear “Misaotra betsaka”</button>' +
        '</div>' +
      '</div>' +

      '<h2>Your data</h2>' +
      '<div class="panel">' +
        '<p>Progress is stored in this browser only — ' +
          ui.plural(core.sessionDoneCount(), 'session') + ', ' +
          ui.plural(Object.keys(core.state.cards).length, 'word') + ' and ' +
          ui.plural(core.state.quizzes.length, 'quiz', 'quizzes') + '.</p>' +
        '<div class="btn-row">' +
          '<button class="btn btn-secondary" type="button" data-export="true">' +
            ui.icon('download') + 'Export progress</button>' +
          '<label class="btn btn-secondary" for="importFile">' +
            ui.icon('download') + 'Restore from file</label>' +
          '<input type="file" id="importFile" accept="application/json,.json" hidden>' +
          '<button class="btn btn-danger" type="button" data-reset="true">' +
            ui.icon('trash') + 'Reset everything</button>' +
        '</div>' +
        '<p class="meta" id="resetNote" hidden>Tap reset once more to erase all progress on this device.</p>' +

        '<details class="advanced-lock-details" id="editorModeDetails" style="margin-top:18px"' + ((advOpen || prefs.showInlineEdit) ? ' open' : '') + '>' +
          '<summary class="advanced-lock-summary">\uD83D\uDD12 Advanced options \u2014 Editor Mode (Malagasy &amp; phonetics)</summary>' +
          '<div class="advanced-lock-body">' +
            '<div class="setting" style="padding-top:0">' +
              '<div>' +
                '<div class="k">Editor Mode \u2014 Switch inline \u270E Edit &amp; course lesson editing On or Off</div>' +
                '<div class="h">When <strong>On</strong>, every word, dialogue, and roleplay card shows the direct <strong>\u270E Edit</strong> button and each course lesson shows the <strong>\u270E Manual edits (this lesson)</strong> drawer. Keep <strong>Off</strong> so only you (the editor) see and trigger edits.</div>' +
              '</div>' +
              '<button class="btn ' + (prefs.showInlineEdit ? '' : 'btn-quiet') + '" type="button" data-inline-edit="true" aria-pressed="' +
                (prefs.showInlineEdit ? 'true' : 'false') + '">' + (prefs.showInlineEdit ? '\u270E Edit Mode: On' : 'Edit Mode: Off') + '</button>' +
            '</div>' +
            '<p class="meta" style="margin:10px 0">Saved on this device: <strong>' + (core.editCount ? core.editCount() : 0) + ' ' + ui.plural(core.editCount ? core.editCount() : 0, 'manual edit') + '</strong>.</p>' +
            '<div class="btn-row" style="margin-top:8px">' +
              (function () {
                var cs = (core.currentSession && core.currentSession()) || core.session('w1s1');
                return cs
                  ? '<a class="btn btn-sm" href="#/edit/session/' + ui.esc(cs.id) + '">\u270E Edit Current Course Lesson (W' + cs.week + ' \u00b7 S' + cs.number + ')</a>'
                  : '<a class="btn btn-sm" href="#/edit">\u270E Open Malagasy &amp; Phonetics Editor</a>';
              })() +
              '<a class="btn btn-secondary btn-sm" href="#/record/fahasalamana">\u25CF Record My Voice</a>' +
              '<a class="btn btn-secondary btn-sm" href="#/edit/words">\u270E Open Full Dictionary Editor</a>' +
              '<a class="btn btn-secondary btn-sm" href="PROOFREAD.html">Open proofread sheet</a>' +
              '<button class="btn btn-secondary btn-sm" type="button" data-export-edits="true">' +
                ui.icon('download') + 'Export edits (.tsv)</button>' +
            '</div>' +
            '<div style="margin-top:14px;padding-top:12px;border-top:1px dashed var(--line)">' +
              '<label class="advanced-unlock-label">' +
                '<input type="checkbox" id="unlockResetEdits"> ' +
                '<span>Unlock manual-edits reset (protects custom Malagasy &amp; phonetic edits)</span>' +
              '</label>' +
              '<div style="margin-top:8px">' +
                '<button class="btn btn-danger btn-sm" type="button" id="resetEditsBtn" data-reset-edits="true" disabled>' +
                  '\uD83D\uDD12 Locked \u2014 Reset all manual edits</button>' +
              '</div>' +
              '<p class="meta" id="resetEditsNote" hidden style="margin-top:8px;color:#c93b2b;font-weight:700">Tap once more to permanently clear all manual edits on this device.</p>' +
            '</div>' +
          '</div>' +
        '</details>' +
      '</div>' +

      '<h2>About</h2>' +
      '<div class="panel">' +
        '<p><strong>Salama!</strong> — part of the Vahiny Mianatra Malagasy project. ' +
          '12 weeks, 36 sessions, 2478 dictionary entries, 717 phrases and 33 dialogues. Version 3.1.</p>' +
        '<p>Salama! is an independent learning product. Its lessons, structure and design are original.</p>' +
      '</div>' +
      '</div>';
  }

  function mount(root) {
    var scope = root.querySelector('.view-narrow') || root;
    var resetArmed = false;
    var resetEditsArmed = false;
    var edDetails = scope.querySelector && scope.querySelector('#editorModeDetails');
    if (edDetails && edDetails.addEventListener) {
      edDetails.addEventListener('toggle', function () {
        advOpen = Boolean(edDetails.open);
      });
    }

    scope.addEventListener('change', function (event) {
      if (event.target.id === 'unlockResetEdits') {
        var btn = scope.querySelector('#resetEditsBtn');
        var note = scope.querySelector('#resetEditsNote');
        resetEditsArmed = false;
        if (note) note.hidden = true;
        if (btn) {
          btn.disabled = !event.target.checked;
          btn.textContent = event.target.checked
            ? 'Reset all manual edits'
            : '\uD83D\uDD12 Locked \u2014 Reset all manual edits';
        }
        return;
      }
      if (event.target.id === 'voiceURI') {
        core.setPref('voiceURI', event.target.value);
        ui.toast(event.target.value ? 'Voice changed.' : 'Using the automatic voice.');
        rerender();
      }
      if (event.target.id === 'ttsGatewayUrl') {
        core.setPref('ttsGatewayUrl', event.target.value.trim());
        ui.toast('Saved TTS gateway URL.');
      }
      if (event.target.id === 'ttsApiKey') {
        core.setPref('ttsApiKey', event.target.value.trim());
        ui.toast('Saved TTS API key locally.');
      }
      if (event.target.id === 'importFile') {
        var file = event.target.files && event.target.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function () {
          try {
            var summary = core.importData(String(reader.result));
            ui.toast('Restored ' + ui.plural(summary.words, 'word') + ' and ' +
              ui.plural(summary.sessions, 'session') + '.');
            rerender();
          } catch (error) {
            ui.toast(error.message || 'That file could not be read.');
          }
        };
        reader.readAsText(file);
      }
    });

    scope.addEventListener('click', function (event) {
      var recBtn = event.target.closest('[data-recorded-voice]');
      if (recBtn) {
        var v = recBtn.getAttribute('data-recorded-voice');
        core.setPref('recordedVoice', v);
        ui.toast('Voice set to ' + v + '.');
        rerender();
        return;
      }
      var dirBtn = event.target.closest('[data-direction]');
      if (dirBtn) {
        core.setPref('direction', dirBtn.getAttribute('data-direction'));
        rerender();
        return;
      }
      var palBtn = event.target.closest('[data-palette]');
      if (palBtn) {
        core.setPref('palette', palBtn.getAttribute('data-palette'));
        rerender();
        return;
      }
      var fontBtn = event.target.closest('[data-font]');
      if (fontBtn) {
        core.setPref('font', fontBtn.getAttribute('data-font'));
        rerender();
        return;
      }
      var modeBtn = event.target.closest('[data-mode]');
      if (modeBtn) {
        core.setPref('mode', modeBtn.getAttribute('data-mode'));
        rerender();
        return;
      }
      var size = event.target.closest('[data-textsize]');
      if (size) {
        core.setPref('textsize', Number(size.getAttribute('data-textsize')));
        rerender();
        return;
      }
      var rate = event.target.closest('[data-rate]');
      if (rate) {
        core.setPref('rate', Number(rate.getAttribute('data-rate')));
        rerender();
        return;
      }
      if (event.target.closest('[data-autoplay]')) {
        core.setPref('autoplay', !core.state.prefs.autoplay);
        rerender();
        return;
      }
      if (event.target.closest('[data-syllables]')) {
        core.setPref('syllables', !core.state.prefs.syllables);
        rerender();
        return;
      }
      if (event.target.closest('[data-inline-edit]')) {
        advOpen = true;
        var nextEdit = !core.state.prefs.showInlineEdit;
        core.setPref('showInlineEdit', nextEdit);
        ui.toast(nextEdit ? 'Editor Mode ON \u2014 \u270E Edit buttons are now visible on cards & lessons.' : 'Editor Mode OFF \u2014 \u270E Edit buttons are now hidden.');
        rerender();
        return;
      }
      var test = event.target.closest('[data-test-voice]');
      if (test) {
        var which = test.getAttribute('data-test-voice');
        if (which === 'salama') {
          speech.play('media/audio_abidi/words/salama.mp3', { node: test });
        } else if (which === 'misaotra') {
          speech.play('media/audio_abidi/words/misaotra-betsaka.mp3', { node: test });
        } else {
          speech.play('media/audio_abidi/lines/dlg-introducing-yourself-0.mp3', { node: test });
        }
        return;
      }
      if (event.target.closest('[data-export]')) {
        core.exportData();
        ui.toast('Progress file downloaded.');
        return;
      }
      if (event.target.closest('[data-export-edits]')) {
        var count = core.exportEditsTSV ? core.exportEditsTSV() : 0;
        if (!count) ui.toast('No manual edits to export yet.');
        else ui.toast('Exported ' + count + ' manual edit(s) to salama_corrections.tsv.');
        return;
      }
      var resetEditsBtn = event.target.closest('[data-reset-edits]');
      if (resetEditsBtn) {
        var unlockBox = scope.querySelector('#unlockResetEdits');
        if (!unlockBox || !unlockBox.checked || resetEditsBtn.disabled) {
          ui.toast('Reset is locked under Advanced options.');
          return;
        }
        if (!resetEditsArmed) {
          resetEditsArmed = true;
          var eNote = scope.querySelector('#resetEditsNote');
          if (eNote) eNote.hidden = false;
          resetEditsBtn.textContent = 'Confirm: Reset all manual edits';
          return;
        }
        if (core.resetAllEdits) core.resetAllEdits();
        ui.toast('All manual edits cleared.');
        rerender();
        return;
      }
      var reset = event.target.closest('[data-reset]');
      if (reset) {
        if (!resetArmed) {
          resetArmed = true;
          var note = scope.querySelector('#resetNote');
          if (note) note.hidden = false;
          reset.textContent = 'Confirm reset';
          return;
        }
        core.resetData();
        ui.toast('Progress reset.');
        rerender();
      }
    });
  }

  function rerender() {
    var main = document.getElementById('main');
    main.innerHTML = render();
    mount(main);
    document.dispatchEvent(new CustomEvent('salama:prefs'));
  }

  S.views = S.views || {};
  S.views.settings = { render: render, mount: mount, nav: 'settings' };
})(window.Salama);
