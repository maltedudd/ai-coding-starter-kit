# PROJ-4: Episode Transcription

## Status: 🔵 Planned

## Abhängigkeiten
- **Benötigt:** PROJ-3 (New Episode Detection) - Episodes mit Status `pending_transcription` müssen existieren

## Übersicht
Automatisierter Worker-Prozess transkribiert neue Podcast-Episodes via OpenAI Whisper API. Audio wird heruntergeladen, an Whisper geschickt, Transkript wird in DB gespeichert. Bei Fehlern wird User benachrichtigt.

## User Stories

### Als System möchte ich Episodes transkribieren
- Als **System** möchte ich automatisch neue Episodes (Status: `pending_transcription`) transkribieren
- Als **System** möchte ich Audio-Files herunterladen und an Whisper API schicken
- Als **System** möchte ich Transkripte in DB speichern für spätere Newsletter-Generierung

### Als User möchte ich über Fehler informiert werden
- Als **User** möchte ich benachrichtigt werden, wenn eine Episode nicht transkribiert werden konnte
- Als **User** möchte ich den Grund des Fehlers sehen (zu groß, nicht erreichbar, etc.)

## Acceptance Criteria

### Transcription Worker
- [ ] Worker-Prozess läuft kontinuierlich oder als Cronjob (z.B. alle 10 Minuten)
- [ ] Worker holt alle Episodes mit Status `pending_transcription` aus DB
- [ ] Worker verarbeitet Episodes nacheinander (oder parallel, max. 5 gleichzeitig)

### Audio Download
- [ ] Audio-File wird von `audio_url` heruntergeladen
- [ ] File-Size wird geprüft: Max. 500 MB (Whisper API Limit: 25 MB, aber größere Files werden später komprimiert)
- [ ] Supported Audio-Formate: MP3, M4A, WAV, FLAC, OGG
- [ ] Audio wird temporär im Filesystem gespeichert (z.B. `/tmp/episode-{id}.mp3`)
- [ ] Nach Transkription: Temporäres File wird gelöscht

### Whisper API Transcription
- [ ] Audio-File wird an OpenAI Whisper API geschickt (`POST /v1/audio/transcriptions`)
- [ ] Whisper Model: `whisper-1` (Standard)
- [ ] Response Format: `text` (Plain Text, kein JSON mit Timestamps für MVP)
- [ ] Sprache: Auto-Detection (Whisper erkennt Sprache automatisch)
- [ ] Transkript wird in DB gespeichert (`episodes.transcript` Feld)

### Status Updates
- [ ] Während Transkription: Episode Status → `transcribing`
- [ ] Nach erfolgreicher Transkription: Status → `transcribed`
- [ ] Bei Fehler: Status → `failed` + Error Message in `episodes.error_message`

### Error Handling
- [ ] **Audio-URL nicht erreichbar (404, Timeout):** Status → `failed`, User-Email-Benachrichtigung
- [ ] **Audio-File zu groß (> 500 MB):** Status → `failed`, User-Email-Benachrichtigung
- [ ] **Whisper API Error (Rate Limit, Server Error):** Status bleibt `pending_transcription`, Retry nach 1h
- [ ] **Audio-Format nicht supported:** Status → `failed`, User-Email-Benachrichtigung
- [ ] Bei `failed`: Episode wird übersprungen (kein Newsletter)

### Performance
- [ ] Transkription Dauer: ~1x Audio-Länge (30min Audio = ~30min Transkription)
- [ ] Worker verarbeitet max. 5 Episodes parallel (Rate Limit beachten)
- [ ] Timeout pro Episode: 60 Minuten (für sehr lange Podcasts)

## Edge Cases

### Was passiert wenn...?

#### Audio-File ist extrem groß (5 GB)
- **Szenario:** 10-Stunden-Podcast mit hoher Bitrate
- **Verhalten:** File-Size Check schlägt fehl → Status `failed`, User-Email mit Fehler
- **Error Message:** "Episode zu groß zum Transkribieren (Max. 500 MB)"
- **Hinweis:** Whisper API Limit ist 25 MB, aber wir komprimieren/konvertieren später (nice-to-have)

