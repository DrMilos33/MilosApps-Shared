# public-app-essentials/v1

Version `1.2.0` vereinheitlicht fünf wiederkehrende Interaktionen öffentlicher
MilosApps: einen begrenzten Startzustand, einen wahrheitsgemäßen
Datenschutzhinweis, Teilen, Datumsauswahl und Ort-/Regionssuche. Der Vertrag ist
frameworkneutral und dependency-frei. Er ersetzt weder
`public-app-shell/v2` noch `public-app-layout/v1`.

## Liefermodell

Jede App übernimmt eine feste Shared-Revision mit dem `tools/sync.mjs` genau
dieser Revision in ihr eigenes Repository. Es gibt kein CDN und keinen
Laufzeitimport aus dem Shared-Repository. Der unveränderliche Release hasht
exakt fünf Quellartefakte: Basis-CSS, Runtime-JS, portabler Verifier,
Manifest-Schema und Sync-Generator. Der Sync erzeugt daraus pro App einen
exakten Lock über sechs Verbraucherartefakte:

- `milos-app-essentials.css`
- `milos-app-essentials-theme.css`
- `milos-app-essentials.js`
- `bootstrap.js`
- `verify.mjs`
- `essentials-manifest.schema.json`

Theme-CSS und Bootstrap sind deterministische, manifestabhängige Ausgaben;
die übrigen vier Verbraucherdateien stammen aus dem Release. Der Sync arbeitet
nur, wenn alle fünf Release-Quellen bytegleich im angegebenen Commit liegen
und dessen `release.json`-Prüfsummen erfüllen. Ein veränderter Arbeitsbaum kann
deshalb keinen Lock unter fremdem Release-SHA erzeugen. Manifest-Schema und
portabler Verifier lehnen fehlende Pflichtfelder, zusätzliche Felder,
`startup=false`, Pfadfluchten, Junctions/Symlinks und hard-verlinkte Ziele
fail-closed ab. Die Manifestkonfiguration wird als kanonisches JSON semantisch
gehasht; reine Einrückung oder Objektschlüssel-Reihenfolge verändert den Lock
nicht.

Die vier Browserartefakte müssen nach dem Verbraucher-Build weiterhin als
Same-Origin-Dateien vorliegen. JavaScript wird als
`text/javascript; charset=utf-8`, CSS als `text/css; charset=utf-8`
ausgeliefert. `data:`-Re-Inlining ist unter `style-src 'self'` unzulässig.
Verifier und Schema sind Quell-/Lockartefakte, keine öffentliche Runtime;
fail-closed Portale dürfen direkte HTTP-Routen zu ihnen weiterhin mit 404
ablehnen.

## Integration

1. `essentials-manifest.example.json` als `milos-essentials.json` in das
   App-Repository übernehmen und App-Key, Texte, Module, Theme sowie den
   vollständigen Shared-Commit eintragen. `$schema` zeigt relativ auf das
   vendorte `essentials-manifest.schema.json`. `vendorDirectory` ist das
   Dateisystemziel im App-Repository; `runtimeBasePath` ist der öffentlich
   ausgelieferte Same-Origin-URL-Pfad. Beide dürfen bei geroutetem Hosting
   bewusst verschieden sein, etwa bei ASP.NET-Assetrouten.
   `consumerEntryModule.sourceFile` benennt zusätzlich genau eine geprüfte
   JavaScript-/TypeScript-Datei aus `integrationFiles`;
   `consumerEntryModule.runtimePath` ist deren exakte Modul-URL im deklarierten
   Quell-`entryHtml`. Ein Bundler darf daraus im Build eine gehashte Datei
   erzeugen; diese instabile Ausgabe gehört nicht ins Manifest, sondern wird
   im app-eigenen Post-Build-/HTTP-Gate gegen das erzeugte HTML geprüft.
2. Synchronisieren:

   ```text
   node <shared-at-exact-tag>/contracts/public-app-essentials/v1/tools/sync.mjs \
     --app-root <app-root> \
     --manifest milos-essentials.json \
     --source-commit <full-shared-sha>
   ```

   Der ausgeführte Sync-Generator und `--source-commit` müssen aus demselben
   unveränderlichen Commit/Tag stammen.
