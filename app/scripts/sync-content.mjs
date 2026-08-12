/**
 * Kopiert die statischen Lerninhalte in den Web-Ordner der App (www/):
 *
 *   Sachkundenachweis mobile/content.json
 *   Sachkundenachweis/Sachkundenachweis/Resources/Images/*.png (nur die tatsächlich
 *   von content.json referenzierten Bilder)
 *     -> Sachkundenachweis mobile/app/www/content.json
 *     -> Sachkundenachweis mobile/app/www/images/*.png
 *
 * Rein lesend gegenüber der WPF-Anwendung und der content-pipeline - beide werden
 * hier nicht verändert, nur als Quelle verwendet. content.json wird unverändert
 * (Byte für Byte) übernommen, nicht neu serialisiert.
 */

import { readFile, copyFile, mkdir, rm, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');
const mobileRoot = path.resolve(appRoot, '..');
const repoRoot = path.resolve(mobileRoot, '..');

const contentJsonSrc = path.join(mobileRoot, 'content.json');
const imagesSrcDir = path.join(repoRoot, 'Sachkundenachweis', 'Sachkundenachweis', 'Resources', 'Images');

const wwwDir = path.join(appRoot, 'www');
const contentJsonDest = path.join(wwwDir, 'content.json');
const imagesDestDir = path.join(wwwDir, 'images');

async function main() {
  const raw = await readFile(contentJsonSrc, 'utf8');
  const content = JSON.parse(raw); // nur zum Ermitteln der benötigten Bilder, Datei selbst wird unverändert kopiert

  await mkdir(wwwDir, { recursive: true });
  await copyFile(contentJsonSrc, contentJsonDest);

  // images/ komplett neu aufbauen, damit keine veralteten Bilder (z. B. von
  // entfernten Fragen) in der App landen - content.json ist die alleinige Quelle.
  await rm(imagesDestDir, { recursive: true, force: true });
  await mkdir(imagesDestDir, { recursive: true });

  const benoetigteBilder = [...new Set(content.fragen.filter(f => f.bild).map(f => f.bild))];

  for (const bild of benoetigteBilder) {
    const src = path.join(imagesSrcDir, `${bild}.png`);
    const dest = path.join(imagesDestDir, `${bild}.png`);
    try {
      await copyFile(src, dest);
    } catch (err) {
      if (err.code === 'ENOENT') {
        throw new Error(
          `Bild "${bild}.png" wird von content.json referenziert, ist aber unter ${src} nicht vorhanden.`
        );
      }
      throw err;
    }
  }

  const kopierteBilder = (await readdir(imagesDestDir)).length;

  console.log('content.json und Bilder synchronisiert:');
  console.log(`  Quelle content.json: ${contentJsonSrc}`);
  console.log(`  Quelle Bilder:       ${imagesSrcDir}`);
  console.log(`  Ziel:                ${wwwDir}`);
  console.log(`  Fragen: ${content.fragen.length}, Bilder kopiert: ${kopierteBilder}`);
}

main().catch(err => {
  console.error('Fehler beim Synchronisieren der Lerninhalte:');
  console.error(err);
  process.exitCode = 1;
});
