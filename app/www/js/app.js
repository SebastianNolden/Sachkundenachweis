(function () {
  'use strict';

  // Gemeinsame Basis für alle drei Seiten (index.html, test.html,
  // result.html): Konstanten, Seiten-Navigation und kleine Hilfsfunktionen,
  // die von mehr als einer Seite gebraucht werden. Seiten-spezifische Logik
  // bleibt bewusst in test.js bzw. result.js.

  // Feste Testlänge (verbindliche Entscheidung, kein Eingabefeld):
  // ein Testdurchlauf besteht immer aus genau 30 zufällig gezogenen Fragen.
  var TEST_LAENGE = 30;

  // sessionStorage ist ausschließlich die technische Brücke zwischen
  // test.html und result.html für den Übergang eines einzelnen
  // Testdurchlaufs - keine dauerhafte Lernfortschrittsfunktion.
  var ERGEBNIS_STORAGE_KEY = 'sachkundenachweis.letztesTestergebnis';

  var SEITEN = {
    menu: 'index.html',
    test: 'test.html',
    result: 'result.html',
    progress: 'progress.html',
    learn: 'learn.html',
  };

  function geheZu(seite) {
    window.location.href = seite;
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

  // Exakter Mengenvergleich zweier Kennungslisten (Reihenfolge egal, keine
  // Teilpunkte) - u. a. für die Antwortauswertung im Test verwendet.
  function kennungsMengenGleich(a, b) {
    return a.length === b.length && a.every(function (k) { return b.indexOf(k) !== -1; });
  }

  function setStatus(el, text, variant) {
    if (!el) return;
    el.textContent = text || '';
    if (variant) {
      el.setAttribute('data-variant', variant);
    } else {
      el.removeAttribute('data-variant');
    }
  }

  window.App = {
    TEST_LAENGE: TEST_LAENGE,
    ERGEBNIS_STORAGE_KEY: ERGEBNIS_STORAGE_KEY,
    SEITEN: SEITEN,
    geheZu: geheZu,
    gemischteKopie: gemischteKopie,
    kennungsMengenGleich: kennungsMengenGleich,
    setStatus: setStatus,
  };

  // Menüseite: Klick auf "Prüfungstest starten" bzw. "Fortschritt". Die
  // Elemente existieren nur auf index.html - auf den anderen Seiten ist
  // app.js zwar mitgeladen (gemeinsame Basis), findet die Buttons dort aber
  // einfach nicht.
  var startButton = document.getElementById('start-button');
  if (startButton) {
    startButton.addEventListener('click', function () {
      geheZu(SEITEN.test);
    });
  }

  var fortschrittButton = document.getElementById('fortschritt-button');
  if (fortschrittButton) {
    fortschrittButton.addEventListener('click', function () {
      geheZu(SEITEN.progress);
    });
  }

  var lernenButton = document.getElementById('lernen-button');
  if (lernenButton) {
    lernenButton.addEventListener('click', function () {
      geheZu(SEITEN.learn);
    });
  }
})();
