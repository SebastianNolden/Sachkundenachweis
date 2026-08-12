(function () {
  'use strict';

  // --- DOM-Referenzen -------------------------------------------------------
  var resultContentEl = document.getElementById('result-content');
  var ergebnisProzentEl = document.getElementById('ergebnis-prozent');
  var ergebnisRichtigWertEl = document.getElementById('ergebnis-richtig-wert');
  var ergebnisFalschWertEl = document.getElementById('ergebnis-falsch-wert');
  var ergebnisDetailsEl = document.getElementById('ergebnis-details');
  var falscheFragenSektionEl = document.getElementById('falsche-fragen-sektion');
  var falscheFragenListeEl = document.getElementById('falsche-fragen-liste');
  var neuerTestButton = document.getElementById('neuer-test-button');
  var hauptmenuButton = document.getElementById('hauptmenu-button');

  // Liest das von test.js in sessionStorage abgelegte Ergebnisobjekt.
  // sessionStorage ist hier ausschließlich die technische Brücke zwischen
  // test.html und result.html - keine dauerhafte Lernfortschrittsfunktion.
  function ladeErgebnis() {
    var rohwert = sessionStorage.getItem(App.ERGEBNIS_STORAGE_KEY);
    if (!rohwert) return null;

    try {
      var ergebnis = JSON.parse(rohwert);
      if (!ergebnis || typeof ergebnis.gesamt !== 'number' || !Array.isArray(ergebnis.fragen)) {
        return null;
      }
      return ergebnis;
    } catch (err) {
      console.error('Testergebnis in sessionStorage ist ungültig:', err);
      return null;
    }
  }

  function kennungenZuTexten(antworten, kennungen) {
    return kennungen.map(function (kennung) {
      var antwort = antworten.filter(function (a) { return a.kennung === kennung; })[0];
      return antwort ? antwort.text : kennung;
    });
  }

  function erzeugeFalscheFrageKarte(frageErgebnis) {
    var karte = document.createElement('div');
    karte.className = 'card falsche-frage-karte';

    var kopf = document.createElement('div');
    kopf.className = 'frage-card-kopf';
    var kategorie = document.createElement('span');
    kategorie.className = 'frage-kategorie';
    kategorie.textContent = 'Kategorie ' + frageErgebnis.kategorieId;
    kopf.appendChild(kategorie);
    karte.appendChild(kopf);

    if (frageErgebnis.bild) {
      var bild = document.createElement('img');
      bild.className = 'frage-bild';
      bild.src = 'images/' + frageErgebnis.bild + '.png';
      bild.alt = '';
      karte.appendChild(bild);
    }

    var text = document.createElement('p');
    text.className = 'falsche-frage-text';
    text.textContent = frageErgebnis.fragetext;
    karte.appendChild(text);

    var deineTexte = kennungenZuTexten(frageErgebnis.antworten, frageErgebnis.gewaehlteKennungen);
    var deineAntwort = document.createElement('p');
    deineAntwort.className = 'falsche-frage-antwort falsche-frage-antwort--gewaehlt';
    deineAntwort.textContent = 'Deine Antwort: ' + (deineTexte.length ? deineTexte.join('; ') : 'keine Antwort ausgewählt');
    karte.appendChild(deineAntwort);

    var korrekteTexte = kennungenZuTexten(frageErgebnis.antworten, frageErgebnis.korrekteKennungen);
    var korrekteAntwort = document.createElement('p');
    korrekteAntwort.className = 'falsche-frage-antwort falsche-frage-antwort--korrekt';
    korrekteAntwort.textContent = 'Richtige Antwort: ' + korrekteTexte.join('; ');
    karte.appendChild(korrekteAntwort);

    return karte;
  }

  function renderErgebnis(ergebnis) {
    ergebnisProzentEl.textContent = ergebnis.prozent + ' %';
    ergebnisRichtigWertEl.textContent = String(ergebnis.richtig);
    ergebnisFalschWertEl.textContent = String(ergebnis.falsch);
    ergebnisDetailsEl.textContent = 'von ' + ergebnis.gesamt + ' Fragen';

    var falscheFragen = ergebnis.fragen.filter(function (f) { return !f.istRichtig; });

    if (falscheFragen.length === 0) {
      falscheFragenSektionEl.hidden = true;
    } else {
      falscheFragenListeEl.innerHTML = '';
      falscheFragen.forEach(function (frageErgebnis) {
        falscheFragenListeEl.appendChild(erzeugeFalscheFrageKarte(frageErgebnis));
      });
      falscheFragenSektionEl.hidden = false;
    }

    resultContentEl.hidden = false;
  }

  function init() {
    var ergebnis = ladeErgebnis();
    if (!ergebnis) {
      // Kein gültiges Testergebnis vorhanden - sinnvoll reagieren statt einer
      // leeren Ergebnisansicht: zurück zum Hauptmenü.
      App.geheZu(App.SEITEN.menu);
      return;
    }
    renderErgebnis(ergebnis);
  }

  neuerTestButton.addEventListener('click', function () {
    // Alten Testzustand zuverlässig ersetzen, bevor der neue Testdurchlauf
    // beginnt (test.js legt ohnehin ein frisches Ergebnis an, dies ist eine
    // zusätzliche Absicherung für den Übergang selbst).
    sessionStorage.removeItem(App.ERGEBNIS_STORAGE_KEY);
    App.geheZu(App.SEITEN.test);
  });

  hauptmenuButton.addEventListener('click', function () {
    App.geheZu(App.SEITEN.menu);
  });

  document.addEventListener('DOMContentLoaded', init);
})();
