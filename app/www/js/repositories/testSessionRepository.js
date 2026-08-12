(function () {
  'use strict';

  // Zugriff auf test_sessions. Kein SQL außerhalb dieser Datei für diese
  // Tabelle - die UI/Session-Logik ruft ausschließlich diese Methoden auf.

  function zeileZuSession(zeile) {
    return {
      id: zeile.id,
      startedAt: zeile.started_at,
      finishedAt: zeile.finished_at,
      questionCount: zeile.question_count,
      correctCount: zeile.correct_count,
      wrongCount: zeile.wrong_count,
      percentage: zeile.percentage,
    };
  }

  // Legt eine neue, noch nicht abgeschlossene Session an (finished_at etc.
  // bleiben NULL, bis finishSession() aufgerufen wird) und liefert ihre ID.
  async function createSession(startedAt) {
    var db = await Database.getConnection();
    var ergebnis = await db.run(
      'INSERT INTO test_sessions (started_at) VALUES (?)',
      [startedAt]
    );
    return ergebnis.lastId;
  }

  // daten: { finishedAt, questionCount, correctCount, wrongCount, percentage }
  async function finishSession(sessionId, daten) {
    var db = await Database.getConnection();
    await db.run(
      'UPDATE test_sessions ' +
        'SET finished_at = ?, question_count = ?, correct_count = ?, wrong_count = ?, percentage = ? ' +
        'WHERE id = ?',
      [
        daten.finishedAt,
        daten.questionCount,
        daten.correctCount,
        daten.wrongCount,
        daten.percentage,
        sessionId,
      ]
    );
  }

  async function getSession(sessionId) {
    var db = await Database.getConnection();
    var zeilen = await db.query('SELECT * FROM test_sessions WHERE id = ?', [sessionId]);
    return zeilen[0] ? zeileZuSession(zeilen[0]) : null;
  }

  async function getSessions() {
    var db = await Database.getConnection();
    var zeilen = await db.query('SELECT * FROM test_sessions ORDER BY started_at DESC', []);
    return zeilen.map(zeileZuSession);
  }

  window.TestSessionRepository = {
    createSession: createSession,
    finishSession: finishSession,
    getSession: getSession,
    getSessions: getSessions,
  };
})();
