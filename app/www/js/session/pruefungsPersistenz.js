(function () {
  'use strict';

  // Session-/Fachlogik-Brücke zwischen dem Prüfungstest (test.js) und den
  // Repositories: kapselt WANN und WIE Testdurchläufe als test_sessions /
  // question_attempts persistiert werden. test.js kennt keine SQL-Details,
  // nur diese beiden Methoden - und behandelt Fehler daraus selbst
  // (Persistenz darf den Testablauf nicht blockieren oder zerstören).

  async function starteSession() {
    var startedAt = new Date().toISOString();
    return TestSessionRepository.createSession(startedAt);
  }

  // fragenErgebnis: Array wie von test.js beim Testabschluss berechnet,
  // je Eintrag { frageId, gewaehlteKennungen, istRichtig, ... }.
  // ergebnis: { gesamt, richtig, falsch, prozent }.
  //
  // Wichtig: wird bewusst erst HIER, beim Testabschluss, für alle Fragen der
  // Session in einem Rutsch aufgerufen - nicht bei jedem Vor/Zurück-Klick -
  // damit Vor/Zurück-Navigation innerhalb eines laufenden Tests keine
  // doppelten Attempts erzeugt. Jede Frage bekommt genau einen Attempt: ihre
  // finale Auswahl zum Zeitpunkt des Testabschlusses (exakt die Auswahl, die
  // auch in die Ergebnisberechnung eingeflossen ist).
  async function schliesseTestAb(testSessionId, fragenErgebnis, ergebnis) {
    var abgeschlossenAm = new Date().toISOString();

    for (var i = 0; i < fragenErgebnis.length; i += 1) {
      var frage = fragenErgebnis[i];
      await AttemptRepository.createAttempt({
        questionId: frage.frageId,
        answeredAt: abgeschlossenAm,
        result: frage.istRichtig ? 'correct' : 'wrong',
        selectedAnswers: frage.gewaehlteKennungen,
        context: 'test',
        testSessionId: testSessionId,
      });
    }

    await TestSessionRepository.finishSession(testSessionId, {
      finishedAt: abgeschlossenAm,
      questionCount: ergebnis.gesamt,
      correctCount: ergebnis.richtig,
      wrongCount: ergebnis.falsch,
      percentage: ergebnis.prozent,
    });
  }

  window.PruefungsPersistenz = {
    starteSession: starteSession,
    schliesseTestAb: schliesseTestAb,
  };
})();
