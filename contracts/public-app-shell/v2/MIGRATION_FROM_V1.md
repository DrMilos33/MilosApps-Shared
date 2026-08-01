# Migration von public-app-shell/v1 auf v2

## Warum eine Major-Version?

v1 war ein Markup-/Tokenvertrag, den jede App manuell nachbaute. v2 macht
App-Manifest, lokale Distribution, Lock/Prüfsummen, Slots, Sprachereignis und
Production-Flag verpflichtend. Diese Distributions- und Konfigurationsgrenze
ist nicht rückwärtskompatibel.

## Reihenfolge pro App

1. Bestehenden gesunden DEV-Source- und Artefakt-SHA als Rollback notieren.
2. `milos-app.json` anhand des Schemas anlegen und den exakten Shared-Commit
   eintragen.
3. Sync aus dem gepinnten v2-Release ausführen.
4. Bestehenden Header/Footer entfernen und genau ein `<milos-app-shell>` mit
   app-eigenem Inline-SVG und `<main slot="main">` einsetzen.
5. Das App-Sprachmodul an `milosapps:localechange` anbinden. Die gesamte
   sichtbare App-Oberfläche bleibt DE/EN-pflichtig.
6. App-eigene Farben ausschließlich über dokumentierte Theme-Werte setzen.
7. Portable Verify-Prüfung und app-eigene CI-/Browsermatrix ausführen.
8. PUBLISH-ABSICHT nur an tatsächlich betroffene Eigentümer senden und das
   unabhängige App-DEV veröffentlichen.
9. Source-SHA, Artefakt-SHA, Health, externe QA und Rollback an Struktur und –
   falls Route oder Portalmetadaten betroffen sind – Portal übergeben.

## Nicht automatisch migrieren

- `calendar` und andere loginpflichtige Apps;
- Production-Branches oder Production-Deployments;
- Apps mit ungeklärtem Eigentümer oder ungesichertem Rollback;
- fremde Repository-Dateien außerhalb des App-Shell-Scopes.

## Rollback

Der App-Eigentümer setzt seinen vorherigen App-Commit einschließlich
Vendorordner, Manifest und Lock wieder ein, führt seine vollständigen Tests aus
und veröffentlicht nur sein eigenes Ziel erneut. Shared und andere Apps werden
nicht zurückgerollt.