3. Beide CSS-Dateien über `runtimeBasePath` vor allen Modulskripten laden. So
   ist die Icon-Grenze bereits wirksam, bevor Web Components und App-Code
   registriert sind. `bootstrap.js` wird ebenfalls über diesen URL-Pfad als
   **erstes** Modul geladen; erst danach folgen App-Module. Modulskripte dürfen
   hier kein `async` tragen, damit Runtime, Custom Elements und der globale
   Ready-Endpunkt deterministisch vor App-Aufrufen registriert sind. Bootstrap
   und Verbraucherentry verwenden echte Script-Endtags. `integrity`, ein
   umschreibendes `<base>` sowie inaktive oder alternative Critical-CSS-Links
   sind für diese lokalen, bytegelockten Dateien unzulässig.
4. Den Loader unmittelbar im `body` ausgeben. Das Icon ist app-eigen, erhält
   explizite `width`/`height`, muss als lokale SVG-Datei vorhanden sein und
   ist im HTML-Fallback und nach dem CSS-Laden exakt 32 mal 32 px groß.
   `loading.iconPath` benennt die physische Datei
   relativ zum App-Repository. Falls die ausgelieferte URL davon abweicht,
   benennt `loading.iconRuntimePath` exakt die Same-Origin-URL im `src`; fehlt
   das optionale Feld, verwendet der Verifier rückwärtskompatibel `iconPath`
   auch als Runtimepfad. Der statische Verifier kann eine spätere Webroute
   nicht selbst abrufen; die Verbraucher-QA belegt deshalb zusätzlich HTTP
   200, `image/svg+xml` und denselben SHA-256 wie die Datei aus `iconPath`:

   ```html
   <section data-milos-app-loading role="status" aria-live="polite">
     <div data-milos-loading-card>
       <img data-milos-loading-icon src="icon.svg" width="32" height="32" alt="">
       <span data-milos-loading-brand>MilosApps</span>
       <p data-milos-loading-title>App-Name</p>
       <p data-milos-loading-message>App wird geöffnet …</p>
       <span data-milos-loading-progress aria-hidden="true"></span>
     </div>
   </section>
   ```

   Verwendet das Entry außerdem `milos-app-shell`, enthält es genau ein
   app-eigenes `<svg slot="app-icon">` mit intrinsischem
   `width="38" height="38"`. Das kritische Essentials-CSS begrenzt dieses SVG
   schon bei noch undefiniertem Shell-Element ebenfalls auf 38 mal 38 Pixel und
   hält es bis zum Upgrade verborgen; der unveränderte Shell-v2.0.3-Vertrag
   übernimmt danach dieselbe Größe. Die Verbraucher-QA blockiert
   Shell-Bootstrap und Komponenten-CSS getrennt und misst den Zustand mit
   geladener Essentials-CSS vor dem Upgrade, den Übergang nach dem Upgrade und
   den Endzustand. Ein app-eigener CSS-Override ist dafür nicht vorgesehen.

5. `bootstrap.js` als lokales Modul laden. Wenn die App wirklich bedienbar ist,
   signalisiert sie das ausdrücklich:

   ```js
   globalThis.milosAppEssentials.ready();
   ```

   In TypeScript/TSX kann die App den generierten Global einmal eng typisieren
   und danach denselben verifizierbaren Aufruf verwenden:

   ```ts
   declare global {
     var milosAppEssentials: { ready(): void };
   }
   globalThis.milosAppEssentials.ready();
   export {};
   ```

   Bis dahin bleibt der Startzustand sichtbar. Ein Timer darf eine fachlich
   noch nicht bereite App nicht vortäuschen. Die API verhindert zusätzlich,
   dass ein frühes Event vor der Registrierung des Empfängers verloren geht;
   Apps dispatchen das interne `milosapps:ready`-Ereignis nicht selbst.
6. Vor Commit den vendorten Prüfer ausführen:

   ```text
   node vendor/milosapps-essentials/v1/verify.mjs \
     --app-root . --manifest milos-essentials.json
   ```

Der portable Verifier belegt reale Quellmarker, Providerverdrahtung, Lock und
Auslieferungspfade. Die Verbraucher-Browser-QA bleibt zusätzlich verpflichtend:
Sie weist nach, dass die Komponenten tatsächlich gerendert sind, der Loader
erst bei Fachbereitschaft verschwindet und der persistente Datenschutzlink auf
die exakte `privacyUrl` führt.

