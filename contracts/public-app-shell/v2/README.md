# Public App Shell v2

- Version: `2.0.2`
- Contract-ID: `public-app-shell/v2`
- Status: bereit zur gepinnten Übernahme
- Kalender und kontopflichtige Apps: ausdrücklich ausgeschlossen

## Zweck

`public-app-shell/v2` stellt Header, Footer, Sprachsteuerung und
Umgebungslinks als dependency-freies ES-Modul/Web-Component bereit. Jede App
pflegt nur ein maschinenlesbares `milos-app.json`, ein eigenes Inline-SVG im
Icon-Slot und ihre Fachoberfläche. Das Sync-Werkzeug kopiert eine feste
Release-Version in das App-Repository und erzeugt einen Lock mit Prüfsummen.

Die Shell ist keine gemeinsame Laufzeit. Es gibt kein CDN und keinen Import
aus einem anderen lokalen Repository. Nach dem Sync besitzt jede App ihre
eigene unveränderliche Kopie und kann unabhängig testen, veröffentlichen und
zurückrollen.

Verbraucher:

- `noodle-calculator`
- `sky`
- `cloud-post`
- `somewhere-now`
- `gravity-loop`
- `waste-guide`
- `daylight`

## Dateien

- `contract.json`: normativer Vertrag und Verbrauchergrenze.
- `schema.json`: Schema des Vertragsmanifests.
- `app-manifest.schema.json`: verpflichtendes App-/Shell-/Portalmanifest.
- `app-manifest.example.json`: vollständig ausgefülltes DEV-Beispiel.
- `dist/milos-app-shell.js`: dependency-freie Web-Component inklusive Markup,
  CSS, Flaggen, Pfeil, Persistenz und Linkbildung.
- `dist/verify.mjs`: portabler App-Validator, der beim Sync mitkopiert wird.
- `tools/sync.mjs`: vendort die feste Distribution und schreibt
  `shell-lock.json` mit SHA-256-Prüfsummen.
- `tools/validate.mjs`: Contract-, Distributions-, Fixture- und Negativtests.
- `fixtures/reference-app`: sichtbare vollständige Referenzintegration.

## App-Integration

Eine App besitzt genau eine Quelle für ihre Metadaten: `milos-app.json`.
Mindestens enthalten sind App-Key, Eigentümer, öffentlicher/no-login-Status,
Beschreibung in DE/EN, Umgebung, lokaler Vendorpfad, Einstiegspunkt,
DEV-/Health-/Portalroute und `productionApproved`.

Der App-Task führt aus einem exakt ausgecheckten Shared-Release aus:

```powershell
node contracts/public-app-shell/v2/tools/sync.mjs `
  --app-root C:\Pfad\Zur\App `
  --manifest milos-app.json `
  --source-commit EXAKTER_SHARED_COMMIT
```

Das Werkzeug kopiert die Distribution in den im Manifest festgelegten
Vendorordner, erzeugt eine app-spezifische Bootstrapdatei und schreibt den
Lock. Anschließend prüft die App lokal:

```powershell
node Pfad\zum\Vendorordner\verify.mjs `
  --app-root C:\Pfad\Zur\App `
  --manifest milos-app.json
```

Das Einstiegsmuster ist frameworkneutral:

```html
<script type="module" src="./vendor/milosapps-shell/v2/bootstrap.js"></script>

<milos-app-shell>
  <svg slot="app-icon" viewBox="0 0 40 40" aria-hidden="true">…</svg>
  <main id="main" slot="main">…</main>
</milos-app-shell>
```

Das Inline-SVG bleibt App-Eigentum. Die Shell besitzt Position, 38-Pixel-
Fassung und Zentrierung. Externe Icon-URLs sind nicht zulässig.

## Sprache

Die Shell übersetzt ausschließlich ihre eigenen Texte und den
app-spezifischen Footertext aus dem Manifest. Sie speichert die Auswahl unter
`milosapps.<app-key>.language`, setzt `document.documentElement.lang` und
sendet bei Initialisierung und Änderung:

```js
window.addEventListener("milosapps:localechange", (event) => {
  updateEntireApp(event.detail.locale);
});

