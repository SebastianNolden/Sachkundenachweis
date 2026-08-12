(function () {
  'use strict';

  // Feste Testlänge (verbindliche Entscheidung, kein Eingabefeld):
  // ein Testdurchlauf besteht immer aus genau 30 zufällig gezogenen Fragen.
  var TEST_LAENGE = 30;

  // --- DOM-Referenzen -------------------------------------------------------
  var statusEl = document.getElementById('status');

  var startViewEl = document.getElementById('start-view');
  var startButton = document.getElementById('start-button');

  var testViewEl = document.getElementById('test-view');
  var fortschrittBalkenEl = document.getElementById('fortschritt-balken');
  var zaehlerEl = document.getElementById('frage-zaehler');
  var kategorieEl = document.getElementById('frage-kategorie');
  var bildEl = document.getElementById('frage-bild');
  var textEl = document.getElementById('frage-text');
  var formEl = document.getElementById('antworten-form');
  var zurueckButton = document.getElementById('zurueck-button');
  var weiterButton = document.getElementById('weiter-button');

  var ergebnisViewEl = document.getElementById('ergebnis-view');
  var ergebnisProzentEl = document.getElementById('ergebnis-prozent');
  var ergebnisRichtigWertEl = document.getElementById('ergebnis-richtig-wert');
  var ergebnisFalschWertEl = document.getElementById('ergebnis-falsch-wert');
  var ergebnisDetailsEl = document.getElementById('ergebnis-details');
  var neuerTestButton = document.getElementById('neuer-test-button');

  // --- Statische Lerninhalte (aus content.json, unverändert) ---------------
  var alleFragen = null;

  // --- Test-Session: lebt ausschließlich im Speicher, keine Persistenz -----
  // {
  //   fragen: Frage[]                      - die 30 fuer diesen Durchlauf gezogenen Fragen
  //   index: number                        - aktuelle Position (0-basiert)
  //   antworten: Map<string, Set<string>>  - Frage-ID -> gewaehlte Antwort-Kennungen
  // }
  var session = null;

  function setStatus(text, variant) {
    statusEl.textContent = text || '';
    if (variant) {
      statusEl.setAttribute('data-variant', variant);
    } else {
      statusEl.removeAttribute('data-variant');
    }
  }

  function zeigeView(name) {
    startViewEl.hidden = name !== 'start';
    testViewEl.hidden = name !== 'test';
    ergebnisViewEl.hidden = name !== 'ergebnis';
  }

  // Auswahltyp wird bewusst nicht in content.json gespeichert, sondern hier
  // aus der Anzahl korrekter Antworten abgeleitet (gleiche Regel wie in der
  // Content-Pipeline / im fachlichen Datenmodell festgelegt).
  function istMehrfachauswahl(frage) {
    return frage.antworten.filter(function (a) { return a.correct; }).length > 1;
  }

  // Fisher-Yates-Shuffle: liefert eine neu gemischte Kopie, "liste" selbst
  // bleibt unverändert.
  function gemischteKopie(liste) {
    var kopie = liste.slice();
    for (var i = kopie.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = kopie[i];
      kopie[i] = kopie[j];
      kopie[j] = tmp;
    }
    return kopie;
  }

  // Zieht TEST_LAENGE zufällige, garantiert unterschiedliche Fragen aus dem
  // gesamten Katalog (Fisher-Yates auf einer Kopie + Ausschnitt - jede Frage
  // kommt in der gemischten Kopie genau einmal vor, daher keine Duplikate).
  function zieheZufaelligeFragen() {
    return gemischteKopie(alleFragen).slice(0, TEST_LAENGE);
  }

  function starteNeuenTest() {
    session = {
      fragen: zieheZufaelligeFragen(),
      index: 0,
      antworten: new Map(),
    };
    zeigeView('test');
    renderAktuelleFrage();
  }

  function ausgewaehlteKennungen() {
    var checked = formEl.querySelectorAll('input:checked');
    return Array.prototype.map.call(checked, function (input) { return input.value; });
  }

  // Merkt sich die aktuelle Auswahl für die gerade angezeigte Frage, bevor
  // zur nächsten/vorherigen Frage gewechselt wird.
  function speichereAktuelleAuswahl() {
    var frage = session.fragen[session.index];
    var gewaehlt = ausgewaehlteKennungen();

    if (gewaehlt.length === 0) {
      session.antworten.delete(frage.id);
    } else {
      session.antworten.set(frage.id, new Set(gewaehlt));
    }
  }

  function renderAktuelleFrage() {
    var frage = session.fragen[session.index];

    zaehlerEl.textContent = 'Frage ' + (session.index + 1) + ' von ' + session.fragen.length;
    kategorieEl.textContent = 'Kategorie ' + frage.kategorieId;
    textEl.textContent = frage.fragetext;
    fortschrittBalkenEl.style.width = Math.round(((session.index + 1) / session.fragen.length) * 100) + '%';

    if (frage.bild) {
      bildEl.src = 'images/' + frage.bild + '.png';
      bildEl.alt = 'Bild zu Frage ' + frage.nummer;
      bildEl.hidden = false;
    } else {
      // Kein leerer Bildplatzhalter, wenn die Frage kein Bild hat.
      bildEl.hidden = true;
      bildEl.removeAttribute('src');
    }

    var inputType = istMehrfachauswahl(frage) ? 'checkbox' : 'radio';
    var vorherigeAuswahl = session.antworten.get(frage.id) || new Set();

    formEl.innerHTML = '';
    frage.antworten.forEach(function (antwort) {
      // <label> umschließt den Input direkt (statt input+label mit "for"):
      // dadurch trifft ein Klick auf die komplette Antwortkarte immer den
      // Input, nicht nur die kleine Auswahlbox. Rein strukturell/visuell,
      // an Auswahl-Logik/-Auswertung ändert das nichts (weiterhin dasselbe
      // <input type="radio|checkbox"> mit name/value/checked).
      var wrapper = document.createElement('label');
      wrapper.className = 'antwort-option';

      var input = document.createElement('input');
      input.type = inputType;
      input.name = 'antwort';
      input.value = antwort.kennung;
      input.id = 'antwort-' + antwort.kennung;
      input.checked = vorherigeAuswahl.has(antwort.kennung);

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
    });

    zurueckButton.disabled = session.index === 0;
    weiterButton.textContent = session.index === session.fragen.length - 1 ? 'Test abschließen' : 'Weiter';
  }

  function gehZurueck() {
    if (!session || session.index === 0) return;
    speichereAktuelleAuswahl();
    session.index -= 1;
    renderAktuelleFrage();
  }

  function gehWeiterOderAbschliessen() {
    if (!session) return;
    speichereAktuelleAuswahl();

    if (session.index < session.fragen.length - 1) {
      session.index += 1;
      renderAktuelleFrage();
    } else {
      zeigeErgebnis();
    }
  }

  // Eine Frage ist nur dann richtig beantwortet, wenn die gewählten Antwort-
  // Kennungen exakt mit den korrekten Kennungen übereinstimmen (Mengen-
  // vergleich, Reihenfolge egal, keine Teilpunkte) - identische Regel wie in
  // der WPF-Referenz (ResultViewModel) und im fachlichen Datenmodell.
  function istAntwortRichtig(frage, gewaehlteKennungen) {
    var korrekt = frage.antworten.filter(function (a) { return a.correct; }).map(function (a) { return a.kennung; });
    var gewaehlt = gewaehlteKennungen || [];

    return (
      gewaehlt.length === korrekt.length &&
      korrekt.every(function (k) { return gewaehlt.indexOf(k) !== -1; })
    );
  }

  function zeigeErgebnis() {
    var richtig = 0;

    session.fragen.forEach(function (frage) {
      var gewaehltSet = session.antworten.get(frage.id);
      var gewaehlt = gewaehltSet ? Array.from(gewaehltSet) : [];
      if (istAntwortRichtig(frage, gewaehlt)) {
        richtig += 1;
      }
    });

    var gesamt = session.fragen.length;
    var falsch = gesamt - richtig;
    var prozent = Math.round((richtig / gesamt) * 100);

    ergebnisProzentEl.textContent = prozent + ' %';
    ergebnisRichtigWertEl.textContent = String(richtig);
    ergebnisFalschWertEl.textContent = String(falsch);
    ergebnisDetailsEl.textContent = 'von ' + gesamt + ' Fragen';

    zeigeView('ergebnis');
  }

  function init() {
    setStatus('Lade Fragen …');

    fetch('content.json')
      .then(function (response) {
        if (!response.ok) {
          throw new Error('Server antwortete mit Status ' + response.status);
        }
        return response.json();
      })
      .then(function (content) {
        if (!content || !Array.isArray(content.fragen) || content.fragen.length === 0) {
          throw new Error('content.json enthält keine Fragen.');
        }
        if (content.fragen.length < TEST_LAENGE) {
          throw new Error(
            'content.json enthält nur ' + content.fragen.length + ' Fragen, benötigt werden ' + TEST_LAENGE + '.'
          );
        }

        alleFragen = content.fragen;
        setStatus('');
        zeigeView('start');
      })
      .catch(function (err) {
        console.error('Fehler beim Laden von content.json:', err);
        setStatus(
          'content.json konnte nicht geladen werden. Bitte Installation prüfen. (' + err.message + ')',
          'error'
        );
      });
  }

  startButton.addEventListener('click', starteNeuenTest);
  zurueckButton.addEventListener('click', gehZurueck);
  weiterButton.addEventListener('click', gehWeiterOderAbschliessen);
  neuerTestButton.addEventListener('click', starteNeuenTest);

  document.addEventListener('DOMContentLoaded', init);
})();