## Datenschutz ohne Scheinwahl

Aktuelle öffentliche MilosApps verwenden keine Werbe- oder Tracking-Cookies.
Deshalb erzeugt v1.1 **kein Einwilligungsbanner mit wirkungslosen
„Akzeptieren/Ablehnen“-Schaltflächen** und simuliert keine optionalen Cookies.
Das Verhalten folgt der im Manifest belegten technischen Realität:

- `no-cookies`: kein Banner und kein gemeinsamer Dismiss-/Consent-Zustand. Das
  gilt nur, wenn die App gar nicht auf das Endgerät speichert oder jeden Zugriff
  im Manifest zweckweise als technisch unbedingt erforderlich nachweist. Die
  App hält ihre wahrheitsgemäße Datenschutzinformation dauerhaft erreichbar
  und markiert den Link mit `data-milos-privacy-info`.
  Wenn die App bereits `public-app-shell/v2.0.3` verwendet, darf stattdessen
  dessen sichtbarer Footerlink der einzige dauerhafte Datenschutzweg sein. Dazu
  referenziert das Essentials-Manifest das separat verifizierte Shell-Manifest:

  ```json
  "privacy": {
    "mode": "no-cookies",
    "privacyUrl": "https://dev.milos-apps.de/datenschutz",
    "permanentLink": {
      "provider": "public-app-shell/v2",
      "manifest": "milos-app.json"
    }
  }
  ```

  Der Verifier bindet App-Key, Umgebung, Productiongrenze und Entry beider
  Manifeste, verlangt genau ein `<milos-app-shell>` und die kanonische
  Datenschutz-URL der Umgebung. Ein zusätzlicher `data-milos-privacy-info`-Link
  ist in diesem Modus unzulässig. Der App-Browsernachweis prüft außerdem den
  sichtbaren Shadow-DOM-Link `.footer-nav a[data-text="privacy"]`; der normale
  Shell-v2-Verifier bleibt verpflichtend. Beliebige CSS-Selektoren, versteckte
  Marker oder nicht verifizierte Footer werden nicht als Nachweis akzeptiert.
- `essential-only`: ein kompakter Sachhinweis zu technisch notwendigen Cookies,
  kein Einwilligungsdialog. Die einzige Aktion schließt den Hinweis; sie heißt
  weder „Akzeptieren“ noch „Verstanden“. Datenschutz bleibt zusätzlich über
  den normalen App-/Portalweg erreichbar.
- `optionalTracking` muss `false` sein. Ein späteres Analyseprodukt benötigt
  einen neuen geprüften Consent-Vertrag und ist nicht durch v1 freigegeben.

Bei `usesLocalStorage=true` ist `privacy.storagePurposes` nicht leer. Jeder
Eintrag nennt den app-namensräumigen Schlüssel, Zweck, Lebensdauer und
`strictlyNecessary=true`. Optionale Speicherung ist standardmäßig aus. Sie
benötigt einen künftigen, getrennten Consent-Vertrag; v1.1 enthält keinen
solchen Vertrag. Bei `usesLocalStorage=false` muss `storagePurposes` leer sein.
Diese technische Produktgrenze ist keine Rechtsberatung.

`usesLocalStorage` bezeichnet in diesem Manifest ausschließlich Web Storage
(`localStorage`/`sessionStorage`). Service Worker, Cache Storage, IndexedDB,
Geräteberechtigungen und Downloads werden nicht daraus erraten: Jede App führt
dafür ihr getrenntes Geräte-/Speicherinventar und legt tatsächliche Nutzung
wahrheitsgemäß sichtbar offen.

Auch `essential-only` speichert das Schließen nicht: Der kompakte Sachhinweis
wird für das gesamte aktuelle Dokument entfernt und auch durch ein wiederholtes
Readiness-Signal nicht erneut geöffnet; beim nächsten Seitenaufruf darf er
wieder erscheinen. Damit erzeugt der Shared-Baustein keinen optionalen
Komfortschlüssel. Nur bei deklariertem `usesLocalStorage=true` entfernt die
Runtime ab v1.1.1 beim ersten Start die beiden veralteten app-eigenen Schlüssel
`milosapps.<appKey>.privacyNotice.v1` und
`milosapps.<appKey>.essentialCookieInfo.v1`. Bei `usesLocalStorage=false` greift
die Runtime nicht auf Web Storage zu. Fremde App-Keys, andere lokale
Einstellungen und alle fachlichen App-Daten bleiben unangetastet.

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

