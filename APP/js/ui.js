/* ============================================================
   UI helpers: escaping, inline icons, toast, small formatting,
   and inline manual editing for Malagasy & phonetics.
   ============================================================ */
window.Salama = window.Salama || {};
(function (S) {
  'use strict';

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /** Malagasy text is marked up with its own language so screen readers and
   *  browser speech engines do not read it as English. */
  function mg(value) {
    return '<span lang="mg">' + esc(value) + '</span>';
  }

  function icon(name, cls) {
    return '<svg class="icon ' + (cls || '') + '" aria-hidden="true" focusable="false">' +
      '<use href="#i-' + name + '"></use></svg>';
  }

  function norm(value) {
    return String(value == null ? '' : value)
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  var toastTimer = null;
  function toast(message) {
    var node = document.getElementById('toast');
    if (!node) {
      node = document.createElement('div');
      node.id = 'toast';
      node.className = 'toast';
      node.setAttribute('role', 'status');
      document.body.appendChild(node);
    }
    node.textContent = message;
    node.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { node.hidden = true; }, 2800);
  }

  /** Label for a pronunciation: machine guess, or checked/edited by the reviewer. */
  function pronunciationTag(item) {
    if (!item) return '';
    if (item.pron_edited) {
      return ' <span class="checked" title="Manually edited">' +
        '\u2713 edited</span>';
    }
    if (item.pron_verified) {
      return ' <span class="checked" title="Approved by a native speaker">' +
        '\u2713 checked</span>';
    }
    return item.pron_approx ? ' <span class="approx">(approx.)</span>' : '';
  }

  /** "sah-LAH-mah" plus an honest label for generated respellings. */
  function pronunciation(word, options) {
    if (!word || !word.pron) return '';
    var label = pronunciationTag(word);
    var opts = options || {};
    var prefix = opts.prefix !== undefined ? opts.prefix : '<span class="say-label">Phonetic:</span> ';
    return '<p class="say">' + prefix + esc(word.pron) + label + '</p>';
  }

  function plural(count, one, many) {
    return count === 1 ? one : (many || one + 's');
  }

  var REFERENCE_TABS = [
    { id: 'words', title: 'Dictionary' },
    { id: 'phrases', title: 'Phrases & dialogues' },
    { id: 'grammar', title: 'Grammar' },
    { id: 'culture', title: 'Culture' },
    { id: 'sayit', title: 'How to say it' }
  ];

  function referenceTabs(active) {
    return '<nav class="tabs" aria-label="Reference">' + REFERENCE_TABS.map(function (tab) {
      return '<a href="#/reference/' + tab.id + '"' +
        (tab.id === active ? ' aria-current="page"' : '') + '>' + tab.title + '</a>';
    }).join('') + '</nav>';
  }

  var PRACTICE_TABS = [
    { id: 'review', href: '#/review', title: 'Flashcard review' },
    { id: 'quiz', href: '#/quiz', title: 'Multiple-choice quiz' }
  ];

  function practiceTabs(active) {
    return '<nav class="tabs" aria-label="Practice">' + PRACTICE_TABS.map(function (tab) {
      return '<a href="' + tab.href + '"' +
        (tab.id === active ? ' aria-current="page"' : '') + '>' + tab.title + '</a>';
    }).join('') + '</nav>';
  }

  var SESSION_PHOTOS = [
    'img/highlands.jpg',
    'img/baobab-sunset.jpg',
    'img/tana-2.jpg',
    'img/tana-1.jpg',
    'img/rice-terraces.jpg',
    'img/baobab-avenue.jpg',
    'img/baobab-portrait.jpg'
  ];

  function photoForIndex(n) {
    return SESSION_PHOTOS[Math.abs(Number(n) || 0) % SESSION_PHOTOS.length];
  }

  var CULTURE_FEATURES = [
    { id: 'fady', title: 'Fady', sub: 'Taboos', img: 'img/baobab-portrait.jpg', body: 'Fady are ancestral prohibitions. A food, a day, an animal, a place or a gesture can be fady \u2014 for a region, a village or a single family. Common examples: pointing at a tomb with an outstretched finger (use a bent finger), eating pork in some areas, or bathing in certain lakes. Always ask: \u201cMisy fady ve eto?\u201d' },
    { id: 'kabary', title: 'Kabary', sub: 'The art of speech', img: 'img/highlands.jpg', body: 'Kabary began as highly poetic public oratory, rich in proverbs. Today it shapes weddings, funerals and festivals \u2014 and, informally, a guest and host may each give a short kabary of thanks and welcome.' },
    { id: 'hospitality', title: 'Fandraisana', sub: 'Hospitality', img: 'img/rice-terraces.jpg', body: '\u201cValala iray ifanapahana\u201d \u2014 we can share one cricket. If guests arrive at mealtime they are fed, even if it means cooking again. If they are about to leave before the meal, they\u2019ll hear \u201cMiandrasa sakafo!\u201d \u2014 wait for the food.' },
    { id: 'respect', title: 'Fanajana', sub: 'Respect', img: 'img/tana-1.jpg', body: 'Add tompoko when addressing elders or people in authority. Give and receive with both hands. Walking past people, bow slightly with your right hand forward and say \u201cazafady\u201d.' },
    { id: 'dialects', title: 'Fitenim-paritra', sub: 'Dialects & Official Malagasy', img: 'img/baobab-avenue.jpg', body: 'Madagascar has 18 ethnic groups across 22 regions. Official Malagasy (based on the highland Merina variety) is taught in schools and understood everywhere \u2014 making it the best foundation wherever you travel.' },
    { id: 'markets', title: 'Tsena', sub: 'Daily Markets', img: 'img/tana-2.jpg', body: 'Open-air markets (tsena) are the heartbeat of towns from Antananarivo to rural communes. Vendors call out \u201cMandrosoa!\u201d and polite greetings always come before asking \u201cOhatrinona?\u201d (How much is it?).' },
    { id: 'baobab', title: 'Renala', sub: 'Mother of the Forest', img: 'img/baobab-sunset.jpg', body: 'Six of the world\u2019s nine baobab species are endemic to Madagascar, known in Malagasy as renala (\u201cmother of the forest\u201d).' }
  ];

  function resolveEditKey(text, opts) {
    var core = S.core;
    if (!core || !core.entryForKey) return '';
    if (opts && opts.editKey && core.entryForKey(opts.editKey)) return opts.editKey;
    if (opts && opts.wordId) {
      if (core.entryForKey('word:' + opts.wordId)) return 'word:' + opts.wordId;
      if (core.entryForKey('phrase:' + opts.wordId)) return 'phrase:' + opts.wordId;
    }
    if (opts && opts.phraseId && core.entryForKey('phrase:' + opts.phraseId)) {
      return 'phrase:' + opts.phraseId;
    }
    if (opts && opts.line && core.entryForKey('dlg:' + opts.line)) {
      return 'dlg:' + opts.line;
    }
    if (core.keyForText) {
      return core.keyForText(text) || '';
    }
    return '';
  }

  /* ---------------- speech + inline edit controls ---------------- */
  function speakButtons(text, options) {
    var opts = options || {};
    var extra = (opts.wordId ? ' data-word-id="' + esc(opts.wordId) + '"' : '') +
                (opts.line ? ' data-line="' + esc(opts.line) + '"' : '');
    var recKey = resolveEditKey(text, opts) || (opts.wordId ? 'word:' + opts.wordId : (opts.line ? 'dlg:' + opts.line : ''));
    var hasCustom = Boolean(S.speech && S.speech.hasCustomAudio && S.speech.hasCustomAudio(recKey, text));
    var label = opts.label || (hasCustom ? 'Hear My Voice' : 'Hear it');
    var showEdit = Boolean(S.core && S.core.state && S.core.state.prefs && S.core.state.prefs.showInlineEdit);
    var editKey = showEdit ? recKey : '';
    var recBtn = recKey
      ? '<button class="icon-btn rec-btn" type="button" data-mic-record="' + esc(recKey) + '" style="border-color:#c93b2b;color:#c93b2b;font-weight:700" title="Record your voice for this word">\u25CF<span>' + (hasCustom ? 'Re-record' : 'Record') + '</span></button>' +
        (hasCustom ? '<button class="icon-btn" type="button" data-mic-download="' + esc(recKey) + '" title="Download your .wav recording">\u2B07<span>.wav</span></button>' : '')
      : '';
    var editBtn = editKey
      ? '<button class="icon-btn edit-btn" type="button" data-edit-key="' + esc(editKey) + '" title="Edit Malagasy &amp; phonetics">\u270E<span>Edit</span></button>'
      : '';
    return '<button class="icon-btn hear-btn" type="button" data-speak="' + esc(text) + '"' + extra + '>' +
        icon('play') + '<span>' + esc(label) + '</span></button>' +
      '<button class="icon-btn slow" type="button" data-slow="' + esc(text) + '"' + extra + '>' +
        icon('volume') + '<span>Syllables</span></button>' +
      recBtn +
      editBtn;
  }

  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('salama:voices-loaded', function () {
      if (!S.speech || !S.speech.hasCustomAudio || !document.querySelectorAll) return;
      var recButtons = document.querySelectorAll('[data-mic-record]');
      for (var i = 0; i < recButtons.length; i++) {
        var rb = recButtons[i];
        var rk = rb.getAttribute('data-mic-record') || '';
        var parent = rb.parentElement;
        var hb = parent ? parent.querySelector('.hear-btn') : null;
        var txt = hb ? (hb.getAttribute('data-speak') || '') : '';
        if (S.speech.hasCustomAudio(rk, txt)) {
          var rSpan = rb.querySelector('span');
          if (rSpan && rSpan.textContent === 'Record') rSpan.textContent = 'Re-record';
          var hSpan = hb ? hb.querySelector('span') : null;
          if (hSpan && hSpan.textContent === 'Hear it') hSpan.textContent = 'Hear My Voice';
        }
      }
    });
  }

  /** True when a rendered clip exists, so the toast is not raised needlessly. */
  function hasClip(node) {
    var speech = S.speech;
    if (!speech || !S.core || !S.core.data) return false;
    var data = S.core.data;
    var wordId = node.getAttribute('data-word-id');
    if (wordId && ((data.wordAudio && data.wordAudio[wordId]) ||
                   (data.phraseAudio && data.phraseAudio[wordId]))) return true;
    var line = String(node.getAttribute('data-line') || '').split(':');
    if (line.length === 2 && data.lineAudio && data.lineAudio[line[0] + '-' + line[1]] !== undefined) return true;
    var text = node.getAttribute('data-speak') || node.getAttribute('data-slow') || '';
    if (text && speech.clipForText && speech.clipForText(text)) return true;
    return false;
  }

  function findCardContainer(node) {
    if (!node || !node.closest) return null;
    return node.closest('.entry, .turn, .word-focus, .review-card') || node.parentElement;
  }

  function updateCardDOM(container, item) {
    if (!container || !item) return;
    var mgNode = container.querySelector('.mg-line, .word, .line, .prompt[lang="mg"], .answer [lang="mg"]');
    if (mgNode) mgNode.textContent = item.mg || '';
    var sayNode = container.querySelector('.say');
    if (item.pron) {
      if (!sayNode && mgNode && mgNode.parentElement) {
        sayNode = document.createElement('p');
        sayNode.className = 'say';
        mgNode.insertAdjacentElement('afterend', sayNode);
      }
      if (sayNode) {
        sayNode.innerHTML = '<span class="say-label">Phonetic:</span> ' + esc(item.pron) + pronunciationTag(item);
      }
    } else if (sayNode) {
      sayNode.remove();
    }
    var speakNodes = container.querySelectorAll('[data-speak]');
    for (var i = 0; i < speakNodes.length; i++) {
      speakNodes[i].setAttribute('data-speak', item.mg || '');
    }
    var slowNodes = container.querySelectorAll('[data-slow]');
    for (var j = 0; j < slowNodes.length; j++) {
      slowNodes[j].setAttribute('data-slow', item.mg || '');
    }
  }

  function openInlineEditor(key, triggerNode) {
    var core = S.core;
    if (!core || !core.entryForKey) return false;
    var item = core.entryForKey(key);
    if (!item) return false;
    var container = findCardContainer(triggerNode);
    if (!container) return false;

    var existing = container.querySelector('.inline-edit-box');
    if (existing) {
      existing.remove();
      return true;
    }

    var box = document.createElement('div');
    box.className = 'inline-edit-box';
    box.setAttribute('data-editing-key', key);
    box.innerHTML =
      '<div class="inline-edit-fields">' +
        '<label class="inline-edit-field">' +
          '<span>Malagasy</span>' +
          '<input type="text" class="inline-edit-mg" lang="mg" value="' + esc(item.mg || '') + '">' +
        '</label>' +
        '<label class="inline-edit-field">' +
          '<span>Phonetics / pronunciation</span>' +
          '<input type="text" class="inline-edit-pron" placeholder="e.g. sah-LAH-mah" value="' + esc(item.pron || '') + '">' +
        '</label>' +
      '</div>' +
      '<div class="inline-edit-actions" style="flex-wrap:wrap">' +
        '<button class="btn btn-sm" type="button" data-edit-save="' + esc(key) + '">Save text</button>' +
        '<button class="btn btn-secondary btn-sm" type="button" data-inline-record-key="' + esc(key) + '">\u25CF<span>Record my voice</span></button>' +
        '<button class="btn btn-quiet btn-sm" type="button" data-inline-clear-voice="' + esc(key) + '"' + ((S.speech && S.speech.hasCustomAudio && S.speech.hasCustomAudio(key)) ? '' : ' hidden') + '>Reset voice</button>' +
        '<button class="btn btn-quiet btn-sm" type="button" data-edit-reset="' + esc(key) + '">Reset text</button>' +
        '<button class="btn btn-quiet btn-sm" type="button" data-edit-cancel="' + esc(key) + '">Cancel</button>' +
      '</div>';

    container.appendChild(box);
    var mgInput = box.querySelector('.inline-edit-mg');
    if (mgInput && mgInput.focus) mgInput.focus();

    box.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        var saveBtn = box.querySelector('[data-edit-save]');
        if (saveBtn) saveBtn.click();
      } else if (ev.key === 'Escape') {
        ev.preventDefault();
        box.remove();
      }
    });
    return true;
  }

  function handleEditInteraction(event) {
    if (!event || !event.target || !event.target.closest) return false;

    var saveBtn = event.target.closest('[data-edit-save]');
    if (saveBtn) {
      var saveKey = saveBtn.getAttribute('data-edit-save');
      var saveBox = saveBtn.closest('.inline-edit-box');
      var saveContainer = findCardContainer(saveBtn);
      if (saveBox && S.core && S.core.saveEdit) {
        var mgVal = (saveBox.querySelector('.inline-edit-mg') || {}).value || '';
        var pronVal = (saveBox.querySelector('.inline-edit-pron') || {}).value || '';
        S.core.saveEdit(saveKey, { mg: mgVal, pron: pronVal });
        var updatedItem = S.core.entryForKey(saveKey);
        updateCardDOM(saveContainer, updatedItem);
        saveBox.remove();
        toast('Saved Malagasy & phonetics.');
      }
      return true;
    }

    var resetBtn = event.target.closest('[data-edit-reset]');
    if (resetBtn) {
      var resetKey = resetBtn.getAttribute('data-edit-reset');
      var resetBox = resetBtn.closest('.inline-edit-box');
      var resetContainer = findCardContainer(resetBtn);
      if (S.core && S.core.resetEdit) {
        S.core.resetEdit(resetKey);
        var origItem = S.core.entryForKey(resetKey);
        updateCardDOM(resetContainer, origItem);
        if (resetBox) resetBox.remove();
        toast('Restored original Malagasy & phonetics.');
      }
      return true;
    }

    var cancelBtn = event.target.closest('[data-edit-cancel]');
    if (cancelBtn) {
      var cancelBox = cancelBtn.closest('.inline-edit-box');
      if (cancelBox) cancelBox.remove();
      return true;
    }

    var recBtn = event.target.closest('[data-inline-record-key]');
    if (recBtn) {
      var recKey = recBtn.getAttribute('data-inline-record-key');
      if (S.speech && S.speech.toggleMicRecording) {
        S.speech.toggleMicRecording(recKey, recBtn, function () {
          var boxNode = recBtn.closest('.inline-edit-box');
          var clrNode = boxNode ? boxNode.querySelector('[data-inline-clear-voice]') : null;
          if (clrNode) clrNode.hidden = false;
        });
      }
      return true;
    }

    var clrVoiceBtn = event.target.closest('[data-inline-clear-voice]');
    if (clrVoiceBtn) {
      var clrKey = clrVoiceBtn.getAttribute('data-inline-clear-voice');
      if (S.speech && S.speech.removeCustomAudio) {
        S.speech.removeCustomAudio(clrKey, function () {
          clrVoiceBtn.hidden = true;
          toast('Restored default audio recording.');
        });
      }
      return true;
    }

    // Ignore clicks inside an open inline editor's inputs
    if (event.target.closest('.inline-edit-box')) {
      return true;
    }

    var editBtn = event.target.closest('[data-edit-key]');
    if (editBtn) {
      var key = editBtn.getAttribute('data-edit-key');
      return openInlineEditor(key, editBtn);
    }

    // Also allow clicking directly on the Malagasy or Phonetics text in a card
    // that has an edit button!
    var textClick = event.target.closest('.mg-line, .word, .line, .say');
    if (textClick) {
      var card = findCardContainer(textClick);
      var cardEditBtn = card && card.querySelector ? card.querySelector('[data-edit-key]') : null;
      if (cardEditBtn) {
        return openInlineEditor(cardEditBtn.getAttribute('data-edit-key'), cardEditBtn);
      }
    }

    return false;
  }

  /**
   * Speak whatever a pressed control asks for, or handle inline editing.
   * Returns true when the event was handled, so views can `if (ui.speakFrom(event)) return;`.
   */
  function speakFrom(event) {
    if (handleEditInteraction(event)) return true;
    var micBtn = event.target && event.target.closest ? event.target.closest('[data-mic-record]') : null;
    if (micBtn) {
      var mKey = micBtn.getAttribute('data-mic-record');
      if (S.speech && S.speech.toggleMicRecording) {
        S.speech.toggleMicRecording(mKey, micBtn, function () {
          var toolsWrap = micBtn.parentElement;
          if (toolsWrap && !toolsWrap.querySelector('[data-mic-download]')) {
            var dl = document.createElement('button');
            dl.className = 'icon-btn';
            dl.type = 'button';
            dl.setAttribute('data-mic-download', mKey);
            dl.title = 'Download your .wav recording';
            dl.innerHTML = '\u2B07<span>.wav</span>';
            micBtn.insertAdjacentElement('afterend', dl);
          }
          var hearSpan = toolsWrap && toolsWrap.querySelector('.hear-btn span');
          if (hearSpan) hearSpan.textContent = 'Hear My Voice';
        });
      }
      return true;
    }
    var dlBtn = event.target && event.target.closest ? event.target.closest('[data-mic-download]') : null;
    if (dlBtn) {
      var dKey = dlBtn.getAttribute('data-mic-download');
      if (S.speech && S.speech.downloadCustomWav) {
        S.speech.downloadCustomWav(dKey);
      }
      return true;
    }
    var node = event.target.closest('[data-speak],[data-slow]');
    if (!node) return false;
    var speech = S.speech;
    var slow = node.hasAttribute('data-slow');
    var text = node.getAttribute(slow ? 'data-slow' : 'data-speak');
    var options = { node: node };
    if (slow) { options.syllables = true; options.slow = true; }

    if (!speech.ttsAvailable() && !hasClip(node)) {
      toast('No speech voice is available in this browser.');
      return true;
    }
    var wordId = node.getAttribute('data-word-id');
    if (wordId) {
      if (speech.speakWordId(wordId, options)) return true;
    }
    var line = String(node.getAttribute('data-line') || '').split(':');
    if (line.length === 2) {
      if (speech.speakLine(line[0], Number(line[1]), text, options)) return true;
    }
    if (S.core && S.core.keyForText) {
      var resolvedKey = S.core.keyForText(text);
      if (resolvedKey) {
        var kParts = String(resolvedKey).split(':');
        var resolvedId = kParts.length > 1 ? kParts.slice(1).join(':') : kParts[0];
        if (speech.speakWordId(resolvedId, options)) return true;
      }
    }
    speech.speak(text, options);
    return true;
  }

  S.ui = {
    esc: esc,
    mg: mg,
    icon: icon,
    norm: norm,
    toast: toast,
    pronunciation: pronunciation,
    pronunciationTag: pronunciationTag,
    plural: plural,
    referenceTabs: referenceTabs,
    practiceTabs: practiceTabs,
    photoForIndex: photoForIndex,
    SESSION_PHOTOS: SESSION_PHOTOS,
    CULTURE_FEATURES: CULTURE_FEATURES,
    speakButtons: speakButtons,
    speakFrom: speakFrom
  };
})(window.Salama);
