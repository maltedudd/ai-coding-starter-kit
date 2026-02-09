# PROJ-2: Podcast Subscription Management

## Status: 🔵 Planned

## Abhängigkeiten
- **Benötigt:** PROJ-1 (User Authentication) - User müssen eingeloggt sein

## Übersicht
User können Podcasts via RSS-Feed URL abonnieren. Die App validiert den Feed, zeigt Podcast-Metadaten (Titel, Cover, Beschreibung) an und speichert das Abo. User können Abos jederzeit mit Bestätigungs-Dialog entfernen.

## User Stories

### Als eingeloggter User möchte ich Podcasts abonnieren
- Als **Podcast-Hörer** möchte ich einen RSS-Feed über URL hinzufügen, um Podcasts zu abonnieren
- Als **User** möchte ich die Podcast-Details (Titel, Cover, Beschreibung) sehen, bevor ich das Abo bestätige
- Als **User** möchte ich eine Liste meiner abonnierten Podcasts sehen, um den Überblick zu behalten

### Als User möchte ich Podcasts verwalten
- Als **User** möchte ich ein Podcast-Abo entfernen können, wenn ich es nicht mehr benötige
- Als **User** möchte ich eine Bestätigung sehen, bevor ein Abo gelöscht wird, um versehentliches Löschen zu vermeiden

### Als User möchte ich klare Fehlermeldungen
- Als **User** möchte ich eine klare Fehlermeldung sehen, wenn die RSS-Feed URL ungültig ist
- Als **User** möchte ich eine klare Fehlermeldung sehen, wenn der RSS-Feed nicht erreichbar ist

## Acceptance Criteria

### Podcast hinzufügen
- [ ] User kann RSS-Feed URL in Input-Feld eingeben
- [ ] Nach Eingabe: "Hinzufügen" Button triggert Validation
- [ ] App fetched RSS-Feed und parst Podcast-Metadaten:
  - Podcast-Titel (required)
  - Cover Image URL (optional, fallback: Default-Image)
  - Beschreibung (optional)
- [ ] Podcast-Preview wird angezeigt mit Titel, Cover, Beschreibung
- [ ] User kann "Abonnieren" oder "Abbrechen" wählen
- [ ] Nach "Abonnieren": Podcast wird in Supabase gespeichert (Tabelle: `podcast_subscriptions`)
- [ ] Success Message: "Podcast erfolgreich abonniert"
- [ ] Neues Abo erscheint in Podcast-Liste

### Podcast-Liste anzeigen
- [ ] Dashboard zeigt alle abonnierten Podcasts des eingeloggten Users
- [ ] Jeder Podcast zeigt: Cover (klein), Titel, kurze Beschreibung (max. 100 Zeichen)
- [ ] Podcasts sind sortiert nach Hinzufüge-Datum (neueste zuerst)
- [ ] Leerer State: "Du hast noch keine Podcasts abonniert. Füge deinen ersten Podcast hinzu!"

### Podcast entfernen
- [ ] Jeder Podcast in Liste hat "Entfernen" Button (Icon: Trash/Delete)
- [ ] Klick auf "Entfernen" öffnet Bestätigungs-Dialog:
  - "Möchtest du '[Podcast-Titel]' wirklich entfernen?"
  - Buttons: "Ja, entfernen" (destructive) + "Abbrechen"
- [ ] Nach Bestätigung: Podcast wird aus Supabase gelöscht
- [ ] Success Message: "Podcast entfernt"
- [ ] Podcast verschwindet aus Liste

### Error Handling
- [ ] **Ungültige URL:** Error Message "Bitte gib eine gültige URL ein"
- [ ] **Feed nicht erreichbar (404, Timeout):** Error Message "RSS-Feed konnte nicht geladen werden. Bitte prüfe die URL."
- [ ] **Kein valider RSS-Feed:** Error Message "Das ist kein gültiger Podcast-RSS-Feed"
- [ ] **Feed bereits abonniert:** Error Message "Dieser Podcast ist bereits abonniert"
- [ ] Kein Abo wird erstellt bei Fehlern

## Edge Cases

### Was passiert wenn...?

