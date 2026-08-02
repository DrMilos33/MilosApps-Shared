# public-app-essentials/v1

Version `1.1.0` vereinheitlicht fünf wiederkehrende Interaktionen öffentlicher
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
       <p data-milos-loading-title>App-Name</p>
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

## Datenschutz ohne Scheinwahl

Aktuelle öffentliche MilosApps verwenden keine Werbe- oder Tracking-Cookies.
Deshalb erzeugt v1.1 **kein Einwilligungsbanner mit wirkungslosen
„Akzeptieren/Ablehnen“-Schaltflächen** und simuliert keine optionalen Cookies.
Das Verhalten folgt der im Manifest belegten technischen Realität:

- `no-cookies`: kein Banner und kein gemeinsamer Dismiss-/Consent-Zustand. Die
  App hält ihre wahrheitsgemäße Datenschutzinformation dauerhaft erreichbar,
  markiert den Link mit `data-milos-privacy-info` und nennt dort optionale
  lokale Einstellungen.
- `essential-only`: ein kompakter Sachhinweis zu technisch notwendigen Cookies,
  kein Einwilligungsdialog. Die einzige Aktion schließt den Hinweis; sie heißt
  weder „Akzeptieren“ noch „Verstanden“. Datenschutz bleibt zusätzlich über
  den normalen App-/Portalweg erreichbar.
- `optionalTracking` muss `false` sein. Ein späteres Analyseprodukt benötigt
  einen neuen geprüften Consent-Vertrag und ist nicht durch v1 freigegeben.

Nur `essential-only` darf den geschlossenen Informationszustand als lokalen
Komfort speichern. `no-cookies` erzeugt dafür ausdrücklich keinen Schlüssel.
Beim ersten Start von v1.1 entfernt die Runtime ausschließlich den veralteten
app-eigenen Schlüssel `milosapps.<appKey>.privacyNotice.v1`. Fremde App-Keys,
andere lokale Einstellungen und der neue Essential-Hinweiszustand bleiben
unangetastet.

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

Teilen ist eine bewusste Nutzeraktion. Erfolgreiches natives Teilen und der
Abbruch des nativen Dialogs bleiben visuell still. Nur Clipboard-Fallback oder
Fehler erscheinen kurz als viewportfeste Statusblase innerhalb von Safe Areas;
die äußeren Maße des Share-Controls und seines Elternlayouts bleiben dabei
unverändert.

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

Der Reflow richtet sich nach der tatsächlichen Komponentenbreite, nicht nur
nach dem Browserfenster. Datum, Jahressprung und Heute überlappen deshalb auch
in einer schmalen Seitenleiste nicht. Alle Ziele bleiben 44 px hoch; Selects
reservieren am Inline-Ende 2,25 rem für den nativen Pfeil und längere Werte.

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

### Optionale Vorschläge

`submit-only` bleibt der Standard. Vorschläge während der Eingabe werden nur
aktiviert, wenn das Manifest `placeSuggestions.enabled=true`, Mindestzeichen
und Debounce deklariert sowie `providerCapability` auf
`consumer-autocomplete-proxy` setzt. Zusätzlich nennt `evidenceFile` einen
app-eigenen Nachweis und die Integration registriert ausdrücklich
`setSuggestionsProvider(...)`.

Der Baustein übernimmt Debounce, Abbruch vorheriger Anfragen, Unterdrückung
veralteter Antworten und Tastaturführung. Provider, Rate-Limit, Cache,
Attribution und Zeitzone bleiben App-Eigentum. Direktes Autocomplete gegen
`nominatim.openstreetmap.org` bleibt verboten; öffentliches Nominatim darf in
derselben App aber weiterhin für eine explizit abgeschickte `setSearchProvider`-
Suche vorkommen. Deshalb prüft der Verifier die separate Suggestions-
Capability, deren Evidenzdatei und `setSuggestionsProvider(...)`, nicht ein
pauschales Hostwort-Verbot über sämtlichen App-Code.

## Migration von 1.0.0 auf 1.1.0

1. `essentialsContract.version` auf `1.1.0` und `sharedCommit` auf den
   unveränderlichen v1.1-Releasecommit setzen; danach alle fünf Artefakte neu
   synchronisieren und locken.
2. `features.placeSuggestions` ergänzen. Der sichere Standard ist:
   `enabled=false`, `minChars=3`, `debounceMs=350`,
   `providerCapability="submit-only"`, `evidenceFile=null`.
3. Bei `privacy.mode="no-cookies"` `features.privacyNotice=false` setzen und
   einen dauerhaft erreichbaren Link mit `data-milos-privacy-info` sowie der
   exakten `privacyUrl` ausgeben. Es entsteht kein Banner und kein Dismiss-Key.
4. Bei `privacy.mode="essential-only"` `features.privacyNotice=true` behalten;
   Texte dürfen den Sachhinweis nicht als Einwilligung darstellen.
5. Falls Vorschläge fachlich nötig sind: app-eigenen Autocomplete-Proxy
   nachweisen, Evidenzdatei eintragen, `consumer-autocomplete-proxy` deklarieren
   und separat `setSuggestionsProvider(...)` registrieren. Der normale
   `setSearchProvider(...)` bleibt die explizite Submit-Suche.
6. Share-Fallback/Fehler, Datum in schmaler Komponente, Select-Pfeilbereich,
   Escape/Abort/Stale-Result und Disconnect-Cleanup in der Verbraucher-
   Browsermatrix prüfen.

Die Runtime entfernt bei der Migration nur
`milosapps.<eigener-appKey>.privacyNotice.v1`. Dieser v1.0-Komfortwert war weder
Consent noch fachlicher Nutzerdatensatz und wird nicht in den neuen
Essential-Hinweiszustand übernommen.

## Pflicht-QA pro Verbraucher

- frischer Start und langsamer Start: Icon höchstens 56 px Desktop / 48 px
  mobil, kein ungestylter Shell-Icon-Flash;
- Datenschutzmodus in DE/EN: `no-cookies` ohne Banner/State mit dauerhaftem
  Link; `essential-only` als Sachhinweis ohne Consent-Sprache;
- Teilen nativ sowie Clipboard-Fallback und abgebrochener Dialog; keine
  Layoutverschiebung und keine Erfolgsmeldung nach nativem Teilen;
- Datum: native Eingabe, Jahressprung, Heute, Min/Max, DE/EN,
  komponentenbreitenabhängiger Reflow und freier Select-Pfeilbereich;
- Ort: Stadt **und Region**, gleiches sichtbares Format, Enter/Schaltfläche,
  leere Treffer, Abbruch, Offline-/Netzfehler und optionaler Gerätestandort;
- optionale Vorschläge: Mindestzeichen, Debounce, Abort, veraltete Antworten,
  Tastatur sowie app-eigener Proxy-/Provider-Nachweis;
- 1440 × 900, 390 × 844 und 360 × 800 bei 200 Prozent ohne horizontalen
  Überlauf, mit 44-px-Zielen und sichtbarem Fokus;
- echte Response-CSP `script-src 'self'; style-src 'self'`, externe Runtime-
  Dateien, korrekte MIME-Typen und SHA-256-Lock;
- DEV-Health, No-Login und `productionApproved=false`.

Kalender und kontopflichtige Apps sind ausgeschlossen. Production benötigt
weiterhin eine ausdrückliche Nutzerfreigabe.