#### Audio-URL ist redirect (301/302)
- **Szenario:** Audio-File wird von CDN mit Redirect geliefert
- **Verhalten:** Redirects werden automatisch gefolgt (fetch default behavior)

#### Audio-File ist passwort-geschützt oder paywall
- **Szenario:** Premium-Podcast-Episode ist nicht öffentlich erreichbar
- **Verhalten:** Download schlägt fehl (401/403) → Status `failed`, User-Email
- **Nice-to-Have:** Support für Private Feeds mit Authentication (nicht für MVP)

#### Whisper API gibt Rate Limit Error zurück
- **Szenario:** OpenAI Rate Limit erreicht (Requests/Minute oder Token/Minute)
- **Verhalten:** Status bleibt `pending_transcription`, Retry nach 1h (exponential backoff)
- **Log:** Error wird geloggt, kein User-Email (ist temporärer Fehler)

#### Transkript ist leer (Whisper gibt "" zurück)
- **Szenario:** Audio-File ist stumm oder nur Musik (keine Sprache)
- **Verhalten:** Status → `failed`, User-Email mit Hinweis "Keine Sprache erkannt"

#### Audio-Format ist exotisch (z.B. .aac, .opus)
- **Szenario:** Whisper API unterstützt Format nicht
- **Verhalten:** API gibt Error → Status `failed`, User-Email
- **Nice-to-Have:** Audio-Konvertierung (FFmpeg) zu unterstütztem Format (nicht für MVP)

#### Episode wird gelöscht während Transkription läuft
- **Szenario:** User entfernt Podcast-Abo während Worker läuft
- **Verhalten:** Foreign Key CASCADE löscht Episode → Worker-Transaction schlägt fehl → Skip, kein Error

