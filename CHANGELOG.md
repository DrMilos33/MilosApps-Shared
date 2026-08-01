# Changelog

## Unreleased

- Keine Änderungen.

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
