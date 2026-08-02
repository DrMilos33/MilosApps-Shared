# Changelog

## Unreleased

- Keine Änderungen.

## public-app-layout 1.1.0 – 2026-08-02

- H1, H2 und Intro-Icon mit eigenen deutlich kompakteren Desktop-/Mobilbudgets
  begrenzt; Intro und Primärarbeitsbeginn zusätzlich enger gefasst.
- `data-milos-settings*` als kompakte, reflowende Einstellungsstruktur ergänzt.
  Auch geöffnet bleiben Einstellungsintro, Controls und lokale Resetaktion
  unter einem eigenen Höhenbudget.
- Schrittfolgen sind standardmäßig einspaltig. Zwei Spalten entstehen nur noch
  durch den app-eigenen Opt-in `data-milos-flow="paired"` und reflowen mobil
  wieder einspaltig.
- Wolkenpost bleibt einziger Pilot; weitere Apps warten weiterhin auf das
  Nutzerreview dieser zweiten DEV-Fassung. Production bleibt gesperrt.

## public-app-layout 1.0.0 – 2026-08-01

- Separaten, frameworkneutralen Vertrag `public-app-layout/v1` für kompakte
  öffentliche No-Login-App-Inhalte ergänzt. `public-app-shell/v2` bleibt
  unverändert Eigentümer von Header, Footer, Sprache und Portal-Links.
- Lokale CSS-Primitiven für Intro, Primärarbeit, flache Flows, Panels,
  Ergebnisse, progressive Offenlegung, Command-Docks und intern reflowende
  Dialoge hinzugefügt.
- Verbindliche Dichtebudgets für 1440 × 900 und 390 × 844 sowie Reflow bei
  360 × 800 und 200 Prozent dokumentiert; 44-Pixel-Ziele, sichtbares Clipping,
  reduzierte Bewegung und höchstens eine dekorative Kartenebene bleiben Gates.
- Manifest, app-eigene Theme-CSS, Sync, drei SHA-256-Lockartefakte und portablen
  Validator hinzugefügt. Kein CDN, keine gemeinsame Runtime und keine
  Production-Freigabe.
- `cloud-post` als einzigen Pilot festgelegt. Weitere Apps werden erst nach
  dessen DEV-Abnahme und ausdrücklichem Nutzerreview geöffnet.

## 2.0.3 – 2026-08-01

- Shadow-DOM-CSS aus dem JavaScript-Inline-`style` in die vendorte externe
  Datei `milos-app-shell.css` verschoben.
- App-spezifische Theme-Tokens werden beim Sync als externe
  `milos-app-shell-theme.css` erzeugt und vom Bootstrap als Same-Origin-Datei
  geladen; `style.setProperty` und dynamische Inline-Styles entfallen.
- Lock und portabler Validator prüfen beide CSS-Artefakte. Der Vertrag verlangt
  eine grüne Browserregression unter `script-src 'self'; style-src 'self'`
  ohne Nonce, Hash oder `unsafe-inline`.

## 2.0.2 – 2026-08-01

- Die globale `20rem`-Mindestbreite der Shell-Seite entfernt. Dadurch kann die
  vendorte Shell auch auf schmalen Viewports bei 200 Prozent Zoom ohne
  horizontalen Überlauf auf die verfügbare Breite zurückfließen.
- Die dekorative Icon-Fassung bleibt bei 38 CSS-Pixeln, während die Markenreihe
  auf schmalen Viewports kontrolliert umbrechen darf. Header-Navigation und
  Sprachgruppe erhalten explizite Schrumpfgrenzen gegen Min-Content-Überlauf.
- Der Contract-Validator lehnt eine erneute feste Body-Mindestbreite ab und
  prüft die reflow-fähige `min-width: 0`-Grenze.
- Noch nicht veröffentlichte oder extern blockierte Apps dürfen `dev.url` und
  `dev.healthUrl` gemeinsam auf `null` setzen. Sync und portabler Validator
  akzeptieren nur das ehrliche Paar „beide HTTPS“ oder „beide null“.

## 2.0.1 – 2026-08-01

- Ausführbare JavaScript-/ES-Modul-Artefakte werden per `.gitattributes`
  plattformübergreifend mit LF ausgecheckt, sodass die veröffentlichten
  SHA-256-Prüfsummen unter Windows und Linux identisch bleiben.
- Vertrag, Manifest, Sync, Validator und Referenzlock auf den unveränderbaren
  Patch-Tag `public-app-shell-v2.0.1` angehoben. Der bereits veröffentlichte
  Tag `v2.0.0` wird nicht verschoben.

## 2.0.0 – 2026-08-01

- `public-app-shell/v2` als dependency-freies ES-Modul/Web-Component mit
  semantischem Header/Footer, Inline-Flaggen mit sichtbaren DE/EN-Labels,
  standardisiertem Pfeil, 100dvh-Grid und app-eigenem SVG-/Main-Slot ergänzt.
- Ein verpflichtendes `milos-app.json`, Schema, app-spezifische
  Bootstrapgenerierung, SHA-256-Lock sowie portable Sync-/Verify-Werkzeuge
  eingeführt.
- Manipulations-, Pfad-, Production-, DE/EN-, Responsive-, Fokus-, Touch-,
  Overflow- und Reload-Persistenzgrenzen in Contract- und Referenztests
  aufgenommen.
- Kalender und kontopflichtige Apps bleiben ausgeschlossen; kein CDN, keine
  gemeinsame Runtime, keine Datenbank und keine Production-Freigabe.

## 1.0.0 – 2026-07-30

- Frameworkneutralen Vertrag `public-app-shell/v1` für die öffentlichen Apps
  `noodle-calculator`, `sky`, `cloud-post`, `somewhere-now`, `gravity-loop`,
  `waste-guide` und `daylight` hinzugefügt.
- Normative Umgebungslinks, DE/EN-Persistenz, Header-/Footer-Semantik,
  Layout-/Accessibility-Tokens, Referenzmarkup und dependency-freie
  Validierung ergänzt.
- Kalender ausdrücklich ausgeschlossen; keine gemeinsame Runtime, Datenbank
  oder erzwungene App-/Portalveröffentlichung.