`<milos-date-picker>` behält seinen bisherigen nativen Datumsmodus samt
Jahressprung als rückwärtskompatiblen Standard. Für merkbare Daten bietet
Version 1.2.0 zusätzlich den expliziten Modus `known-date-text`:

```html
<milos-date-picker min="1900-01-01" max="2100-12-31"
  label-de="Datum" label-en="Date"
  mode="known-date-text"></milos-date-picker>
```

Die primäre Eingabe ist dann ein normales Textfeld mit `inputmode="numeric"`.
Deutsch akzeptiert `D.M.YYYY`, `D/M/YYYY`, `D-M-YYYY` und kompakt exakt acht
Ziffern `DDMMYYYY`; Englisch nutzt dieselbe Tag-Monat-Jahr-Reihenfolge und
zeigt sie ausdrücklich als `DD/MM/YYYY` an. `13111995` wird beim Commit zu
`1995-11-13`. Gemischte Trenner, zweistellige Jahre, unmögliche Kalendertage
und Werte außerhalb von `min`/`max` sind ungültig. Der Rohtext bleibt dabei
sichtbar und erhält `aria-invalid` sowie eine genaue lokalisierte Meldung.

Enter oder Blur versucht zu committen. Escape stellt den letzten gültigen
formatierten Wert wieder her. Ein einfacher Pointerklick in einem vollständigen
Wert kann nur das getroffene Tag-, Monat- oder Jahrsegment auswählen; eine
automatische Fokusverlagerung findet nicht statt. Eine getrennte native
Kalenderaktion bleibt als Progressive Enhancement erhalten: Eine sichtbare
Schaltfläche ruft nur bei Browserunterstützung `showPicker()` auf; andernfalls
entfällt sie fail-closed. „Heute“ bleibt erhalten, ist aber deaktiviert, wenn
der heutige Tag außerhalb von `min`/`max` liegt. Clear bleibt für optionale
Felder möglich. Bei `required` bleibt ein leerer Rohwert sichtbar, wird als
ungültig erklärt und ändert den letzten gültigen ISO-Wert nicht. Der alte
Jahressprung erscheint im neuen Modus nicht. Ein eigener ARIA-Kalender ist
ausdrücklich nicht Teil des Vertrags.

Intern und in Events bleibt der Wert `YYYY-MM-DD`. Pro tatsächlicher Änderung
werden genau ein `milosapps:datechange` und ein normales `change`-Ereignis
ausgegeben; ein Commit desselben Werts bleibt still. Apps bleiben Eigentümer
von Zeitzone, historischer Gültigkeit und erlaubtem Zeitraum. Der Reflow richtet
sich nach der tatsächlichen Komponentenbreite; alle sichtbaren Aktionen bleiben
mindestens 44 px hoch.

Ohne `mode="known-date-text"` bleibt der native v1.1.6-Pfad unverändert. Dort
wird ein bereits normalisierter nativer Wert weiterhin nicht redundant in
`input.value` geschrieben. Bestehende Verbraucher migrieren dadurch nicht
automatisch.

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

Im standardmäßigen `submit-only`-Modus wird eine Suche nur mit Enter oder der
Suchen-Schaltfläche **explizit abgeschickt**; dabei sendet der Baustein keine
Anfrage während der Eingabe. Das ist besonders wichtig für die öffentliche
Nominatim-Instanz: deren Richtlinie
verbietet clientseitiges Autocomplete, begrenzt Nutzung und verlangt
Attribution sowie eine austauschbare Verbindung. Apps müssen außerdem ihre
fachlichen Suchgrenzen beibehalten; ein Wetterort und ein astronomischer Ort
dürfen dasselbe UI/Ergebnisformat nutzen, ohne ihre Berechnung gleichzusetzen.

### Optionale Vorschläge

`submit-only` bleibt der Standard. Vorschläge während der Eingabe werden nur
aktiviert, wenn das Manifest `placeSuggestions.enabled=true`, Mindestzeichen
und Debounce deklariert sowie `providerCapability` auf genau eine der beiden
geprüften Grenzen setzt:

