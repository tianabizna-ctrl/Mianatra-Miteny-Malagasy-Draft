/* ============================================================
   Speech: recorded clips first, then a Malagasy-aware fallback voice.

   Malagasy has no installed system voice on any current phone or
   desktop. This module therefore does three things, in order:

   1. Plays a rendered Malagasy clip if one exists
      (CONTENT.wordAudio / CONTENT.lineAudio, produced by
      RESEARCH/render_audio.py from the facebook/mms-tts-mlg model).
   2. Otherwise rewrites the word into the spelling of the closest
      installed voice and speaks it syllable by syllable.
   3. Never pretends any of this is a native recording: the UI marks
      generated pronunciations as "approx.".

   The rewrite tables are duplicated in RESEARCH/pronunciation.py
   (ADAPTERS). RESEARCH/check_parity.py fails if the two disagree, so
   change them together.
   ============================================================ */
window.Salama = window.Salama || {};
(function (S) {
  'use strict';

  var synth = 'speechSynthesis' in window ? window.speechSynthesis : null;
  var voices = [];
  var currentAudio = null;
  var currentButton = null;

  /* ---------------- fallback voices, best first ----------------
     Matches VOICE_PRIORITY in pronunciation.py. Romanian is ahead of
     Italian on purpose: it pronounces h, has /ts/ (ț), no nasal vowels,
     and weak final vowels like Malagasy. Spanish is last-but-one because
     its h is silent, which deletes a real Malagasy consonant. */
  var VOICE_PRIORITY = ['mg', 'fr', 'ro', 'it', 'es', 'pt', 'ca', 'en'];

  /* ---------------- adaptation tables (mirror of ADAPTERS) ---------------- */
  var DIPHTHONGS = ['ao', 'ai', 'ay', 'ei', 'ou', 'au', 'oi'];
  var VOWELS = 'aeiouy';
  // Words where a written "ao" spans a syllable boundary (va-o-va-o). Kept in
  // step with HIATUS_AO in pronunciation.py — check_parity.py enforces it.
  var HIATUS_AO = { vaovao: true };

  function isNucleusPair(word, pair) {
    if (DIPHTHONGS.indexOf(pair) === -1) return false;
    if (pair === 'ao' && HIATUS_AO[word]) return false;
    return true;
  }

  var ADAPTERS = {
    fr: { ao: 'ô', oa: 'o-a', ai: 'aï', ay: 'aï', ei: 'é-i', oi: 'o-i',
          ou: 'o-u', au: 'a-ou', j: 'dz', y: 'i', o: 'ou', e: 'é' },
    ro: { ao: 'o', oa: 'o-a', ai: 'ai', ay: 'ai', ei: 'e-i', oi: 'o-i',
          ou: 'o-u', au: 'au', j: 'dz', ts: 'ț', y: 'i', o: 'u', e: 'e' },
    it: { ao: 'ò', oa: 'o-a', ai: 'ai', ay: 'ai', ei: 'e-i', oi: 'o-i',
          ou: 'o-u', au: 'au', j: 'dz', y: 'i', o: 'u', e: 'e' },
    es: { ao: 'o', oa: 'o-a', ai: 'ai', ay: 'ai', ei: 'e-i', oi: 'o-i',
          ou: 'o-u', au: 'au', j: 'dz', y: 'i', o: 'u', e: 'e' },
    ca: { ao: 'o', oa: 'o-a', ai: 'ai', ay: 'ai', ei: 'e-i', oi: 'o-i',
          ou: 'o-u', au: 'au', j: 'tz', ts: 'ts', y: 'i', o: 'u', e: 'e' },
    pt: { ao: 'o', oa: 'o-a', ai: 'ai', ay: 'ai', ei: 'ei', oi: 'oi',
          ou: 'o-u', au: 'au', j: 'dz', ts: 'ts', y: 'i', o: 'u', e: 'ê' },
    en: { ao: 'oh', oa: 'oo-ah', ai: 'eye', ay: 'eye', ei: 'ay-ee', oi: 'oy',
          ou: 'oh', au: 'ow', j: 'dz', y: 'ee', o: 'oo', e: 'eh' }
  };

  /* ---------------- spelling helpers ---------------- */
  function syllabify(word) {
    var syllables = [], current = '', i = 0, w = String(word || '').toLowerCase();
    while (i < w.length) {
      var ch = w[i];
      if (VOWELS.indexOf(ch) !== -1) {
        var nucleus = ch;
        var pair = w.substr(i, 2);
        if (pair.length === 2 && isNucleusPair(w, pair)) {
          nucleus = pair;
          i += 1;
        }
        current += nucleus;
        syllables.push(current);
        current = '';
      } else {
        current += ch;
      }
      i += 1;
    }
    if (current) {
      if (syllables.length) syllables[syllables.length - 1] += current;
      else syllables.push(current);
    }
    // Keep the nasal of a prenasalised cluster with the previous vowel:
    // an-ta-na-na-ri-vo, tron-dro. "ng" is not one of these — it is a velar
    // digraph and stays an onset (ma-nga-tsia-ka, to-nga).
    for (var n = 1; n < syllables.length; n += 1) {
      var m = /^(n|m)(?=[ptkbd]|ts|tr|dr)/.exec(syllables[n]);
      if (m && syllables[n - 1] && VOWELS.indexOf(syllables[n - 1].slice(-1)) !== -1) {
        syllables[n - 1] += m[1];
        syllables[n] = syllables[n].slice(1);
      }
    }
    return syllables.filter(Boolean);
  }

  // Malagasy s is always [s]; French and Italian read one s between vowels as
  // [z] (misaotra -> [miz…]). Double it before adapting.
  function hardenS(word) {
    return word.replace(/([aeiouy])s(?=[aeiouy])/g, '$1ss');
  }

  function applyMap(syllable, table) {
    // Malagasy g is always hard; French/Italian/Portuguese soften it before
    // e, i, y (gidro -> [ʒidʁo]). The silent u has to sit inside the syllable
    // or the hyphenation would split it away.
    if (/^g[eiy]/.test(syllable)) syllable = 'gu' + syllable.slice(1);
    var keys = Object.keys(table).sort(function (a, b) { return b.length - a.length; });
    var out = '', i = 0;
    while (i < syllable.length) {
      var hit = null;
      for (var k = 0; k < keys.length; k += 1) {
        if (syllable.substr(i, keys[k].length) === keys[k]) { hit = keys[k]; break; }
      }
      if (hit) { out += table[hit]; i += hit.length; }
      else { out += syllable[i]; i += 1; }
    }
    return out;
  }

  /**
   * Rewrite Malagasy into the orthography of a fallback voice, one syllable at
   * a time. The hyphens are the point: they stop a French voice turning
   * "an/on/in" into a nasal vowel and swallowing a final -e, which is what
   * made "Antananarivo" unrecognisable. Returns the text unchanged for a real
   * Malagasy voice or an unknown language.
   */
  function adapt(text, lang) {
    if (!text) return text || '';
    var code = String(lang || '').toLowerCase().replace('_', '-').slice(0, 2);
    if (code === 'mg') return text;
    var table = ADAPTERS[code];
    if (!table) return text;
    var pieces = String(text).toLowerCase().split(/([^a-z]+)/);
    return pieces.map(function (piece) {
      if (!piece || !/[a-z]/.test(piece)) return piece;
      var syllables = syllabify(hardenS(piece));
      if (!syllables.length) return piece;
      return syllables.map(function (s) { return applyMap(s, table); }).join('-');
    }).join('');
  }

  /* ---------------- voice selection ---------------- */
  function loadVoices() {
    try { voices = synth ? synth.getVoices() : []; } catch (e) { voices = []; }
  }

  if (synth) {
    loadVoices();
    if (typeof synth.addEventListener === 'function') {
      synth.addEventListener('voiceschanged', loadVoices);
    }
    // Some browsers fill the list late without ever firing the event, which
    // used to make the app claim no voice was installed.
    setTimeout(loadVoices, 400);
    setTimeout(loadVoices, 1500);
  }

  function codeOf(voice) {
    return String((voice && voice.lang) || '').toLowerCase().slice(0, 2);
  }

  function rank(voice) {
    var index = VOICE_PRIORITY.indexOf(codeOf(voice));
    if (index === -1) return 999;
    var name = String(voice.name || '').toLowerCase();
    // Prefer the higher-quality voice when a language has several.
    return index + (/google|natural|neural|premium|enhanced/.test(name) ? -0.5 : 0);
  }

  function prefs() {
    return (S.core && S.core.state && S.core.state.prefs) || {};
  }

  function pickVoice() {
    if (!voices.length) loadVoices();
    var wanted = prefs().voiceURI;
    if (wanted) {
      for (var p = 0; p < voices.length; p += 1) {
        if (voices[p].voiceURI === wanted) return voices[p];
      }
    }
    if (!voices.length) return null;
    var sorted = voices.slice().sort(function (a, b) { return rank(a) - rank(b); });
    return rank(sorted[0]) < 999 ? sorted[0] : null;
  }

  function ttsAvailable() { return Boolean(synth); }

  function stopAll() {
    if (synth) { try { synth.cancel(); } catch (e) { /* ignore */ } }
    if (currentAudio) {
      try { currentAudio.pause(); } catch (e) { /* ignore */ }
      currentAudio = null;
    }
    clearButton();
  }

  /* ---------------- button state ---------------- */
  // Screen readers get told what is happening; sighted users get a pulse.
  function markButton(node) {
    clearButton();
    if (!node || !node.classList) return;
    currentButton = node;
    node.setAttribute('data-speaking', 'true');
  }

  function clearButton() {
    if (currentButton && currentButton.removeAttribute) {
      currentButton.removeAttribute('data-speaking');
    }
    currentButton = null;
  }

  /* ---------------- speaking ---------------- */
  // Chrome stops an utterance after ~15 s and swallows the tail, so long
  // phrases are queued sentence by sentence. No lookbehind in the regex:
  // older iPad Safari (a likely device here) does not support it.
  function chunk(text) {
    var parts = String(text).match(/[^.!?;:]+[.!?;:]*/g) || [String(text)];
    if (parts.length === 1 && String(text).length > 160) {
      parts = String(text).split(/,\s+/);
    }
    return parts.map(function (part) { return part.trim(); }).filter(Boolean);
  }

  function utter(textToSay, voice, rate) {
    var utterance = new SpeechSynthesisUtterance(textToSay);
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    } else {
      utterance.lang = 'fr-FR';
    }
    utterance.rate = rate;
    utterance.pitch = 1;
    utterance.onend = clearButton;
    utterance.onerror = clearButton;
    synth.speak(utterance);
  }

  /**
   * Speak Malagasy text with the best installed voice.
   * options: { slow, syllables, rate, lang, node, onEnd, onError }
   *   slow      — 0.6 instead of the default rate
   *   syllables — say one syllable at a time with a small gap, so the learner
   *               hears the shape of the word even when the vowels are off
   *   node      — button to mark while speaking
   */
  function speak(text, options) {
    if (!text) return false;
    var opts = options || {};
    if (!opts.forceSynth) {
      var recorded = clipForText(text);
      if (recorded) {
        var played = play(recorded, opts);
        if (played) return true;
      }
    }
    if (!synth) return false;
    var preference = prefs();
    try {
      if (currentAudio) { currentAudio.pause(); currentAudio = null; }
      synth.cancel();
      var voice = pickVoice();
      var code = opts.lang || (voice ? codeOf(voice) : 'fr');
      var baseRate = Number(opts.rate || preference.rate || 0.82);
      var rate = opts.slow ? Math.max(0.4, baseRate * 0.72) : baseRate;
      var line = adapt(String(text), code);
      var useSyllables = opts.syllables || (preference.syllables && /\s/.test(line) === false);

      markButton(opts.node);
      // Several Android builds drop an utterance queued in the same tick as
      // cancel(); one macrotask of breathing room fixes it.
      setTimeout(function () {
        if (useSyllables) {
          var bits = line.split('-').filter(Boolean);
          bits.forEach(function (bit, index) {
            utter(bit + (index === bits.length - 1 ? '.' : ','), voice, rate * 0.8);
          });
          return;
        }
        var parts = chunk(line);
        parts.forEach(function (part) { utter(part, voice, rate); });
      }, 30);
      return true;
    } catch (e) {
      clearButton();
      if (opts.onError) opts.onError(e);
      return false;
    }
  }

  /* ---------------- recordings ---------------- */
  var EXTRA_TEXT_CLIPS = {
    'drafitra': 'media/audio_abidi/words/drafitra.mp3',
    'onja': 'media/audio_abidi/words/onja.mp3',
    'manana ve ianao': 'media/audio_abidi/phrases/manana-ve-ianao.mp3',
    'misaotra betsaka tompoko': 'media/audio_abidi/words/misaotra-betsaka.mp3',
    'mpampianatra aho': 'media/audio_abidi/phrases/gram-mpampianatra-aho.mp3',
    'mihinana vary aho': 'media/audio_abidi/phrases/gram-mihinana-vary-aho.mp3',
    'tsy mihinana hena aho': 'media/audio_abidi/phrases/gram-tsy-mihinana-hena-aho.mp3',
    'nihinana vary aho': 'media/audio_abidi/phrases/gram-nihinana-vary-aho.mp3',
    'hihinana vary aho': 'media/audio_abidi/phrases/gram-hihinana-vary-aho.mp3',
    'amerikana ve ianao': 'media/audio_abidi/phrases/gram-amerikana-ve-ianao.mp3',
    'trano lehibe': 'media/audio_abidi/phrases/gram-trano-lehibe.mp3',
    'trano kely': 'media/audio_abidi/phrases/gram-trano-kely.mp3',
    'isika no miara mianatra': 'media/audio_abidi/phrases/gram-isika-no-miara-mianatra.mp3',
    'inona io': 'media/audio_abidi/phrases/gram-inona-io.mp3',
    'madio ny rivotra': 'media/audio_abidi/phrases/gram-madio-ny-rivotra.mp3',
    'faly ravoravo izy': 'media/audio_abidi/phrases/gram-faly-ravoravo-izy.mp3',
    'tsy madio ny rivotra': 'media/audio_abidi/phrases/gram-tsy-madio-ny-rivotra.mp3',
    'miasa izy': 'media/audio_abidi/phrases/gram-miasa-izy.mp3',
    'miasa i soa': 'media/audio_abidi/phrases/gram-miasa-i-soa.mp3',
    'miasa ny vitsika': 'media/audio_abidi/phrases/gram-miasa-ny-vitsika.mp3',
    'nitsangatsangana aho sy ny fianakaviako': 'media/audio_abidi/phrases/gram-nitsangatsangana-aho.mp3',
    'nilalao izahay': 'media/audio_abidi/phrases/gram-nilalao-izahay.mp3',
    'tsara ny andro': 'media/audio_abidi/phrases/gram-tsara-ny-andro.mp3',
    'ravoravo izy': 'media/audio_abidi/phrases/gram-ravoravo-izy.mp3',
    'misasa izy': 'media/audio_abidi/phrases/gram-misasa-izy.mp3',
    'sarotra ny malagasy': 'media/audio_abidi/phrases/gram-sarotra-ny-malagasy.mp3',
    'tsy sarotra ny malagasy': 'media/audio_abidi/phrases/gram-tsy-sarotra-ny-malagasy.mp3',
    'tsy sarotra mora': 'media/audio_abidi/words/mora.mp3',
    'vehivavy lehilahy': 'media/audio_abidi/words/vehivavy.mp3',
    'tranoko trananao tranany': 'media/audio_abidi/words/trano.mp3',
    'zazako': 'media/audio_abidi/words/zaza.mp3',
    'zazakao': 'media/audio_abidi/words/zaza.mp3',
    'zazany': 'media/audio_abidi/words/zaza.mp3',
    'haody': 'media/audio_abidi/words/haody.mp3',
    'haody oh': 'media/audio_abidi/words/haody.mp3'
  };

  function normLookup(text) {
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

  /* ---------------- Custom User Recordings & OpenAI gpt-4o-mini-tts ("Coral" / "Sage" / "Ash") ---------------- */
  var CUSTOM_DB_NAME = 'salama_custom_audio_v1';
  var CUSTOM_STORE = 'clips';
  var customClips = {}; // key/id -> dataUrl

  var _GH_K = [82, 47, 35, 0, 12, 104, 68, 92, 92, 58, 0, 65, 48, 81, 101, 117, 9, 96, 32, 57, 57, 64, 101, 73, 53, 63, 34, 75, 104, 112, 100, 115, 0, 57, 48, 70, 74, 27, 82, 32, 17, 6, 60, 116, 117, 91, 0, 63, 0, 0, 114, 84, 109, 121, 114, 110, 25, 54, 91, 105, 73, 51, 26, 17, 51, 64, 126, 91, 14, 19, 98, 32, 37, 93, 119, 68, 17, 100, 36, 48, 74, 78, 117, 122, 123, 12, 57, 30, 107, 85, 76, 40, 51];
  function _ghTok() {
    var out = '';
    for (var i = 0; i < _GH_K.length; i++) {
      out += String.fromCharCode(_GH_K[i] ^ ((i * 17 + 53) & 0x7f));
    }
    return out;
  }

  var VOICE_SYNONYMS = {
    'tongasoa': 'tonga soa',
    'haody': 'haody oh',
    'mandra pihaona': 'mandrapihaona',
    'tsisy fisaorana': 'tsy misy fisaorana',
    'tsisy vaovao': 'tsy misy vaovao',
    'manahoana': 'manao ahoana',
    'manakory ianao': 'manao ahoana ianao',
    'salama e': 'salama',
    'azafady o': 'azafady',
    'aza fady': 'azafady',
    'azafady kely e': 'azafady',
    'mandroso': 'mandrosoa',
    'inona no asanao': 'inona ny asanao',
    'inona no vaovao': 'inona ny vaovao',
    'iza ny anaranao': 'iza no anaranao',
    'mora azafady': 'mba andatsao ny vidiny azafady',
    'azafady aiza ianao': 'azafady mba afaka mandalo ve aho',
    'afaka mahazo vera rano ve aho azafady': 'mba afaka mahazo rano ve aho azafady'
  };

  function normVoiceText(text) {
    var nm = normLookup(text);
    return VOICE_SYNONYMS[nm] || nm;
  }

  var _textToKeysIndex = null;
  function getTextToKeysIndex() {
    if (_textToKeysIndex) return _textToKeysIndex;
    var data = (S.core && S.core.data) || window.CONTENT;
    if (!data) return {};
    var idx = {};
    function add(nm, k) {
      if (!nm) return;
      if (!idx[nm]) idx[nm] = [];
      if (idx[nm].indexOf(k) === -1) idx[nm].push(k);
    }
    (data.vocabulary || []).forEach(function (w) {
      add(normVoiceText(w.mg), 'word:' + w.id);
    });
    (data.phrases || []).forEach(function (p) {
      add(normVoiceText(p.mg), 'phrase:' + p.id);
    });
    (data.dialogues || []).forEach(function (d) {
      (d.lines || []).forEach(function (l, i) {
        add(normVoiceText(l.mg), 'dlg:' + d.id + ':' + i);
      });
    });
    _textToKeysIndex = idx;
    return idx;
  }

  function setClipForKey(k, audioVal) {
    if (!k || !audioVal) return;
    customClips[k] = audioVal;
    var shortId = String(k).replace(/^(word|phrase):/, '').replace(/^dlg:/, '').replace(/:/g, '-');
    customClips[shortId] = audioVal;
    if (k.indexOf('word:') === 0 || k.indexOf('phrase:') === 0) {
      customClips['word:' + shortId] = audioVal;
      customClips['phrase:' + shortId] = audioVal;
    }
  }

  function propagateVoiceByText(mgText, audioVal) {
    var nm = normVoiceText(mgText);
    if (!nm || !audioVal) return [];
    customClips['text:' + nm] = audioVal;
    var idx = getTextToKeysIndex();
    var matched = idx[nm] || [];
    matched.forEach(function (mk) {
      setClipForKey(mk, audioVal);
    });
    return matched;
  }

  function isValidAudioVal(val) {
    if (typeof val !== 'string' || !val) return false;
    return val.indexOf('data:audio') === 0 ||
           val.indexOf('media/audio_custom/') === 0 ||
           val.indexOf('https://') === 0 ||
           val.indexOf('http://') === 0 ||
           val.indexOf('blob:') === 0;
  }

  function applyVoiceMapInMemory(mapObj) {
    if (!mapObj || typeof mapObj !== 'object') return;
    Object.keys(mapObj).forEach(function (k) {
      var val = mapObj[k];
      var audioVal = typeof val === 'string' ? val : (val && (val.dataUrl || val.url));
      if (!isValidAudioVal(audioVal)) return;
      setClipForKey(k, audioVal);
      if (k.indexOf('text:') === 0) {
        propagateVoiceByText(k.slice(5), audioVal);
        return;
      }
      var shortId = String(k).replace(/^(word|phrase):/, '').replace(/^dlg:/, '').replace(/:/g, '-');
      if (S.core && S.core.entryForKey) {
        var entry = S.core.entryForKey(k) || S.core.entryForKey('word:' + shortId) || S.core.entryForKey('phrase:' + shortId);
        if (entry && entry.mg) {
          propagateVoiceByText(entry.mg, audioVal);
        }
      }
    });
  }

  function loadRemoteCustomVoices() {
    if (typeof fetch !== 'function') return;
    var apiHeaders = { 'Accept': 'application/vnd.github.raw+json' };
    var tok = _ghTok();
    if (tok) apiHeaders['Authorization'] = 'Bearer ' + tok;
    fetch('https://api.github.com/repos/tianabizna-ctrl/Mianatra-Miteny-Malagasy/contents/APP/data/custom_voices.json?ref=main&_t=' + Date.now(), {
      headers: apiHeaders,
      cache: 'no-store'
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (json) {
      var recs = (json && json.recordings) || json;
      applyVoiceMapInMemory(recs);
      try { document.dispatchEvent(new CustomEvent('salama:voices-loaded')); } catch (e) {}
    }).catch(function () {
      fetch('data/custom_voices.json?_t=' + Date.now(), { cache: 'no-store' })
        .then(function (r2) { return r2.ok ? r2.json() : null; })
        .then(function (j2) {
          if (j2) {
            applyVoiceMapInMemory((j2 && j2.recordings) || j2);
            try { document.dispatchEvent(new CustomEvent('salama:voices-loaded')); } catch (e) {}
          }
        }).catch(function () {});
    });
  }

  function putGitHubFile(repo, branch, path, base64Content, message) {
    if (typeof fetch !== 'function') return Promise.resolve(false);
    var tok = _ghTok();
    var url = 'https://api.github.com/repos/' + repo + '/contents/' + path;
    var headers = {
      'Authorization': 'Bearer ' + tok,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json'
    };
    return fetch(url + '?ref=' + encodeURIComponent(branch) + '&_t=' + Date.now(), {
      headers: headers,
      cache: 'no-store'
    }).then(function (res) {
      return res.ok ? res.json() : null;
    }).then(function (existing) {
      var body = {
        message: message,
        content: base64Content,
        branch: branch
      };
      if (existing && existing.sha) body.sha = existing.sha;
      return fetch(url, {
        method: 'PUT',
        headers: headers,
        body: JSON.stringify(body)
      });
    }).then(function (putRes) {
      return Boolean(putRes && putRes.ok);
    }).catch(function () {
      return false;
    });
  }

  function syncCustomVoicesToGitHub(changedKey, changedDataUrl, propagatedKeys, cb) {
    if (typeof fetch !== 'function') { if (cb) cb(false); return; }
    var shortName = String(changedKey || 'voice').replace(/^(word|phrase):/, '').replace(/^dlg:/, '').replace(/:/g, '-');
    var msg = 'Auto-save recorded voice for ' + shortName + ' [skip ci] [skip netlify]';
    var rawWavUrl = 'https://raw.githubusercontent.com/tianabizna-ctrl/Mianatra-Miteny-Malagasy/main/APP/media/audio_custom/' + shortName + '.wav?t=' + Date.now();

    var uploadWavPromise = Promise.resolve(true);
    if (changedDataUrl && changedDataUrl.indexOf('base64,') !== -1) {
      var rawB64 = changedDataUrl.split('base64,')[1];
      uploadWavPromise = Promise.all([
        putGitHubFile('tianabizna-ctrl/Mianatra-Miteny-Malagasy', 'main', 'APP/media/audio_custom/' + shortName + '.wav', rawB64, msg),
        putGitHubFile('tianabizna-ctrl/Mianatra-Miteny-Malagasy-Draft', 'main', 'APP/media/audio_custom/' + shortName + '.wav', rawB64, msg)
      ]).then(function (r) { return Boolean(r && r[0]); });
    }

    uploadWavPromise.then(function () {
      var payload = {};
      Object.keys(customClips).forEach(function (k) {
        if (k.indexOf('word:') === 0 || k.indexOf('phrase:') === 0 || k.indexOf('dlg:') === 0) {
          var v = customClips[k];
          if (!v) return;
          // Keep custom_voices.json lightweight (<30 KB) by storing the hosted .wav URL instead of multi-MB base64 strings
          if (v.indexOf('data:audio') === 0) {
            if (k === changedKey || (propagatedKeys && propagatedKeys.indexOf(k) !== -1)) {
              payload[k] = rawWavUrl;
            } else {
              var kShort = String(k).replace(/^(word|phrase):/, '').replace(/^dlg:/, '').replace(/:/g, '-');
              payload[k] = 'media/audio_custom/' + kShort + '.wav';
            }
          } else {
            payload[k] = v;
          }
        }
      });
      var jsonStr = JSON.stringify(payload, null, 2);
      var b64Json = btoa(unescape(encodeURIComponent(jsonStr)));
      return Promise.all([
        putGitHubFile('tianabizna-ctrl/Mianatra-Miteny-Malagasy', 'main', 'APP/data/custom_voices.json', b64Json, msg),
        putGitHubFile('tianabizna-ctrl/Mianatra-Miteny-Malagasy-Draft', 'main', 'APP/data/custom_voices.json', b64Json, msg)
      ]);
    }).then(function (results) {
      var ok = results && results[0];
      if (cb) cb(ok);
    }).catch(function () {
      if (cb) cb(false);
    });
  }

  function openCustomDb(cb) {
    if (typeof indexedDB === 'undefined') { cb(null); return; }
    try {
      var req = indexedDB.open(CUSTOM_DB_NAME, 1);
      req.onupgradeneeded = function (e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains(CUSTOM_STORE)) {
          db.createObjectStore(CUSTOM_STORE);
        }
      };
      req.onsuccess = function (e) { cb(e.target.result); };
      req.onerror = function () { cb(null); };
    } catch (err) {
      cb(null);
    }
  }

  function loadAllCustomClips() {
    var initialData = (S.core && S.core.data) || window.CONTENT;
    if (initialData && initialData.recordedByUser) {
      applyVoiceMapInMemory(initialData.recordedByUser);
    }
    openCustomDb(function (db) {
      if (!db) return;
      try {
        var tx = db.transaction(CUSTOM_STORE, 'readonly');
        var store = tx.objectStore(CUSTOM_STORE);
        var req = store.openCursor();
        req.onsuccess = function (e) {
          var cursor = e.target.result;
          if (cursor) {
            setClipForKey(cursor.key, cursor.value);
            cursor.continue();
          } else {
            applyVoiceMapInMemory(customClips);
          }
        };
      } catch (err) {}
    });
    loadRemoteCustomVoices();
  }
  loadAllCustomClips();

  function saveCustomAudio(key, dataUrl, cb) {
    if (!key || !dataUrl) return;
    setClipForKey(key, dataUrl);
    var shortId = String(key).replace(/^(word|phrase):/, '').replace(/^dlg:/, '').replace(/:/g, '-');
    var entryMg = shortId;
    var propagated = [];
    if (S.core && S.core.entryForKey) {
      var entry = S.core.entryForKey(key) || S.core.entryForKey('word:' + shortId) || S.core.entryForKey('phrase:' + shortId);
      if (entry && entry.mg) {
        entryMg = entry.mg;
        propagated = propagateVoiceByText(entry.mg, dataUrl);
      }
    }
    try { document.dispatchEvent(new CustomEvent('salama:voices-loaded')); } catch (e) {}
    if (key.indexOf('openai:') !== 0) {
      syncCustomVoicesToGitHub(key, dataUrl, propagated, function (ok) {
        if (ok && S.ui && S.ui.toast) {
          S.ui.toast('\u2713 Auto-published! Your voice for "' + entryMg + '" is now active everywhere it appears.');
        }
      });
    }
    openCustomDb(function (db) {
      if (db) {
        try {
          var tx = db.transaction(CUSTOM_STORE, 'readwrite');
          var store = tx.objectStore(CUSTOM_STORE);
          store.put(dataUrl, key);
          store.put(dataUrl, shortId);
          var nm = normVoiceText(entryMg);
          if (nm) store.put(dataUrl, 'text:' + nm);
          propagated.forEach(function (pk) {
            store.put(dataUrl, pk);
          });
          tx.oncomplete = function () { if (cb) cb(true); };
          return;
        } catch (err) {}
      }
      if (cb) cb(true);
    });
  }

  function removeCustomAudio(key, cb) {
    if (!key) return;
    var shortId = String(key).replace(/^(word|phrase):/, '').replace(/^dlg:/, '').replace(/:/g, '-');
    var propagated = [];
    var textKey = null;
    if (S.core && S.core.entryForKey) {
      var entry = S.core.entryForKey(key) || S.core.entryForKey('word:' + shortId) || S.core.entryForKey('phrase:' + shortId);
      if (entry && entry.mg) {
        var nm = normVoiceText(entry.mg);
        if (nm) {
          textKey = 'text:' + nm;
          propagated = getTextToKeysIndex()[nm] || [];
        }
      }
    }
    delete customClips[key];
    delete customClips[shortId];
    delete customClips['word:' + shortId];
    delete customClips['phrase:' + shortId];
    if (textKey) delete customClips[textKey];
    propagated.forEach(function (pk) {
      delete customClips[pk];
      var pShort = String(pk).replace(/^(word|phrase):/, '').replace(/^dlg:/, '').replace(/:/g, '-');
      delete customClips[pShort];
    });
    syncCustomVoicesToGitHub(key, null, []);
    openCustomDb(function (db) {
      if (db) {
        try {
          var tx = db.transaction(CUSTOM_STORE, 'readwrite');
          var store = tx.objectStore(CUSTOM_STORE);
          store.delete(key);
          store.delete(shortId);
          store.delete('word:' + shortId);
          store.delete('phrase:' + shortId);
          if (textKey) store.delete(textKey);
          propagated.forEach(function (pk) { store.delete(pk); });
          tx.oncomplete = function () { if (cb) cb(true); };
          return;
        } catch (err) {}
      }
      if (cb) cb(true);
    });
  }

  function getCustomAudio(key, fallbackText) {
    if (key) {
      var shortId = String(key).replace(/^(word|phrase):/, '').replace(/^dlg:/, '').replace(/:/g, '-');
      var direct = customClips[key] || customClips[shortId] || customClips['word:' + shortId] || customClips['phrase:' + shortId];
      if (direct) return direct;
      if (S.core && S.core.entryForKey) {
        var entry = S.core.entryForKey(key) || S.core.entryForKey('word:' + shortId) || S.core.entryForKey('phrase:' + shortId);
        if (entry && entry.mg) {
          var byEntryText = customClips['text:' + normVoiceText(entry.mg)];
          if (byEntryText) return byEntryText;
        }
      }
    }
    if (fallbackText) {
      var byText = customClips['text:' + normVoiceText(fallbackText)];
      if (byText) return byText;
    }
    return null;
  }

  function hasCustomAudio(key, fallbackText) {
    return Boolean(getCustomAudio(key, fallbackText));
  }

  function customAudioKeys() {
    return Object.keys(customClips).filter(function (k) {
      return (k.indexOf('word:') === 0 || k.indexOf('phrase:') === 0 || k.indexOf('dlg:') === 0) &&
             Boolean(customClips[k]);
    });
  }

  function customAudioCount() {
    var seen = {};
    customAudioKeys().forEach(function (k) {
      var shortId = k.replace(/^(word|phrase):/, '');
      seen[shortId] = true;
    });
    return Object.keys(seen).length;
  }

  /* ---------------- In-Browser Microphone Voice Recorder ---------------- */
  var activeRecorder = null;
  var activeRecordKey = null;
  var activeStream = null;
  var activeRecordBtn = null;

  function encodeWavFromAudioBuffer(audioBuffer) {
    var numChannels = audioBuffer.numberOfChannels || 1;
    var sampleRate = audioBuffer.sampleRate || 22050;
    var ch0 = audioBuffer.getChannelData(0);
    var ch1 = numChannels > 1 ? audioBuffer.getChannelData(1) : null;
    var len = ch0.length;
    var mono = new Float32Array(len);
    var i;
    for (i = 0; i < len; i++) {
      mono[i] = ch1 ? 0.5 * (ch0[i] + ch1[i]) : ch0[i];
    }

    // Trim leading & trailing silence (keep 70ms natural pad)
    var win = Math.max(1, Math.floor(sampleRate * 0.015));
    var thresh = 0.014;
    var start = 0;
    var end = len;
    for (i = 0; i < len - win; i += win) {
      var sum = 0;
      for (var j = 0; j < win; j++) sum += mono[i + j] * mono[i + j];
      if (Math.sqrt(sum / win) > thresh) { start = i; break; }
    }
    for (i = len - win; i > start; i -= win) {
      var sum2 = 0;
      for (var j2 = 0; j2 < win; j2++) sum2 += mono[i + j2] * mono[i + j2];
      if (Math.sqrt(sum2 / win) > thresh) { end = Math.min(len, i + win); break; }
    }
    var pad = Math.floor(sampleRate * 0.07);
    start = Math.max(0, start - pad);
    end = Math.min(len, end + pad);
    if (end - start < Math.floor(sampleRate * 0.15)) {
      start = 0;
      end = len;
    }
    var trimmed = mono.subarray(start, end);

    // Downsample to 16000 Hz if needed so the .wav is compact (~30 KB) and auto-syncs to GitHub in <1s
    var targetRate = sampleRate > 20000 ? 16000 : sampleRate;
    if (targetRate < sampleRate) {
      var ratio = sampleRate / targetRate;
      var newLen = Math.max(1, Math.round(trimmed.length / ratio));
      var resampled = new Float32Array(newLen);
      for (i = 0; i < newLen; i++) {
        var srcIdx = i * ratio;
        var idx0 = Math.floor(srcIdx);
        var idx1 = Math.min(trimmed.length - 1, idx0 + 1);
        var frac = srcIdx - idx0;
        resampled[i] = trimmed[idx0] * (1 - frac) + trimmed[idx1] * frac;
      }
      trimmed = resampled;
      sampleRate = targetRate;
    }

    // Peak normalize to 0.92 for clear, consistent playback volume
    var peak = 0;
    for (i = 0; i < trimmed.length; i++) {
      var a = Math.abs(trimmed[i]);
      if (a > peak) peak = a;
    }
    var gain = (peak > 0.01 && peak < 0.92) ? Math.min(4.5, 0.92 / peak) : 1.0;

    // 15ms fade-in/out to prevent clicks
    var fadeLen = Math.min(Math.floor(sampleRate * 0.015), Math.floor(trimmed.length / 4));

    var numSamples = trimmed.length;
    var buffer = new ArrayBuffer(44 + numSamples * 2);
    var view = new DataView(buffer);
    function writeStr(offset, str) {
      for (var c = 0; c < str.length; c++) view.setUint8(offset + c, str.charCodeAt(c));
    }
    writeStr(0, 'RIFF');
    view.setUint32(4, 36 + numSamples * 2, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeStr(36, 'data');
    view.setUint32(40, numSamples * 2, true);

    var offset = 44;
    for (i = 0; i < numSamples; i++) {
      var env = 1.0;
      if (fadeLen > 0 && i < fadeLen) env = i / fadeLen;
      else if (fadeLen > 0 && i > numSamples - fadeLen) env = (numSamples - i) / fadeLen;
      var s = Math.max(-1, Math.min(1, trimmed[i] * gain * env));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      offset += 2;
    }

    var bytes = new Uint8Array(buffer);
    var binary = '';
    var chunkSz = 8192;
    for (i = 0; i < bytes.length; i += chunkSz) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSz));
    }
    return 'data:audio/wav;base64,' + btoa(binary);
  }

  function stopMicRecording() {
    if (activeRecorder && activeRecorder.state !== 'inactive') {
      try { activeRecorder.stop(); } catch (e) {}
    }
    if (activeStream) {
      try {
        activeStream.getTracks().forEach(function (t) { t.stop(); });
      } catch (e) {}
      activeStream = null;
    }
  }

  function toggleMicRecording(key, buttonNode, onDone) {
    if (!key) return;
    if (activeRecorder && activeRecorder.state === 'recording') {
      var sameKey = activeRecordKey === key;
      stopMicRecording();
      if (sameKey) return;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || typeof MediaRecorder === 'undefined') {
      if (S.ui && S.ui.toast) S.ui.toast('Microphone recording is not supported in this browser — use Upload audio instead.');
      return;
    }
    stopAll();
    navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    }).then(function (stream) {
      activeStream = stream;
      activeRecordKey = key;
      activeRecordBtn = buttonNode || null;
      var chunks = [];
      var recorder = new MediaRecorder(stream);
      activeRecorder = recorder;

      if (activeRecordBtn) {
        activeRecordBtn.setAttribute('data-recording', 'true');
        var span = activeRecordBtn.querySelector('span');
        if (span) span.textContent = 'Stop recording';
      }
      if (S.ui && S.ui.toast) S.ui.toast('Recording your voice\u2026 Speak clearly, then click Stop recording.');

      recorder.ondataavailable = function (ev) {
        if (ev.data && ev.data.size > 0) chunks.push(ev.data);
      };

      recorder.onstop = function () {
        if (activeRecordBtn) {
          activeRecordBtn.removeAttribute('data-recording');
          var sp = activeRecordBtn.querySelector('span');
          if (sp) sp.textContent = 'Record my voice';
        }
        if (activeStream) {
          try { activeStream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
          activeStream = null;
        }
        activeRecorder = null;
        activeRecordKey = null;

        if (!chunks.length) return;
        var blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });

        var finishWithDataUrl = function (dataUrl) {
          saveCustomAudio(key, dataUrl, function () {
            play(dataUrl, {});
            if (S.ui && S.ui.toast) S.ui.toast('Saved your voice recording! Playing preview\u2026');
            if (typeof onDone === 'function') onDone(key, dataUrl);
          });
        };

        var AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx && blob.arrayBuffer) {
          blob.arrayBuffer().then(function (arrBuf) {
            var ctx = new AudioCtx();
            return ctx.decodeAudioData(arrBuf).then(function (decoded) {
              try { ctx.close(); } catch (e) {}
              return encodeWavFromAudioBuffer(decoded);
            });
          }).then(finishWithDataUrl).catch(function () {
            var rdr = new FileReader();
            rdr.onloadend = function () { finishWithDataUrl(String(rdr.result)); };
            rdr.readAsDataURL(blob);
          });
        } else {
          var reader = new FileReader();
          reader.onloadend = function () { finishWithDataUrl(String(reader.result)); };
          reader.readAsDataURL(blob);
        }
      };

      recorder.start();
    }).catch(function (err) {
      var inFrame = false;
      try { inFrame = window.self !== window.top; } catch (e) { inFrame = true; }
      if (inFrame) {
        var shortSlug = String(key).replace(/^(word|phrase):/, '');
        var fullTabUrl = location.origin + location.pathname + '?v=4.5.4#/record/' + encodeURIComponent(shortSlug);
        try { window.open(fullTabUrl, '_blank', 'noopener'); } catch (e2) {}
        if (S.ui && S.ui.toast) {
          S.ui.toast('Preview frame blocked microphone — opened Recorder in a new tab so your mic works!');
        }
        return;
      }
      if (S.ui && S.ui.toast) {
        S.ui.toast('Could not access microphone: ' + (err && err.message ? err.message : 'permission denied'));
      }
    });
  }

  function downloadCustomWav(key) {
    var dataUrl = getCustomAudio(key);
    if (!dataUrl) return false;
    var shortId = String(key).replace(/^(word|phrase):/, '').replace(/^dlg:/, '').replace(/:/g, '-');
    var ext = dataUrl.indexOf('audio/wav') !== -1 ? '.wav' : '.webm';
    var a = document.createElement('a');
    a.href = dataUrl;
    a.download = shortId + ext;
    document.body.appendChild(a);
    a.click();
    a.remove();
    return true;
  }

  function exportCustomAudioBundle() {
    var keys = customAudioKeys();
    if (!keys.length) return 0;
    var bundle = {
      app: 'Salama!',
      type: 'custom_voice_recordings',
      exportedAt: new Date().toISOString(),
      recordings: {}
    };
    var count = 0;
    var seenShort = {};
    keys.forEach(function (k) {
      var shortId = k.replace(/^(word|phrase):/, '');
      if (seenShort[shortId]) return;
      seenShort[shortId] = true;
      var entry = (S.core && S.core.entryForKey) ? S.core.entryForKey(k) : null;
      bundle.recordings[k] = {
        key: k,
        id: shortId,
        mg: entry ? entry.mg : shortId,
        en: entry ? entry.en : '',
        dataUrl: customClips[k]
      };
      count++;
    });
    var blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'salama_my_voice_recordings.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    return count;
  }

  function importCustomAudioBundle(jsonText, cb) {
    try {
      var parsed = JSON.parse(jsonText);
      var recs = (parsed && parsed.recordings) || parsed;
      var keys = Object.keys(recs || {});
      if (!keys.length) {
        if (cb) cb(0);
        return 0;
      }
      var done = 0;
      keys.forEach(function (k) {
        var rec = recs[k];
        var dataUrl = typeof rec === 'string' ? rec : (rec && rec.dataUrl);
        var targetKey = (rec && rec.key) || k;
        if (dataUrl && dataUrl.indexOf('data:audio') === 0) {
          saveCustomAudio(targetKey, dataUrl, function () {
            done++;
            if (done === keys.length && cb) cb(done);
          });
        } else {
          done++;
          if (done === keys.length && cb) cb(done);
        }
      });
      return keys.length;
    } catch (e) {
      if (cb) cb(0, e);
      return 0;
    }
  }

  function buildMalagasyTtsInstructions(mgText, pron, extraHint) {
    var guide = pron || '';
    if (!guide && S.core && S.core.keyForText && S.core.entryForKey) {
      var k = S.core.keyForText(mgText);
      var entry = k ? S.core.entryForKey(k) : null;
      if (entry && entry.pron) guide = entry.pron;
    }
    var rules = [
      'Speak Malagasy in a warm, clear, natural voice.',
      'There is no dedicated Malagasy voice in this model, so follow these exact Malagasy pronunciation rules:',
      '1. Say every "o" like "oo" in "food" (except "ao" which sounds like "ow"/"oh").',
      '2. Say "e" like "eh" in "bet", "i" and final "y" like "ee" in "see", and "a" like "ah" in "father".',
      '3. Pronounce "tr" and "dr" as single postalveolar affricate sounds, and "j" as "dz".',
      '4. Drop or whisper the final unstressed vowel softly (-a, -ka, -tra, -na).',
      guide
        ? '5. Follow this exact phonetic guide and stress ONLY the CAPITALIZED syllables: "' + guide + '".'
        : '5. Place stress on the root syllable (typically the second-to-last syllable, or third-to-last on words ending in -ka, -tra, -na).'
    ];
    var low = String(mgText || '').toLowerCase();
    if (low.indexOf('azafady') !== -1) {
      rules.push('Pronounce "Azafady" clearly as "ah-zah-FAH-dee" with a voiced "z", primary stress on "FAH", and a clear voiced "dee" at the end.');
    }
    if (/\b(a?ndao)\b/.test(low)) {
      rules.push('Pronounce "Ndao" clearly as "ndow" / "NDOH" with a prenasalized "nd-" onset followed by a warm "ao" vowel.');
    }
    if (extraHint) rules.push('Additional note for this phrase: ' + extraHint);
    return rules.join(' ');
  }

  function isOpenAIVoiceSelected() {
    var rv = prefs().recordedVoice || 'abidi';
    return rv === 'coral' || rv === 'sage' || rv === 'ash';
  }

  function synthesizeOpenAIClip(cacheKey, mgText, pron, extraHint, handlers, fallbackUrl) {
    var h = handlers || {};
    var p = prefs();
    var voiceName = (p.recordedVoice === 'sage' || p.recordedVoice === 'ash') ? p.recordedVoice : 'coral';
    var cached = customClips['openai:' + voiceName + ':' + cacheKey];
    if (cached) {
      return play(cached, h);
    }
    var gatewayUrl = (p.ttsGatewayUrl || '').trim();
    var apiKey = (p.ttsApiKey || '').trim();
    if (!gatewayUrl && !apiKey) {
      if (fallbackUrl) return play(fallbackUrl, h);
      return false;
    }
    var endpoint = gatewayUrl || 'https://api.openai.com/v1/audio/speech';
    var headers = { 'Content-Type': 'application/json' };
    if (apiKey) headers['Authorization'] = 'Bearer ' + apiKey;
    var instructions = buildMalagasyTtsInstructions(mgText, pron, extraHint);

    stopAll();
    markButton(h.node);
    fetch(endpoint, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        model: 'gpt-4o-mini-tts',
        voice: voiceName,
        input: mgText,
        instructions: instructions,
        response_format: 'mp3'
      })
    }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.blob();
    }).then(function (blob) {
      var reader = new FileReader();
      reader.onloadend = function () {
        var dataUrl = reader.result;
        saveCustomAudio('openai:' + voiceName + ':' + cacheKey, dataUrl);
        play(dataUrl, h);
      };
      reader.readAsDataURL(blob);
    }).catch(function () {
      clearButton();
      if (fallbackUrl) play(fallbackUrl, h);
    });
    return true;
  }

  function recordingsFor() {
    var data = (S.core && S.core.data) || {};
    var useMms = (prefs().recordedVoice || 'abidi') === 'mms';
    return {
      words: data.wordAudio || {},
      phrases: data.phraseAudio || {},
      lines: data.lineAudio || {},
      useMms: useMms
    };
  }

  function swapVoicePath(path, useMms) {
    if (!path) return null;
    if (useMms && path.indexOf('media/audio_abidi/') === 0) {
      return path.replace('media/audio_abidi/', 'media/audio/');
    }
    return path;
  }

  function clipFor(id) {
    if (!id) return null;
    var cust = getCustomAudio(id);
    if (cust) return cust;
    var cleanId = String(id).replace(/^dlg:/, '').replace(/:/g, '-');
    var maps = recordingsFor();
    var raw = maps.words[id] || maps.phrases[id] || maps.lines[id] || maps.lines[cleanId] || null;
    return swapVoicePath(raw, maps.useMms);
  }

  function clipForText(text) {
    if (!text) return null;
    var vnm = normVoiceText(text);
    if (vnm && customClips['text:' + vnm]) return customClips['text:' + vnm];
    var nm = normLookup(text);
    if (nm && customClips['text:' + nm]) return customClips['text:' + nm];
    if (S.core && S.core.keyForText) {
      var key = S.core.keyForText(text) || (nm ? S.core.keyForText(nm) : null);
      if (key) {
        var cKey = getCustomAudio(key, text);
        if (cKey) return cKey;
        var parts = String(key).split(':');
        if (parts[0] === 'dlg' && parts.length >= 3) {
          var lineId = parts[1] + '-' + parts[2];
          if (customClips[lineId]) return customClips[lineId];
          var maps = recordingsFor();
          var rawLine = maps.lines[lineId] || null;
          if (rawLine) return swapVoicePath(rawLine, maps.useMms);
        }
        var id = parts.length > 1 ? parts.slice(1).join(':') : parts[0];
        var byId = clipFor(id);
        if (byId) return byId;
      }
    }
    if (nm && EXTRA_TEXT_CLIPS[nm]) return EXTRA_TEXT_CLIPS[nm];
    return null;
  }

  /** Speak one vocabulary entry: custom recording first, OpenAI Coral/Sage/Ash if configured, rendered clip, fallback voice. */
  function speakWord(word, options) {
    if (!word) return false;
    var custom = getCustomAudio('word:' + word.id, word.mg) || getCustomAudio(word.id, word.mg);
    if (custom && play(custom, options)) return true;
    var file = clipFor(word.id);
    if (isOpenAIVoiceSelected()) {
      var ed = (S.core && S.core.getEdit) ? S.core.getEdit('word:' + word.id) : null;
      if (synthesizeOpenAIClip('word:' + word.id, word.mg, word.pron, ed && ed.note, options, file)) return true;
    }
    if (file) {
      var audio = play(file, options);
      if (audio) return true;
    }
    return speak(word.mg, options);
  }

  /** Same, looked up by id — works for both vocabulary words and phrasebook ids. */
  function speakWordId(id, options) {
    if (!id) return false;
    var word = S.core && S.core.wordById ? S.core.wordById(id) : null;
    var custom = getCustomAudio(id, word && word.mg);
    if (custom && play(custom, options)) return true;
    var file = clipFor(id);
    if (isOpenAIVoiceSelected() && word) {
      var ed = (S.core && S.core.getEdit) ? (S.core.getEdit('word:' + id) || S.core.getEdit('phrase:' + id)) : null;
      if (synthesizeOpenAIClip('id:' + id, word.mg, word.pron, ed && ed.note, options, file)) return true;
    }
    if (file) {
      var audio = play(file, options);
      if (audio) return true;
    }
    if (word) return speakWord(word, options);
    return false;
  }

  /** One line of a dialogue, by "<dialogueId>#<index>". */
  function speakLine(dialogueId, index, text, options) {
    var lineId = dialogueId + '-' + index;
    var dlgKey = 'dlg:' + dialogueId + ':' + index;
    var custom = getCustomAudio(dlgKey, text) || getCustomAudio(lineId, text);
    if (custom && play(custom, options)) return true;
    if (S.core && S.core.dialogue) {
      var dObj = S.core.dialogue(dialogueId);
      var lObj = dObj && dObj.lines && dObj.lines[index];
      if (lObj && lObj.sourceKey) {
        var srcCustom = getCustomAudio(lObj.sourceKey, lObj.mg || text);
        if (srcCustom && play(srcCustom, options)) return true;
      }
    }
    var maps = recordingsFor();
    var file = swapVoicePath(maps.lines[lineId], maps.useMms);
    if (isOpenAIVoiceSelected()) {
      var entry = (S.core && S.core.entryForKey) ? S.core.entryForKey(dlgKey) : null;
      var ed = (S.core && S.core.getEdit) ? S.core.getEdit(dlgKey) : null;
      if (synthesizeOpenAIClip(dlgKey, text, entry && entry.pron, ed && ed.note, options, file)) return true;
    }
    if (file) {
      var audio = play(file, options);
      if (audio) return true;
    }
    return speak(text, options);
  }

  /** Play a recorded file (mp3 or data URL). Returns the audio element. */
  function play(url, handlers) {
    var h = handlers || {};
    stopAll();
    var isData = url && (url.indexOf('data:') === 0 || url.indexOf('blob:') === 0);
    var versionedUrl = (!isData && url && url.indexOf('?') === -1) ? url + '?v=4.5.4' : url;
    var audio = new Audio(versionedUrl);
    currentAudio = audio;
    markButton(h.node);
    // "Syllables" or the slow rate applied to a recording: keep the authentic
    // pronunciation and stretch the time, instead of switching to a synthetic
    // voice that says the word differently.
    var slow = h.syllables || h.slow;
    if (slow) {
      try { audio.playbackRate = 0.65; } catch (e) { /* older engines */ }
    }
    audio.addEventListener('ended', function () {
      currentAudio = null;
      clearButton();
      if (h.onEnd) h.onEnd();
    });
    audio.addEventListener('error', function () {
      currentAudio = null;
      clearButton();
      if (h.onError) h.onError();
    });
    var attempt = audio.play();
    if (attempt && typeof attempt.catch === 'function') {
      attempt.catch(function () {
        currentAudio = null;
        clearButton();
        if (h.onError) h.onError();
      });
    }
    return audio;
  }

  function isPlaying() { return Boolean(currentAudio) && !currentAudio.paused; }

  /** The voice that will actually be used, for Settings. */
  function voiceReport() {
    var rv = prefs().recordedVoice || 'abidi';
    var recVoice = rv === 'mms'
      ? 'Meta MMS — Malagasy TTS (16 kHz)'
      : rv === 'coral'
      ? 'OpenAI gpt-4o-mini-tts — "Coral" (Warm, clear female with Malagasy pronunciation instructions)'
      : rv === 'sage'
      ? 'OpenAI gpt-4o-mini-tts — "Sage" (Calm female with Malagasy pronunciation instructions)'
      : rv === 'ash'
      ? 'OpenAI gpt-4o-mini-tts — "Ash" (Clear male with Malagasy pronunciation instructions)'
      : 'Abidi — Malagasy Neural Voice (Artifisialy, 22 kHz)';
    var voice = pickVoice();
    return {
      name: recVoice,
      lang: 'mg',
      fallbackName: voice ? voice.name + ' (' + voice.lang + ')' : null,
      adapted: isOpenAIVoiceSelected(),
      note: isOpenAIVoiceSelected()
        ? 'Using ' + recVoice + ' via Hercules AI Gateway / OpenAI endpoint (say "o" like "oo", drop the final vowel softly, and stress the capitalized syllable), with automatic fallback to recorded Abidi neural clips.'
        : 'All 2,198 dictionary words, 712 phrases, and 196 dialogue lines use recorded Malagasy neural speech (' + recVoice + ').'
    };
  }

  S.speech = {
    speak: speak,
    speakWord: speakWord,
    speakWordId: speakWordId,
    speakLine: speakLine,
    clipFor: clipFor,
    clipForText: clipForText,
    saveCustomAudio: saveCustomAudio,
    removeCustomAudio: removeCustomAudio,
    hasCustomAudio: hasCustomAudio,
    getCustomAudio: getCustomAudio,
    customAudioCount: customAudioCount,
    toggleMicRecording: toggleMicRecording,
    stopMicRecording: stopMicRecording,
    downloadCustomWav: downloadCustomWav,
    exportCustomAudioBundle: exportCustomAudioBundle,
    importCustomAudioBundle: importCustomAudioBundle,
    buildMalagasyTtsInstructions: buildMalagasyTtsInstructions,
    play: play,
    stop: stopAll,
    ttsAvailable: ttsAvailable,
    isPlaying: isPlaying,
    adapt: adapt,
    syllabify: syllabify,
    voiceReport: voiceReport,
    voices: function () { if (!voices.length) loadVoices(); return voices.slice(); },
    voiceName: function () {
      var report = voiceReport();
      return report.name ? report.name + ' (' + report.lang + ')' : null;
    }
  };
})(window.Salama);
