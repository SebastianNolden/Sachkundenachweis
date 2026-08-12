(function () {
  'use strict';

  // --- DOM-Referenzen -------------------------------------------------------
  var statusEl = document.getElementById('status');
  var testContentEl = document.getElementById('test-content');
  var fortschrittBalkenEl = document.getElementById('fortschritt-balken');
  var zaehlerEl = document.getElementById('frage-zaehler');
  var kategorieEl = document.getElementById('frage-kategorie');
  var bildEl = document.getElementById('frage-bild');
  var textEl = document.getElementById('frage-text');
  var formEl = document.getElementById('antworten-form');
  var zurueckButton = document.getElementById('zurueck-button');
  var weiterButton = document.getElementById('weiter-button');

  // --- Statische Lerninhalte (aus content.json, unverändert) ---------------
  var alleFragen = null;

  // --- Test-Session: lebt ausschließlich im Speicher, keine Persistenz -----
  // {
  //   fragen: Frage[]                      - die 30 fuer diesen Durchlauf gezogenen Fragen
  //   index: number                        - aktuelle Position (0-basiert)
  //   antworten: Map<string, Set<string>>  - Frage-ID -> gewaehlte Antwort-Kennungen
  // }
  var session = null;

  // Zieht TEST_LAENGE zufällige, garantiert unterschiedliche Fragen aus dem
  // gesamten Katalog (Fisher-Yates auf einer Kopie + Ausschnitt - jede Frage
  // kommt in der gemischten Kopie genau einmal vor, daher keine Duplikate).
  function zieheZufaelligeFragen() {
    return App.gemischteKopie(alleFragen).slice(0, App.TEST_LAENGE);
  }

  function starteNeuenTest() {
    // Alten Testzustand zuverlässig ersetzen: ein evtl. noch vorhandenes
    // Ergebnis eines früheren Durchlaufs darf ab jetzt nicht mehr gültig sein.
    sessionStorage.removeItem(App.ERGEBNIS_STORAGE_KEY);

    session = {
      fragen: zieheZufaelligeFragen(),
      index: 0,
      antworten: new Map(),
    };
    renderAktuelleFrage();
    testContentEl.hidden = false;
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
      if (!bildEl.parentNode) {
        textEl.parentNode.insertBefore(bildEl, textEl);
      }
    } else {
      // Kein Bild vorhanden: das <img>-Element wird komplett aus dem DOM
      // entfernt statt nur über "hidden" versteckt - so kann kein leerer
      // Bildplatzhalter sichtbar werden, egal was CSS dazu sagt.
      if (bildEl.parentNode) {
        bildEl.parentNode.removeChild(bildEl);
      }
      bildEl.hidden = true;
      bildEl.removeAttribute('src');
    }

    // Ob eine Frage intern eine oder mehrere korrekte Antworten hat, ist
    // ausschließlich für die spätere Auswertung relevant (siehe
    // korrekteKennungen()) - die Eingabe selbst ist für den Benutzer bei
    // jeder Frage identisch: immer eine Checkbox, immer 0 bis 4 auswählbar,
    // damit nicht erkennbar ist, ob eine oder mehrere Antworten korrekt sind.
    var inputType = 'checkbox';
    var vorherigeAuswahl = session.antworten.get(frage.id) || new Set();

    formEl.innerHTML = '';
    frage.antworten.forEach(function (antwort) {
      // <label> umschließt den Input direkt (statt input+label mit "for"):
      // dadurch trifft ein Klick auf die komplette Antwortkarte immer den
      // Input, nicht nur die kleine Auswahlbox. Rein strukturell/visuell,
      // an Auswahl-Logik/-Auswertung ändert das nichts (weiterhin dasselbe
      // <input type="checkbox"> mit name/value/checked).
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
      schliesseTestAb();
    }
  }

  // Eine Frage ist nur dann richtig beantwortet, wenn die gewählten Antwort-
  // Kennungen exakt mit den korrekten Kennungen übereinstimmen (Mengen-
  // vergleich, Reihenfolge egal, keine Teilpunkte) - identische Regel wie in
  // der WPF-Referenz (ResultViewModel) und im fachlichen Datenmodell.
  function korrekteKennungen(frage) {
    return frage.antworten.filter(function (a) { return a.correct; }).map(function (a) { return a.kennung; });
  }

  // Wertet den Test aus, baut das Ergebnisobjekt (inkl. Detaildaten je Frage
  // für die spätere Anzeige falsch beantworteter Fragen), legt es als
  // technische Brücke in sessionStorage ab und navigiert zu result.html.
  // Die Fragen selbst werden nicht dauerhaft gespeichert.
  function schliesseTestAb() {
    var richtig = 0;

    var fragenErgebnis = session.fragen.map(function (frage) {
      var gewaehltSet = session.antworten.get(frage.id);
      var gewaehlt = gewaehltSet ? Array.from(gewaehltSet) : [];
      var korrekt = korrekteKennungen(frage);
      var istRichtig = App.kennungsMengenGleich(gewaehlt, korrekt);

      if (istRichtig) {
        richtig += 1;
      }

      return {
        frageId: frage.id,
        fragetext: frage.fragetext,
        kategorieId: frage.kategorieId,
        bild: frage.bild || null,
        antworten: frage.antworten.map(function (a) {
          return { kennung: a.kennung, text: a.text, correct: a.correct };
        }),
        gewaehlteKennungen: gewaehlt,
        korrekteKennungen: korrekt,
        istRichtig: istRichtig,
      };
    });

    var gesamt = session.fragen.length;
    var falsch = gesamt - richtig;
    var prozent = Math.round((richtig / gesamt) * 100);

    var ergebnis = {
      gesamt: gesamt,
      richtig: richtig,
      falsch: falsch,
      prozent: prozent,
      fragen: fragenErgebnis,
    };

    sessionStorage.setItem(App.ERGEBNIS_STORAGE_KEY, JSON.stringify(ergebnis));
    App.geheZu(App.SEITEN.result);
  }

  function init() {
    App.setStatus(statusEl, 'Lade Fragen …');

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
        if (content.fragen.length < App.TEST_LAENGE) {
          throw new Error(
            'content.json enthält nur ' + content.fragen.length + ' Fragen, benötigt werden ' + App.TEST_LAENGE + '.'
          );
        }

        alleFragen = content.fragen;
        App.setStatus(statusEl, '');
        starteNeuenTest();
      })
      .catch(function (err) {
        console.error('Fehler beim Laden von content.json:', err);
        // Keine gültige Test-Session möglich - sinnvoll reagieren statt einer
        // kaputten/leeren Testseite: zurück zum Hauptmenü.
        App.geheZu(App.SEITEN.menu);
      });
  }

  zurueckButton.addEventListener('click', gehZurueck);
  weiterButton.addEventListener('click', gehWeiterOderAbschliessen);

  document.addEventListener('DOMContentLoaded', init);
})();
