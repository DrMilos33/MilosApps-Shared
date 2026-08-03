# Changelog

## Unreleased

## public-app-essentials 1.1.4 – 2026-08-03

- Eingabevorschläge akzeptieren neben einem app-eigenen Proxy nun eng die neue
  Capability `provider-autocomplete-direct`, wenn ein direkter Browserprovider
  Autocomplete ausdrücklich erlaubt und die App Endpunkt, CORS, Terms,
  Rate-Limits, Lizenz, Attribution, Privacy und Productiongrenze nachweist.
- Öffentliches Nominatim bleibt ausdrücklich submit-only. Ein direkter
  Providernachweis ist kein pauschaler Productionvertrag.
- `milos-place-search` schließt seine eine Listbox bei Außen-Pointer, Escape,
  Auswahl, Localewechsel und Disconnect. Capture-Listener werden entfernt;
  abort-ignorierende Altantworten können das Popup nicht erneut öffnen und
  Optionsauswahl bleibt race-sicher.
- Loader 32×32, Shell-Footer-Datenschutzweg und alle übrigen v1.1.3-Grenzen
  bleiben rückwärtskompatibel erhalten.

## public-app-essentials 1.1.3 – 2026-08-03

- Das gemeinsame App-Ladeicon ist im HTML-Fallback, in der CSS-Runtime und im
  portablen Verifier einheitlich auf 32 mal 32 Pixel begrenzt. Die Grenze gilt
  auf Desktop, Mobil und im 200-Prozent-Reflow bereits vor dem Laden der CSS.
- Loaderkarte, Ready-Lifecycle, Privacy, Share, Date, Place, CSP, MIME,
  Iconpfade und die sechs Verbraucherartefakte bleiben unverändert aufgebaut.
- Für `no-cookies` darf der dauerhafte Datenschutzweg alternativ durch den
  bereits sichtbaren Footer von `public-app-shell/v2.0.3` belegt werden. Die
  App referenziert dazu ihr Shell-Manifest; App-Key, Umgebung, Entry, kanonische
  URL und separate Shell-Verifikation werden fail-closed gebunden. Ein
  zusätzlicher oder versteckter App-Link ist dann ausdrücklich unzulässig.
- Jede öffentliche App übernimmt den Patch weiterhin atomar im eigenen
  DEV-Lifecycle.

## public-app-essentials 1.1.2 – 2026-08-03

- `loading.iconPath` bleibt der physische, app-eigene SVG-Quellpfad;
  `loading.iconRuntimePath` kann zusätzlich die abweichende öffentliche
  Same-Origin-URL benennen. Ohne das neue Feld bleibt `iconPath` der
  rückwärtskompatible Runtime-Fallback.
- Schema, Sync, portabler Verifier, Referenzfixture und Regressionen trennen
  damit Repository- und Hostingpfad fail-closed, ohne Schattenassets oder
  künstliche Webrouten zu erzwingen. Die app-eigene DEV-QA belegt zusätzlich
  200/`image/svg+xml` und SHA-256-Identität der gerouteten Antwort.
- `consumerEntryModule.runtimePath` bezeichnet ausdrücklich den Modulpfad im
  geprüften Quell-HTML. Bundler-Hashes bleiben app-eigene Buildausgaben und
  werden dort per Post-Build-/HTTP-Gate statt als instabiler Manifestwert
  belegt.

## public-app-essentials 1.1.1 – 2026-08-03

- Manifest-Schema, Sync und portabler Verifier erzwingen nun den verpflichtenden
  Startup-Baustein, alle Pflicht-/Zusatzfeldgrenzen und sechs bytegelockte
  Artefakte einschließlich des Schemas.
- Sync gleicht Dist-, Schema- und Releasebytes mit dem angegebenen Git-Commit
  ab; ein veränderter Shared-Arbeitsbaum kann keinen fremden Release-SHA mehr
  behaupten. Theme-Tokens akzeptieren nur lokale CSS-Farbwerte.
- `essential-only` schließt seinen Sachhinweis nur im aktuellen Dokument und
  erzeugt keinen optionalen, nicht inventarisierten Komfortschlüssel.
- Datum sendet je Bedienung nur ein normales `change`; Place korrigiert
  initiales ArrowUp, Stale-Rejections, Locale-/Reconnect-Lebenszyklen und zeigt
  nach Auswahl Name, Region und Land dauerhaft.
