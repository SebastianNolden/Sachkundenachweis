(function () {
  'use strict';

  // Dünner Treiber um die rohe Capacitor-Plugin-Bridge für
  // @capacitor-community/sqlite (Capacitor.Plugins.CapacitorSQLite.*) -
  // bewusst OHNE die JS-Convenience-Wrapper-Klassen des npm-Pakets
  // (SQLiteConnection/SQLiteDBConnection). Diese werden als ES-Module
  // ausgeliefert und setzen einen Bundler voraus; das Projekt bleibt aber
  // bundlerfreies Vanilla-JS (siehe CLAUDE.md). Auf Android/iOS ist die
  // native Pluginfunktionalität unabhängig vom JS-Wrapper direkt über die
  // von Capacitor automatisch injizierte Bridge nutzbar - das gilt für
  // jedes Capacitor-Plugin, der npm-Wrapper ist Komfort, keine Voraussetzung.

  function holePlugin() {
    var capacitor = window.Capacitor;
    if (!capacitor || !capacitor.Plugins || !capacitor.Plugins.CapacitorSQLite) {
      throw new Error('CapacitorSQLite-Plugin ist auf dieser Plattform nicht verfügbar.');
    }
    return capacitor.Plugins.CapacitorSQLite;
  }

  // Stellt sicher, dass eine Verbindung existiert und die Datenbank offen
  // ist - idempotent, da test.html/result.html/index.html jeweils eigene
  // Seitenladezyklen (und damit frische JS-Kontexte) sind, während die
  // native Verbindung auf Android über Seitenwechsel hinweg bestehen bleibt.
  //
  // Die rohe CapacitorSQLitePlugin-Schnittstelle bietet dafür KEIN
  // isConnection() (das existiert nur in der JS-Convenience-Wrapper-Klasse
  // SQLiteConnection, die wir bewusst nicht verwenden, siehe Dateikopf) -
  // ein zweites createConnection() auf denselben Datenbanknamen wirft nativ
  // stattdessen eine Exception mit der Meldung "Connection <name> already
  // exists" (siehe CapacitorSQLite.java). Genau dieser (erwartete) Fall wird
  // hier abgefangen; jeder andere Fehler wird weitergereicht.
  async function verbindeUndOeffne(plugin, databaseName, readonly) {
    try {
      await plugin.createConnection({
        database: databaseName,
        version: 1,
        encrypted: false,
        mode: 'no-encryption',
        readonly: readonly,
      });
    } catch (err) {
      var nachricht = (err && err.message) || '';
      if (nachricht.indexOf('already exists') === -1) {
        throw err;
      }
      // Verbindung existiert bereits (typischerweise von einer vorherigen
      // Seite in derselben App-Sitzung) - kein echter Fehler.
    }

    var offen = await plugin.isDBOpen({ database: databaseName, readonly: readonly });
    if (!offen || !offen.result) {
      await plugin.open({ database: databaseName, readonly: readonly });
    }
  }

  // Öffnet (bzw. verbindet erneut mit) der SQLite-Datenbank und liefert
  // einen treiberunabhängigen Zugriffspunkt mit execute/run/query - exakt
  // dieselbe Form wie der Node-Testtreiber (siehe Testsuite), damit
  // database.js und die Repositories unabhängig vom konkreten Treiber sind.
  async function oeffne(databaseName) {
    var readonly = false;
    var plugin = holePlugin();
    await verbindeUndOeffne(plugin, databaseName, readonly);

    return {
      async execute(sql) {
        var ergebnis = await plugin.execute({
          database: databaseName,
          statements: sql,
          transaction: true,
          readonly: readonly,
        });
        return (ergebnis && ergebnis.changes) || {};
      },
      async run(sql, params) {
        var ergebnis = await plugin.run({
          database: databaseName,
          statement: sql,
          values: params || [],
          transaction: true,
          readonly: readonly,
        });
        var changes = (ergebnis && ergebnis.changes) || {};
        return { changes: changes.changes || 0, lastId: changes.lastId };
      },
      async query(sql, params) {
        var ergebnis = await plugin.query({
          database: databaseName,
          statement: sql,
          values: params || [],
          readonly: readonly,
        });
        return (ergebnis && ergebnis.values) || [];
      },
    };
  }

  window.CapacitorSqliteDriver = { oeffne: oeffne };
})();
