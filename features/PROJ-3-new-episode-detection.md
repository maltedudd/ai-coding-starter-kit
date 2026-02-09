# PROJ-3: New Episode Detection

## Status: 🔵 Planned

## Abhängigkeiten
- **Benötigt:** PROJ-2 (Podcast Subscription Management) - Abonnierte Podcasts müssen existieren

## Übersicht
Automatisierter Cronjob (stündlich) prüft alle abonnierten Podcast-RSS-Feeds auf neue Episoden. Neue Episoden werden in DB gespeichert und für Transkription vorbereitet.

## User Stories

### Als System möchte ich neue Episodes automatisch erkennen
- Als **System** möchte ich stündlich alle Podcast-RSS-Feeds prüfen, um neue Episoden zu finden
- Als **System** möchte ich nur wirklich neue Episoden speichern, um Duplikate zu vermeiden
- Als **System** möchte ich Episode-Metadaten (Titel, Audio-URL, Dauer, Publish-Date) speichern, um sie später zu verarbeiten

### Als User möchte ich über Fehler informiert werden
- Als **User** möchte ich benachrichtigt werden, wenn ein Podcast-Feed nicht mehr erreichbar ist
- Als **User** möchte ich benachrichtigt werden, wenn eine Episode nicht verarbeitet werden konnte

## Acceptance Criteria

### Cronjob Setup
- [ ] Cronjob läuft stündlich (z.B. via Vercel Cron Jobs oder GitHub Actions)
- [ ] Cronjob holt alle Podcast-Abos aus DB (`SELECT * FROM podcast_subscriptions`)
- [ ] Für jeden Podcast: RSS-Feed fetchen und parsen

### Episode Detection
- [ ] Jeder RSS-Feed wird auf neue `<item>` Einträge geprüft
- [ ] Für jede Episode werden folgende Daten extrahiert:
  - Episode-Titel (`item.title`)
  - Audio-URL (`item.enclosure.url`)
  - Publish-Date (`item.pubDate`)
  - Dauer (`item.itunes.duration`, optional)
  - Beschreibung (`item.description`, optional)
  - GUID (`item.guid` - eindeutige Episode-ID)
- [ ] Duplikat-Check: Episode mit gleichem GUID existiert bereits? → Skip
- [ ] Neue Episode wird in DB gespeichert (`episodes` Tabelle)
- [ ] Status der neuen Episode: `pending_transcription`

### Error Handling
- [ ] Wenn RSS-Feed nicht erreichbar (Timeout, 404): Log Error, skip diesen Feed
- [ ] Wenn RSS-Feed invalid ist: Log Error, skip diesen Feed
- [ ] Bei 3 aufeinanderfolgenden Fehlern für einen Feed: User benachrichtigen (Email)
- [ ] Cronjob-Execution wird geloggt (Success/Failure, Anzahl neuer Episodes)

### Performance
- [ ] Cronjob verarbeitet max. 100 Feeds pro Run (Paginierung bei mehr Feeds)
- [ ] Timeout pro Feed: 10 Sekunden
- [ ] Gesamte Cronjob-Execution: < 5 Minuten

## Edge Cases

### Was passiert wenn...?

#### RSS-Feed ist temporär nicht erreichbar
- **Szenario:** Podcast-Server ist für 2 Stunden down
- **Verhalten:** Error wird geloggt, Feed wird beim nächsten Cronjob (1h später) erneut geprüft
- **Kein Alert:** Erst nach 3 aufeinanderfolgenden Fehlern User benachrichtigen

#### RSS-Feed hat 100+ Episodes
- **Szenario:** Neues Feed-Abo mit vielen alten Episodes
- **Verhalten:** Nur Episodes der letzten 30 Tage als "neu" behandeln (Filter: `pubDate > NOW() - 30 days`)
- **Grund:** Vermeidet Transkription von hunderten alter Episodes

#### Episode hat keine Audio-URL (kein enclosure)
- **Szenario:** RSS-Feed item hat kein `<enclosure>` Tag
- **Verhalten:** Episode wird NICHT gespeichert (Log Warning: "Episode has no audio file")

