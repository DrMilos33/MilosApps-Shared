# Public App Shell v1

- Version: `1.0.0`
- Contract-ID: `public-app-shell/v1`
- Status: bereit zur gepinnten Übernahme
Kalender: ausdrücklich ausgeschlossen

## Zweck

Dieser frameworkneutrale Vertrag vereinheitlicht den kleinen MilosApps-Rahmen
öffentlicher Apps, ohne ihre eigene visuelle Identität oder ihren Lifecycle zu
übernehmen. Er definiert Header, Sprachwahl, Portalnavigation, Footer,
Umgebungslinks und Mindesttests.

Verbraucher:

- `noodle-calculator`
- `sky`
- `cloud-post`
- `somewhere-now`
- `gravity-loop`
- `waste-guide`
- `daylight`

`calendar` ist kein Verbraucher. Browserkalender und APK behalten ihren
eigenen geschützten Navigations-, Login- und Releasevertrag.

## Dateien

- [`contract.json`](contract.json): maschinenlesbare Sollwerte und Verbraucher.
- [`schema.json`](schema.json): Schema des Vertragsmanifests.
- [`tokens.css`](tokens.css): optionale, appüberschreibbare Shell-Tokens.
- [`reference.html`](reference.html): semantisches Referenzmarkup.
- [`reference.css`](reference.css): frameworkneutrale Referenzdarstellung.
- [`reference.js`](reference.js): Referenz für DE/EN, Persistenz und
  Umgebungslinks; keine gemeinsame Runtime.
- [`validate.ps1`](validate.ps1): dependency-freier Vertrags- und
  Referenzcheck.

Apps übernehmen eine feste veröffentlichte Version oder einen exakt gepinnten
Shared-Commit. Direkte Laufzeitimporte aus diesem lokalen Repository sind
verboten. Die Referenzdateien werden in das eigene Repository übertragen,
an dessen Framework angepasst und dort getestet.

## Header

- Der Header liegt normal im Dokumentfluss und überlagert keinen Inhalt.
  `sticky` ist kein Baseline-Verhalten und benötigt eine app-spezifische
  Begründung sowie eigene Scroll-/Zoomtests.
- Links steht ein app-eigenes, optisch zentriertes SVG-Icon mit einer
  sichtbaren Fassung von 36 bis 40 Pixeln.
- Direkt daneben steht die Wortmarke `MilosApps`.
- Ein dezentes `DEV`-Badge erscheint ausschließlich in DEV.
- Rechts folgt eine zugängliche Sprachwahl mit mindestens DE und EN.
  Der aktive Zustand ist visuell und programmatisch erkennbar.
- Danach folgt `Alle Apps` beziehungsweise `All apps`.
- Der App-Name bleibt als H1 in der Hauptfläche. Er wird nicht als zweite
  schwere Headernavigation wiederholt.

Das Icon ist app-eigen. Shared liefert nur Slot, Größe und
Barrierefreiheitsvertrag. Ist die Wortmarke direkt daneben vorhanden, darf das
rein dekorative Icon `aria-hidden="true"` sein. Ein funktionales oder allein
stehendes Icon benötigt dagegen einen eigenen zugänglichen Namen.

Das geometrische Inline-SVG in `reference.html` wurde für diesen Vertrag neu
erstellt, ist nur ein austauschbarer Platzhalter und kein MilosApps-Logo.
Verbraucher dürfen es zu Testzwecken verwenden, müssen es für die App aber
durch ihr eigenes dokumentiertes SVG ersetzen.

## Sprache

- Mindestens `de` und `en`.
- Die gesamte sichtbare UI der App wird übersetzt, nicht nur die Shell.
- Dazu gehören Seitentitel, Navigation, Buttons, Status, Validierung,
  Fehlermeldungen, Dialoge, leere Zustände und zugängliche Namen.
- Die Auswahl bleibt pro App lokal erhalten. Der Schlüssel lautet
  `milosapps.<app-key>.language`, damit mehrere Apps auf derselben Origin nicht
  kollidieren.
- Nicht unterstützte oder beschädigte Werte fallen auf DE zurück.
- Die Sprachwahl setzt `document.documentElement.lang` und den übersetzten
  Dokumenttitel.

