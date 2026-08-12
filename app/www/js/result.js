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

  // Liefert die Antworttexte einer Frage in der Reihenfolge, in der sie im
  // Fragenkatalog stehen (frageErgebnis.antworten, unverändert aus
  // content.json übernommen) und dabei jeweils nur, ob sie in "kennungen"
  // enthalten sind - so ist die Reihenfolge unabhängig von Klickreihenfolge
  // bzw. der Reihenfolge korrekter Kennungen stets nachvollziehbar (A, B, C, D).
  function nachvollziehbareTexte(antworten, kennungen) {
    return antworten
      .filter(function (a) { return kennungen.indexOf(a.kennung) !== -1; })
      .map(function (a) { return a.text; });
  }

  // Baut eine Liste einzelner Antwort-Einträge (kein zusammengeklebter
  // Fließtext) für eine Antwortgruppe ("Meine Antwort" bzw. "Richtige
  // Antwort"). Bei leerer Auswahl wird stattdessen ein einzelner,
  // verständlicher Hinweistext angezeigt.
  function erzeugeAntwortgruppe(titel, texte, varianteKlasse) {
    var gruppe = document.createElement('div');
    gruppe.className = 'falsche-frage-antwortgruppe ' + varianteKlasse;

    var titelEl = document.createElement('p');
    titelEl.className = 'falsche-frage-antwortgruppe-titel';
    titelEl.textContent = titel;
    gruppe.appendChild(titelEl);

    if (texte.length === 0) {
      var keineAuswahl = document.createElement('p');
      keineAuswahl.className = 'falsche-frage-keine-auswahl';
      keineAuswahl.textContent = 'Keine Antwort ausgewählt';
      gruppe.appendChild(keineAuswahl);
    } else {
      var liste = document.createElement('ul');
      liste.className = 'falsche-frage-antwortliste';
      texte.forEach(function (text) {
        var eintrag = document.createElement('li');
        eintrag.textContent = text;
        liste.appendChild(eintrag);
      });
      gruppe.appendChild(liste);
    }

    return gruppe;
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
    if (frageErgebnis.nummer) {
      var nummer = document.createElement('span');
      nummer.className = 'frage-zaehler';
      nummer.textContent = 'Frage ' + frageErgebnis.nummer;
      kopf.appendChild(nummer);
    }
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

    var deineTexte = nachvollziehbareTexte(frageErgebnis.antworten, frageErgebnis.gewaehlteKennungen);
    karte.appendChild(erzeugeAntwortgruppe('Meine Antwort:', deineTexte, 'falsche-frage-antwortgruppe--gewaehlt'));

    var korrekteTexte = nachvollziehbareTexte(frageErgebnis.antworten, frageErgebnis.korrekteKennungen);
    karte.appendChild(erzeugeAntwortgruppe('Richtige Antwort:', korrekteTexte, 'falsche-frage-antwortgruppe--korrekt'));

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
