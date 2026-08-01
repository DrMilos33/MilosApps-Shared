# `public-app-layout/v1`

Version `1.0.0` ist der kompakte Inhaltslayout-Vertrag für öffentliche
MilosApps ohne Konto. Er ergänzt `public-app-shell/v2`; er ersetzt den
Header-/Footer-Vertrag nicht.

## Warum ein eigener Vertrag?

`public-app-shell/v2` besitzt Header, Footer, DE/EN-Auswahl und Portal-Links.
Die App besitzt weiterhin Fachfunktion, Texte, Illustration, Farben und
Interaktion. Dieser Vertrag standardisiert nur die wiederkehrende Mitte:

- ruhige Inhaltsachse und Dichte-Tokens;
- kurze Introzone statt großer, rein dekorativer Hero-Fläche;
- frühe Sichtbarkeit der eigentlichen Aufgabe;
- eine visuelle Oberflächenebene statt Karten in Karten;
- kompakte Flow-, Ergebnis-, Disclosure-, Dialog- und Command-Dock-Primitiven;
- messbare Desktop-, Mobil- und 200-Prozent-Reflow-Grenzen.

Die Referenzrichtung ist aus den bestätigten DEV-Ständen von `sky`,
`gravity-loop` und `noodle-calculator` abgeleitet. Sie kopiert weder deren
Farben noch produktspezifische Komponenten.

## Konsummodell

Jede App legt ein `milos-layout.json` nach
[`layout-manifest.schema.json`](layout-manifest.schema.json) an und trägt nur
ihre Daten ein:

- App-Key und Layoutprofil;
- fester Vertrag, Version und Shared-Commit;
- lokale Markup-/Stylesheet-Dateien für den Validator;
- neun app-eigene Farbtokens;
- `productionApproved=false` während des Pilot- und DEV-Lebenszyklus.

Der Sync kopiert die unveränderliche Basis-CSS lokal in das App-Repository,
erzeugt die app-eigene Theme-CSS und schreibt einen SHA-256-Lock. Es gibt kein
CDN, keinen Import aus einem fremden Arbeitsverzeichnis und keine gemeinsame
Runtime.

```powershell
node contracts/public-app-layout/v1/tools/sync.mjs `
  --app-root C:\Pfad\zur\App `
  --manifest milos-layout.json `
  --source-commit <vollständiger-shared-sha>
```

Danach führt die App den vendorten Prüfer aus:

```powershell
node vendor/milosapps-layout/v1/verify-layout.mjs `
  --app-root . `
  --manifest milos-layout.json
```

Die App bindet lokal beide CSS-Dateien ein:

```html
<link rel="stylesheet" href="./vendor/milosapps-layout/v1/milos-app-layout.css">
<link rel="stylesheet" href="./vendor/milosapps-layout/v1/milos-app-layout-theme.css">
```

Bundler müssen beide Dateien als Same-Origin-CSS erhalten; ein Verbraucher
prüft dies am gebauten und externen Artefakt. Ein Runtime-Import aus Shared ist
verboten.

## Minimaler Aufbau

```html
<main
  id="main"
  slot="main"
  data-milos-layout="compact"
  data-milos-profile="focused-task"
  data-milos-app-key="example-app"
>
  <section data-milos-intro>
    <div data-milos-intro-copy>
      <p data-milos-eyebrow>Eine klare Einordnung</p>
      <h1>Die kurze, konkrete Aufgabe</h1>
      <p data-milos-lead>Ein Satz erklärt Nutzen und Grenze.</p>
    </div>
  </section>

  <section data-milos-primary-work data-milos-panel>
    <!-- App-eigene Fachoberfläche -->
  </section>

  <details data-milos-secondary>
    <summary>Quellen und Einstellungen</summary>
    <!-- Sekundäre Informationen -->
  </details>
</main>
```

## Profile

- `focused-task`: Rechner, Suche oder einzelner Helfer. Die Hauptaufgabe folgt
  direkt auf das Intro.
- `guided-flow`: zwei bis wenige nachvollziehbare Arbeitsschritte. Schritte
  werden flach nebeneinander beziehungsweise mobil untereinander angeordnet.
- `immersive`: Canvas, Karte oder Planetarium. Das Intro bleibt besonders kurz,
  die interaktive Fläche beginnt früh.

Profile sind keine Themes und erzeugen keine Produktlogik.

## Primitive

| Marker | Zweck |
|---|---|
| `data-milos-intro` | kurze Einordnung mit genau einem H1 |
| `data-milos-primary-work` | erste echte Fachaktion oder immersive Fläche |
| `data-milos-flow` | flache, responsive Schrittfolge |
| `data-milos-panel` | genau eine visuelle Oberflächenebene |
| `data-milos-step` | nummerierter oder benannter Schritt |
| `data-milos-actions` | kompakt umbrechende Aktionen |
| `data-milos-result` | Ergebnisfläche, nicht zusätzliche Kartenhierarchie |
| `data-milos-secondary` | progressive Offenlegung für Quellen/Meta/Optionen |
| `data-milos-command-dock` | kompakte mobile oder immersive Bediengruppe |
| `data-milos-dialog-layout` | Dialog mit fixem Kopf, Scrollmitte und Aktionen |

Ein `data-milos-panel` innerhalb eines Panels erhält bewusst keine zweite
Kartenoptik. Eine zusätzliche visuelle Ebene braucht app-eigene Begründung und
Regressionsevidenz.

## Verbindliches Dichtebudget

Die App markiert Intro und Primärarbeit. Ihre Browser-QA prüft:

| Viewport | Intro maximal | Oberkante Primärarbeit maximal |
|---|---:|---:|
| 1440 × 900 | 320 px | 520 px |
| 390 × 844 | 280 px | 500 px |

Zusätzlich verbindlich:

- 360 × 800 bei 200 Prozent Textskalierung ohne horizontalen Überlauf;
- sichtbare Interaktionsziele mindestens 44 × 44 CSS-Pixel;
- genau ein H1, vollständiges DE/EN und Reload-Persistenz;
- kein großer dekorativer Block vor der Primärarbeit;
- Root-Overflow **und** Clipping sichtbarer Elemente prüfen;
- Dialoginhalt und Aktionsleiste intern auf Reflow prüfen;
- `prefers-reduced-motion`, Tastatur, Fokus und No-Login beibehalten.

Bei immersiven Apps darf die Primärarbeit eine Canvas-/Kartenfläche sein. Das
Dichtebudget darf nicht durch versteckte Inhalte oder `overflow:hidden`
scheinbar erfüllt werden.

## Pilot und Rollout

Der erste Verbraucher ist ausschließlich `cloud-post`. Nach dessen eigenem
DEV-Publish prüft der Nutzer die Designrichtung. Erst nach diesem Review darf
der Struktur-Task die Kampagne für weitere Apps öffnen. Es gibt keine
automatische Migration und keine Production-Freigabe.

Rollback erfolgt appweise auf den letzten gesunden DEV-Commit. Die bereits
veröffentlichte `public-app-shell/v2`-Integration bleibt dabei unabhängig.
