/* Today: Miteny base UI hero + callout + Today's session, starter cards, review & edit. */
(function (S) {
  'use strict';
  var core = S.core;
  var ui = S.ui;

  function previewTurns(session) {
    var dialogue = session && session.dialogue ? core.dialogue(session.dialogue) : null;
    if (!dialogue) return '';
    return dialogue.lines.slice(0, 2).map(function (line) {
      return '<div class="turn"><span class="who">' + ui.esc(line.speaker || 'A') +
        (line.stage ? ' <span class="stage">(' + ui.esc(line.stage) + ')</span>' : '') + '</span>' +
        ui.mg(line.mg) +
        '<p class="trans">' + ui.esc(line.en) + '</p></div>';
    }).join('');
  }

  function steps(session, done) {
    var names = ['Warm-up dialogue', 'New words', 'Roleplay'];
    return '<ol class="steps">' + names.map(function (name) {
      return '<li data-done="' + (done ? 'true' : 'false') + '">' +
        '<span class="tick">' + (done ? ui.icon('check', 'icon-sm') : '') + '</span>' +
        '<span>' + name + '</span></li>';
    }).join('') + '</ol>';
  }

  var WOD_LIST = [
    { id: 'salama', mg: 'Salama', pron: 'sah-LAH-mah', en: 'Hello / peace' },
    { id: 'misaotra', mg: 'Misaotra', pron: 'mee-SOH-trah', en: 'Thank you' },
    { id: 'veloma', mg: 'Veloma', pron: 'veh-LOO-mah', en: 'Goodbye — “live well”' },
    { id: 'azafady', mg: 'Azafady', pron: 'ah-zah-FAH-dee', en: 'Please / excuse me' },
    { id: 'tonga_soa', mg: 'Tonga soa', pron: 'TOONG-ah SOO-ah', en: 'Welcome' },
    { id: 'mazotoa', mg: 'Mazotoa', pron: 'mah-zoo-TOO-ah', en: 'Enjoy! Keep it up!' }
  ];

  function starterCards(session) {
    var ids = (session && session.words ? session.words : []).slice(0, 4);
    var list = ids.map(function (id) { return core.wordById(id); }).filter(Boolean);
    if (list.length < 4) {
      list = core.data.vocabulary.slice(0, 4);
    }
    return '<div class="entry-list miteny-grid-4">' + list.map(function (w, idx) {
      var num = String(idx + 1).padStart(2, '0');
      var cat = core.themeTitle ? core.themeTitle(w.theme) : (w.theme || 'Core');
      return '<article class="entry">' +
        '<div class="entry-top">' +
          '<span class="entry-badge">' + num + ' \u2022 ' + ui.esc(cat) + '</span>' +
          '<span class="entry-lesson">Session ' + (session ? session.number : 1) + '</span>' +
        '</div>' +
        '<div>' +
          '<p class="mg-line" lang="mg">' + ui.esc(w.mg) + '</p>' +
          (w.pron ? '<p class="say"><span class="say-label">Phonetic:</span> ' + ui.esc(w.pron) + ui.pronunciationTag(w) + '</p>' : '') +
          '<p class="en">' + ui.esc(w.en) + '</p>' +
        '</div>' +
        '<div class="entry-tools">' + ui.speakButtons(w.mg, { wordId: w.id }) + '</div>' +
      '</article>';
    }).join('') + '</div>';
  }

  function heroBanner(session) {
    var lessonNum = session ? session.number : 1;
    var lessonId = session ? session.id : 'w1s1';
    var pos = core.lastPosition();
    var startHref = pos ? core.positionHash(pos) : '#/session/' + lessonId + '/dialogue';
    var startLabel = pos ? 'Continue: Week ' + session.week + ' \u00b7 Session ' + lessonNum : 'Start Lesson ' + lessonNum;

    var tryRows = [
      { id: 'salama', mg: 'Salama.', speak: 'Salama!', pron: 'sah-LAH-mah', en: 'Hello!' },
      { id: 'manao_ahoana', mg: 'Manao ahoana?', speak: 'Manao ahoana?', pron: 'mah-NOW ah-WAH-nah', en: 'How are you?' },
      { id: 'tsara', mg: 'Tsara.', speak: 'tsara', pron: 'TSAH-rah', en: 'Good!' },
      { id: 'misaotra', mg: 'Misaotra.', speak: 'Misaotra.', pron: 'mee-SOH-trah', en: 'Thank you!' }
    ].map(function (r) {
      var w = core.wordById(r.id) || r;
      var pronTxt = (w && w.pron) || r.pron;
      return '<div class="hero-try-row">' +
        '<div class="hero-try-row-left">' +
          '<div class="hero-try-row-top">' +
            '<strong class="hero-try-mg" lang="mg">' + ui.esc(r.mg) + '</strong> ' +
            '<span class="hero-try-pron">' + ui.esc(pronTxt) + '</span>' +
          '</div>' +
          '<div class="hero-try-en">\u2014 ' + ui.esc(r.en) + '</div>' +
        '</div>' +
        '<div class="hero-try-actions">' +
          '<button class="hero-hear-pill" type="button" data-speak="' + ui.esc(r.speak) + '" data-word-id="' + ui.esc(r.id) + '">' +
            '&#9654; Hear it' +
          '</button>' +
          '<button class="hero-rec-pill" type="button" data-mic-record="word:' + ui.esc(r.id) + '" title="Record your own voice for ' + ui.esc(r.mg) + '">' +
            '\u25CF<span>' + (S.speech && S.speech.hasCustomAudio && S.speech.hasCustomAudio('word:' + r.id) ? 'Re-record' : 'Record') + '</span>' +
          '</button>' +
        '</div>' +
      '</div>';
    }).join('');

    var dir = (core.state && core.state.prefs && core.state.prefs.direction) || 'miteny';
    var imgSrc = dir === 'raffia' ? 'img/highlands.jpg' : 'img/baobab-avenue.jpg';

    return '<section class="miteny-hero mahay-hero">' +
      '<div class="mahay-hero-media"><img src="' + imgSrc + '" alt="Madagascar landscape" loading="lazy"></div>' +
      '<div class="miteny-hero-inner">' +
        '<div class="miteny-hero-copy">' +
          '<p class="miteny-pill-badge miteny-pill-gold">ENGLISH SPEAKER FRIENDLY \u2022 PHONETIC &amp; WARM</p>' +
          '<h1 class="miteny-hero-title">' +
            '<span class="miteny-title-top">Miteny</span>' +
            '<span class="miteny-title-gold">Malagasy</span>' +
          '</h1>' +
          '<p class="miteny-hero-sub">Speak like a local in Madagascar.</p>' +
          '<p class="miteny-hero-lead">Real Malagasy words, plain phonetic guides, and warm phrases you can use on day one \u2014 all right here.</p>' +
          '<div class="miteny-hero-ctas">' +
            '<a class="btn btn-orange-cta btn-lg" href="' + startHref + '">' + startLabel + ' ' + ui.icon('arrow-right') + '</a>' +
            '<button class="btn btn-hero-ghost btn-lg" type="button" data-speak-greetings="true">&#9655; Hear Greetings</button>' +
          '</div>' +
        '</div>' +

        '<div class="miteny-try-wrap">' +
          '<div class="hero-bubbles">' +
            '<button class="hero-bubble hero-bubble-light" type="button" data-speak="Salama e" data-word-id="wv_goodmorning">' +
              '<div class="hero-bubble-top"><strong lang="mg">Salama e!</strong> <span class="hero-bubble-en">Hello!</span></div>' +
              '<div class="hero-bubble-pron">sah-LAH-mah</div>' +
            '</button>' +
            '<button class="hero-bubble hero-bubble-gold" type="button" data-speak="Misaotra." data-word-id="misaotra">' +
              '<div class="hero-bubble-top"><strong lang="mg">Misaotra!</strong></div>' +
              '<div class="hero-bubble-pron">mee-SOH-trah \u2022 Thank you!</div>' +
            '</button>' +
          '</div>' +

          '<div class="hero-try-card">' +
            '<div class="hero-try-eyebrow"><span class="hero-try-dot"></span> WEEK ' + (session ? session.week : 1) + ' \u2022 LESSON ' + lessonNum + ' \u2022 TRY IT NOW</div>' +
            '<div class="hero-try-list">' + tryRows + '</div>' +
            '<a class="hero-try-bottom-btn" href="' + startHref + '">Open Lesson ' + lessonNum + ' Dialogue &amp; Practice &rarr;</a>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</section>' +

    '<section class="miteny-banner-wrap">' +
      '<div class="miteny-banner">' +
        '<div class="miteny-banner-check">\u2713</div>' +
        '<div class="miteny-banner-body">' +
          '<h2>Official Malagasy words first \u2014 with authentic neural audio.</h2>' +
          '<p>Every word, phrase, and dialogue line uses Official Malagasy spelling and plays recorded Malagasy neural speech.</p>' +
        '</div>' +
        '<div class="miteny-banner-pills">' +
          '<span class="pill-gold">BIG = real spelling</span>' +
          '<span class="pill-sage">small = sound</span>' +
        '</div>' +
      '</div>' +
    '</section>';
  }

  function resumeCard() {
    var pos = core.lastPosition();
    var s = pos ? core.session(pos.id) : null;
    if (!s) return '';
    var prev = core.adjacentSession(s.id, -1);
    var next = core.adjacentSession(s.id, 1);
    return '<div class="miteny-section" style="padding-bottom:0">' +
      '<div class="resume-wrap">' +
        (prev ? '<a class="resume-side" href="#/session/' + prev.id + '/dialogue"><small>Previous lesson</small>\u2190 Week ' + prev.week + ' \u00b7 ' + ui.esc(prev.day.slice(0, 3)) + ' S' + prev.number + '</a>' : '') +
        '<a class="resume-card" href="' + core.positionHash(pos) + '">' +
          '<span class="resume-dot">\u25B6</span>' +
          '<span class="resume-text"><small>You are here \u2014 continue where you left off</small>' +
          '<strong>Week ' + s.week + ' \u00b7 ' + ui.esc(s.day) + ' \u00b7 Session ' + s.number + ' \u00b7 ' + core.STEP_NAMES[pos.step] + '</strong>' +
          '<span>' + ui.esc(s.focus) + '</span></span>' +
          '<span class="resume-go">Continue \u2192</span>' +
        '</a>' +
        (next ? '<a class="resume-side" href="#/session/' + next.id + '/dialogue"><small>Next lesson</small>Week ' + next.week + ' \u00b7 ' + ui.esc(next.day.slice(0, 3)) + ' S' + next.number + ' \u2192</a>' : '') +
        '<a class="resume-side" href="#/course/' + s.week + '"><small>Syllabus</small>Week ' + s.week + ' &amp; all weeks</a>' +
      '</div>' +
    '</div>';
  }

  function render() {
    var session = core.currentSession();
    var doneCount = core.sessionDoneCount();
    var total = core.data.sessions.length;
    var everything = doneCount === total;
    var due = core.dueCount();
    var round = Math.min(10, due);

    var statusLine = doneCount + ' of ' + total + ' sessions complete';
    if (core.state.streak.days > 1) statusLine += ' · ' + core.state.streak.days + '-day streak';

    return '' +
      heroBanner(session) +
      resumeCard() +
      '<div class="miteny-section" style="padding-bottom:0">' +
        '<section class="panel" style="border:2px solid #c93b2b;padding:18px 22px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:14px">' +
          '<div>' +
            '<p class="section-eyebrow" style="margin:0 0 2px;color:#c93b2b">\u25CF VOICE RECORDER STUDIO \u2022 RECORD YOUR OWN VOICE</p>' +
            '<h2 style="margin:0 0 4px;font-size:1.35rem">Record <span lang="mg">Fahasalamana?</span> (and any word) with your microphone</h2>' +
            '<p class="meta" style="margin:0">Click <strong>\u25CF Record "Fahasalamana"</strong> below or open the Voice Recorder Studio to record any word, hear your voice immediately across the site, and download the <code>.wav</code> file to upload in chat.</p>' +
          '</div>' +
          '<div class="entry-tools" style="display:flex;flex-wrap:wrap;gap:8px;align-items:center">' +
            ui.speakButtons('Fahasalamana?', { wordId: 'fahasalamana', editKey: 'word:fahasalamana' }) +
            '<a class="btn btn-sm" href="#/record/fahasalamana" style="background:#123F2B;color:#FFF8EC">Open Full Voice Recorder &rarr;</a>' +
          '</div>' +
        '</section>' +
      '</div>' +
      '<div class="miteny-section">' +
        '<p class="section-eyebrow">01 \u2014 LEARN \u2022 ' + ui.esc(core.longDate().toUpperCase()) + '</p>' +
        '<div class="section-head-row">' +
          '<h2>' + (everything ? 'Course complete' : 'Session ' + session.number + ': ' + ui.esc(session.focus)) + '</h2>' +
          '<p class="section-sub">Say each word slowly with the audio, then step into today\u2019s dialogue and roleplay.</p>' +
        '</div>' +
        starterCards(session) +
      '</div>' +

      '<div class="view-narrow" style="margin-top:28px">' +
        '<header class="today-head" hidden>' +
          '<p class="date">' + ui.esc(core.longDate()) + '</p>' +
          '<h1>' + (everything ? 'Course complete' : 'Today') + '</h1>' +
        '</header>' +

        (everything
          ? '<section class="panel session-panel">' +
              '<h2 class="session-title">All ' + total + ' sessions are marked complete</h2>' +
              '<p class="muted">Any session can be replayed from the course outline. Words you rate below “known” keep returning in review.</p>' +
              '<div class="btn-row"><a class="btn btn-lg" href="#/review">Review words</a>' +
              '<a class="btn btn-secondary" href="#/course">Course outline</a></div>' +
            '</section>'
          : '<section class="panel session-panel session-panel-with-photo" aria-labelledby="sessionTitle">' +
              '<div class="session-card-photo"><img src="' + ui.photoForIndex((session.week - 1) * 3 + session.number - 1) + '" alt="Madagascar landscape" loading="lazy"></div>' +
              '<div class="session-meta">' +
                '<span class="week">Week ' + session.week + '</span>' +
                ' <span>Session ' + session.number + ' of ' + session.total_sessions + '</span>' +
                ' <span>Month ' + session.month + '</span>' +
              '</div>' +
              '<h2 class="session-title" id="sessionTitle">' + ui.esc(session.focus) + '</h2>' +
              '<div class="preview">' + previewTurns(session) + '</div>' +
              steps(session, false) +
              '<div class="btn-row">' +
                '<a class="btn btn-lg" href="' + (core.lastPosition() ? core.positionHash(core.lastPosition()) : '#/session/' + session.id + '/dialogue') + '">' + (core.lastPosition() ? 'Continue lesson' : 'Start session') +
                  ui.icon('arrow-right') + '</a>' +
                '<a class="btn btn-quiet" href="#/course/' + session.week + '">Week ' + session.week + ' outline</a>' +
              '</div>' +
            '</section>') +

        '<p class="section-eyebrow" style="margin-top:32px">02 \u2014 PRACTICE</p>' +
        '<div class="review-strip">' +
          '<div>' +
            (due
              ? '<p class="count"><strong>' + due + '</strong> ' + ui.plural(due, 'word') + ' due for flashcard review</p>' +
                '<p class="detail">A ' + round + '-card spaced-repetition round</p>'
              : '<p class="count"><strong>0</strong> words due right now</p>' +
                '<p class="detail">Words join your flashcard deck as you complete sessions, or test yourself with a 10-question quiz.</p>') +
          '</div>' +
          '<div class="btn-row" style="margin-top:0">' +
            (due ? '<a class="btn btn-secondary" href="#/review">Review flashcards</a>' : '') +
            '<a class="btn btn-gold" href="#/quiz">10-question quiz</a>' +
          '</div>' +
        '</div>' +

        '<p class="section-eyebrow" style="margin-top:32px">03 \u2014 RAKIBOLANA \u2022 MALAGASY \u2194 ENGLISH DICTIONARY</p>' +
        '<section class="panel" style="margin-bottom:24px">' +
          '<div class="cult-head-row" style="margin-bottom:14px">' +
            '<div>' +
              '<h2 style="margin:0 0 4px">' + (core.data.vocabulary ? core.data.vocabulary.length.toLocaleString() : '2,198') + ' Official Malagasy Dictionary Entries</h2>' +
              '<p class="meta" style="margin:0">Search in Malagasy or English, browse A\u2013Z or by part of speech (Nouns, Verbs, Adjectives), with phonetic stress guides and recorded neural audio for every word.</p>' +
            '</div>' +
            '<a class="btn btn-lg" href="#/dictionary">Open Full Dictionary ' + ui.icon('arrow-right') + '</a>' +
          '</div>' +
          '<div class="chips" style="margin-bottom:12px">' +
            ['A','B','D','E','F','G','H','I','J','K','L','M','N','O','P','R','S','T','V','Z'].map(function (L) {
              return '<a class="chip" href="#/dictionary/' + L + '" style="text-decoration:none">' + L + '</a>';
            }).join('') +
          '</div>' +
          '<div class="btn-row" style="margin-top:8px">' +
            '<a class="btn btn-secondary btn-sm" href="#/dictionary/all">All ' + (core.data.vocabulary ? core.data.vocabulary.length.toLocaleString() : '2,198') + ' Words</a>' +
            '<a class="btn btn-quiet btn-sm" href="#/dictionary/core">Core A\u2013Z Dictionary (974)</a>' +
            '<a class="btn btn-quiet btn-sm" href="#/dictionary/n">Nouns (837)</a>' +
            '<a class="btn btn-quiet btn-sm" href="#/dictionary/v">Verbs (297)</a>' +
            '<a class="btn btn-quiet btn-sm" href="#/dictionary/adj">Adjectives (200)</a>' +
            '<a class="btn btn-quiet btn-sm" href="#/reference/phrases">Phrasebook (712)</a>' +
          '</div>' +
        '</section>' +

        '<p class="section-eyebrow" style="margin-top:32px">04 \u2014 KOLONTSAINA \u2022 CULTURE &amp; LANDSCAPES</p>' +
        '<div class="cult-head-row">' +
          '<div>' +
            '<h2 style="margin:0 0 4px">Language is more than words.</h2>' +
            '<p class="meta" style="margin:0">Explore Madagascar\u2019s regions, customs, and cultural notes.</p>' +
          '</div>' +
          '<a class="btn btn-secondary" href="#/reference/culture">All ' + (core.data.culture ? core.data.culture.length : 155) + ' culture notes ' + ui.icon('arrow-right') + '</a>' +
        '</div>' +
        '<div class="cult-grid">' +
          (ui.CULTURE_FEATURES || []).slice(0, 3).map(function (c) {
            return '<a class="cult-tile" href="#/reference/culture">' +
              '<img src="' + c.img + '" alt="' + ui.esc(c.sub) + '" loading="lazy">' +
              '<div class="cult-cap">' +
                '<div class="cult-title" lang="mg">' + ui.esc(c.title) + '</div>' +
                '<div class="cult-sub">' + ui.esc(c.sub) + '</div>' +
              '</div>' +
            '</a>';
          }).join('') +
        '</div>' +

        '<div class="today-foot">' +
          '<p class="meta">' + ui.esc(statusLine) + '</p>' +
          '<a class="cta-link" href="#/course">Full 12-week course outline' + ui.icon('chevron-right', 'icon-sm') + '</a>' +
        '</div>' +
      '</div>';
  }

  function mount(root) {
    if (!root) return;
    root.addEventListener('click', function (event) {
      var greetBtn = event.target.closest('[data-speak-greetings]');
      if (greetBtn) {
        if (S.speech && S.speech.play) {
          S.speech.play('media/audio_abidi/lines/dlg-introducing-yourself-0.mp3', { node: greetBtn });
        }
        return;
      }
      ui.speakFrom(event);
    });
  }

  S.views = S.views || {};
  S.views.today = { render: render, mount: mount, nav: 'today' };
})(window.Salama);
