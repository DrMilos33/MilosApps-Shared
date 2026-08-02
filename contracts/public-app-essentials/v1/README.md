# public-app-essentials/v1

Version `1.0.0` vereinheitlicht fünf wiederkehrende Interaktionen öffentlicher
MilosApps: einen begrenzten Startzustand, einen wahrheitsgemäßen
Datenschutzhinweis, Teilen, Datumsauswahl und Ort-/Regionssuche. Der Vertrag ist
frameworkneutral und dependency-frei. Er ersetzt weder
`public-app-shell/v2` noch `public-app-layout/v1`.

## Liefermodell

Jede App übernimmt eine feste Shared-Revision mit `tools/sync.mjs` in ihr
eigenes Repository. Es gibt kein CDN und keinen Laufzeitimport aus dem
Shared-Repository. Fünf Dateien werden gemeinsam gelockt:

- `milos-app-essentials.css`
- `milos-app-essentials-theme.css`
- `milos-app-essentials.js`
- `bootstrap.js`
- `verify.mjs`

Die vier Browserartefakte müssen nach dem Verbraucher-Build weiterhin als
Same-Origin-Dateien vorliegen. JavaScript wird als
`text/javascript; charset=utf-8`, CSS als `text/css; charset=utf-8`
ausgeliefert. `data:`-Re-Inlining ist unter `style-src 'self'` unzulässig.

## Integration

1. `essentials-manifest.example.json` als `milos-essentials.json` in das
   App-Repository übernehmen und App-Key, Texte, Module, Theme sowie den
   vollständigen Shared-Commit eintragen.
2. Synchronisieren:

   ```text
   node <shared>/contracts/public-app-essentials/v1/tools/sync.mjs \
     --app-root <app-root> \
     --manifest milos-essentials.json \
     --source-commit <full-shared-sha>
   ```

3. Beide CSS-Dateien vor allen Modulskripten laden. So ist die Icon-Grenze
   bereits wirksam, bevor Web Components und App-Code registriert sind.
4. Den Loader unmittelbar im `body` ausgeben. Das Icon ist app-eigen, erhält
   explizite `width`/`height` und bleibt höchstens 56 px groß:

   ```html
   <section data-milos-app-loading role="status" aria-live="polite">
     <div data-milos-loading-card>
       <img data-milos-loading-icon src="icon.svg" width="52" height="52" alt="">
       <span data-milos-loading-brand>MilosApps</span>
       <h1 data-milos-loading-title>App-Name</h1>
       <p data-milos-loading-message>App wird geöffnet …</p>
       <span data-milos-loading-progress aria-hidden="true"></span>
     </div>
   </section>
   ```

5. `bootstrap.js` als lokales Modul laden. Wenn die App wirklich bedienbar ist,
   signalisiert sie das ausdrücklich:

   ```js
   document.dispatchEvent(new CustomEvent("milosapps:ready"));
   ```

   Bis dahin bleibt der Startzustand sichtbar. Ein Timer darf eine fachlich
   noch nicht bereite App nicht vortäuschen.
6. Vor Commit den vendorten Prüfer ausführen:

   ```text
   node vendor/milosapps-essentials/v1/verify.mjs \
     --app-root . --manifest milos-essentials.json
   ```

## Datenschutz statt Scheinwahl

Aktuelle öffentliche MilosApps verwenden keine Werbe- oder Tracking-Cookies.
Deshalb erzeugt v1 **kein Einwilligungsbanner mit wirkungslosen
„Akzeptieren/Ablehnen“-Schaltflächen**. Stattdessen erscheint einmalig ein
kompakter, schließbarer Datenschutzhinweis mit Link zur Datenschutzerklärung.

- `no-cookies`: keine Cookies; optionale lokale Einstellungen können
  wahrheitsgemäß genannt werden.
- `essential-only`: nur technisch erforderliche Speicherung; kein Tracking.
- `optionalTracking` muss `false` sein. Ein späteres Analyseprodukt benötigt
  einen neuen geprüften Consent-Vertrag und ist nicht durch v1 freigegeben.

