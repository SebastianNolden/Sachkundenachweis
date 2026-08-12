(function () {
  'use strict';

  // Zugriff auf die Fragen aus content.json (bzw. die bereits geladene
  // Content-Struktur) - KEINE SQLite-Duplikation der Fragen/Antworten/
  // Kategorien. content.json bleibt die alleinige fachliche Quelle.
  //
  // Die generische Lade-/Validierungslogik lebt hier (früher direkt in
  // test.js inline); prüfungsspezifische Regeln wie "mindestens 30 Fragen
  // nötig" bleiben bewusst in der Session-/Fachlogik des Prüfungstests
  // (test.js), da das eine Regel des Prüfungstests ist, nicht der Fragen
  // an sich - ein künftiger Lernmodus hätte diese Mindestanzahl z.B. nicht.

  var ladePromise = null;

  function ladeAlle() {
    if (!ladePromise) {
      ladePromise = fetch('content.json')
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
          return content.fragen;
        })
        .catch(function (err) {
          // Beim nächsten Versuch erneut laden statt einen Fehler dauerhaft
          // zwischenzuspeichern.
          ladePromise = null;
          throw err;
        });
    }
    return ladePromise;
  }

  function findeNachId(fragen, questionId) {
    return fragen.filter(function (f) { return f.id === questionId; })[0] || null;
  }

  window.QuestionRepository = {
    ladeAlle: ladeAlle,
    findeNachId: findeNachId,
  };
})();