- Der Verifier verlangt echte Link-/Script-/Markup-Integration; bloße Marker in
  HTML- oder JavaScript-Kommentaren bestehen nicht mehr.

## public-app-essentials 1.1.0 – 2026-08-03

- Datenschutzmodi präzisiert: `no-cookies` erzeugt weder Banner noch
  Dismiss-/Consent-Zustand; `essential-only` zeigt ausschließlich einen
  schließbaren Sachhinweis ohne Akzeptieren-/Ablehnen-Simulation. Der alte
  `privacyNotice.v1`-Komfortschlüssel wird nur im Namespace der eigenen App
  entfernt.
- Share-Rückmeldung ohne Layoutverschiebung: natives Teilen und Abbruch bleiben
  visuell still, Clipboard-/Fehlerstatus erscheint kurz als Overlay.
- Datumsauswahl reflowt nach Komponentenbreite, behält 44-Pixel-Ziele und
  reserviert im Select einen festen Inline-Endbereich für den nativen Pfeil.
- Ortssuche bleibt standardmäßig submit-only. Vorschläge sind ein expliziter
  Opt-in mit Mindestzeichen, Debounce, Abort, Stale-Result-Schutz,
  Tastaturführung und app-eigenem Proxy-/Provider-Nachweis; direktes
  öffentliches Nominatim-Autocomplete bleibt verboten, eine getrennte
  explizite Submit-Suche über öffentliches Nominatim aber zulässig.
- Submit- und Suggestions-Anfragen besitzen getrennte Abort-/Request-IDs,
  Query-/Stale-Guards, Escape-Abbruch und Disconnect-Cleanup.
- JSON-Vertrags- und Lockdateien für Essentials v1 werden im Shared-Repository
  explizit mit LF ausgecheckt; Verbraucher behalten zusätzlich ihre enge
  vendorlokale LF-Regel.

## public-app-essentials 1.0.0 – 2026-08-02

- `public-app-essentials/v1.0.0` vorbereitet: begrenzter CSS-first Loading
  Screen, wahrheitsgemäßer Datenschutz-/Cookiehinweis ohne Scheinwahl,
  einheitliches Teilen mit Web-Share-/Clipboard-Fallback, native Datumsauswahl
  mit Jahressprung und providerneutrale Ort-/Regionssuche.
- App-eigenes Theme, Sync, fünf SHA-256-Lockartefakte, portabler Validator und
  strikte CSP-Referenz ergänzt. Kalender, Login-Apps und Production bleiben
  ausgeschlossen.

## public-app-layout 1.1.0 – 2026-08-02

- H1, H2 und Intro-Icon mit eigenen deutlich kompakteren Desktop-/Mobilbudgets
  begrenzt; Intro und Primärarbeitsbeginn zusätzlich enger gefasst.
- `data-milos-settings*` als kompakte, reflowende Einstellungsstruktur ergänzt.
  Auch geöffnet bleiben Einstellungsintro, Controls und lokale Resetaktion
  unter einem eigenen Höhenbudget.
- Schrittfolgen sind standardmäßig einspaltig. Zwei Spalten entstehen nur noch
  durch den app-eigenen Opt-in `data-milos-flow="paired"` und reflowen mobil
  wieder einspaltig.
- Wolkenpost bleibt einziger Pilot; weitere Apps warten weiterhin auf das
  Nutzerreview dieser zweiten DEV-Fassung. Production bleibt gesperrt.

## public-app-layout 1.0.0 – 2026-08-01

- Separaten, frameworkneutralen Vertrag `public-app-layout/v1` für kompakte
  öffentliche No-Login-App-Inhalte ergänzt. `public-app-shell/v2` bleibt
  unverändert Eigentümer von Header, Footer, Sprache und Portal-Links.
- Lokale CSS-Primitiven für Intro, Primärarbeit, flache Flows, Panels,
  Ergebnisse, progressive Offenlegung, Command-Docks und intern reflowende
  Dialoge hinzugefügt.
- Verbindliche Dichtebudgets für 1440 × 900 und 390 × 844 sowie Reflow bei
  360 × 800 und 200 Prozent dokumentiert; 44-Pixel-Ziele, sichtbares Clipping,
  reduzierte Bewegung und höchstens eine dekorative Kartenebene bleiben Gates.