#### Episode GUID ist leer oder fehlt
- **Szenario:** RSS-Feed hat kein `<guid>` Tag
- **Verhalten:** Fallback: Generiere GUID aus `feed_url + episode_title + pubDate` (Hash)
- **Grund:** GUID ist essentiell für Duplikat-Check

#### Zwei User abonnieren denselben Podcast
- **Szenario:** User A und User B haben beide "Podcast X" abonniert
- **Verhalten:** Episode wird zweimal gespeichert (einmal pro User-Subscription)
- **Grund:** Jede Episode ist user-spezifisch (für Newsletter-Generierung)
- **Schema:** `episodes` Tabelle hat `subscription_id` (nicht `podcast_id`)

#### Episode Publish-Date ist in der Zukunft
- **Szenario:** Podcast setzt `pubDate` auf morgiges Datum (geplante Episode)
- **Verhalten:** Episode wird NICHT gespeichert (Filter: `pubDate <= NOW()`)

#### Podcast veröffentlicht 10 Episodes gleichzeitig
- **Szenario:** Backlog-Release oder Staffel-Drop
- **Verhalten:** Alle neuen Episodes werden gespeichert und verarbeitet
- **Limit:** Max. 50 neue Episodes pro Feed pro Run (Schutz vor Spam)

#### User entfernt Podcast-Abo während Cronjob läuft
- **Szenario:** Subscription wird gelöscht, während Feed gecheckt wird
- **Verhalten:** Foreign Key Constraint verhindert Episode-Insert → Skip, kein Error

#### Audio-URL ist sehr groß (5GB+ File)
- **Szenario:** Episode ist extrem lang oder hochauflösend
- **Verhalten:** In PROJ-3 wird nur URL gespeichert, keine Validierung
- **Hinweis:** Download + Size-Check passiert in PROJ-4 (Transcription)

## Technische Anforderungen

### Supabase Schema: `episodes`
```sql
CREATE TABLE episodes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subscription_id UUID NOT NULL REFERENCES podcast_subscriptions(id) ON DELETE CASCADE,
  guid TEXT NOT NULL, -- Episode unique identifier
  title TEXT NOT NULL,
  description TEXT,
  audio_url TEXT NOT NULL,
  duration_seconds INT, -- optional
  published_at TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'pending_transcription', -- pending_transcription, transcribing, transcribed, failed, newsletter_sent
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(subscription_id, guid) -- Verhindert Duplikate pro Subscription
);

-- Index für schnelle Status-Queries
CREATE INDEX idx_episodes_status ON episodes(status);
CREATE INDEX idx_episodes_published_at ON episodes(published_at DESC);

-- RLS Policies
ALTER TABLE episodes ENABLE ROW LEVEL SECURITY;

-- User kann nur Episodes seiner Subscriptions sehen
CREATE POLICY "Users can view own episodes"
  ON episodes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM podcast_subscriptions
      WHERE podcast_subscriptions.id = episodes.subscription_id
      AND podcast_subscriptions.user_id = auth.uid()
    )
  );
```

### Supabase Schema: `feed_check_logs` (Error Tracking)
```sql
CREATE TABLE feed_check_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subscription_id UUID NOT NULL REFERENCES podcast_subscriptions(id) ON DELETE CASCADE,
  status TEXT NOT NULL, -- success, error
  error_message TEXT,
  checked_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index für Recent Errors Query
CREATE INDEX idx_feed_check_logs_subscription ON feed_check_logs(subscription_id, checked_at DESC);
```

### Cronjob Implementation
- **Option 1 (Recommended):** Vercel Cron Jobs (`vercel.json` + API Route)
  - `vercel.json`: `"cron": ["0 * * * *"]` (every hour)
  - API Route: `/api/cron/check-new-episodes`
- **Option 2:** GitHub Actions Workflow (hourly schedule)
- **Option 3:** External Service (Railway Cron, Render Cron)

