# MilosApps Shared-Regeln

## Zweck

Dieses Repository enthält ausschließlich wiederverwendbare, versionierte
MilosApps-Assets und appübergreifende Verträge. Es enthält keine App-Fachlogik,
keinen laufenden Identity-Dienst und keine Datenbank.

## Vor Änderungen

1. `README.md` und `CHANGELOG.md` lesen.
2. Im MilosApps Workspace `docs/APP_REGISTRY.md` und
   `docs/PORTFOLIO_ARCHITECTURE.md` lesen.
3. Benennen, welche Apps die Änderung benötigen und welche Version sie aktuell
   verwenden.

## Regeln

- Verbraucher binden eine feste Release-Version ein.
- Keine App importiert Dateien direkt aus diesem lokalen Arbeitsordner.
- Rückwärtskompatible Ergänzungen erhöhen später die Minor-Version.
- Inkompatible Änderungen benötigen eine neue Major-Version und einen
  Migrationshinweis.
- App-spezifische Sonderfälle bleiben im jeweiligen App-Repository.
- Verträge enthalten keine Secrets, Tokens, Produktionswerte oder
  personenbezogenen Beispieldaten.
- Bilder, Icons und Schriften benötigen dokumentierte Herkunft und Lizenz.
- Ein Shared-Release erzwingt kein Deployment einer verbrauchenden App.

## Prüfung

- Änderungen an Design-Tokens benötigen eine visuelle Beispielprüfung.
- Verträge benötigen gültige Beispiele und, sobald Schemas existieren,
  automatisierte Validierung.
- Vor Release müssen Changelog, Version und betroffene Verbraucher dokumentiert
  sein.
