/**
 * Formatiert den Pipeline-Lauf als lesbaren Konsolen-Bericht.
 */

/**
 * @param {object} args
 * @param {{csvPath:string, imagesDir:string, outputPath:string, idMapPath:string}} args.paths
 * @param {{fragenCount:number, kategorienCount:number, bilderVerwendet:number, neueIds:number, entfernteFragen:number}|null} args.stats
 * @param {string[]} args.errors
 * @param {string[]} args.warnings
 * @returns {string}
 */
export function formatReport({ paths, stats, errors, warnings }) {
  const lines = [];

  lines.push('=== Content-Pipeline: Sachkundenachweis.csv -> content.json ===');
  lines.push(`CSV-Quelle:   ${paths.csvPath}`);
  lines.push(`Bilder:       ${paths.imagesDir}`);
  lines.push(`content.json: ${paths.outputPath}`);
  lines.push(`ID-Mapping:   ${paths.idMapPath}`);
  lines.push('');

  if (stats) {
    lines.push(`Fragen: ${stats.fragenCount}`);
    lines.push(`Kategorien: ${stats.kategorienCount}`);
    lines.push(`Bilder verwendet: ${stats.bilderVerwendet}`);
    lines.push(`Neue IDs: ${stats.neueIds}`);
    lines.push(`Entfernte Fragen: ${stats.entfernteFragen}`);
  }
  lines.push(`Fehler: ${errors.length}`);
  lines.push(`Warnungen: ${warnings.length}`);

  if (errors.length > 0) {
    lines.push('');
    lines.push('Fehler (blockierend):');
    errors.forEach(e => lines.push(`  - ${e}`));
  }

  if (warnings.length > 0) {
    lines.push('');
    lines.push('Warnungen:');
    warnings.forEach(w => lines.push(`  - ${w}`));
  }

  lines.push('');
  lines.push(
    errors.length > 0
      ? 'Ergebnis: FEHLGESCHLAGEN - content.json wurde NICHT geschrieben. Bitte Fehler oben beheben und Pipeline erneut ausfuehren.'
      : 'Ergebnis: ERFOLGREICH - content.json und content-id-map.json wurden geschrieben.'
  );

  return lines.join('\n');
}