#### Whisper API ist komplett down (Outage)
- **Szenario:** OpenAI Service ist offline
- **Verhalten:** Alle Transkriptionen schlagen fehl → Status bleibt `pending_transcription`
- **Retry:** Beim nächsten Worker-Run (10min später) erneut versuchen
- **Hinweis:** Kein User-Email bei OpenAI-Outage (nicht User's Schuld)

#### Audio hat mehrere Sprachen (z.B. Interview DE/EN)
- **Szenario:** Podcast wechselt zwischen Deutsch und Englisch
- **Verhalten:** Whisper erkennt dominante Sprache und transkribiert alles
- **Hinweis:** Whisper ist sehr gut mit Multi-Language, keine spezielle Behandlung nötig

#### Transkription dauert > 60 Minuten
- **Szenario:** Sehr langer Podcast + langsame Whisper-Response
- **Verhalten:** Timeout nach 60min → Status bleibt `pending_transcription`, Retry
- **Nice-to-Have:** Chunking von sehr langen Audio-Files (nicht für MVP)

## Technische Anforderungen

### Supabase Schema: Update `episodes` Table
```sql
-- Add transcript and error_message columns
ALTER TABLE episodes
ADD COLUMN transcript TEXT,
ADD COLUMN error_message TEXT;

-- Index für Status-Query (Worker holt pending Episodes)
-- Already created in PROJ-3
```

### Worker Implementation
- **Option 1 (Recommended):** Separate Worker Service (Railway, Render, Fly.io)
  - Läuft als Background Job, nicht als Serverless Function
  - Kontinuierlicher Polling-Loop oder Message Queue (z.B. BullMQ)
- **Option 2:** Vercel Serverless Function (Cron-triggered)
  - Läuft alle 10 Minuten
  - Achtung: Max. Execution Time 10min (Hobby) / 60min (Pro)
- **Option 3:** GitHub Actions Workflow
  - Scheduled Job (alle 10 Minuten)
  - Nicht ideal (Rate Limits, keine echte Background Jobs)

### OpenAI Whisper API
- **Endpoint:** `https://api.openai.com/v1/audio/transcriptions`
- **Method:** POST (multipart/form-data)
- **Auth:** `Authorization: Bearer $OPENAI_API_KEY`
- **Request Body:**
  - `file`: Audio-File (Binary)
  - `model`: `whisper-1`
  - `response_format`: `text` (oder `json` für Timestamps, nice-to-have)
- **Response:** Plain Text Transkript

**Example Request (Node.js):**
```typescript
import OpenAI from 'openai';
import fs from 'fs';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function transcribeEpisode(audioFilePath: string) {
  const transcription = await openai.audio.transcriptions.create({
    file: fs.createReadStream(audioFilePath),
    model: 'whisper-1',
    response_format: 'text',
  });
  return transcription; // String
}
```

### Audio Download
- Use `fetch()` oder `axios` mit Stream
- Max File Size Check: `response.headers['content-length']`
- Save to `/tmp/episode-{uuid}.{ext}` (Serverless) oder `/data/` (Persistent Worker)

### Worker Flow
1. Query DB: `SELECT * FROM episodes WHERE status = 'pending_transcription' ORDER BY published_at ASC LIMIT 10`
2. Für jede Episode:
   - Update Status → `transcribing`
   - Download Audio → `/tmp/episode-{id}.mp3`
   - Check File Size (< 500 MB)
   - Call Whisper API mit Audio-File
   - Save Transcript → `episodes.transcript`
   - Update Status → `transcribed`
   - Delete Temp File
3. Bei Error:
   - Update Status → `failed` (bei permanenten Errors wie "File not found")
   - Oder: Status bleibt `pending_transcription` (bei temporären Errors wie Rate Limit)
   - Save Error Message → `episodes.error_message`
   - Trigger User-Email (bei permanenten Errors)

### API Keys & Environment Variables
- `OPENAI_API_KEY` (Required)
- `SUPABASE_URL` (Required)
- `SUPABASE_SERVICE_ROLE_KEY` (Required, für Backend-Worker)

### Performance & Cost
- **Whisper API Pricing:** $0.006 / Minute Audio
- **Example:** 30min Episode = $0.18
- **Rate Limits:** 50 Requests/Minute (OpenAI default)
- **Optimierung:** Max. 5 parallele Transkriptionen (um unter Rate Limit zu bleiben)

### Error Notification Email Template
```
Subject: Episode konnte nicht transkribiert werden

Hallo,

leider konnte die folgende Podcast-Episode nicht transkribiert werden:

Podcast: [Podcast-Titel]
Episode: [Episode-Titel]
Fehler: [Error Message]

Was kannst du tun?
- Prüfe, ob die Episode noch verfügbar ist
- Falls das Problem weiterhin besteht, kontaktiere uns

Viele Grüße,
Dein Podletter-Team
```

## Nice-to-Have (nicht für MVP)
- Audio-Kompression für große Files (FFmpeg: MP3 mit niedrigerer Bitrate)
- Audio-Format-Konvertierung (alle Formate → MP3)
- Chunking von sehr langen Audio-Files (> 2h)
- Timestamps im Transkript (`response_format: 'verbose_json'`)
- Retry-Logik mit exponential backoff
- Dashboard für User: Transkriptions-Status anzeigen
- Whisper Alternative (z.B. AssemblyAI) als Fallback

## Notizen für Entwickler
- Whisper API ist sehr zuverlässig, aber langsam (1x Audio-Länge)
- Temporäre Files müssen unbedingt gelöscht werden (sonst füllt sich Disk)
- Für MVP: Keine Audio-Konvertierung, nur Basis-Formate (MP3, M4A)
- User-Benachrichtigung bei permanenten Fehlern ist wichtig (sonst wundern sich User, warum kein Newsletter kommt)
- OpenAI Rate Limits beachten: Max. 5 parallele Requests