- `consumer-autocomplete-proxy`: ein app-eigener Proxy übernimmt Provider-,
  Schlüssel-, Rate-Limit- und Datenschutzgrenzen.
- `provider-autocomplete-direct`: der Provider erlaubt die direkte
  browserseitige Eingabevorschlagsuche ausdrücklich; die App benötigt dafür
  keine im Browser offengelegten Zugangsdaten.

Zusätzlich nennt `evidenceFile` in beiden Fällen einen app-eigenen Nachweis und
die Integration registriert ausdrücklich `setSuggestionsProvider(...)`. Der
Nachweis eines direkten Providers hält mindestens den exakten credential-freien
HTTPS-Endpunkt, offizielle Capability-Dokumentation, Browser-/CORS-Grenze,
Nutzungsbereich, Rate-Limits, Datenquelle/Lizenz/Attribution, übermittelte
Eingabedaten und Privacy, Cache-Lebensdauer sowie eine getrennte
Production-Neubewertung fest. Der Verifier bindet Pfad und Vorhandensein; die
inhaltliche Wahrheit fremder Richtlinien bleibt ein menschliches App- und
Release-Gate.

Der Baustein übernimmt Debounce, Abbruch vorheriger Anfragen, Unterdrückung
veralteter Antworten und Tastaturführung. Combobox und Provider teilen genau
eine über `aria-controls` zugeordnete Listbox. Escape, Auswahl, Disconnect und
ein Außenklick beziehungsweise -pointer schließen das Popup vollständig; ein
Pointer auf einer Option bleibt bis zum folgenden Auswahlklick race-sicher.
Abort ignorierende Altantworten dürfen das geschlossene Popup nicht wieder
öffnen. Ein Localewechsel bricht alte Provideroperationen ab; nach Auswahl
bleiben Name, Region und Land sichtbar.
Provider, Rate-Limit, Cache,
Attribution und Zeitzone bleiben App-Eigentum. Direktes Autocomplete gegen
`nominatim.openstreetmap.org` bleibt verboten; öffentliches Nominatim darf in
derselben App aber weiterhin für eine explizit abgeschickte `setSearchProvider`-
Suche vorkommen. Deshalb prüft der Verifier die separate Suggestions-
Capability, deren Evidenzdatei und `setSuggestionsProvider(...)`, nicht ein
pauschales Hostwort-Verbot über sämtlichen App-Code.

Öffentliches `nominatim.openstreetmap.org` kann die direkte Capability nicht
wahrheitsgemäß belegen: dessen offizielle Richtlinie verbietet clientseitiges
Autocomplete. Open-Meteos Geocoding-Endpunkt dokumentiert dagegen direkte
Suche ab drei Zeichen; die freie API ist nur für nichtkommerzielle Nutzung und
ihre veröffentlichten Limits bestimmt. Eine App darf das deshalb für ein
entsprechend belegtes DEV verwenden, erhält dadurch aber keine pauschale
Productionfreigabe. Das ist keine Rechtsberatung.

## Migration von 1.0.0 bis 1.1.6 auf 1.2.0

1. `essentialsContract.version` auf `1.2.0` und `sharedCommit` auf den
   unveränderlichen v1.2.0-Releasecommit setzen. `$schema` auf das vendorte
   Schema umstellen, `vendorDirectory` als Repositorypfad,
   `runtimeBasePath` als tatsächlich ausgelieferten URL-Basispfad und
   `consumerEntryModule` mit physischer Integrationsdatei plus exakter
   Modul-URL im deklarierten Quell-`entryHtml` ergänzen; danach alle sechs
   Verbraucherartefakte neu synchronisieren und locken. Bei bundelnden Apps
   belegt das getrennte Post-Build-/HTTP-Gate die erzeugte öffentliche URL.
   Verwendet die App `milos-app-shell`, erhält ihr bestehendes
   `svg[slot="app-icon"]` zusätzlich exakt `width="38" height="38"`; das
   portabel verifizierte Markup und das kritische 38-px-CSS werden atomar
   übernommen.
2. `loading.iconPath` auf die tatsächlich vorhandene SVG-Datei im Repository
   setzen. Bei geroutetem Hosting zusätzlich `loading.iconRuntimePath` auf die
   exakte öffentliche Same-Origin-URL setzen; ein Schattenasset oder eine
   künstliche Route ist nicht erforderlich. Bei identischen Pfaden darf das
   optionale Runtimefeld fehlen.
