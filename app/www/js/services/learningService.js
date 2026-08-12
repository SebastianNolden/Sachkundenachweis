(function () {
  'use strict';

  // Lernfortschritts-Fachlogik. Enthält AUSSCHLIESSLICH reine Funktionen:
  // kein DOM-Zugriff, keine SQLite-Abfragen. Nimmt bereits geladene Fragen
  // (aus content.json / QuestionRepository) und Attempts (aus
  // AttemptRepository.getAllAttempts()) entgegen und berechnet daraus den
  // Lernstatus - komplett im Speicher (Variante B, siehe Analyse zu
  // Meilenstein 4), keine 197 Einzelabfragen.
  //
  // Der Lernstatus wird NICHT in SQLite gespeichert - question_attempts
  // bleibt die einzige Quelle der Wahrheit. Ein falscher Attempt löscht oder
  // verändert niemals ältere Attempts; er beeinflusst nur das (bei jedem
  // Aufruf neu berechnete) Ergebnis.

  var STATUS = {
    NEU: 'neu',
    ANGEFANGEN: 'angefangen',
    FESTIGUNG: 'festigung',
    GELERNT: 'gelernt',
    UNSICHER: 'unsicher',
  };

  function zweistellig(zahl) {
    return zahl < 10 ? '0' + zahl : String(zahl);
  }

  // Bildet aus einem ISO-8601-Zeitstempel (wie in answered_at gespeichert,
  // UTC) einen stabilen Tages-Key auf Basis der LOKALEN Gerätezeit -
  // bewusst NICHT über answered_at.substring(0, 10) (das wäre der UTC-Tag,
  // der z. B. um Mitternacht lokal vom tatsächlich erlebten Kalendertag
  // abweichen kann). Zwei Antworten am selben lokalen Kalendertag liefern
  // denselben Key, unabhängig davon, ob sie UTC-seitig auf unterschiedliche
  // Tage fallen.
  function lokalerTagKey(answeredAt) {
    var datum = new Date(answeredAt);
    return datum.getFullYear() + '-' + zweistellig(datum.getMonth() + 1) + '-' + zweistellig(datum.getDate());
  }

  // Sortiert eine Attempt-Liste chronologisch (answered_at, bei Gleichstand
  // per id) - erzeugt dabei bewusst eine NEUE Kopie, die Eingabe (und deren
  // Objekte) bleibt unverändert (siehe Test "selected_answers wird nicht
  // verändert").
  function sortiereChronologisch(attempts) {
    return attempts.slice().sort(function (a, b) {
      if (a.answeredAt < b.answeredAt) return -1;
      if (a.answeredAt > b.answeredAt) return 1;
      return (a.id || 0) - (b.id || 0);
    });
  }

  // Berechnet den Lernstatus + alle Kennzahlen für EINE Frage aus ihrer
  // vollständigen Attempt-Historie. Reine Funktion: dieselbe Eingabe liefert
  // immer dieselbe Ausgabe, keine Seiteneffekte.
  //
  // Statusregeln (in dieser Reihenfolge geprüft):
  //   0 Attempts                                            -> NEU
  //   >=1 Attempt, aber 0 Erfolgstage                        -> ANGEFANGEN
  //   >=1 Erfolgstag, aber letzte Antwort ist falsch          -> UNSICHER
  //   genau 1 Erfolgstag, letzte Antwort richtig              -> ANGEFANGEN
  //   genau 2 Erfolgstage, letzte Antwort richtig             -> FESTIGUNG
  //   >=3 Erfolgstage, letzte Antwort richtig                 -> GELERNT
  //
  // "Erfolgstag" = unterschiedlicher lokaler Kalendertag mit mindestens
  // einer korrekten Antwort (siehe lokalerTagKey). Eine falsche Antwort
  // entfernt nie einen bereits erreichten Erfolgstag - die Historie bleibt
  // vollständig erhalten, nur der berechnete Status ändert sich.
  function berechneStatus(attempts) {
    var sortiert = sortiereChronologisch(attempts || []);
    var anzahlVersuche = sortiert.length;

    if (anzahlVersuche === 0) {
      return {
        status: STATUS.NEU,
        anzahlVersuche: 0,
        anzahlRichtig: 0,
        anzahlFalsch: 0,
        letzteAntwort: null,
        letzteRichtigeAntwort: null,
        zuletztBearbeitet: null,
        erfolgstage: 0,
      };
    }

    var anzahlRichtig = 0;
    var anzahlFalsch = 0;
    var erfolgstageSet = {};
    var letzteRichtigeAntwort = null;

    sortiert.forEach(function (attempt) {
      if (attempt.result === 'correct') {
        anzahlRichtig += 1;
        erfolgstageSet[lokalerTagKey(attempt.answeredAt)] = true;
        letzteRichtigeAntwort = attempt.answeredAt;
      } else {
        anzahlFalsch += 1;
      }
    });

    var erfolgstage = Object.keys(erfolgstageSet).length;
    var letzterAttempt = sortiert[sortiert.length - 1];
    var letzteAntwort = letzterAttempt.answeredAt;
    var letzteAntwortRichtig = letzterAttempt.result === 'correct';

    var status;
    if (erfolgstage === 0) {
      status = STATUS.ANGEFANGEN;
    } else if (!letzteAntwortRichtig) {
      status = STATUS.UNSICHER;
    } else if (erfolgstage === 1) {
      status = STATUS.ANGEFANGEN;
    } else if (erfolgstage === 2) {
      status = STATUS.FESTIGUNG;
    } else {
      status = STATUS.GELERNT;
    }

    return {
      status: status,
      anzahlVersuche: anzahlVersuche,
      anzahlRichtig: anzahlRichtig,
      anzahlFalsch: anzahlFalsch,
      letzteAntwort: letzteAntwort,
      letzteRichtigeAntwort: letzteRichtigeAntwort,
      zuletztBearbeitet: letzteAntwort,
      erfolgstage: erfolgstage,
    };
  }

  function gruppiereNachQuestionId(attempts) {
    var gruppen = {};
    (attempts || []).forEach(function (attempt) {
      if (!gruppen[attempt.questionId]) {
        gruppen[attempt.questionId] = [];
      }
      gruppen[attempt.questionId].push(attempt);
    });
    return gruppen;
  }

  // Berechnet für JEDE übergebene Frage ein Fortschrittsobjekt - auch für
  // Fragen ohne einen einzigen Attempt (Status NEU). "fragen" kommt aus
  // content.json/QuestionRepository, "attempts" aus
  // AttemptRepository.getAllAttempts() (einmaliger Ladevorgang, siehe
  // Dateikopf). Kein SQL-Zugriff hier - reine In-Memory-Verarbeitung.
  function berechneFragenFortschritt(fragen, attempts) {
    var attemptsProFrage = gruppiereNachQuestionId(attempts);

    return (fragen || []).map(function (frage) {
      var status = berechneStatus(attemptsProFrage[frage.id] || []);
      return {
        questionId: frage.id,
        status: status.status,
        anzahlVersuche: status.anzahlVersuche,
        anzahlRichtig: status.anzahlRichtig,
        anzahlFalsch: status.anzahlFalsch,
        letzteAntwort: status.letzteAntwort,
        letzteRichtigeAntwort: status.letzteRichtigeAntwort,
        zuletztBearbeitet: status.zuletztBearbeitet,
        erfolgstage: status.erfolgstage,
      };
    });
  }

  // Aggregiert eine bereits berechnete Fragen-Fortschrittsliste nach
  // Kategorie. Die Kategorie-Zuordnung kommt ausschließlich aus "fragen"
  // (content.json, kategorieId je Frage) - keine Duplikation in SQLite.
  // Kategorie-Metadaten (Name, Reihenfolge) sind NICHT Teil des Ergebnisses;
  // das bleibt bewusst reine Zähllogik, die Anzeige führt die Namen aus
  // content.json separat zusammen (siehe progress.js).
  function berechneKategorieFortschritt(fragenFortschritt, fragen) {
    var kategorieIdProFrage = {};
    (fragen || []).forEach(function (frage) {
      kategorieIdProFrage[frage.id] = frage.kategorieId;
    });

    var gruppen = {};
    (fragenFortschritt || []).forEach(function (eintrag) {
      var kategorieId = kategorieIdProFrage[eintrag.questionId];
      if (kategorieId === undefined) return;
      if (!gruppen[kategorieId]) gruppen[kategorieId] = [];
      gruppen[kategorieId].push(eintrag);
    });

    return Object.keys(gruppen).map(function (kategorieId) {
      var eintraege = gruppen[kategorieId];
      var zaehle = function (status) {
        return eintraege.filter(function (e) { return e.status === status; }).length;
      };
      var anzahlFragen = eintraege.length;
      var anzahlGelernt = zaehle(STATUS.GELERNT);

      return {
        kategorieId: kategorieId,
        anzahlFragen: anzahlFragen,
        anzahlGelernt: anzahlGelernt,
        prozentGelernt: anzahlFragen > 0 ? Math.round((anzahlGelernt / anzahlFragen) * 100) : 0,
        anzahlNeu: zaehle(STATUS.NEU),
        anzahlAngefangen: zaehle(STATUS.ANGEFANGEN),
        anzahlFestigung: zaehle(STATUS.FESTIGUNG),
        anzahlUnsicher: zaehle(STATUS.UNSICHER),
      };
    });
  }

  // Gesamtstatistik über alle Fragen/Attempts hinweg - für den
  // "Gesamtfortschritt"-Bereich der Fortschrittsseite. Keine im Auftrag
  // explizit benannte Funktion, aber dieselbe reine/testbare Bauart wie die
  // übrigen Funktionen; UI-Layer soll diese Summen nicht selbst berechnen
  // müssen (Service bleibt für alle Fachlogik zuständig, siehe Dateikopf).
  function berechneGesamtstatistik(attempts, fragenFortschritt) {
    var alleAttempts = attempts || [];
    var alleFragenFortschritt = fragenFortschritt || [];

    var anzahlRichtigGesamt = alleAttempts.filter(function (a) { return a.result === 'correct'; }).length;
    var anzahlFalschGesamt = alleAttempts.filter(function (a) { return a.result === 'wrong'; }).length;

    var erfolgstageSet = {};
    alleAttempts.forEach(function (a) {
      if (a.result === 'correct') {
        erfolgstageSet[lokalerTagKey(a.answeredAt)] = true;
      }
    });

    var zaehle = function (status) {
      return alleFragenFortschritt.filter(function (e) { return e.status === status; }).length;
    };
    var anzahlFragenGesamt = alleFragenFortschritt.length;
    var anzahlGelernt = zaehle(STATUS.GELERNT);

    return {
      anzahlFragenGesamt: anzahlFragenGesamt,
      anzahlGelernt: anzahlGelernt,
      anzahlFestigung: zaehle(STATUS.FESTIGUNG),
      anzahlAngefangen: zaehle(STATUS.ANGEFANGEN),
      anzahlUnsicher: zaehle(STATUS.UNSICHER),
      anzahlNeu: zaehle(STATUS.NEU),
      prozentGelernt: anzahlFragenGesamt > 0 ? Math.round((anzahlGelernt / anzahlFragenGesamt) * 100) : 0,
      anzahlRichtigGesamt: anzahlRichtigGesamt,
      anzahlFalschGesamt: anzahlFalschGesamt,
      anzahlErfolgstageGesamt: Object.keys(erfolgstageSet).length,
    };
  }

  window.LearningService = {
    STATUS: STATUS,
    lokalerTagKey: lokalerTagKey,
    berechneStatus: berechneStatus,
    berechneFragenFortschritt: berechneFragenFortschritt,
    berechneKategorieFortschritt: berechneKategorieFortschritt,
    berechneGesamtstatistik: berechneGesamtstatistik,
  };
})();