## Umgebungslinks

Alle Shell-Links sind absolut und werden aus der fachlichen Umgebung gebildet:

| Link | DEV | Production |
|---|---|---|
| MilosApps | `https://dev.milos-apps.de/` | `https://milos-apps.de/` |
| Alle Apps | `https://dev.milos-apps.de/apps` | `https://milos-apps.de/apps` |
| Impressum | `https://dev.milos-apps.de/impressum` | `https://milos-apps.de/impressum` |
| Datenschutz | `https://dev.milos-apps.de/datenschutz` | `https://milos-apps.de/datenschutz` |

Ein DEV-Build darf nie still auf Production verlinken. Das `DEV`-Badge und die
DEV-Linkbasis stammen aus derselben expliziten Umgebungsvariable. Production
bleibt trotz vorhandener Linkabbildung ohne gesonderte fachliche Freigabe
gesperrt.

## Footer

- Sehr kompakt, mit feiner oberer Trennlinie.
- Gleiche Inhaltsachse wie Header und Hauptfläche.
- App-spezifischer kurzer Text.
- Links `Impressum`/`Legal notice`, `Datenschutz`/`Privacy`, `MilosApps`.
- Desktop als ruhige Zeile, mobil sauber umbrechend.
- Kein künstlicher Abstand unterhalb des Footers.

## Layout und Barrierefreiheit

- Semantische Elemente `header`, `nav`, `main` und `footer`.
- Gemeinsame Inhaltsachse, standardmäßig maximal `72rem`.
- Controls mindestens 44 × 44 Pixel.
- Sichtbarer `:focus-visible`-Zustand.
- Kein horizontaler Überlauf bei 390 Pixeln und bei 200 Prozent Zoom.
- Bewegungen respektieren `prefers-reduced-motion`.
- Die App darf Farben, Typografie, Radius und Icon vollständig über die
  dokumentierten Tokens an ihre Identität anpassen.

## Integrationsfolge pro App

1. Exacten Shared-Commit beziehungsweise Release pinnen.
2. Manifest lesen und `data-app-key` sowie `data-environment` explizit setzen.
3. App-eigenes SVG und Farben einsetzen.
4. Shell-Markup in das eigene Framework übertragen; keine Shared-Runtime
   importieren.
5. Vorhandene UI vollständig in DE und EN übersetzen.
6. App-eigene Tests aus der Matrix ergänzen.
7. Nur im eigenen Repository committen und über
   `docs/PUBLISH_COORDINATION.md` veröffentlichen.

## Mindesttestmatrix

| Achse | Pflichtnachweis |
|---|---|
| Sprache | DE/EN schaltet die gesamte sichtbare UI und bleibt nach Reload erhalten |
| Umgebung | DEV und Production ergeben ausschließlich die festgelegten absoluten Links; DEV-Badge nur in DEV |
| Semantik | genau ein Haupt-H1; semantische Header-/Nav-/Main-/Footer-Struktur |
| Tastatur | alle Controls erreichbar, Reihenfolge logisch, Fokus sichtbar |
| Touch | interaktive Ziele mindestens 44 × 44 Pixel |
| Responsive | 390 Pixel und Desktop ohne horizontalen Überlauf |
| Zoom | 200 Prozent ohne abgeschnittene Navigation oder Footerlinks |
| Bewegung | Reduced Motion entfernt nichtfunktionale Übergänge |
| Unabhängigkeit | App bleibt direkt und ohne Login nutzbar; kein Portal-Cookie |
| Production | keine Veröffentlichung ohne separate fachliche Freigabe |

## Kompatibilität und Rollback

Ergänzungen innerhalb von `v1` sind nur rückwärtskompatibel zulässig.
Entfernte Felder, andere Linksemantik, neue Pflichtsprachen oder inkompatibles
Markup benötigen `v2`.

Jede App kann unabhängig auf ihre vorherige lokale Shell-Version zurückrollen.
Ein Shared-Update erzwingt weder App- noch Portal-Deployment. Rollback bedeutet:
App-Commit zurücksetzen, app-eigene Tests ausführen und ausschließlich das
eigene Ziel neu veröffentlichen.
