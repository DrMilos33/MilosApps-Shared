# MilosApps Shared

Versionierte Austauschschicht für gemeinsame MilosApps-Assets und
Integrationsverträge.

## Bereiche

- [`brand/`](brand/README.md): Farben, Typografie, Logos, Icons und Design-Tokens
- [`contracts/`](contracts/README.md): stabile, appübergreifende Daten- und
  Integrationsverträge
- [`CHANGELOG.md`](CHANGELOG.md): vorbereitete und veröffentlichte Änderungen

## Verfügbare Verträge

- [`public-app-shell/v1`](contracts/public-app-shell/v1/README.md): kompakter,
  zweisprachiger Header-/Footer- und Portal-Link-Vertrag für öffentliche
  MilosApps. Der Kalender ist ausdrücklich ausgeschlossen.
- [`public-app-shell/v2`](contracts/public-app-shell/v2/README.md):
  dependency-freies ES-Modul/Web-Component mit App-Manifest, lokaler
  Build-Vendorung, SHA-256-Lock, Sync-/Verify-Werkzeug und standardisierter
  Referenz-QA. Kalender und kontopflichtige Apps sind ausgeschlossen.

## Konsummodell

Apps übernehmen ausschließlich eine markierte Release-Version oder ein daraus
gebautes Paket. Direkte relative Importe aus diesem Repository sind verboten.
So kann jede App selbst entscheiden, wann sie eine neue Shared-Version testet
und veröffentlicht.

## Paketformat

`public-app-shell/v1` bleibt ein statischer, frameworkneutraler Vertrag.
`public-app-shell/v2` ergänzt ein dependency-freies ES-Modul/Web-Component und
ein Sync-Werkzeug. Das Modul wird beim Build beziehungsweise Bootstrap in das
App-Repository vendort und mit Version, Shared-Commit und SHA-256 gesperrt. Es
gibt weiterhin kein CDN und keinen appübergreifenden Runtime-Import.

Es wurden bewusst noch keine Assets aus bestehenden Apps kopiert. Vor der ersten
Übernahme werden Quelle, Lizenz, Varianten, Barrierefreiheit und bestehende
Abhängigkeiten geprüft.
