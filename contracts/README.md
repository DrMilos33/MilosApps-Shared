# Appübergreifende Verträge

Dieser Bereich ist für versionierte Verträge zwischen Portal und Apps
vorgesehen, beispielsweise:

- App-Metadaten für das öffentliche Verzeichnis;
- Berechtigungs- und App-Key-Konventionen;
- sichere Übergabe eines zentral gewährten App-Zugriffs;
- Healthcheck- und Gateway-Metadaten;
- gemeinsame Fehlerformate.

Verträge beschreiben Schnittstellen, nicht Implementierungen. Passwörter,
Cookies, Secrets und Fachdaten anderer Apps werden nicht geteilt. Neue Felder
sind standardmäßig optional; inkompatible Änderungen erhalten eine neue
Vertragsversion.

## Veröffentlicht

- [`public-app-shell/v1`](public-app-shell/v1/README.md): Header, DE/EN,
  umgebungsabhängige Portalnavigation, kompakter Footer, Tokens,
  Referenzmarkup und Mindesttestmatrix für öffentliche Apps. Der Kalender ist
  nicht Teil dieses Vertrags.
- [`public-app-shell/v2`](public-app-shell/v2/README.md): verpflichtendes
  App-Manifest, gepinntes lokales ES-Modul/Web-Component, Inline-Flaggen,
  Sprachereignis, Sync, Lock/Prüfsummen und portabler CI-Validator für
  öffentliche Apps ohne Login. Kalender und kontopflichtige Apps sind
  ausgeschlossen.
- [`public-app-layout/v1`](public-app-layout/v1/README.md): kompakte,
  frameworkneutrale Hauptinhaltsachse mit Intro-, Arbeits-, Flow-, Ergebnis-,
  Einstellungs-, Disclosure- und Dialog-Primitiven, app-eigenem Theme,
  Dichtebudget und portablem Lock/Validator. Version 1.1.0 begrenzt Titel und
  Intro-Icon und setzt mehrere Flowspalten nur per explizitem Opt-in. Der erste
  Verbraucher ist ausschließlich Wolkenpost; weitere Apps warten auf
  Nutzerreview.
- [`public-app-essentials/v1`](public-app-essentials/v1/README.md):
  dependency-freie, lokal vendorte Bausteine für Loading Screen,
  wahrheitsgemäße Datenschutzmodi, layoutstabiles Teilen, native Datumsauswahl
  und providerneutrale Ort-/Regionssuche. Version 1.1.0 ergänzt
  komponentenbreitenabhängigen Reflow, Select-Pfeilabstand sowie einen
  nachweispflichtigen Suggestions-Opt-in. Der Vertrag erzwingt explizite
  App-Bereitschaft, Same-Origin-CSP, Lock/Hashes und wahrheitsgemäße
  Trackinggrenzen.