### RSS Parsing
- Library: `rss-parser` (gleiche wie PROJ-2)
- Parse Episode Fields:
  - `item.title` → `title`
  - `item.guid` → `guid` (fallback: hash von `title + pubDate`)
  - `item.enclosure.url` → `audio_url`
  - `item.pubDate` → `published_at`
  - `item.itunes.duration` → `duration_seconds` (convert to seconds)
  - `item.description` → `description`

### API Route: `/api/cron/check-new-episodes`
- **Method:** GET (mit Vercel Cron) oder POST
- **Auth:** Vercel Cron Secret Header (`x-vercel-cron-secret`)
- **Flow:**
  1. Fetch alle Subscriptions: `SELECT * FROM podcast_subscriptions`
  2. Für jede Subscription:
     - Fetch RSS Feed
     - Parse Items
     - Filter: `pubDate > NOW() - 30 days` UND `pubDate <= NOW()`
     - Duplikat-Check: `guid` bereits in `episodes`?
     - Insert neue Episodes mit Status `pending_transcription`
     - Log Success/Error in `feed_check_logs`
  3. Return: `{ success: true, newEpisodes: 42, errors: 2 }`

### Performance
- Parallel Processing: Max. 10 Feeds gleichzeitig (Promise.all mit Chunk-Verarbeitung)
- Timeout pro Feed: 10 Sekunden
- Gesamte Execution: < 5 Minuten (Vercel Serverless Function Limit: 10min)

### Error Notification Logic
- Query last 3 logs per subscription: `SELECT * FROM feed_check_logs WHERE subscription_id = X ORDER BY checked_at DESC LIMIT 3`
- Wenn alle 3 `status = 'error'`: Trigger Email an User
- Email enthält: Podcast-Titel, Error Message, Empfehlung (Feed-URL prüfen)

## Nice-to-Have (nicht für MVP)
- Dashboard für User: "Letzte geprüfte Episodes" (Feed-Check-Historie)
- Retry-Mechanismus für failed Feeds (exponential backoff)
- Webhook-Support (statt Polling): Podcast-Hoster benachrichtigt bei neuer Episode
- Custom Check-Intervalle pro Podcast (täglich, 6h, 12h)
- Health-Check Dashboard für Admins (alle Feeds, Success-Rate)

## Tech-Design (Solution Architect)

### System-Komponenten

```
Automatisierter Cronjob (stündlich)
├── Timer (jede Stunde ausgelöst)
│
├── Feed-Checker (Hauptlogik)
│   ├── Hole alle Podcast-Abos aus Datenbank
│   ├── Für jeden Podcast:
│   │   ├── Lade RSS-Feed von URL
│   │   ├── Parse alle Episode-Einträge
│   │   ├── Filtere neue Episodes (nicht älter als 30 Tage)
│   │   ├── Duplikat-Check (schon in Datenbank?)
│   │   └── Speichere neue Episodes
│   └── Logge Erfolge und Fehler
│
└── Error-Handler
    ├── Zähle Fehler pro Feed (max. 3 Versuche)
    └── Sende User-Email bei 3 aufeinanderfolgenden Fehlern
```

**Keine User-sichtbare UI** - Läuft komplett im Hintergrund!

### Daten-Model

**Episode hat:**
- Eindeutige Episode-ID (GUID aus RSS-Feed)
- Episode-Titel
- Audio-Datei URL (zum MP3/M4A-File)
- Veröffentlichungs-Datum
- Dauer (optional, in Sekunden)
- Beschreibung (optional)
- Status ("wartet auf Transkription", "fertig", etc.)
- Zugehörigkeit zu Podcast-Abo

**Gespeichert in:** Supabase Datenbank (Tabelle: `episodes`)

**Error-Log hat:**
- Feed-URL die fehlgeschlagen ist
- Fehler-Nachricht
- Zeitstempel
- Zugehörigkeit zu Podcast-Abo

**Gespeichert in:** Supabase Datenbank (Tabelle: `feed_check_logs`)

### Tech-Entscheidungen

