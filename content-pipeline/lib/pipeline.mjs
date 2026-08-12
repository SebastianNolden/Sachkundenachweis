/**
 * Reine Transformationslogik: CSV-Records (+ vorhandenes ID-Mapping,
 * + vorhandene Bilddateien) -> content.json + content-id-map.json.
 *
 * Enthält bewusst kein Datei-I/O, damit die eigentliche fachliche Logik
 * unabhängig von Dateisystem/Pfaden nachvollziehbar bleibt.
 */

/**
 * @param {object} args
 * @param {Record<string,string>[]} args.records        Rohzeilen aus der CSV
 * @param {{schemaVersion:string, naechsteFreieLaufnummer:number, eintraege:object[]}} args.existingIdMap
 * @param {Set<string>} args.imageBaseNames              Dateinamen (ohne ".png") der vorhandenen Bilder
 * @param {string} args.nowIso                           Zeitstempel für "erzeugtAm"
 */
export function buildContent({ records, existingIdMap, imageBaseNames, nowIso }) {
  const errors = [];
  const warnings = [];

  // -----------------------------------------------------------------------
  // 1. Kategorien: Kennung (führende Zahl) + normalisierter Name extrahieren
  // -----------------------------------------------------------------------
  const kategorien = new Map(); // kennung -> { kennung, name, reihenfolge }
  const kategorieNameNormalizedWarned = new Set();
  const kategorieConflictWarned = new Set();

  function resolveKategorie(rawValue, recordLabel) {
    // String.fromCharCode(160) = geschütztes Leerzeichen (NBSP); zur Sicherheit
    // wie ein normales Leerzeichen behandeln, bevor die führende Nummer extrahiert wird.
    const cleaned = rawValue.split(String.fromCharCode(160)).join(' ').trim();
    const match = cleaned.match(/^(\d+)\s+(.+)$/s);
    if (!match) {
      errors.push(
        `${recordLabel}: Kategorie-Kennung konnte nicht aus "${rawValue}" extrahiert werden ` +
        `(erwartet: führende Nummer gefolgt von einem Namen).`
      );
      return null;
    }

    const kennung = match[1];
    const rawName = match[2].trim();
    const name = rawName.replace(/\s+/g, ' ').trim();

    if (!name) {
      errors.push(`${recordLabel}: Kategorie-Name ist nach der Kennung "${kennung}" leer.`);
      return null;
    }

    if (name !== rawName && !kategorieNameNormalizedWarned.has(kennung)) {
      warnings.push(`Kategorie ${kennung}: Name wurde normalisiert ("${rawName}" -> "${name}").`);
      kategorieNameNormalizedWarned.add(kennung);
    }

    const existing = kategorien.get(kennung);
    if (!existing) {
      kategorien.set(kennung, { kennung, name, reihenfolge: parseInt(kennung, 10) });
    } else if (existing.name !== name && !kategorieConflictWarned.has(kennung)) {
      warnings.push(
        `Kategorie ${kennung}: uneinheitlicher Name ("${existing.name}" vs. "${name}") - ` +
        `"${existing.name}" wird verwendet.`
      );
      kategorieConflictWarned.add(kennung);
    }

    return kennung;
  }

  // -----------------------------------------------------------------------
  // 2. Zeilen zu Fragen gruppieren, anhand (Kategorie-Kennung, Nummer)
  //    -> Fragetext wird nur innerhalb der jeweils eigenen Gruppe verwendet,
  //       ein Fill-Down über Gruppengrenzen hinweg ist damit ausgeschlossen.
  // -----------------------------------------------------------------------
  const fragenByKey = new Map();

  records.forEach((record, index) => {
    const recordLabel = `Datensatz ${index + 1}`; // logischer CSV-Datensatz, siehe README

    const kategorieRaw = (record.Kategorie ?? '').trim();
    const nummerRaw = (record.Nummer ?? '').trim();
    // CRLF/CR -> LF normalisieren: innerhalb gequoteter CSV-Felder können
    // eingebettete Zeilenumbrüche vorkommen (siehe README); für content.json
    // wird einheitlich \n verwendet statt der Windows-Zeilenenden aus der CSV.
    const fragetextRaw = (record.Fragetext ?? '').replace(/\r\n?/g, '\n');
    const ziffer = (record.Ziffer ?? '').trim().toUpperCase();
    const antwortText = (record.Antworten ?? '').replace(/\r\n?/g, '\n').trim();
    const korrekt = (record.Korrekt ?? '').trim();

    if (!kategorieRaw) {
      errors.push(`${recordLabel}: Kategorie fehlt.`);
      return;
    }
    if (!nummerRaw || !/^\d+$/.test(nummerRaw)) {
      errors.push(`${recordLabel}: Nummer "${nummerRaw}" ist keine gültige Zahl.`);
      return;
    }
    if (!ziffer) {
      errors.push(`${recordLabel} (Kategorie "${kategorieRaw}", Nummer ${nummerRaw}): Antwort-Ziffer fehlt.`);
      return;
    }
    if (!antwortText) {
      errors.push(
        `${recordLabel} (Kategorie "${kategorieRaw}", Nummer ${nummerRaw}, Ziffer ${ziffer}): Antworttext fehlt.`
      );
      return;
    }

    const kennung = resolveKategorie(kategorieRaw, recordLabel);
    if (kennung === null) return;

    const nummer = parseInt(nummerRaw, 10);
    const key = `${kennung}::${nummer}`;

    let frage = fragenByKey.get(key);
    if (!frage) {
      frage = { kennung, nummer, fragetext: null, antworten: [] };
      fragenByKey.set(key, frage);
    }

    const fragetextTrimmed = fragetextRaw.trim();
    if (fragetextTrimmed) {
      if (frage.fragetext === null) {
        frage.fragetext = fragetextTrimmed;
      } else if (frage.fragetext !== fragetextTrimmed) {
        errors.push(
          `${recordLabel}: widersprüchlicher Fragetext für Kategorie "${kategorieRaw}" / Nummer ${nummer} ` +
          `("${frage.fragetext}" vs. "${fragetextTrimmed}") - evtl. wurde dieselbe (Kategorie, Nummer)-Kombination ` +
          `versehentlich für zwei unterschiedliche Fragen verwendet.`
        );
      }
    }

    if (frage.antworten.some(a => a.ziffer === ziffer)) {
      errors.push(
        `${recordLabel}: doppelte Antwort-Ziffer "${ziffer}" bei Kategorie "${kategorieRaw}" / Nummer ${nummer}.`
      );
      return;
    }

    frage.antworten.push({ ziffer, text: antwortText, correct: korrekt !== '' });
  });

  // -----------------------------------------------------------------------
  // 3. Fragen abschließend prüfen (Fragetext vorhanden, mind. 1 korrekt)
  // -----------------------------------------------------------------------
  for (const frage of fragenByKey.values()) {
    const label = `Kategorie ${frage.kennung} / Nummer ${frage.nummer}`;

    if (frage.fragetext === null) {
      errors.push(`${label}: kein Fragetext in irgendeiner zugehörigen Zeile gefunden.`);
    }

    const correctCount = frage.antworten.filter(a => a.correct).length;
    if (correctCount === 0) {
      errors.push(`${label}: keine Antwort als korrekt markiert.`);
    }

    if (frage.antworten.length !== 4) {
      warnings.push(`${label}: hat ${frage.antworten.length} Antworten statt der üblichen 4.`);
    }
  }

  if (errors.length > 0) {
    // Bei Validierungsfehlern wird bewusst nicht weitergebaut (insbesondere
    // keine ID-Vergabe), damit content-id-map.json nicht durch fehlerhafte
    // Daten verändert wird.
    return { content: null, idMap: existingIdMap, errors, warnings, stats: null };
  }

  // -----------------------------------------------------------------------
  // 4. Bildzuordnung: ausschließlich anhand der fachlichen Nummer
  // -----------------------------------------------------------------------
  const usedImageBaseNames = new Set();
  for (const frage of fragenByKey.values()) {
    const key = String(frage.nummer);
    if (imageBaseNames.has(key)) {
      frage.bild = key;
      usedImageBaseNames.add(key);
    } else {
      frage.bild = null;
    }
  }
  for (const baseName of imageBaseNames) {
    if (!usedImageBaseNames.has(baseName)) {
      warnings.push(`Bild "${baseName}.png" wird von keiner Frage referenziert.`);
    }
  }

  // -----------------------------------------------------------------------
  // 5. Stabile technische IDs vergeben/pflegen (content-id-map.json)
  // -----------------------------------------------------------------------
  const idMap = {
    schemaVersion: existingIdMap.schemaVersion ?? '1',
    naechsteFreieLaufnummer: existingIdMap.naechsteFreieLaufnummer ?? 1,
    eintraege: existingIdMap.eintraege.map(e => ({ ...e })), // Kopie, Original bleibt unangetastet
  };

  const idMapByKey = new Map(idMap.eintraege.map(e => [`${e.kategorieKennung}::${e.nummer}`, e]));
  const touchedKeys = new Set();
  let neueIds = 0;

  const sortedFragen = [...fragenByKey.values()].sort(
    (a, b) =>
      a.kennung.localeCompare(b.kennung, undefined, { numeric: true }) || a.nummer - b.nummer
  );

  for (const frage of sortedFragen) {
    const key = `${frage.kennung}::${frage.nummer}`;
    touchedKeys.add(key);

    let eintrag = idMapByKey.get(key);
    if (!eintrag) {
      const id = `q-${String(idMap.naechsteFreieLaufnummer).padStart(4, '0')}`;
      idMap.naechsteFreieLaufnummer += 1;
      eintrag = { id, kategorieKennung: frage.kennung, nummer: frage.nummer, status: 'aktiv' };
      idMap.eintraege.push(eintrag);
      idMapByKey.set(key, eintrag);
      neueIds += 1;
    } else if (eintrag.status !== 'aktiv') {
      // zuvor entfernte, jetzt wieder vorhandene (Kategorie, Nummer)-Kombination:
      // dieselbe Frage ist zurück, sie bekommt daher wieder dieselbe ID.
      eintrag.status = 'aktiv';
    }

    frage.id = eintrag.id;
  }

  let entfernteFragen = 0;
  for (const eintrag of idMap.eintraege) {
    const key = `${eintrag.kategorieKennung}::${eintrag.nummer}`;
    if (!touchedKeys.has(key) && eintrag.status === 'aktiv') {
      eintrag.status = 'entfernt';
      entfernteFragen += 1;
    }
  }

  // Absicherung: doppelte technische IDs dürften durch obige Logik nicht
  // entstehen, werden aber sicherheitshalber geprüft, bevor etwas geschrieben wird.
  const idCounts = new Map();
  for (const eintrag of idMap.eintraege) {
    idCounts.set(eintrag.id, (idCounts.get(eintrag.id) ?? 0) + 1);
  }
  for (const [id, count] of idCounts) {
    if (count > 1) {
      errors.push(`Interner Fehler im ID-Mapping: technische ID "${id}" ist ${count}-fach vergeben.`);
    }
  }
  if (errors.length > 0) {
    return { content: null, idMap: existingIdMap, errors, warnings, stats: null };
  }

  // -----------------------------------------------------------------------
  // 6. content.json zusammenstellen
  // -----------------------------------------------------------------------
  const kategorienSorted = [...kategorien.values()].sort((a, b) => a.reihenfolge - b.reihenfolge);

  const content = {
    schemaVersion: '1',
    quelle: 'Sachkundenachweis.csv',
    erzeugtAm: nowIso,
    kategorien: kategorienSorted,
    fragen: sortedFragen.map(f => ({
      id: f.id,
      nummer: f.nummer,
      kategorieId: f.kennung,
      fragetext: f.fragetext,
      bild: f.bild,
      antworten: f.antworten.map(a => ({ kennung: a.ziffer, text: a.text, correct: a.correct })),
    })),
  };

  const stats = {
    fragenCount: content.fragen.length,
    kategorienCount: content.kategorien.length,
    bilderVerwendet: usedImageBaseNames.size,
    neueIds,
    entfernteFragen,
  };

  return { content, idMap, errors, warnings, stats };
}