3. `features.placeSuggestions` ergänzen. Der sichere Standard ist:
   `enabled=false`, `minChars=3`, `debounceMs=350`,
   `providerCapability="submit-only"`, `evidenceFile=null`.
4. Bei `privacy.mode="no-cookies"` `features.privacyNotice=false` setzen und
   entweder einen dauerhaft erreichbaren Link mit `data-milos-privacy-info`
   sowie der exakten `privacyUrl` ausgeben oder über `privacy.permanentLink`
   das passende `public-app-shell/v2.0.3`-Manifest referenzieren. Im zweiten
   Fall bleibt ausschließlich der sichtbare Shell-Footerlink; ein doppelter
   App-Link, Banner oder Dismiss-Key entsteht nicht.
5. `privacy.storagePurposes` ergänzen. Bei `usesLocalStorage=true` jeden
   app-eigenen Schlüssel mit Zweck, Lebensdauer und `strictlyNecessary=true`
   deklarieren; optionale Zwecke sind in v1.1 nicht zulässig. Bei
   `usesLocalStorage=false` bleibt die Liste leer.
6. Bei `privacy.mode="essential-only"` `features.privacyNotice=true` behalten;
   Texte dürfen den Sachhinweis nicht als Einwilligung darstellen. Einen
   Dismiss-Key gibt es nicht mehr; die Schließaktion gilt nur im Dokument.
7. Falls Vorschläge fachlich nötig sind: entweder den app-eigenen
   Autocomplete-Proxy mit `consumer-autocomplete-proxy` oder einen ausdrücklich
   dafür erlaubten direkten Browserprovider mit `provider-autocomplete-direct`
   nachweisen. Evidenzdatei eintragen und separat
   `setSuggestionsProvider(...)` registrieren. Der normale
   `setSearchProvider(...)` bleibt die explizite Submit-Suche. Für direkte
   Provider bleiben Umgebung, Terms, Rate-Limits, Attribution, Privacy und
   Productioneignung app-eigene Gates.
8. Eine App, die merkbare Daten ohne native Segmentbearbeitung eingeben lässt,
   setzt ausschließlich am vorhandenen `<milos-date-picker>`
   `mode="known-date-text"`. Sie prüft Text, Paste, Enter, Blur, Escape, Clear,
   Heute, native Kalenderwahl, Tag-/Monat-/Jahr-Segmentauswahl, `min`/`max`,
   Schaltjahr, DE/EN und den einzelnen ISO-Eventpfad. Ein echter Chromium-Lauf
   deckt dabei mindestens `13111995`, einen Klick am rechten Rand des
   Jahrsegments, Blur/Escape und die sichtbare Kalenderaktion ab; Fake-DOM-
   Tests allein genügen für diese Browsergrenzen nicht. Ohne dieses Attribut
   bleibt der bisherige native Modus einschließlich Jahressprung aktiv.
9. `features.startup=true` setzen beziehungsweise beibehalten und die komplette
   statische Loaderstruktur ergänzen. Das App-Icon trägt im Quellmarkup
   `width="32" height="32"`; so bleibt auch der Zustand vor dem CSS-Laden
   kompakt. Beide Essentials-CSS-Dateien stehen vor
   allen Modulskripten. Erst bei echter Fachbereitschaft ruft der App-Code
   `globalThis.milosAppEssentials.ready()` auf; ein altes, direkt dispatchtes
   Ready-Event reicht nicht. Das gilt ausdrücklich auch für Portal-v1.0-
   Verbraucher, die zuvor `startup=false` oder keinen Loader hatten.
10. Das Schema ist nun selbst Teil des Locks. Themewerte sind ausschließlich
   gültige Hex-Farben oder eng benannte app-eigene Custom Properties der Form
   `var(--token-name)`. Fallbacks, `url()`-Assets und beliebige CSS-Ausdrücke
   bleiben verboten. So darf eine App ihr geprüftes Hell-/Dunkel-Theme
   weiterverwenden, ohne fremde Ressourcen oder Deklarationen einzuschleusen.
11. Im Vendorverzeichnis die enge Regel `* text eol=lf` setzen und den Verifier
   nach einem frischen Windows-Recheckout mit `core.autocrlf=true` erneut
   ausführen. Das schützt alle sechs bytegenauen Textartefakte.