updateEntireApp(document.documentElement.lang);
```

Die vollständige sichtbare App-UI bleibt Eigentümerpflicht. Dazu gehören
Titel, H1, Status, Fehler, Dialoge, Validierung und zugängliche Namen.

## Header und Footer

- Normaler Dokumentfluss, kein Baseline-`sticky`.
- Einheitliche Inhaltsachse bis `72rem`.
- App-eigenes Inline-SVG in 38-Pixel-Fassung, danach `MilosApps` und nur in
  DEV ein dezentes `DEV`.
- Die 38-Pixel-Iconfassung vergrößert sich bei Textzoom nicht künstlich; auf
  schmalen Viewports darf die Markenreihe kontrolliert umbrechen.
- Sprachbuttons mit eigenen inline SVG-Flaggen Deutschland/UK und sichtbaren
  Labels `DE`/`EN`; Flaggen stehen nie allein.
- `Alle Apps`/`All apps` mit standardisiertem Outline-Pfeil.
- Kompakter Footer mit Beschreibung und exakt Impressum/Legal notice,
  Datenschutz/Privacy und MilosApps.
- Mindestens 44 Pixel Touchziel, sichtbarer Fokus, Reduced Motion, mobiler
  Wrap und kein Raum unterhalb des Footers.
- Hostlayout: `min-height: 100dvh; grid-template-rows: auto 1fr auto`.
- Keine feste Mindestbreite auf der Shell-Seite; der Rahmen muss auch bei
  200 Prozent Zoom auf schmalen Viewports auf die verfügbare Breite reflowen.

## Umgebungen

| Link | DEV | Production |
|---|---|---|
| MilosApps | `https://dev.milos-apps.de/` | `https://milos-apps.de/` |
| Alle Apps | `https://dev.milos-apps.de/apps` | `https://milos-apps.de/apps` |
| Impressum | `https://dev.milos-apps.de/impressum` | `https://milos-apps.de/impressum` |
| Datenschutz | `https://dev.milos-apps.de/datenschutz` | `https://milos-apps.de/datenschutz` |

`environment=production` ist nur mit `productionApproved=true` gültig. Ein
Shared-Release oder eine erfolgreiche DEV-Migration erteilt diese Freigabe
nicht.

Bereits veröffentlichte Verbraucher tragen in `dev.url` und `dev.healthUrl`
zwei echte HTTPS-Adressen ein. Noch nicht veröffentlichte oder extern
blockierte Verbraucher setzen beide Felder gemeinsam auf `null`; eine einzelne
URL oder ein erfundener Platzhalter ist unzulässig. Die Portalroute bleibt bis
zum verifizierten DEV-Handoff inaktiv.

## Pflichtprüfungen

- Manifest, Lock und Artefakt-SHA-256 stimmen überein.
- Einstiegspunkt bindet ausschließlich den lokalen Bootstrap ein.
- Genau ein `<milos-app-shell>`, ein Inline-SVG mit `slot="app-icon"` und ein
  semantisches `<main slot="main">` sind vorhanden.
- DE/EN, Reload-Persistenz und vollständige App-Übersetzung.
- Absolute umgebungsrichtige Links und DEV-Badge nur in DEV.
- Tastatur, sichtbarer Fokus, 44-Pixel-Ziele und Reduced Motion.
- 1440 × 900, 390 × 844 und 200 Prozent Zoom ohne Überlauf.
- Direkter No-Login-Aufruf ohne Portal-Cookie.
- App-eigener Healthcheck, Source-/Artefakt-SHA und Rollback.

Die Referenz-App kann den reproduzierbaren Textzoomfall ohne Browser-
Sonderkonfiguration unter `?textZoom=200` darstellen. Die 360-mal-800-Prüfung
misst dabei insbesondere Body, Header, Markenreihe, Navigation und Footer.

## Kompatibilität und Rollback

Apps pinnen `2.x` nicht als bewegliches Ziel, sondern immer eine konkrete
Version, einen Shared-Commit und die Artefaktprüfsummen. Rückwärtskompatible
Ergänzungen erhalten eine Minor-Version. Geänderte Pflichtfelder, Events,
Slots, Linksemantik oder Distributionsform benötigen `v3`.

Rollback erfolgt ausschließlich im App-Repository: vorherigen App-Commit und
vorherigen Vendor-/Lockstand wiederherstellen, App-Tests ausführen und nur das
eigene Ziel neu veröffentlichen. Shared, Portal und andere Apps müssen dafür
nicht zurückgerollt werden.