- Manifest, app-eigene Theme-CSS, Sync, drei SHA-256-Lockartefakte und portablen
  Validator hinzugefügt. Kein CDN, keine gemeinsame Runtime und keine
  Production-Freigabe.
- `cloud-post` als einzigen Pilot festgelegt. Weitere Apps werden erst nach
  dessen DEV-Abnahme und ausdrücklichem Nutzerreview geöffnet.

## 2.0.3 – 2026-08-01

- Shadow-DOM-CSS aus dem JavaScript-Inline-`style` in die vendorte externe
  Datei `milos-app-shell.css` verschoben.
- App-spezifische Theme-Tokens werden beim Sync als externe
  `milos-app-shell-theme.css` erzeugt und vom Bootstrap als Same-Origin-Datei
  geladen; `style.setProperty` und dynamische Inline-Styles entfallen.
- Lock und portabler Validator prüfen beide CSS-Artefakte. Der Vertrag verlangt
  eine grüne Browserregression unter `script-src 'self'; style-src 'self'`
  ohne Nonce, Hash oder `unsafe-inline`.

## 2.0.2 – 2026-08-01

- Die globale `20rem`-Mindestbreite der Shell-Seite entfernt. Dadurch kann die
  vendorte Shell auch auf schmalen Viewports bei 200 Prozent Zoom ohne
  horizontalen Überlauf auf die verfügbare Breite zurückfließen.
- Die dekorative Icon-Fassung bleibt bei 38 CSS-Pixeln, während die Markenreihe
  auf schmalen Viewports kontrolliert umbrechen darf. Header-Navigation und
  Sprachgruppe erhalten explizite Schrumpfgrenzen gegen Min-Content-Überlauf.
- Der Contract-Validator lehnt eine erneute feste Body-Mindestbreite ab und
  prüft die reflow-fähige `min-width: 0`-Grenze.
- Noch nicht veröffentlichte oder extern blockierte Apps dürfen `dev.url` und
  `dev.healthUrl` gemeinsam auf `null` setzen. Sync und portabler Validator
  akzeptieren nur das ehrliche Paar „beide HTTPS“ oder „beide null“.

## 2.0.1 – 2026-08-01

- Ausführbare JavaScript-/ES-Modul-Artefakte werden per `.gitattributes`
  plattformübergreifend mit LF ausgecheckt, sodass die veröffentlichten
  SHA-256-Prüfsummen unter Windows und Linux identisch bleiben.
- Vertrag, Manifest, Sync, Validator und Referenzlock auf den unveränderbaren
  Patch-Tag `public-app-shell-v2.0.1` angehoben. Der bereits veröffentlichte
  Tag `v2.0.0` wird nicht verschoben.

## 2.0.0 – 2026-08-01

- `public-app-shell/v2` als dependency-freies ES-Modul/Web-Component mit
  semantischem Header/Footer, Inline-Flaggen mit sichtbaren DE/EN-Labels,
  standardisiertem Pfeil, 100dvh-Grid und app-eigenem SVG-/Main-Slot ergänzt.
- Ein verpflichtendes `milos-app.json`, Schema, app-spezifische
  Bootstrapgenerierung, SHA-256-Lock sowie portable Sync-/Verify-Werkzeuge
  eingeführt.
- Manipulations-, Pfad-, Production-, DE/EN-, Responsive-, Fokus-, Touch-,
  Overflow- und Reload-Persistenzgrenzen in Contract- und Referenztests
  aufgenommen.
- Kalender und kontopflichtige Apps bleiben ausgeschlossen; kein CDN, keine
  gemeinsame Runtime, keine Datenbank und keine Production-Freigabe.

## 1.0.0 – 2026-07-30

- Frameworkneutralen Vertrag `public-app-shell/v1` für die öffentlichen Apps
  `noodle-calculator`, `sky`, `cloud-post`, `somewhere-now`, `gravity-loop`,
  `waste-guide` und `daylight` hinzugefügt.
- Normative Umgebungslinks, DE/EN-Persistenz, Header-/Footer-Semantik,
  Layout-/Accessibility-Tokens, Referenzmarkup und dependency-freie
  Validierung ergänzt.
- Kalender ausdrücklich ausgeschlossen; keine gemeinsame Runtime, Datenbank
  oder erzwungene App-/Portalveröffentlichung.
