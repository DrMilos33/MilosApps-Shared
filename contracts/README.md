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