**Warum stündlicher Cronjob?**
- Balance zwischen Aktualität und Server-Last
- Podcasts erscheinen selten häufiger als stündlich
- Vercel erlaubt kostenlose Cron Jobs (jede Stunde)

**Warum 30-Tage Filter?**
- Verhindert Transkription von hunderten alter Episodes
- Neu abonnierte Podcasts haben oft 100+ alte Episodes im Feed
- Reduziert Kosten (Whisper API kostet pro Minute Audio)
- 30 Tage = ~4-8 neue Episodes pro Podcast (realistisch)

**Warum GUID als Duplikat-Check?**
- GUID ist eindeutige Episode-ID im RSS-Standard
- Verlässlicher als Titel-Vergleich (Titel können sich ändern)
- RSS-Standard garantiert GUID-Einzigartigkeit

**Warum 3 Fehler-Versuche?**
- Temporäre Server-Ausfälle sollten nicht sofort User benachrichtigen
- Nach 3 Stunden (3 aufeinanderfolgende Checks) ist es wahrscheinlich ein echtes Problem
- User wird informiert und kann Feed-URL prüfen

**Warum nur neue Episodes speichern (nicht alle)?**
- Spart Speicherplatz
- User interessieren sich nur für neue Inhalte
- Alte Episodes sind nicht mehr relevant

**Warum Vercel Cron Jobs?**
- Bereits in Next.js integriert (keine zusätzliche Infrastruktur)
- Kostenlos im Hobby-Plan
- Einfaches Setup (nur JSON-Konfiguration)

### Dependencies

**Benötigte Packages:**
- `rss-parser` (gleiche Library wie PROJ-2)
- Vercel Cron Jobs (keine Installation nötig, Teil von Next.js Deployment)

**Backend-Logik:**
- API Route für Cronjob (`/api/cron/check-new-episodes`)
- Supabase Client für Datenbank-Zugriff

### System-Workflow

**Jede Stunde passiert:**

1. **Cronjob startet** (triggert API Route)

2. **Für jeden abonnierten Podcast:**
   - Lade RSS-Feed von gespeicherter URL
   - Parse alle Episode-Einträge (XML → JavaScript-Objekt)
   - Filtere nur Episodes der letzten 30 Tage
   - Prüfe: Ist Episode schon in Datenbank? (GUID-Check)
   - Falls neu: Speichere Episode mit Status "pending_transcription"

3. **Error-Handling:**
   - Feed nicht erreichbar → Log Error, weiter mit nächstem Feed
   - Feed invalid → Log Error, weiter mit nächstem Feed
   - Nach 3 aufeinanderfolgenden Fehlern → Email an User

4. **Cronjob endet** (bis nächste Stunde)

**User merkt nichts davon** - läuft komplett im Hintergrund!

### Backend-API

**Endpoint:**
- `GET /api/cron/check-new-episodes` (von Vercel Cron ausgelöst)

**Sicherheit:**
- Nur von Vercel Cron aufrufbar (Secret-Header-Check)
- User können diesen Endpoint NICHT direkt aufrufen

### Vercel Cron Konfiguration

**In `vercel.json`:**
```
Zeitplan: Jede Stunde (z.B. 00:00, 01:00, 02:00, ...)
Endpoint: /api/cron/check-new-episodes
```

**Keine zusätzliche Infrastruktur nötig** (Vercel handled alles)

### User-Benachrichtigung

**Email bei Fehler (nach 3 Versuchen):**
- Betreff: "Podcast-Feed konnte nicht geladen werden"
- Inhalt: Welcher Podcast, welcher Fehler, was User tun kann
- Nur bei permanenten Fehlern (nicht bei temporären)

## Notizen für Entwickler
- Vercel Cron Jobs sind ideal für MVP (kein externer Service nötig)
- `rss-parser` ist sehr zuverlässig, aber parst manchmal `itunes:duration` nicht korrekt → Fallback-Logik implementieren
- 30-Tage Filter ist wichtig: Verhindert Transkription von hunderten alten Episodes bei neuem Abo
- User-Benachrichtigung bei Errors ist wichtig: User wissen sonst nicht, warum keine Newsletter kommen