#### User gibt ungültige URL ein
- **Szenario:** User gibt "test" oder "podcast.com" (ohne https://) ein
- **Verhalten:** Client-Side Validation: Error "Bitte gib eine gültige URL ein (z.B. https://...)"

#### RSS-Feed ist nicht erreichbar (404)
- **Szenario:** URL existiert nicht oder Server antwortet nicht
- **Verhalten:** Error Message "RSS-Feed konnte nicht geladen werden. Bitte prüfe die URL."
- **Hinweis:** Timeout nach 10 Sekunden

#### URL ist gültig, aber kein RSS-Feed
- **Szenario:** User gibt "https://google.com" ein (HTML statt RSS)
- **Verhalten:** Error Message "Das ist kein gültiger Podcast-RSS-Feed"

#### User versucht Podcast doppelt zu abonnieren
- **Szenario:** User gibt RSS-Feed URL ein, die bereits abonniert ist
- **Verhalten:** Error Message "Dieser Podcast ist bereits abonniert"
- **Check:** RSS-Feed URL Duplikat-Check in DB

#### RSS-Feed hat kein Cover Image
- **Szenario:** RSS-Feed hat kein `<itunes:image>` Tag
- **Verhalten:** Default Placeholder Image anzeigen (generisches Podcast-Icon)

#### RSS-Feed hat sehr lange Beschreibung
- **Szenario:** Beschreibung ist 5000+ Zeichen lang
- **Verhalten:** In Liste nur erste 100 Zeichen anzeigen + "..." (kein Truncate in DB)

#### User entfernt Podcast während Newsletter-Generierung läuft
- **Szenario:** Podcast wird gelöscht, aber Episode wird gerade transkribiert
- **Verhalten:** Laufende Jobs werden NICHT abgebrochen (laufen zu Ende), aber neue Episodes werden nicht mehr gecheckt
- **Hinweis:** Subscription-Status Check in PROJ-3 vor Newsletter-Generierung

#### RSS-Feed ändert URL (Redirect)
- **Szenario:** Podcast zieht auf neuen Feed um, alter Feed redirected (301)
- **Verhalten:** Redirect wird gefolgt (automatisch via fetch), neue URL wird NICHT gespeichert (User muss manuell updaten)
- **Nice-to-Have:** Auto-Update von Feed-URLs (nicht für MVP)

#### User hat 100+ Podcast-Abos
- **Szenario:** User abonniert sehr viele Podcasts
- **Verhalten:** Pagination oder Infinite Scroll in Podcast-Liste (nicht für MVP: zeige erstmal alle)

## Technische Anforderungen

### Supabase Schema: `podcast_subscriptions`
```sql
CREATE TABLE podcast_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feed_url TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  cover_image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, feed_url) -- Verhindert Duplikate
);

-- RLS Policies
ALTER TABLE podcast_subscriptions ENABLE ROW LEVEL SECURITY;

-- User kann nur eigene Abos sehen
CREATE POLICY "Users can view own subscriptions"
  ON podcast_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- User kann nur eigene Abos erstellen
CREATE POLICY "Users can create own subscriptions"
  ON podcast_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- User kann nur eigene Abos löschen
CREATE POLICY "Users can delete own subscriptions"
  ON podcast_subscriptions FOR DELETE
  USING (auth.uid() = user_id);
```

### RSS Feed Parsing
- Library: `rss-parser` (npm package)
- Parse Fields:
  - `feed.title` → `title`
  - `feed.description` → `description`
  - `feed.itunes.image` oder `feed.image.url` → `cover_image_url`

### Frontend Components
- `AddPodcastForm` - Input + Submit Button
- `PodcastPreview` - Zeigt geparste Metadaten
- `PodcastList` - Liste aller Abos
- `PodcastCard` - Einzelner Podcast in Liste
- `DeletePodcastDialog` - Bestätigungs-Dialog

### API Routes
- `POST /api/podcasts/validate` - RSS-Feed validieren + parsen
- `POST /api/podcasts/subscribe` - Podcast abonnieren
- `DELETE /api/podcasts/[id]` - Podcast-Abo löschen
- `GET /api/podcasts` - User's Podcast-Abos abrufen (optional: Supabase Client-Side Query)

### Performance
- RSS Feed Validation: < 10 Sekunden (mit Timeout)
- Podcast-Liste Laden: < 500ms

### Security
- RLS Policies: User kann nur eigene Abos sehen/ändern
- Feed URL Validation: HTTPS-only URLs bevorzugen (Warning bei HTTP)
- UNIQUE Constraint: `(user_id, feed_url)` verhindert Duplikate

## Nice-to-Have (nicht für MVP)
- Podcast-Suche über iTunes/Podcast-Index API (statt manueller URL)
- Podcast-Details-Seite (alle Episodes anzeigen)
- Podcast-Kategorien/Tags
- Auto-Update von Feed-URLs bei Redirects
- Bulk-Import von OPML-Dateien
- Podcast-Abo Pausieren (statt Löschen)

## Tech-Design (Solution Architect)

### Component-Struktur

```
Dashboard (/dashboard)
├── Kopfzeile
│   ├── App-Logo
│   └── Navigation (Logout-Button)
│
├── "Neuen Podcast hinzufügen" Bereich
│   ├── RSS-Feed URL Eingabefeld
│   ├── "Feed prüfen" Button
│   └── Podcast-Preview (erscheint nach Validation)
│       ├── Podcast-Cover (Bild)
│       ├── Podcast-Titel
│       ├── Beschreibung (erste 200 Zeichen)
│       └── Buttons: "Abonnieren" + "Abbrechen"
│
└── Meine Podcasts (Liste)
    ├── Leerer Zustand (wenn keine Abos)
    │   └── Nachricht: "Noch keine Podcasts abonniert"
    │
    └── Podcast-Karten (für jeden abonnierten Podcast)
        ├── Cover-Bild (klein, 80x80px)
        ├── Titel (fett)
        ├── Beschreibung (max. 100 Zeichen)
        └── "Entfernen" Button (Trash-Icon)

Bestätigungs-Dialog (beim Entfernen)
├── Titel: "Podcast entfernen?"
├── Text: "Möchtest du '[Podcast-Name]' wirklich entfernen?"
└── Buttons: "Ja, entfernen" (rot) + "Abbrechen"
```

### Daten-Model

**Podcast-Abonnement hat:**
- RSS-Feed URL (die URL zum XML-Feed)
- Podcast-Titel (aus Feed extrahiert)
- Beschreibung (aus Feed extrahiert)
- Cover-Bild URL (aus Feed extrahiert, oder Default-Bild)
- Hinzufüge-Datum (wann User abonniert hat)
- Zugehörigkeit zu User (jeder User hat eigene Abos)

**Gespeichert in:** Supabase Datenbank (Tabelle: `podcast_subscriptions`)

**Wichtige Regel:** Gleiche RSS-URL kann NICHT zweimal vom selben User abonniert werden (Duplikat-Schutz)

### Tech-Entscheidungen

**Warum RSS-Feed URL statt Podcast-Suche?**
- Einfacher für MVP (keine Integration mit iTunes/Spotify API nötig)
- User haben meist die RSS-URL ihrer Lieblings-Podcasts
- Flexibler: Funktioniert mit jedem Podcast (auch kleine/private)

**Warum rss-parser Library?**
- Bewährt und zuverlässig (200k+ Downloads/Woche)
- Parst alle gängigen Podcast-Formate (iTunes-Tags inklusive)
- Einfache API (kein komplexes XML-Parsing nötig)

**Warum Validation im Backend?**
- Sicherer: User kann keine gefährlichen URLs einschleusen
- Server kann Redirects folgen (CORS-Probleme vermeiden)
- Timeout-Control (Feed-Abruf max. 10 Sekunden)

**Warum Bestätigungs-Dialog beim Löschen?**
- Verhindert versehentliches Entfernen
- User verliert sonst alle Episoden-Historie
- Best Practice für destruktive Aktionen

**Warum Default Cover-Bild?**
- Nicht alle Podcasts haben Cover im Feed
- Verhindert "kaputte" Bilder in der UI
- Einheitliches Design

### Dependencies

**Benötigte Packages:**
- `rss-parser` (RSS-Feed Parsing)
- Bereits installierte shadcn/ui Components: `input`, `button`, `card`, `dialog`, `alert`

**Backend-Logik:**
- API Route zum Feed-Validieren (prüft URL, holt Metadaten)
- Supabase Client für Datenbank-Zugriff (Abos speichern/löschen)

### Workflow für User

**Podcast hinzufügen:**
1. User gibt RSS-URL ein → klickt "Feed prüfen"
2. Backend lädt Feed, extrahiert Titel/Cover/Beschreibung
3. Preview wird angezeigt
4. User klickt "Abonnieren" → Podcast wird gespeichert
5. Success-Nachricht + Podcast erscheint in Liste

**Podcast entfernen:**
1. User klickt Trash-Icon bei Podcast
2. Bestätigungs-Dialog öffnet sich
3. User bestätigt → Podcast wird gelöscht
4. Success-Nachricht + Podcast verschwindet

**Error-Handling:**
- Ungültige URL → "Bitte gib eine gültige URL ein"
- Feed nicht erreichbar → "Feed konnte nicht geladen werden"
- Kein RSS-Feed → "Das ist kein gültiger Podcast-Feed"
- Bereits abonniert → "Dieser Podcast ist bereits abonniert"

### Backend-API

**Endpoints (in Next.js API Routes):**
- `POST /api/podcasts/validate` - RSS-Feed prüfen und Metadaten holen
- `POST /api/podcasts/subscribe` - Podcast-Abo erstellen
- `DELETE /api/podcasts/[id]` - Podcast-Abo löschen

**Alternativ:** Direkter Supabase-Zugriff für Subscribe/Delete (nur Validate-Endpoint im Backend)

## Notizen für Entwickler
- Nutze `rss-parser` für RSS-Parsing (bewährte Library)
- RSS-Feed Validation sollte Backend-seitig laufen (nicht im Client)
- shadcn/ui Components: `input`, `button`, `card`, `dialog`, `alert`
- Default Cover Image vorbereiten (z.B. `/public/default-podcast-cover.png`)
