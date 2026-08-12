(function () {
  'use strict';

  // Lernmodus: endlose Folge einzelner Fragen mit sofortigem Feedback.
  // Fachlich klar getrennt vom Prüfungstest (test.js bleibt unverändert):
  // keine feste Fragenzahl, kein Zähler, sofortige Bewertung je Frage statt
  // Ergebnis am Ende, gewichtete statt rein zufällige Fragenauswahl.
  //
  // Architektur: DOM/Session-Zustand/Persistenz-Aufrufe leben hier;
  // Statusregeln und die Auswahl-Fachlogik liegen ausschließlich im
  // (weiterhin reinen, I/O-freien) LearningService.

  // --- DOM-Referenzen -------------------------------------------------------
  var statusEl = document.getElementById('status');
  var learnContentEl = document.getElementById('learn-content');
  var kategorieEl = document.getElementById('frage-kategorie');
  var bildEl = document.getElementById('frage-bild');
  var textEl = document.getElementById('frage-text');
  var formEl = document.getElementById('antworten-form');
  var pruefenButton = document.getElementById('pruefen-button');
  var naechsteButton = document.getElementById('naechste-button');
  var hauptmenuButton = document.getElementById('learn-hauptmenu-button');

  // Eine gerade geprüfte Frage darf für die nächsten SPERR_LAENGE geprüften
  // Lernfragen nicht erneut ausgewählt werden (siehe starteSperre unten).
  // Rein sitzungsintern, siehe session.gesperrteFragenIds - wird NICHT in
  // SQLite gespeichert und beginnt bei jedem Öffnen des Lernmodus neu.
  var SPERR_LAENGE = 5;

  // --- Lern-Session: lebt ausschließlich im Speicher ------------------------
  // {
  //   fragenById: { [questionId]: Frage },
  //   attemptsProFrage: { [questionId]: Attempt[] }  - Rohdaten, initial aus
  //     AttemptRepository.getAllAttempts(), danach lokal ergänzt (siehe
  //     persistiereUndAktualisiere) statt bei jeder Antwort neu zu laden.
  //   fragenFortschrittListe: FortschrittObjekt[]  - wird waehleNaechsteFrage()
  //     übergeben; Einträge werden inkrementell in-place aktualisiert.
  //   fragenFortschrittById: { [questionId]: FortschrittObjekt }  - dieselben
  //     Objekte wie in fragenFortschrittListe, nur zusätzlich indiziert.
  //   gesperrteFragenIds: string[]  - FIFO, max. SPERR_LAENGE Einträge.
  //   aktuelleFrage: Frage|null,
  //   antwortElemente: { kennung, text, label, input }[]  - für die gerade
  //     angezeigte Frage, gefüllt beim Rendern, ausgewertet beim Prüfen.
  //   auswahlGeprueft: boolean,
  // }
  var session = null;

  function korrekteKennungen(frage) {
    return frage.antworten.filter(function (a) { return a.correct; }).map(function (a) { return a.kennung; });
  }

  function ausgewaehlteKennungen() {
    var checked = formEl.querySelectorAll('input:checked');
    return Array.prototype.map.call(checked, function (input) { return input.value; });
  }

  function baueFragenIndex(fragen) {
    var index = {};
    fragen.forEach(function (f) { index[f.id] = f; });
    return index;
  }

  function gruppiereNachQuestionId(attempts) {
    var gruppen = {};
    attempts.forEach(function (a) {
      if (!gruppen[a.questionId]) gruppen[a.questionId] = [];
      gruppen[a.questionId].push(a);
    });
    return gruppen;
  }

  // Berechnet den Status einer einzelnen Frage neu (nach einem soeben lokal
  // ergänzten Attempt) und aktualisiert den bereits vorhandenen Fortschritts-
  // Eintrag IN PLACE - dieselbe Objektreferenz steckt sowohl in
  // fragenFortschrittListe als auch in fragenFortschrittById, ein voller
  // SQLite-Reload ist dafür nicht nötig (siehe Auftrag Abschnitt 21).
  function aktualisiereFortschrittFuerFrage(questionId) {
    var neu = LearningService.berechneStatus(session.attemptsProFrage[questionId] || []);
    var eintrag = session.fragenFortschrittById[questionId];
    eintrag.status = neu.status;
    eintrag.anzahlVersuche = neu.anzahlVersuche;
    eintrag.anzahlRichtig = neu.anzahlRichtig;
    eintrag.anzahlFalsch = neu.anzahlFalsch;
    eintrag.letzteAntwort = neu.letzteAntwort;
    eintrag.letzteRichtigeAntwort = neu.letzteRichtigeAntwort;
    eintrag.zuletztBearbeitet = neu.zuletztBearbeitet;
    eintrag.erfolgstage = neu.erfolgstage;
  }

  function zeigeNaechsteFrage() {
    var heuteKey = LearningService.lokalerTagKey(new Date().toISOString());
    var questionId = LearningService.waehleNaechsteFrage(
      session.fragenFortschrittListe,
      session.gesperrteFragenIds,
      heuteKey
    );

    if (!questionId) {
      // Praktisch nur bei komplett leerem Fragenkatalog möglich - wäre schon
      // beim Laden abgefangen worden, defensiv trotzdem behandelt statt
      // eine kaputte/leere Ansicht zu zeigen.
      App.setStatus(statusEl, 'Es sind keine Fragen verfügbar.', 'error');
      return;
    }

    session.aktuelleFrage = session.fragenById[questionId];
    session.auswahlGeprueft = false;
    renderFrage();
  }

  function renderFrage() {
    var frage = session.aktuelleFrage;

    kategorieEl.textContent = 'Kategorie ' + frage.kategorieId;
    textEl.textContent = frage.fragetext;

    if (frage.bild) {
      bildEl.src = 'images/' + frage.bild + '.png';
      bildEl.alt = 'Bild zu Frage ' + frage.nummer;
      bildEl.hidden = false;
      if (!bildEl.parentNode) {
        textEl.parentNode.insertBefore(bildEl, textEl);
      }
    } else {
      // Kein Bild vorhanden: das <img>-Element wird komplett aus dem DOM
      // entfernt statt nur über "hidden" versteckt - identisches Vorgehen
      // wie im Prüfungstest (test.js), siehe dortige Begründung.
      if (bildEl.parentNode) {
        bildEl.parentNode.removeChild(bildEl);
      }
      bildEl.hidden = true;
      bildEl.removeAttribute('src');
    }

    // Immer Checkbox, unabhängig von der Anzahl korrekter Antworten - exakt
    // dasselbe Vorgehen wie im Prüfungstest (test.js), damit Single- und
    // Multiple-Choice visuell nicht unterscheidbar sind. Anders als im
    // Prüfungstest gibt es hier keine "vorherige Auswahl": jede angezeigte
    // Lernfrage startet mit leerer Auswahl (kein Vor/Zurück im Lernmodus).
    session.antwortElemente = [];
    formEl.innerHTML = '';
    frage.antworten.forEach(function (antwort) {
      var wrapper = document.createElement('label');
      wrapper.className = 'antwort-option';

      var input = document.createElement('input');
      input.type = 'checkbox';
      input.name = 'antwort';
      input.value = antwort.kennung;
      input.id = 'antwort-' + antwort.kennung;

      var box = document.createElement('span');
      box.className = 'antwort-box';
      box.setAttribute('aria-hidden', 'true');

      var text = document.createElement('span');
      text.className = 'antwort-text';
      text.textContent = antwort.text;

      wrapper.appendChild(input);
      wrapper.appendChild(box);
      wrapper.appendChild(text);
      formEl.appendChild(wrapper);

      session.antwortElemente.push({ kennung: antwort.kennung, text: antwort.text, label: wrapper, input: input });
    });

    pruefenButton.hidden = false;
    naechsteButton.hidden = true;
  }

  // Visuelles Feedback je Antwortoption (siehe Auftrag Abschnitt 7):
  //   ausgewählt + korrekt      -> grün
  //   ausgewählt + falsch       -> rot
  //   nicht ausgewählt + korrekt -> rot (bewusst, macht übersehene richtige
  //                                       Antworten sichtbar)
  //   nicht ausgewählt + falsch  -> unverändert/neutral
  function markiereAntwortoptionen(gewaehlt, korrekt) {
    session.antwortElemente.forEach(function (eintrag) {
      var istGewaehlt = gewaehlt.indexOf(eintrag.kennung) !== -1;
      var istKorrekt = korrekt.indexOf(eintrag.kennung) !== -1;

      if (istGewaehlt && istKorrekt) {
        eintrag.label.classList.add('antwort-option--richtig');
      } else if (istGewaehlt !== istKorrekt) {
        eintrag.label.classList.add('antwort-option--falsch');
      }
      // istGewaehlt === false && istKorrekt === false: neutral, keine Klasse.

      // Antwortoptionen sind nach dem Prüfen nicht mehr veränderbar - ein
      // <label> aktiviert ein disabled Input beim Klick nicht mehr, die
      // gesamte Karte wird dadurch inert (siehe :has(input:disabled) in
      // styles.css für die passende Cursor-Anpassung).
      eintrag.input.disabled = true;
    });
  }

  // Ergänzt den neuen Attempt lokal (statt eines vollen SQLite-Reloads),
  // aktualisiert Status/Sperrliste sofort und persistiert im Hintergrund.
  // Ein SQLite-Fehler beim Speichern darf den Lernmodus nicht blockieren
  // oder abstürzen lassen - der lokale Zustand bleibt in jedem Fall korrekt.
  function persistiereUndAktualisiere(frage, gewaehlt, istRichtig) {
    var jetzt = new Date().toISOString();

    if (!session.attemptsProFrage[frage.id]) {
      session.attemptsProFrage[frage.id] = [];
    }
    session.attemptsProFrage[frage.id].push({
      id: Date.now(),
      questionId: frage.id,
      answeredAt: jetzt,
      result: istRichtig ? 'correct' : 'wrong',
      selectedAnswers: gewaehlt,
      context: 'learning',
      testSessionId: null,
    });

    aktualisiereFortschrittFuerFrage(frage.id);

    // Sperre erst NACH dem Prüfen aktualisieren, nicht beim bloßen Anzeigen.
    session.gesperrteFragenIds.push(frage.id);
    if (session.gesperrteFragenIds.length > SPERR_LAENGE) {
      session.gesperrteFragenIds.shift();
    }

    AttemptRepository.createAttempt({
      questionId: frage.id,
      answeredAt: jetzt,
      result: istRichtig ? 'correct' : 'wrong',
      selectedAnswers: gewaehlt,
      context: 'learning',
      testSessionId: null,
    }).catch(function (err) {
      console.error('Konnte Lern-Attempt nicht in SQLite speichern:', err);
    });
  }

  function pruefeAntwort() {
    if (!session || !session.aktuelleFrage || session.auswahlGeprueft) return;

    var frage = session.aktuelleFrage;
    var gewaehlt = ausgewaehlteKennungen();
    var korrekt = korrekteKennungen(frage);
    // Exakter Mengenvergleich - dieselbe, unveränderte Bewertungslogik wie
    // im Prüfungstest (App.kennungsMengenGleich aus app.js): fehlende
    // korrekte Antwort, zusätzliche falsche Antwort oder leere Auswahl sind
    // jeweils falsch, keine Teilpunkte.
    var istRichtig = App.kennungsMengenGleich(gewaehlt, korrekt);

    // Kein zusätzlicher "Richtig"/"Falsch"-Text mehr - die farbliche
    // Markierung der Antwortoptionen (siehe markiereAntwortoptionen) ist die
    // alleinige Rückmeldung.
    markiereAntwortoptionen(gewaehlt, korrekt);

    session.auswahlGeprueft = true;
    pruefenButton.hidden = true;
    naechsteButton.hidden = false;

    persistiereUndAktualisiere(frage, gewaehlt, istRichtig);
  }

  function init() {
    App.setStatus(statusEl, 'Lade Fragen …');

    QuestionRepository.ladeAlle()
      .then(function (fragen) {
        if (!fragen || fragen.length === 0) {
          throw new Error('content.json enthält keine Fragen.');
        }

        return AttemptRepository.getAllAttempts()
          .catch(function (err) {
            // SQLite nicht verfügbar: Lernmodus funktioniert trotzdem weiter,
            // nur eben ohne Gewichtung (siehe unten - ohne Attempts sind
            // alle Fragen "neu" und damit gleich gewichtet, was einer
            // ungewichteten Zufallsauswahl entspricht). Kein Absturz, keine
            // erfundenen Daten.
            console.error('Konnte Lernfortschritt nicht laden (SQLite nicht verfügbar):', err);
            return null;
          })
          .then(function (attempts) {
            var sqliteVerfuegbar = attempts !== null;
            var alleAttempts = attempts || [];

            var fragenFortschrittListe = LearningService.berechneFragenFortschritt(fragen, alleAttempts);
            var fragenFortschrittById = {};
            fragenFortschrittListe.forEach(function (f) { fragenFortschrittById[f.questionId] = f; });

            session = {
              fragenById: baueFragenIndex(fragen),
              attemptsProFrage: gruppiereNachQuestionId(alleAttempts),
              fragenFortschrittListe: fragenFortschrittListe,
              fragenFortschrittById: fragenFortschrittById,
              gesperrteFragenIds: [],
              aktuelleFrage: null,
              antwortElemente: [],
              auswahlGeprueft: false,
            };

            if (sqliteVerfuegbar) {
              App.setStatus(statusEl, '');
            } else {
              App.setStatus(
                statusEl,
                'Lernfortschritt aktuell nicht verfügbar - Fragen werden ohne Gewichtung angezeigt.',
                'error'
              );
            }

            zeigeNaechsteFrage();
            learnContentEl.hidden = false;
          });
      })
      .catch(function (err) {
        console.error('Fehler beim Laden des Lernmodus:', err);
        // Harter Fehler (kein content.json / keine Fragen) - keine kaputte
        // Seite, stattdessen zurück zum Hauptmenü, analog zu test.js.
        App.geheZu(App.SEITEN.menu);
      });
  }

  // Nur beim tatsächlichen Wechsel zu einer neuen Frage (Klick auf "Nächste
  // Frage") nach oben scrollen - nicht beim Prüfen und nicht bei der
  // Antwortauswahl. zeigeNaechsteFrage() selbst bleibt ohne Scroll-Aufruf,
  // da sie auch beim initialen Laden der ersten Frage verwendet wird
  // (dasselbe Muster wie gehZurueck()/gehWeiterOderAbschliessen() in test.js).
  function gehZurNaechstenFrage() {
    zeigeNaechsteFrage();
    window.scrollTo(0, 0);
  }

  pruefenButton.addEventListener('click', pruefeAntwort);
  naechsteButton.addEventListener('click', gehZurNaechstenFrage);
  hauptmenuButton.addEventListener('click', function () {
    // Keine Lernsession zu persistieren - nur bereits geprüfte Antworten
    // wurden als Attempts gespeichert (siehe persistiereUndAktualisiere).
    App.geheZu(App.SEITEN.menu);
  });

  document.addEventListener('DOMContentLoaded', init);
})();
