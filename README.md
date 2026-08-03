# MilosApps Shared

Versionierte Austauschschicht für gemeinsame MilosApps-Assets und
Integrationsverträge.

## Bereiche

- [`brand/`](brand/README.md): Farben, Typografie, Logos, Icons und Design-Tokens
- [`contracts/`](contracts/README.md): stabile, appübergreifende Daten- und
  Integrationsverträge
- [`templates/`](templates/README.md): optionale, versionierte App-Scaffolds
  ohne gemeinsame Browser-Runtime
- [`CHANGELOG.md`](CHANGELOG.md): vorbereitete und veröffentlichte Änderungen

## Verfügbare Verträge

- [`public-app-shell/v1`](contracts/public-app-shell/v1/README.md): kompakter,
  zweisprachiger Header-/Footer- und Portal-Link-Vertrag für öffentliche
  MilosApps. Der Kalender ist ausdrücklich ausgeschlossen.
- [`public-app-shell/v2`](contracts/public-app-shell/v2/README.md):
  dependency-freies ES-Modul/Web-Component mit App-Manifest, lokaler
  Build-Vendorung, SHA-256-Lock, Sync-/Verify-Werkzeug und standardisierter
  Referenz-QA. Kalender und kontopflichtige Apps sind ausgeschlossen.
- [`public-app-layout/v1`](contracts/public-app-layout/v1/README.md):
  frameworkneutraler, kompakter Inhaltslayout-Baukasten. Version 1.1.0
  begrenzt zusätzlich H1/H2/Icon, bietet kompakte Einstellungen und macht
  Zwei-Spalten-Flows zum bewussten Opt-in. Lokale CSS-Artefakte, app-eigene
  Farbtokens, Sync, SHA-256-Lock und Validator bleiben erhalten. `cloud-post`
  ist der einzige Pilot bis zum Nutzerreview.
- [`public-app-essentials/v1`](contracts/public-app-essentials/v1/README.md):
  allgemeiner, CSP-sicher vendorter Interaktionsbaukasten für einen begrenzten
  Loading Screen, wahrheitsgemäße Datenschutzmodi, layoutstabiles Teilen,
  komponentenbreitenabhängige Datumsauswahl und eine providerneutrale
  Ort-/Regionssuche. Version 1.2.0 begrenzt das App-Ladeicon in Markup und CSS
  einheitlich auf 32 mal 32 Pixel und das app-eigene Shell-Slot-SVG in allen
  Übergangszuständen auf 38 mal 38 Pixel. Sie zeigt bei `no-cookies` keinen Banner,
  hält natives Teilen visuell still, erzwingt den Startup-Vertrag und
  bewahrt den bisherigen nativen Datumsmodus und ergänzt für merkbare Daten
  einen expliziten textbasierten Tag-Monat-Jahr-Modus mit separater nativer
  Kalenderaktion. Schema, Release-Provenienz und Provider-Lebenszyklen werden
  weiterhin fail-closed validiert.
  Ein bereits verifizierter `public-app-shell/v2`-Footer kann den permanenten
  No-Cookies-Datenschutzweg ohne doppelten App-Link bereitstellen. Physischer
  Icon-Quellpfad und öffentliche Same-Origin-URL können bei
  geroutetem Hosting getrennt deklariert werden.
  Vorschläge bleiben an einen expliziten Nachweis gebunden: app-eigener Proxy
  oder ein Provider, der direkte Browser-Vorschläge ausdrücklich erlaubt.
  Außenklick, Escape und Disconnect schließen die gemeinsame Listbox
  race-sicher; öffentliches Nominatim bleibt submit-only.
  Kalender und Login-Apps sind ausgeschlossen.

## Konsummodell

Apps übernehmen ausschließlich eine markierte Release-Version oder ein daraus
gebautes Paket. Direkte relative Importe aus diesem Repository sind verboten.
So kann jede App selbst entscheiden, wann sie eine neue Shared-Version testet
und veröffentlicht.

Die React-/Vite-Vorlage unter `templates/public-app-react-vite/v1` ist davon
bewusst getrennt. Sie wird einmalig aus einem unveränderlichen Template-Tag
kopiert; anschließend gehören Quellcode, Paketpins und Lockdatei der App.
React bleibt optional, Shell/Layout/Essentials bleiben frameworkneutral und
kein neuer Template-Tag migriert bestehende Apps automatisch.

## Paketformat

`public-app-shell/v1` bleibt ein statischer, frameworkneutraler Vertrag.
`public-app-shell/v2` ergänzt ein dependency-freies ES-Modul/Web-Component und
ein Sync-Werkzeug. Das Modul wird beim Build beziehungsweise Bootstrap in das
App-Repository vendort und mit Version, Shared-Commit und SHA-256 gesperrt. Es
gibt weiterhin kein CDN und keinen appübergreifenden Runtime-Import.

`public-app-layout/v1` ergänzt diese Shell um lokale CSS-Primitiven für den
Hauptinhalt. Der Vertrag erzeugt keine gemeinsame Runtime und vereinheitlicht
weder Fachfunktion noch App-Identität. Jede App übernimmt ihn bewusst und
app-eigen; ein Pilot in Wolkenpost geht jedem weiteren Rollout voraus.

`public-app-essentials/v1` ergänzt Shell und Layout um wiederkehrende
Interaktionen. Die Browserartefakte werden ebenfalls in jedes Verbraucher-Repo
kopiert und zusammen mit app-eigenem Theme und Verifier gelockt. Ortssuche
vereinheitlicht UI und Ergebnisformat, nicht den externen Anbieter oder die
fachliche Interpretation eines Ortes. Submit-only bleibt Standard; ein
Autocomplete-fähiger Verbraucher-Proxy ist ein expliziter, belegter Opt-in.

Es wurden bewusst noch keine Assets aus bestehenden Apps kopiert. Vor der ersten
Übernahme werden Quelle, Lizenz, Varianten, Barrierefreiheit und bestehende
Abhängigkeiten geprüft.
