# PROJ-5: Newsletter Generation

## Status: 🔵 Planned

## Abhängigkeiten
- **Benötigt:** PROJ-4 (Episode Transcription) - Transkripte müssen existieren

## Übersicht
KI-gestützte Newsletter-Generierung via Claude (Anthropic). Aus Transkript wird eine strukturierte Summary erstellt: Intro, 5-10 Bullet Points, Top 3-5 Key Takeaways. Generierter Newsletter wird in DB gespeichert für Email-Versand.

## User Stories

### Als System möchte ich Newsletter aus Transkripten generieren
- Als **System** möchte ich automatisch aus Transkripten strukturierte Newsletter erstellen
- Als **System** möchte ich Claude API nutzen, um hochwertige Summaries zu generieren
- Als **System** möchte ich Newsletter-Content in DB speichern für späteren Email-Versand

### Als User möchte ich qualitativ hochwertige Summaries
- Als **User** möchte ich prägnante Zusammenfassungen (Intro + 5-10 Bullet Points) erhalten
- Als **User** möchte ich die wichtigsten Highlights (Key Takeaways) auf einen Blick sehen
- Als **User** möchte ich einen Link zur Original-Episode haben, falls ich mehr hören möchte

### Als User möchte ich über Fehler informiert werden
- Als **User** möchte ich benachrichtigt werden, wenn eine Summary nicht generiert werden konnte

## Acceptance Criteria

### Newsletter Generation Worker
- [ ] Worker-Prozess läuft kontinuierlich oder als Cronjob (z.B. alle 10 Minuten)
- [ ] Worker holt alle Episodes mit Status `transcribed` aus DB
- [ ] Worker generiert Newsletter-Content via Claude API
- [ ] Generierter Content wird in DB gespeichert (`episode_newsletters` Tabelle)

### Claude API Prompt Structure
- [ ] Prompt enthält:
  - Podcast-Titel
  - Episode-Titel
  - Transkript (vollständig)
  - Anweisung: "Erstelle eine strukturierte Summary mit Intro (2-3 Sätze), 5-10 Bullet Points, und 3-5 Key Takeaways"
- [ ] Claude Model: `claude-3-5-sonnet-20241022` (oder neuester Sonnet)
- [ ] Max Tokens: 2000 (ausreichend für Newsletter-Content)

### Newsletter Content Structure
Generierter Newsletter enthält:
- [ ] **Intro** (2-3 Sätze): Überblick über das Thema der Episode
- [ ] **Bullet Points** (5-10): Wichtigste Inhalte und Themen
- [ ] **Key Takeaways** (3-5): Die wichtigsten Erkenntnisse/Highlights
- [ ] **Original-Link:** Link zur Podcast-Episode (aus RSS-Feed `audio_url`)

### Status Updates
- [ ] Während Generierung: Episode Status → `generating_newsletter`
- [ ] Nach erfolgreicher Generierung: Status → `newsletter_ready`
- [ ] Bei Fehler: Status → `newsletter_failed` + Error Message

### Error Handling
- [ ] **Claude API Error (Rate Limit, Server Error):** Status bleibt `transcribed`, Retry nach 1h
- [ ] **Transkript zu lang (> 200k Tokens):** Transkript wird gekürzt (erste 150k Tokens), dann retry
- [ ] **Claude gibt leere Antwort:** Status → `newsletter_failed`, User-Email-Benachrichtigung
- [ ] **API Key ungültig:** Worker stoppt, Admin-Benachrichtigung

### Performance
- [ ] Newsletter-Generierung Dauer: 10-30 Sekunden (abhängig von Transkript-Länge)
- [ ] Worker verarbeitet Episodes nacheinander (Claude Rate Limits beachten)
- [ ] Timeout pro Episode: 2 Minuten

## Edge Cases

### Was passiert wenn...?

#### Transkript ist extrem lang (10-Stunden-Podcast)
- **Szenario:** Transkript hat 200k+ Tokens (Claude Limit: ~200k Context)
- **Verhalten:** Transkript wird auf erste 150k Tokens gekürzt, dann an Claude geschickt
- **Hinweis:** Summary ist trotzdem brauchbar (erste 80% des Podcasts)
- **Nice-to-Have:** Chunking + Multiple Summaries (nicht für MVP)

#### Transkript ist sehr kurz (5-Minuten-Episode)
- **Szenario:** Transkript hat nur 500 Wörter
- **Verhalten:** Claude generiert trotzdem Intro + Bullet Points (halt weniger, z.B. 3-5 statt 10)
- **Prompt:** "Mindestens 3 Bullet Points" (flexibel)

