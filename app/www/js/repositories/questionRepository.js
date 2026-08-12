(function () {
  'use strict';

  // Zugriff auf die Fragen UND Kategorien aus content.json (bzw. die bereits
  // geladene Content-Struktur) - KEINE SQLite-Duplikation der Fragen/
  // Antworten/Kategorien. content.json bleibt die alleinige fachliche
  // Quelle, und dieses Repository die alleinige Zugriffsstelle darauf -
  // andere Module (z. B. progress.js) besitzen bewusst keine eigene
  // fetch('content.json')-Logik.
  //
  // Die generische Lade-/Validierungslogik lebt hier (früher direkt in
  // test.js inline); prüfungsspezifische Regeln wie "mindestens 30 Fragen
  // nötig" bleiben bewusst in der Session-/Fachlogik des Prüfungstests
  // (test.js), da das eine Regel des Prüfungstests ist, nicht der Fragen
  // an sich - ein künftiger Lernmodus hätte diese Mindestanzahl z.B. nicht.

  // Cacht das VOLLSTÄNDIGE geparste content.json (Fragen + Kategorien) -
  // ladeAlle() und ladeKategorien() greifen beide auf denselben, nur einmal
  // ausgeführten Ladevorgang zu (kein zweiter fetch, egal wie oft/in welcher
  // Kombination beide Funktionen aufgerufen werden).
  var ladeContentPromise = null;

  function ladeContent() {
    if (!ladeContentPromise) {
      ladeContentPromise = fetch('content.json')
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
          return content;
        })
        .catch(function (err) {
          // Beim nächsten Versuch erneut laden statt einen Fehler dauerhaft
          // zwischenzuspeichern.
          ladeContentPromise = null;
          throw err;
        });
    }
    return ladeContentPromise;
  }

  function ladeAlle() {
    return ladeContent().then(function (content) { return content.fragen; });
  }

  // Liefert die Kategorien aus content.json (kennung/name/reihenfolge), z. B.
  // für die Fortschrittsanzeige. Keine eigene Ladelogik in den aufrufenden
  // Modulen nötig - nutzt denselben gecachten Ladevorgang wie ladeAlle().
  function ladeKategorien() {
    return ladeContent().then(function (content) { return content.kategorien || []; });
  }

  function findeNachId(fragen, questionId) {
    return fragen.filter(function (f) { return f.id === questionId; })[0] || null;
  }

  window.QuestionRepository = {
    ladeAlle: ladeAlle,
    ladeKategorien: ladeKategorien,
    findeNachId: findeNachId,
  };
})();
