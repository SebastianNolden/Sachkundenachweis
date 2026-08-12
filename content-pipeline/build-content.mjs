#!/usr/bin/env node
/**
 * CLI-Einstiegspunkt der Content-Pipeline.
 *
 *   Sachkundenachweis/Sachkundenachweis/Resources/Sachkundenachweis.csv
 *   Sachkundenachweis/Sachkundenachweis/Resources/Images/*.png
 *     -> Sachkundenachweis mobile/content.json
 *     -> Sachkundenachweis mobile/content-id-map.json
 *
 * Liest die WPF-Ressourcen ausschließlich lesend - es wird dort nichts
 * verändert. Siehe README.md in diesem Ordner für Details.
 *
 * Aufruf:  node build-content.mjs   (oder: npm run build)
 */

import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseCsv, rowsToObjects } from './lib/csv-parser.mjs';
import { buildContent } from './lib/pipeline.mjs';
import { formatReport } from './lib/report.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(mobileRoot, '..');

const paths = {
  csvPath: path.join(repoRoot, 'Sachkundenachweis', 'Sachkundenachweis', 'Resources', 'Sachkundenachweis.csv'),
  imagesDir: path.join(repoRoot, 'Sachkundenachweis', 'Sachkundenachweis', 'Resources', 'Images'),
  outputPath: path.join(mobileRoot, 'content.json'),
  idMapPath: path.join(mobileRoot, 'content-id-map.json'),
};

async function loadExistingIdMap(idMapPath) {
  let raw;
  try {
    raw = await readFile(idMapPath, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') {
      return { schemaVersion: '1', naechsteFreieLaufnummer: 1, eintraege: [] };
    }
    throw err;
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `content-id-map.json ist vorhanden, aber kein gültiges JSON (${err.message}). ` +
      `Abbruch, um bestehende ID-Zuordnungen nicht zu gefährden.`
    );
  }

  if (
    typeof parsed !== 'object' || parsed === null ||
    !Array.isArray(parsed.eintraege) ||
    typeof parsed.naechsteFreieLaufnummer !== 'number'
  ) {
    throw new Error(
      'content-id-map.json hat nicht die erwartete Struktur (eintraege[] / naechsteFreieLaufnummer). ' +
      'Abbruch, um bestehende ID-Zuordnungen nicht zu gefährden.'
    );
  }

  return parsed;
}

async function loadImageBaseNames(imagesDir) {
  let entries;
  try {
    entries = await readdir(imagesDir);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return new Set();
    }
    throw err;
  }
  return new Set(
    entries
      .filter(name => name.toLowerCase().endsWith('.png'))
      .map(name => name.slice(0, -4))
  );
}

async function main() {
  const csvText = await readFile(paths.csvPath, 'utf8');
  const rows = parseCsv(csvText, ';');
  const records = rowsToObjects(rows);

  const existingIdMap = await loadExistingIdMap(paths.idMapPath);
  const imageBaseNames = await loadImageBaseNames(paths.imagesDir);

  const result = buildContent({
    records,
    existingIdMap,
    imageBaseNames,
    nowIso: new Date().toISOString(),
  });

  if (result.errors.length > 0) {
    console.log(formatReport({ paths, stats: null, errors: result.errors, warnings: result.warnings }));
    process.exitCode = 1;
    return;
  }

  // content.json und content-id-map.json werden nur gemeinsam geschrieben,
  // damit beide Dateien immer zueinander konsistent bleiben.
  await writeFile(paths.outputPath, JSON.stringify(result.content, null, 2) + '\n', 'utf8');
  await writeFile(paths.idMapPath, JSON.stringify(result.idMap, null, 2) + '\n', 'utf8');

  console.log(formatReport({ paths, stats: result.stats, errors: result.errors, warnings: result.warnings }));
}

main().catch(err => {
  console.error('Unerwarteter Fehler in der Pipeline:');
  console.error(err);
  process.exitCode = 1;
});