Die Speicherung des geschlossenen Hinweiszustands ist lokaler Komfort und darf
keine Identität oder geräteübergreifende Profilbildung erzeugen.

## Teilen

`<milos-share-button>` bietet überall dieselbe 44-px-Bedienung. In einem
sicheren Kontext wird `navigator.share()` verwendet, sofern verfügbar. Sonst
wird Text plus URL in die Zwischenablage kopiert. Jede App liefert nur den
fachlich richtigen Payload:

```js
document.querySelector("milos-share-button").setPayloadProvider(() => ({
  title: document.title,
  text: "Meine Zusammenfassung",
  url: location.href
}));
```

Teilen ist eine bewusste Nutzeraktion. Abbruch des nativen Share-Dialogs ist
kein Fehlerzustand.

## Datum

`<milos-date-picker>` kapselt den nativen `<input type="date">`, ergänzt einen
direkten Jahressprung und „Heute“. Damit bleiben Plattformtastatur,
Kalenderbedienung und Assistive-Technology-Unterstützung erhalten, während
Darstellung und Ereignis vereinheitlicht werden.

```html
<milos-date-picker min="1900-01-01" max="2100-12-31"
  label-de="Datum" label-en="Date"></milos-date-picker>
```

Der ISO-Wert `YYYY-MM-DD` wird als `milosapps:datechange` und normales
`change`-Ereignis ausgegeben. Die App bleibt Eigentümerin von Fachgrenzen wie
Zeitzone, historischer Gültigkeit und erlaubtem Zeitraum.

## Ort und Region

`<milos-place-search>` vereinheitlicht Beschriftung, sichtbare Region und Land,
Tastaturführung, Statusmeldungen und das Ergebnisformat. Die eigentliche
Geocoding-Verbindung bleibt app-eigen und austauschbar. Ein Ergebnis enthält:

```js
{
  id, name, region, country, countryCode,
  latitude, longitude, type, timeZone?
}
```

Eine Suche wird nur mit Enter oder der Suchen-Schaltfläche **explizit
abgeschickt**. Der Baustein sendet keine Anfrage bei jedem Tastendruck. Das ist
besonders wichtig für die öffentliche Nominatim-Instanz: deren Richtlinie
verbietet clientseitiges Autocomplete, begrenzt Nutzung und verlangt
Attribution sowie eine austauschbare Verbindung. Apps müssen außerdem ihre
fachlichen Suchgrenzen beibehalten; ein Wetterort und ein astronomischer Ort
dürfen dasselbe UI/Ergebnisformat nutzen, ohne ihre Berechnung gleichzusetzen.

## Pflicht-QA pro Verbraucher

- frischer Start und langsamer Start: Icon höchstens 56 px Desktop / 48 px
  mobil, kein ungestylter Shell-Icon-Flash;
- Datenschutzhinweis in DE/EN, Tastatur, Link, erneuter Start nach Schließen;
- Teilen nativ sowie Clipboard-Fallback und abgebrochener Dialog;
- Datum: native Eingabe, Jahressprung, Heute, Min/Max und DE/EN;
- Ort: Stadt **und Region**, gleiches sichtbares Format, Enter/Schaltfläche,
  leere Treffer, Abbruch, Offline-/Netzfehler und optionaler Gerätestandort;
- 1440 × 900, 390 × 844 und 360 × 800 bei 200 Prozent ohne horizontalen
  Überlauf, mit 44-px-Zielen und sichtbarem Fokus;
- echte Response-CSP `script-src 'self'; style-src 'self'`, externe Runtime-
  Dateien, korrekte MIME-Typen und SHA-256-Lock;
- DEV-Health, No-Login und `productionApproved=false`.

Kalender und kontopflichtige Apps sind ausgeschlossen. Production benötigt
weiterhin eine ausdrückliche Nutzerfreigabe.