12. Share-Fallback/Fehler, Datum in schmaler Komponente, Select-Pfeilbereich,
   Escape/Abort/Stale-Result, genau eine Listbox, Außenklick, race-sichere
   Auswahl, Localewechsel und Disconnect-Cleanup in der Verbraucher-
   Browsermatrix prüfen.

Die Runtime entfernt bei der Migration nur
`milosapps.<eigener-appKey>.privacyNotice.v1` und den tatsächlich von v1.1.0
geschriebenen Vorgänger `milosapps.<eigener-appKey>.essentialCookieInfo.v1`.
Diese Komfortwerte waren weder Consent noch fachliche Nutzerdatensätze und
werden nicht in den neuen Essential-Hinweiszustand übernommen.

## Pflicht-QA pro Verbraucher

- frischer Start und langsamer Start: Icon exakt 32 mal 32 px in Quellmarkup,
  auf Desktop, mobil und bei 200 Prozent sowie vor und nach dem CSS-Laden; kein
  ungestylter Shell-Icon-Flash; das Shell-Slot-SVG bleibt nach geladener
  Essentials-CSS vor dem Custom-Element-Upgrade, nach dem Upgrade bei
  verzögerter Shell-Komponenten-CSS und im Endzustand jeweils höchstens
  38 mal 38 px; Loader verschwindet erst nach
  `globalThis.milosAppEssentials.ready()` und tatsächlich fertiger App; die
  effektive `iconRuntimePath`-URL liefert Same-Origin HTTP 200 mit
  `image/svg+xml`, und ihr dekodierter Antwortinhalt stimmt per SHA-256 mit
  der app-eigenen Datei aus `iconPath` überein;
- bei bundelnden Verbrauchern: erzeugtes HTML referenziert nach dem Build einen
  tatsächlich vorhandenen Same-Origin-Verbraucherentry; dessen HTTP-Antwort
  ist 200 mit gültigem JavaScript-MIME und das Modul führt ohne Konsolenfehler
  aus. Ein gehashter Buildname wird nicht ins Shared-Manifest zurückgeschrieben;
- Datenschutzmodus in DE/EN: `no-cookies` ohne Banner/State mit dauerhaftem
  Link auf die exakte Manifest-`privacyUrl`; bei Shell-Nachweis genau ein
  sichtbarer Footerlink, passender App-/Umgebungs-/Entry-Vertrag und zusätzlich
  grüner Shell-v2-Verifier; `essential-only` als Sachhinweis ohne
  Consent-Sprache;
- Teilen nativ sowie Clipboard-Fallback und abgebrochener Dialog; keine
  Layoutverschiebung und keine Erfolgsmeldung nach nativem Teilen; ausstehende
  Promises dürfen nach Disconnect/Reconnect weder Status noch Events ändern;
- Datum: native Eingabe, Jahressprung, Heute, Min/Max, DE/EN,
  komponentenbreitenabhängiger Reflow und freier Select-Pfeilbereich;
- Ort: Stadt **und Region**, gleiches sichtbares Format, Enter/Schaltfläche,
  leere Treffer, Abbruch, Offline-/Netzfehler und optionaler Gerätestandort;
  auch ein Abort ignorierender Provider darf nach neuer Eingabe, Auswahl,
  Escape oder Disconnect/Reconnect keinen alten Zustand mehr einspielen;
- optionale Vorschläge: Mindestzeichen, Debounce, Abort, veraltete Antworten,
  Tastatur sowie app-eigener Proxy-/Provider-Nachweis;
- 1440 × 900, 390 × 844 und 360 × 800 bei 200 Prozent ohne horizontalen
  Überlauf, mit 44-px-Zielen und sichtbarem Fokus;
- echte Response-CSP `script-src 'self'; style-src 'self'`, externe Runtime-
  Dateien, korrekte MIME-Typen und SHA-256-Lock;
- enge LF-Policy und erneuter sechsfacher Locknachweis nach einem frischen
  Windows-Recheckout mit `core.autocrlf=true`;
- DEV-Health, No-Login und `productionApproved=false`.

Kalender und kontopflichtige Apps sind ausgeschlossen. Production benötigt
weiterhin eine ausdrückliche Nutzerfreigabe.
