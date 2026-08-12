/**
 * Minimaler, RFC4180-konformer CSV-Parser ohne externe Abhängigkeiten.
 *
 * Unterstützt (bewusst so ausgelegt, weil Sachkundenachweis.csv das braucht):
 *  - konfigurierbares Trennzeichen (hier: Semikolon)
 *  - gequotete Felder ("...") mit eingebetteten Trennzeichen und Zeilenumbrüchen
 *  - escapte Anführungszeichen innerhalb eines gequoteten Feldes ("" -> ")
 *  - CRLF- und LF-Zeilenenden
 *  - UTF-8-BOM am Dateianfang
 */

/**
 * @param {string} text       vollständiger CSV-Dateiinhalt
 * @param {string} delimiter  Feldtrennzeichen, hier ";"
 * @returns {string[][]}      Rohzeilen (jede Zeile = Array von Feldwerten), erste Zeile = Header
 */
export function parseCsv(text, delimiter = ';') {
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1);
  }

  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  let i = 0;
  const len = text.length;

  while (i < len) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          // escapte Anführungszeichen ("") innerhalb eines gequoteten Feldes
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      // innerhalb eines gequoteten Feldes zählen auch Trennzeichen und
      // Zeilenumbrüche als normaler Zeicheninhalt
      field += char;
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }

    if (char === delimiter) {
      row.push(field);
      field = '';
      i += 1;
      continue;
    }

    if (char === '\r' || char === '\n') {
      row.push(field);
      rows.push(row);
      field = '';
      row = [];
      i += char === '\r' && text[i + 1] === '\n' ? 2 : 1;
      continue;
    }

    field += char;
    i += 1;
  }

  // letztes Feld/letzte Zeile abschließen, falls die Datei nicht mit
  // einem Zeilenumbruch endet
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  // vollständig leere Zeilen (z. B. durch ein abschließendes Zeilenende) verwerfen
  return rows.filter(r => !(r.length === 1 && r[0] === ''));
}

/**
 * Wandelt Rohzeilen (erste Zeile = Header) in Objekte um, benannt nach den
 * Spaltenüberschriften. Eine leere Spaltenüberschrift (z. B. durch ein
 * abschließendes Trennzeichen im Header) wird ignoriert.
 *
 * @param {string[][]} rows
 * @returns {Record<string,string>[]}
 */
export function rowsToObjects(rows) {
  if (rows.length === 0) return [];

  const [header, ...dataRows] = rows;
  const columns = header.map(h => h.trim());

  return dataRows
    .filter(r => !(r.length === 1 && r[0].trim() === ''))
    .map(r => {
      const obj = {};
      columns.forEach((col, idx) => {
        if (!col) return;
        obj[col] = r[idx] ?? '';
      });
      return obj;
    });
}