#### Transkript ist in Fremdsprache (z.B. Spanisch)
- **Szenario:** Podcast ist nicht auf Deutsch/Englisch
- **Verhalten:** Claude erkennt Sprache und generiert Summary in gleicher Sprache
- **Nice-to-Have:** User-Setting "Newsletter-Sprache" (z.B. immer auf Deutsch) - nicht für MVP

#### Claude gibt schlecht strukturierte Antwort (kein Markdown)
- **Szenario:** Claude antwortet mit Plain Text statt strukturiertem Markdown
- **Verhalten:** Post-Processing: Newsletter-Parser extrahiert Sections (Intro, Bullet Points, Key Takeaways)
- **Fallback:** Wenn Parsing fehlschlägt → gesamte Claude-Antwort als Intro speichern

#### Claude API gibt Rate Limit Error
- **Szenario:** Anthropic Rate Limit erreicht (Requests/Minute)
- **Verhalten:** Status bleibt `transcribed`, Retry nach 1h (exponential backoff)
- **Log:** Error wird geloggt, kein User-Email (temporärer Fehler)

#### Episode wird gelöscht während Newsletter-Generierung läuft
- **Szenario:** User entfernt Podcast-Abo während Worker läuft
- **Verhalten:** Foreign Key CASCADE löscht Episode → Worker-Transaction schlägt fehl → Skip, kein Error

#### Transkript enthält nur Musik-Beschreibung (kein Inhalt)
- **Szenario:** Whisper hat nur "[Musik]" transkribiert (Podcast ist nur Musik)
- **Verhalten:** Claude gibt trotzdem Antwort (z.B. "Diese Episode enthält hauptsächlich Musik")
- **Hinweis:** Newsletter wird trotzdem erstellt (aber uninformativ)

