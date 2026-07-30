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

## Konsummodell

Apps übernehmen ausschließlich eine markierte Release-Version oder ein daraus
gebautes Paket. Direkte relative Importe aus diesem Repository sind verboten.
So kann jede App selbst entscheiden, wann sie eine neue Shared-Version testet
und veröffentlicht.

## Paketformat

Es gibt noch keine gemeinsame Runtime und kein npm-/NuGet-Paket.
`public-app-shell/v1` ist bewusst ein statischer, frameworkneutraler Vertrag.
Apps übernehmen ihn aus einem festen Release beziehungsweise exakten
Shared-Commit in das eigene Repository. Eine spätere Paketierung darf diesen
Lifecyclegedanken nicht aufheben.

Es wurden bewusst noch keine Assets aus bestehenden Apps kopiert. Vor der ersten
Übernahme werden Quelle, Lizenz, Varianten, Barrierefreiheit und bestehende
Abhängigkeiten geprüft.
