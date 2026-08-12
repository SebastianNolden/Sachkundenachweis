(function () {
  'use strict';

  // Zentrale Datenbank-Schicht: Verbindung öffnen, Schema-Version verwalten,
  // Tabellen anlegen, spätere Migrationen ermöglichen. Enthält bewusst
  // KEINE UI- oder Testlogik und KEINE Lernlogik - nur Verbindungsaufbau und
  // Schema-Verwaltung. Fachliche Zugriffe laufen über die Repositories
  // (siehe js/repositories/), die diese Verbindung über getConnection()
  // beziehen.

  var DATABASE_NAME = 'sachkundenachweis';
  var DATABASE_VERSION = 1;

  // Schema-Migrationen: jede Version listet die SQL-Statements, die beim
  // Sprung auf genau diese Version ausgeführt werden. Angewendet wird über
  // PRAGMA user_version - ein SQLite-Bordmittel, das sowohl über die
  // Capacitor-SQLite-Bridge als auch über node:sqlite (Node-Testtreiber)
  // funktioniert, statt über die pluginspezifische addUpgradeStatement()-API.
  // So bleibt dieselbe Migrationslogik unabhängig vom konkreten Treiber
  // testbar.
  //
  // WICHTIG für künftige Versionen: niemals DROP TABLE / datenverlust-
  // trächtige Statements für bestehende Nutzdaten einfügen - nur additive
  // Änderungen (CREATE TABLE IF NOT EXISTS, ALTER TABLE ADD COLUMN,
  // CREATE INDEX IF NOT EXISTS, ...). Die Datenbank wird bei einer
  // Schemaänderung NIEMALS gelöscht, nur migriert.
  var MIGRATIONS = [
    {
      version: 1,
      statements: [
        'CREATE TABLE IF NOT EXISTS test_sessions (' +
          'id INTEGER PRIMARY KEY AUTOINCREMENT, ' +
          'started_at TEXT NOT NULL, ' +
          'finished_at TEXT, ' +
          'question_count INTEGER, ' +
          'correct_count INTEGER, ' +
          'wrong_count INTEGER, ' +
          'percentage INTEGER' +
          ')',
        'CREATE TABLE IF NOT EXISTS question_attempts (' +
          'id INTEGER PRIMARY KEY AUTOINCREMENT, ' +
          'question_id TEXT NOT NULL, ' +
          'answered_at TEXT NOT NULL, ' +
          "result TEXT NOT NULL CHECK (result IN ('correct','wrong')), " +
          'selected_answers TEXT NOT NULL, ' +
          "context TEXT NOT NULL CHECK (context IN ('test','learning')), " +
          'test_session_id INTEGER, ' +
          'FOREIGN KEY (test_session_id) REFERENCES test_sessions(id)' +
          ')',
        'CREATE INDEX IF NOT EXISTS idx_question_attempts_test_session ON question_attempts(test_session_id)',
        'CREATE INDEX IF NOT EXISTS idx_question_attempts_question ON question_attempts(question_id)',
      ],
    },
  ];

  // Produktions-Default: öffnet die echte SQLite-Datenbank über die
  // Capacitor-Bridge. Für Node-Tests austauschbar über
  // _setDriverFactoryFuerTests (siehe unten) - Produktionscode ruft das nie auf.
  function standardDriverFactory() {
    return CapacitorSqliteDriver.oeffne(DATABASE_NAME);
  }

  var driverFactory = standardDriverFactory;
  var verbindungsPromise = null;

  async function ermittleSchemaVersion(driver) {
    var zeilen = await driver.query('PRAGMA user_version', []);
    var zeile = zeilen[0] || {};
    return typeof zeile.user_version === 'number' ? zeile.user_version : 0;
  }

  async function wendeMigrationenAn(driver) {
    var aktuelleVersion = await ermittleSchemaVersion(driver);
    var ausstehend = MIGRATIONS
      .filter(function (m) { return m.version > aktuelleVersion; })
      .sort(function (a, b) { return a.version - b.version; });

    for (var i = 0; i < ausstehend.length; i += 1) {
      var migration = ausstehend[i];
      for (var j = 0; j < migration.statements.length; j += 1) {
        await driver.execute(migration.statements[j]);
      }
      // PRAGMA user_version akzeptiert keine Platzhalter/Parameter - der
      // Wert stammt hier ausschließlich aus der eigenen MIGRATIONS-Liste,
      // kein Benutzereingabe-Risiko.
      await driver.execute('PRAGMA user_version = ' + migration.version);
    }
  }

  // Liefert die (einmalig aufgebaute, danach wiederverwendete) Verbindung
  // inkl. angewendeter Migrationen. Idempotent: mehrfacher Aufruf - auch von
  // verschiedenen Stellen auf derselben Seite - liefert dieselbe Verbindung,
  // ohne Tabellen erneut fehlerhaft anzulegen (CREATE TABLE IF NOT EXISTS).
  function getConnection() {
    if (!verbindungsPromise) {
      verbindungsPromise = Promise.resolve()
        .then(function () { return driverFactory(); })
        .then(async function (driver) {
          await wendeMigrationenAn(driver);
          return driver;
        })
        .catch(function (err) {
          // Beim nächsten Versuch erneut probieren, statt eine fehlgeschlagene
          // Verbindung dauerhaft zwischenzuspeichern.
          verbindungsPromise = null;
          throw err;
        });
    }
    return verbindungsPromise;
  }

  // Nur für Tests: ersetzt die Treiber-Factory (z. B. durch einen
  // node:sqlite-basierten Treiber) und verwirft eine evtl. gecachte
  // Verbindung. Wird von Produktionscode nie aufgerufen.
  function _setDriverFactoryFuerTests(fn) {
    driverFactory = fn || standardDriverFactory;
    verbindungsPromise = null;
  }

  window.Database = {
    DATABASE_NAME: DATABASE_NAME,
    DATABASE_VERSION: DATABASE_VERSION,
    MIGRATIONS: MIGRATIONS,
    getConnection: getConnection,
    _setDriverFactoryFuerTests: _setDriverFactoryFuerTests,
  };
})();
