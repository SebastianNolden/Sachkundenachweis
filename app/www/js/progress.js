(function () {
  'use strict';

  // UI-Schicht der Fortschrittsseite: lädt Fragen (QuestionRepository) und
  // Attempts (AttemptRepository), lässt LearningService die Fachlogik
  // berechnen und rendert ausschließlich das fertige Ergebnis. Kein SQL,
  // keine Statusregeln hier - siehe js/services/learningService.js.

  var statusEl = document.getElementById('status');
  var contentEl = document.getElementById('progress-content');

  var gesamtAnzahlGelerntEl = document.getElementById('gesamt-anzahl-gelernt');
  var gesamtFortschrittBalkenEl = document.getElementById('gesamt-fortschritt-balken');
  var gesamtGelerntWertEl = document.getElementById('gesamt-gelernt-wert');
  var gesamtFestigungWertEl = document.getElementById('gesamt-festigung-wert');
  var gesamtAngefangenWertEl = document.getElementById('gesamt-angefangen-wert');
  var gesamtUnsicherWertEl = document.getElementById('gesamt-unsicher-wert');
  var gesamtNeuWertEl = document.getElementById('gesamt-neu-wert');
  var gesamtDetailsEl = document.getElementById('gesamt-details');
  var kategorienListeEl = document.getElementById('kategorien-liste');
  var fragenListeEl = document.getElementById('fragen-liste');
  var hauptmenuButton = document.getElementById('progress-hauptmenu-button');
  var hauptmenuButtonObenEl = document.getElementById('progress-hauptmenu-button-oben');
  var nachObenButton = document.getElementById('nach-oben-button');

  // Ab dieser Scrollposition (in px) gilt "ein sinnvolles Stück nach unten
  // gescrollt" - der Floating-Button erscheint erst dann.
  var NACH_OBEN_BUTTON_SCHWELLENWERT = 400;

  var STATUS_LABEL = {
    neu: 'neu',
    angefangen: 'angefangen',
    festigung: 'Festigung',
    gelernt: 'gelernt',
    unsicher: 'unsicher',
  };

  function formatiereDatum(iso) {
    if (!iso) return '–';
    var datum = new Date(iso);
    return datum.toLocaleDateString('de-DE');
  }

  function erzeugeKategorieKarte(kategorie) {
    var karte = document.createElement('div');
    karte.className = 'card kategorie-karte';

    var kopf = document.createElement('div');
    kopf.className = 'kategorie-kopf';

    var name = document.createElement('span');
    name.className = 'kategorie-name';
    name.textContent = kategorie.name;

    var anteil = document.createElement('span');
    anteil.className = 'kategorie-anteil';
    anteil.textContent = kategorie.anzahlGelernt + ' / ' + kategorie.anzahlFragen + ' gelernt';

    kopf.appendChild(name);
    kopf.appendChild(anteil);
    karte.appendChild(kopf);

    var prozent = document.createElement('p');
    prozent.className = 'kategorie-prozent';
    prozent.textContent = kategorie.prozentGelernt + ' %';
    karte.appendChild(prozent);

    var leiste = document.createElement('div');
    leiste.className = 'fortschritt-leiste';
    leiste.setAttribute('aria-hidden', 'true');
    var balken = document.createElement('div');
    balken.className = 'fortschritt-balken';
    balken.style.width = kategorie.prozentGelernt + '%';
    leiste.appendChild(balken);
    karte.appendChild(leiste);

    return karte;
  }

  function fuegeDetailZeileHinzu(liste, label, wert) {
    var dt = document.createElement('dt');
    dt.textContent = label;
    var dd = document.createElement('dd');
    dd.textContent = wert;
    liste.appendChild(dt);
    liste.appendChild(dd);
  }

  function erzeugeFrageEintrag(frage, fortschritt) {
    var eintrag = document.createElement('details');
    eintrag.className = 'frage-eintrag';

    var summary = document.createElement('summary');

    var nummer = document.createElement('span');
    nummer.className = 'frage-eintrag-nummer';
    nummer.textContent = '#' + frage.nummer;

    var text = document.createElement('span');
    text.className = 'frage-eintrag-text';
    text.textContent = frage.fragetext;

    var badge = document.createElement('span');
    badge.className = 'status-badge status-badge--' + fortschritt.status;
    badge.textContent = STATUS_LABEL[fortschritt.status] || fortschritt.status;

    summary.appendChild(nummer);
    summary.appendChild(text);
    summary.appendChild(badge);
    eintrag.appendChild(summary);

    var details = document.createElement('dl');
    details.className = 'frage-eintrag-details';
    fuegeDetailZeileHinzu(details, 'Versuche', String(fortschritt.anzahlVersuche));
    fuegeDetailZeileHinzu(details, 'Richtig', String(fortschritt.anzahlRichtig));
    fuegeDetailZeileHinzu(details, 'Falsch', String(fortschritt.anzahlFalsch));
    fuegeDetailZeileHinzu(details, 'Erfolgstage', String(fortschritt.erfolgstage));
    fuegeDetailZeileHinzu(details, 'Letzte Antwort', formatiereDatum(fortschritt.letzteAntwort));
    eintrag.appendChild(details);

    return eintrag;
  }

  function render(fragen, gesamt, kategorieFortschritt, fragenFortschritt) {
    gesamtAnzahlGelerntEl.textContent = gesamt.anzahlGelernt + ' von ' + gesamt.anzahlFragenGesamt + ' Fragen gelernt';
    gesamtFortschrittBalkenEl.style.width = gesamt.prozentGelernt + '%';
    gesamtGelerntWertEl.textContent = String(gesamt.anzahlGelernt);
    gesamtFestigungWertEl.textContent = String(gesamt.anzahlFestigung);
    gesamtAngefangenWertEl.textContent = String(gesamt.anzahlAngefangen);
    gesamtUnsicherWertEl.textContent = String(gesamt.anzahlUnsicher);
    gesamtNeuWertEl.textContent = String(gesamt.anzahlNeu);
    gesamtDetailsEl.textContent =
      gesamt.prozentGelernt + ' % · ' +
      gesamt.anzahlRichtigGesamt + ' richtige und ' + gesamt.anzahlFalschGesamt + ' falsche Antworten insgesamt · ' +
      gesamt.anzahlErfolgstageGesamt + ' verschiedene Erfolgstage';

    kategorienListeEl.innerHTML = '';
    kategorieFortschritt.forEach(function (kategorie) {
      kategorienListeEl.appendChild(erzeugeKategorieKarte(kategorie));
    });

    var fortschrittProFrage = {};
    fragenFortschritt.forEach(function (eintrag) {
      fortschrittProFrage[eintrag.questionId] = eintrag;
    });

    fragenListeEl.innerHTML = '';
    fragen.forEach(function (frage) {
      var fortschritt = fortschrittProFrage[frage.id];
      if (!fortschritt) return; // sollte nicht vorkommen, defensiv
      fragenListeEl.appendChild(erzeugeFrageEintrag(frage, fortschritt));
    });

    contentEl.hidden = false;
  }

  function init() {
    App.setStatus(statusEl, 'Lade Fortschritt …');

    // Kategorie-Namen/Reihenfolge kommen ausschließlich aus content.json
    // (keine Duplikation in SQLite) - der Zugriff läuft vollständig über
    // QuestionRepository, progress.js besitzt keine eigene content.json-
    // Ladelogik mehr.
    Promise.all([QuestionRepository.ladeAlle(), AttemptRepository.getAllAttempts(), QuestionRepository.ladeKategorien()])
      .then(function (ergebnisse) {
        var fragen = ergebnisse[0];
        var attempts = ergebnisse[1];
        var kategorien = ergebnisse[2];

        var fragenFortschritt = LearningService.berechneFragenFortschritt(fragen, attempts);
        var gesamt = LearningService.berechneGesamtstatistik(attempts, fragenFortschritt);
        var kategorieFortschrittRoh = LearningService.berechneKategorieFortschritt(fragenFortschritt, fragen);

        var kategorieMetaProId = {};
        kategorien.forEach(function (k) { kategorieMetaProId[k.kennung] = k; });

        var kategorieFortschritt = kategorieFortschrittRoh
          .map(function (eintrag) {
            var meta = kategorieMetaProId[eintrag.kategorieId] || { name: 'Kategorie ' + eintrag.kategorieId, reihenfolge: 999 };
            return {
              kategorieId: eintrag.kategorieId,
              name: meta.name,
              reihenfolge: meta.reihenfolge,
              anzahlFragen: eintrag.anzahlFragen,
              anzahlGelernt: eintrag.anzahlGelernt,
              prozentGelernt: eintrag.prozentGelernt,
              anzahlNeu: eintrag.anzahlNeu,
              anzahlAngefangen: eintrag.anzahlAngefangen,
              anzahlFestigung: eintrag.anzahlFestigung,
              anzahlUnsicher: eintrag.anzahlUnsicher,
            };
          })
          .sort(function (a, b) { return a.reihenfolge - b.reihenfolge; });

        App.setStatus(statusEl, '');
        render(fragen, gesamt, kategorieFortschritt, fragenFortschritt);
        // Falls die Seite (z. B. durch den Browser) bereits gescrollt geladen
        // wird, direkt den passenden Anfangszustand setzen statt auf das
        // erste scroll-Ereignis zu warten.
        aktualisiereNachObenButton();
      })
      .catch(function (err) {
        console.error('Fehler beim Laden des Fortschritts:', err);
        // Keine kaputte/leere Ansicht und keine erfundenen Daten - der
        // Bereich bleibt hidden, stattdessen eine verständliche Fehlermeldung.
        App.setStatus(
          statusEl,
          'Fortschritt konnte nicht geladen werden. Bitte SQLite-Verfügbarkeit prüfen. (' + err.message + ')',
          'error'
        );
      });
  }

  function geheZumHauptmenu() {
    App.geheZu(App.SEITEN.menu);
  }

  // Zeigt den Floating-"Nach oben"-Button erst, sobald ein sinnvolles Stück
  // gescrollt wurde, und blendet ihn am Seitenanfang wieder aus.
  function aktualisiereNachObenButton() {
    var scrollPosition = window.scrollY || document.documentElement.scrollTop || 0;
    nachObenButton.hidden = scrollPosition < NACH_OBEN_BUTTON_SCHWELLENWERT;
  }

  hauptmenuButton.addEventListener('click', geheZumHauptmenu);
  hauptmenuButtonObenEl.addEventListener('click', geheZumHauptmenu);

  window.addEventListener('scroll', aktualisiereNachObenButton);
  nachObenButton.addEventListener('click', function () {
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
  });

  document.addEventListener('DOMContentLoaded', init);
})();
