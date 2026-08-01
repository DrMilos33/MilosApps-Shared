# Changelog

## Unreleased

- Keine Änderungen.

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