#### Claude API ist komplett down (Outage)
- **Szenario:** Anthropic Service ist offline
- **Verhalten:** Alle Generierungen schlagen fehl → Status bleibt `transcribed`
- **Retry:** Beim nächsten Worker-Run (10min später) erneut versuchen
- **Hinweis:** Kein User-Email bei Anthropic-Outage (nicht User's Schuld)

#### Podcast-Episode hat mehrere Sprecher (Interview)
- **Szenario:** Transkript enthält Sprecher A und B (aber ohne Labels, da Whisper keine Diarisation macht)
- **Verhalten:** Claude fasst alle Inhalte zusammen (unabhängig von Sprechern)
- **Nice-to-Have:** Speaker Diarisation (nicht für MVP)

## Technische Anforderungen

### Supabase Schema: `episode_newsletters`
```sql
CREATE TABLE episode_newsletters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  episode_id UUID NOT NULL REFERENCES episodes(id) ON DELETE CASCADE UNIQUE,
  intro TEXT NOT NULL,
  bullet_points TEXT[] NOT NULL, -- Array of bullet point strings
  key_takeaways TEXT[] NOT NULL, -- Array of key takeaway strings
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index für Episode-Query
CREATE INDEX idx_episode_newsletters_episode ON episode_newsletters(episode_id);

-- RLS Policies
ALTER TABLE episode_newsletters ENABLE ROW LEVEL SECURITY;

-- User kann nur Newsletters seiner Episodes sehen
CREATE POLICY "Users can view own newsletters"
  ON episode_newsletters FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM episodes
      JOIN podcast_subscriptions ON podcast_subscriptions.id = episodes.subscription_id
      WHERE episodes.id = episode_newsletters.episode_id
      AND podcast_subscriptions.user_id = auth.uid()
    )
  );
```

### Supabase Schema: Update `episodes` Table
```sql
-- Add newsletter generation status
-- Status values: transcribed, generating_newsletter, newsletter_ready, newsletter_failed
-- Already handled by existing status field
```

### Claude API Integration
- **Library:** `@anthropic-ai/sdk` (Official Anthropic SDK)
- **Model:** `claude-3-5-sonnet-20241022` (oder neuester)
- **Max Tokens:** 2000 (für Newsletter-Content)
- **Temperature:** 0.7 (kreativ, aber konsistent)

**Example Request (Node.js):**
```typescript
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function generateNewsletter(podcastTitle: string, episodeTitle: string, transcript: string) {
  const message = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 2000,
    temperature: 0.7,
    messages: [{
      role: 'user',
      content: `Du bist ein Newsletter-Autor. Erstelle eine strukturierte Zusammenfassung dieser Podcast-Episode.

Podcast: ${podcastTitle}
Episode: ${episodeTitle}

Transkript:
${transcript}

Erstelle folgende Struktur:

## Intro
[2-3 Sätze Überblick über das Thema]

## Inhalte
[5-10 Bullet Points mit den wichtigsten Themen und Aussagen]

## Key Takeaways
[3-5 wichtigste Erkenntnisse/Highlights]

Schreibe prägnant und leserfreundlich.`
    }]
  });

  return message.content[0].text; // String mit Markdown
}
```

### Newsletter Parser
- Parse Claude-Antwort (Markdown → Structured Data)
- Extrahiere Sections: `## Intro`, `## Inhalte`, `## Key Takeaways`
- Bullet Points → Array: `["Punkt 1", "Punkt 2", ...]`
- Save to `episode_newsletters` Tabelle

**Example Regex Parsing:**
```typescript
function parseNewsletter(markdown: string) {
  const introMatch = markdown.match(/## Intro\n([\s\S]*?)(?=\n## )/);
  const bulletPointsMatch = markdown.match(/## Inhalte\n([\s\S]*?)(?=\n## )/);
  const keyTakeawaysMatch = markdown.match(/## Key Takeaways\n([\s\S]*?)$/);

  const intro = introMatch?.[1].trim() || '';
  const bulletPoints = bulletPointsMatch?.[1]
    .split('\n')
    .filter(line => line.startsWith('- '))
    .map(line => line.replace(/^- /, '')) || [];
  const keyTakeaways = keyTakeawaysMatch?.[1]
    .split('\n')
    .filter(line => line.startsWith('- '))
    .map(line => line.replace(/^- /, '')) || [];

  return { intro, bulletPoints, keyTakeaways };
}
```

### Worker Flow
1. Query DB: `SELECT * FROM episodes WHERE status = 'transcribed' ORDER BY published_at ASC LIMIT 5`
2. Für jede Episode:
   - Update Status → `generating_newsletter`
   - Fetch Podcast-Titel (via `subscription_id`)
   - Call Claude API mit Prompt (Podcast-Titel, Episode-Titel, Transkript)
   - Parse Claude-Antwort (Markdown → Structured Data)
   - Insert into `episode_newsletters`
   - Update Status → `newsletter_ready`
3. Bei Error:
   - Update Status → `newsletter_failed` (bei permanenten Errors)
   - Oder: Status bleibt `transcribed` (bei temporären Errors wie Rate Limit)
   - Save Error Message → `episodes.error_message`
   - Trigger User-Email (bei permanenten Errors)

### API Keys & Environment Variables
- `ANTHROPIC_API_KEY` (Required)
- `SUPABASE_URL` (Required)
- `SUPABASE_SERVICE_ROLE_KEY` (Required)

### Performance & Cost
- **Claude API Pricing:** ~$3 / 1M Input Tokens, ~$15 / 1M Output Tokens (Sonnet 3.5)
- **Example:** 30min Podcast = ~6k Tokens Input + 500 Tokens Output = ~$0.03
- **Rate Limits:** 50 Requests/Minute (Anthropic default)
- **Optimierung:** Sequentielle Verarbeitung (1 Episode nach der anderen)

### Error Notification Email Template
```
Subject: Newsletter konnte nicht generiert werden

Hallo,

leider konnte für die folgende Episode kein Newsletter erstellt werden:

Podcast: [Podcast-Titel]
Episode: [Episode-Titel]
Fehler: [Error Message]

Was kannst du tun?
- Falls das Problem weiterhin besteht, kontaktiere uns

Viele Grüße,
Dein Podletter-Team
```

## Nice-to-Have (nicht für MVP)
- User-spezifische Newsletter-Sprache (z.B. immer auf Deutsch)
- User-spezifische Newsletter-Länge (Kurz/Mittel/Lang)
- Chunking für sehr lange Transkripte (> 150k Tokens)
- Multi-Language Support (Auto-Translation)
- Newsletter-Vorschau im Dashboard (User kann Preview sehen vor Email-Versand)
- Custom Prompt Templates pro User
- Speaker Diarisation (Sprecher-Labels im Transkript)

## Notizen für Entwickler
- Claude ist sehr gut mit langen Texten (200k Context), perfekt für Podcast-Transkripte
- Markdown-Parsing ist wichtig: Claude gibt strukturiertes Markdown zurück, muss in DB-Format konvertiert werden
- Fallback-Parsing implementieren: Falls Claude nicht exakt das erwartete Format liefert
- User-Benachrichtigung bei permanenten Fehlern ist wichtig
- Temperature 0.7 ist ein guter Mittelweg (kreativ, aber konsistent)
