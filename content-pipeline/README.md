# Content-Pipeline (Sachkundenachweis Mobile)

Erzeugt aus der bestehenden WPF-Datenquelle die statischen Lerninhalte für
die Mobile-App. Liest die WPF-Ressourcen ausschließlich lesend - es wird dort
nichts verändert.

```
Sachkundenachweis/Sachkundenachweis/Resources/Sachkundenachweis.csv
Sachkundenachweis/Sachkundenachweis/Resources/Images/*.png
  -> Sachkundenachweis mobile/content.json
  -> Sachkundenachweis mobile/content-id-map.json
```

`content.json` enthält die statischen Lerninhalte (Kategorien, Fragen,
Antworten, Bildreferenzen) für die Mobile-App. `content-id-map.json` ist ein
**dauerhaftes** Mapping (Kategorie, Nummer) -> stabile technische Frage-ID.
Es wird bei jedem Lauf gelesen und fortgeschrieben, niemals verworfen und neu
erzeugt, damit einmal vergebene IDs erhalten bleiben.

## Ausführen

```
node build-content.mjs
```

oder

```
npm run build
```

Voraussetzung: Node.js (getestet mit v24). Keine weiteren Abhängigkeiten,
`npm install` ist nicht nötig.

## Funktionsweise (Kurzüberblick)

1. CSV RFC4180-konform einlesen (Semikolon-getrennt, inkl. gequoteter,
   mehrzeiliger Felder und escapter Anführungszeichen) - siehe
   `lib/csv-parser.mjs`. Kein zeilenbasiertes Parsing, da die CSV
   nachweislich mehrzeilige, gequotete Felder enthält.
2. Datensätze zu Fragen gruppieren anhand **(Kategorie-Kennung, Nummer)**,
   nicht nur anhand der Nummer - vermeidet Kollisionen zwischen Kategorien.
3. Fragetext je Frage aus der/den Zeile(n) übernehmen, in der/denen er
   gesetzt ist. Da die Gruppierung direkt anhand von (Kategorie, Nummer)
   erfolgt statt über ein sequenzielles Fill-Down über die ganze Datei, kann
   der Fragetext einer Frage niemals versehentlich von einer vorherigen,
   fachlich anderen Frage übernommen werden. Ein widersprüchlicher
   Fragetext innerhalb derselben (Kategorie, Nummer)-Gruppe ist ein Fehler,
   kein stilles Überschreiben.
4. Kategorie-Kennung (führende Zahl) + Name aus dem Rohstring extrahieren,
   Name normalisieren (Mehrfach-Leerzeichen bereinigen), numerische
   Reihenfolge aus der Kennung ableiten.
5. Bildzuordnung rein anhand der fachlichen Nummer prüfen
   (`Resources/Images/{Nummer}.png`) - `content.json` enthält nur eine
   logische Referenz (die Nummer als String), keinen Dateipfad.
6. Stabile technische IDs über `content-id-map.json` vergeben/pflegen:
   - bekannte (Kategorie, Nummer) behalten ihre ID
   - neue (Kategorie, Nummer) erhalten eine neue, fortlaufende ID
     (`q-0001`, `q-0002`, ...)
   - nicht mehr in der CSV vorkommende Einträge werden als `"entfernt"`
     markiert, ihre ID bleibt reserviert und wird nie für eine andere
     Frage wiederverwendet
7. Validierung (siehe unten) über alle Fragen/Antworten/Kategorien. Bei
   blockierenden Fehlern werden **weder** `content.json` **noch**
   `content-id-map.json` geschrieben - beide Dateien werden nur gemeinsam
   aktualisiert, damit sie nie inkonsistent zueinander werden können.
8. Bericht auf der Konsole ausgeben (Anzahl Fragen/Kategorien/Bilder, neue
   und entfernte IDs, Fehler, Warnungen im Detail).

## Validierung

**Blockierend** (Pipeline bricht ab, keine Ausgabedatei wird geschrieben):

- Kategorie, Nummer, Antwort-Ziffer oder Antworttext fehlt
- Kategorie-Kennung nicht aus dem Rohstring extrahierbar
- widersprüchlicher Fragetext innerhalb derselben (Kategorie, Nummer)-Gruppe
- doppelte Antwort-Ziffer innerhalb einer Frage
- kein Fragetext für eine Frage gefunden
- keine Antwort einer Frage als korrekt markiert
- interne doppelte technische ID im Mapping (Absicherung)

**Warnung** (nicht blockierend, wird im Bericht aufgeführt):

- Kategorie-Name musste normalisiert werden (z. B. doppelte Leerzeichen)
- uneinheitlicher Kategorie-Name für dieselbe Kennung
- Frage mit einer von 4 abweichenden Antwortanzahl
- Bild, das von keiner Frage referenziert wird

## Konventionen dieses Ordners

Eigenständiges Node.js-Projekt ohne Abhängigkeit zur WPF-Codebasis (siehe
`CLAUDE.md`: "teilen sich keinen Code"). Bezeichner im Code sind Englisch,
fachliche Begriffe (Frage, Antwort, Kategorie, Ziffer, korrekt) bleiben wie
in der WPF-Referenz Deutsch.
