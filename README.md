# MilosApps Shared

Versionierte Austauschschicht für gemeinsame MilosApps-Assets und
Integrationsverträge.

## Bereiche

- [`brand/`](brand/README.md): Farben, Typografie, Logos, Icons und Design-Tokens
- [`contracts/`](contracts/README.md): stabile, appübergreifende Daten- und
  Integrationsverträge
- [`CHANGELOG.md`](CHANGELOG.md): vorbereitete und veröffentlichte Änderungen

## Konsummodell

Apps übernehmen ausschließlich eine markierte Release-Version oder ein daraus
gebautes Paket. Direkte relative Importe aus diesem Repository sind verboten.
So kann jede App selbst entscheiden, wann sie eine neue Shared-Version testet
und veröffentlicht.

## Noch nicht festgelegt

Ein Paketformat wird erst gewählt, wenn der erste echte gemeinsame Verbraucher
feststeht. Möglich sind beispielsweise ein statisches Asset-Archiv, ein
versioniertes NuGet-Paket oder ein npm-Paket. Bis dahin werden keine
Build-Abhängigkeiten eingeführt.

Es wurden bewusst noch keine Assets aus bestehenden Apps kopiert. Vor der ersten
Übernahme werden Quelle, Lizenz, Varianten, Barrierefreiheit und bestehende
Abhängigkeiten geprüft.
