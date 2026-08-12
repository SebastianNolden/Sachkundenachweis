# Sachkundenachweis - Mobile App

Capacitor/Android-App für den Sachkundenachweis-Lerntrainer. Reines
HTML/CSS/JavaScript (kein Framework, kein Bundler), verpackt mit Capacitor
für Android. Vollständig unabhängig von der WPF-Anwendung - keine
C#-Referenzen, kein gemeinsamer Code.

**Meilenstein 1 (aktueller Stand):** App lädt `content.json` aus dem
Mobile-Projekt und zeigt die erste Frage darin an (Fragetext, Bild falls
vorhanden, Single-Choice/Mehrfachauswahl je nach Anzahl korrekter Antworten,
ein "Antwort prüfen"-Button mit einfacher lokaler Rückmeldung ohne
Speicherung). Noch **kein** Lernfortschritt, keine Statistik, kein
vollständiger Testmodus, keine SQLite-Datenbank.

## Voraussetzungen

- **Node.js ≥ 22** und npm (getestet mit Node v24.19.0 / npm 11.17.0)
- Für den Browser-Test: nur Node.js, sonst nichts weiter
- Für den Android-Build zusätzlich:
  - **JDK 17** (wird von Android Studio mitgebracht, alternativ separat
    installierbar) - `JAVA_HOME` muss gesetzt sein
  - **Android SDK** (wird von Android Studio mitgebracht) - `ANDROID_HOME`
    bzw. `ANDROID_SDK_ROOT` muss gesetzt sein, oder das Projekt wird über
    Android Studio geöffnet, das den Pfad selbst einträgt
  - Empfehlung: **Android Studio** installieren - bringt JDK und Android SDK
    in einem Schritt mit und ist der einfachste Weg, das generierte
    `android/`-Projekt zu öffnen und zu bauen

    Auf diesem Entwicklungsrechner sind aktuell **weder JDK noch Android SDK
    vorhanden** - ein reiner `npm install` reicht zum Vorbereiten der App,
    für einen echten Android-Build ist eine der obigen Installationen nötig.

## Installation

```
cd "Sachkundenachweis mobile/app"
npm install
npm run sync-content
```

`npm run sync-content` kopiert `content.json` sowie die davon referenzierten
Bilder aus dem WPF-Projekt in `www/` (siehe Abschnitt "Woher content.json und
Bilder kommen" unten). Dieser Schritt läuft auch automatisch bei `npm run
build` und `npm run cap:sync`.

## Start im Browser

Kein Build-Schritt nötig, da reines HTML/CSS/JS. `www/` muss aber über einen
lokalen Webserver ausgeliefert werden (nicht per Doppelklick/`file://`
öffnen, sonst blockiert der Browser das Laden von `content.json` per CORS):

```
npx serve www
```

oder z. B.

```
npx http-server www
```

und die angezeigte lokale Adresse (z. B. `http://localhost:3000`) im Browser
öffnen.

## Android-Build

```
npm run cap:sync
```

führt `sync-content` aus und synchronisiert danach die Web-Assets in das
`android/`-Projekt (`cap sync android`). Das native Android-Projekt selbst
bauen (erzeugt eine Debug-APK):

```
cd android
./gradlew assembleDebug        # macOS/Linux
gradlew.bat assembleDebug      # Windows
```

Voraussetzung dafür sind JDK 17 und das Android SDK wie oben beschrieben.
Ohne diese schlägt der Build mit einer klaren Fehlermeldung
(`JAVA_HOME is not set ...`) fehl, ohne dass etwas anderes kaputt geht.

## Android-Projekt öffnen (Android Studio)

```
npm run android:open
```

öffnet `android/` in Android Studio (falls installiert). Android Studio
richtet beim ersten Öffnen `local.properties` (Pfad zum Android SDK)
automatisch ein.

## Woher content.json und Bilder kommen

- Quelle: `Sachkundenachweis mobile/content.json` (erzeugt durch die
  CSV→JSON-Pipeline unter `../content-pipeline/`, siehe deren README) und
  `Sachkundenachweis/Sachkundenachweis/Resources/Images/*.png` (Bilder der
  bestehenden WPF-Anwendung, rein lesend verwendet).
- `npm run sync-content` (`scripts/sync-content.mjs`) kopiert daraus:
  - `content.json` unverändert nach `www/content.json`
  - ausschließlich die tatsächlich referenzierten Bilder (aktuell 7) nach
    `www/images/*.png`
- Die App selbst liest zur Laufzeit **nur** `www/content.json` bzw. das
  daraus gebündelte Äquivalent in der Android-App (`fetch('content.json')`)
  - nichts wird in JavaScript hartkodiert und nichts wird zur Laufzeit aus
    der WPF-Anwendung oder der CSV gelesen.
- Weder die CSV→JSON-Pipeline noch die WPF-Anwendung werden durch diese App
  verändert; `sync-content` liest von dort nur lesend.

## Projektstruktur

```
app/
├── package.json           npm-Projekt, Skripte fuer Sync/Build/Android
├── capacitor.config.json  App-ID "de.sachkundenachweis.mobile", App-Name "Sachkundenachweis"
├── scripts/
│   └── sync-content.mjs   kopiert content.json + Bilder nach www/
├── www/                    Web-Assets der App (Quelle fuer Capacitor)
│   ├── index.html
│   ├── css/styles.css
│   ├── js/app.js
│   ├── content.json        (generiert, nicht manuell bearbeiten)
│   └── images/              (generiert, nicht manuell bearbeiten)
└── android/                 generiertes natives Android-Projekt (`cap add android`)
```
