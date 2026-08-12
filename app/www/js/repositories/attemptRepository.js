(function () {
  'use strict';

  // Zugriff auf question_attempts. Kein SQL außerhalb dieser Datei für diese
  // Tabelle - die UI/Session-Logik ruft ausschließlich diese Methoden auf.

  function zeileZuAttempt(zeile) {
    return {
      id: zeile.id,
      questionId: zeile.question_id,
      answeredAt: zeile.answered_at,
      result: zeile.result,
      selectedAnswers: JSON.parse(zeile.selected_answers),
      context: zeile.context,
      testSessionId: zeile.test_session_id,
    };
  }

  // eintrag: {
  //   questionId, answeredAt (ISO 8601), result ('correct'|'wrong'),
  //   selectedAnswers (string[]), context ('test'|'learning'), testSessionId
  // }
  // Die Antwort-Kennungen werden sortiert gespeichert, damit
  // selected_answers unabhängig von der Klickreihenfolge deterministisch ist.
  async function createAttempt(eintrag) {
    var db = await Database.getConnection();
    var selectedAnswersJson = JSON.stringify((eintrag.selectedAnswers || []).slice().sort());

    var ergebnis = await db.run(
      'INSERT INTO question_attempts ' +
        '(question_id, answered_at, result, selected_answers, context, test_session_id) ' +
        'VALUES (?, ?, ?, ?, ?, ?)',
      [
        eintrag.questionId,
        eintrag.answeredAt,
        eintrag.result,
        selectedAnswersJson,
        eintrag.context,
        eintrag.testSessionId,
      ]
    );

    return ergebnis.lastId;
  }

  async function getAttemptsForQuestion(questionId) {
    var db = await Database.getConnection();
    var zeilen = await db.query(
      'SELECT * FROM question_attempts WHERE question_id = ? ORDER BY answered_at ASC, id ASC',
      [questionId]
    );
    return zeilen.map(zeileZuAttempt);
  }

  async function getAttemptsForTestSession(testSessionId) {
    var db = await Database.getConnection();
    var zeilen = await db.query(
      'SELECT * FROM question_attempts WHERE test_session_id = ? ORDER BY id ASC',
      [testSessionId]
    );
    return zeilen.map(zeileZuAttempt);
  }

  // Lädt ALLE question_attempts in einem einzigen Zugriff (keine 197
  // Einzelabfragen je Frage) - Grundlage für die Lernfortschrittsberechnung
  // (siehe LearningService), die anschließend rein in JavaScript nach
  // question_id gruppiert und ausgewertet wird.
  async function getAllAttempts() {
    var db = await Database.getConnection();
    var zeilen = await db.query(
      'SELECT * FROM question_attempts ORDER BY question_id ASC, answered_at ASC, id ASC',
      []
    );
    return zeilen.map(zeileZuAttempt);
  }

  window.AttemptRepository = {
    createAttempt: createAttempt,
    getAttemptsForQuestion: getAttemptsForQuestion,
    getAttemptsForTestSession: getAttemptsForTestSession,
    getAllAttempts: getAllAttempts,
  };
})();
