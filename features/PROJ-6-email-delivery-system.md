# PROJ-6: Email Delivery System

## Status: 🔵 Planned

## Abhängigkeiten
- **Benötigt:** PROJ-5 (Newsletter Generation) - Newsletter-Content muss existieren
- **Benötigt:** PROJ-7 (User Settings) - User-Email und Versandzeit müssen konfiguriert sein

## Übersicht
Täglicher Email-Versand zur user-spezifischen Zeit. Cronjob prüft stündlich, welche User Newsletter erhalten sollen, und versendet diese via Email-Service (z.B. Resend oder SendGrid). Email enthält Newsletter-Content (Intro, Bullet Points, Key Takeaways) + Link zur Original-Episode.

## User Stories

### Als User möchte ich Newsletter per Email erhalten
- Als **User** möchte ich täglich zur von mir gewählten Zeit einen Newsletter erhalten, wenn neue Episoden verfügbar sind
- Als **User** möchte ich den Newsletter in lesbarem Format (HTML) erhalten
- Als **User** möchte ich Links zu Original-Episoden haben, falls ich mehr hören möchte

### Als User möchte ich keine Spam-Emails
- Als **User** möchte ich NUR dann einen Newsletter erhalten, wenn es tatsächlich neue Episoden gibt
- Als **User** möchte ich NICHT mehrere Emails pro Tag erhalten (nur eine Daily-Digest-Email)

## Acceptance Criteria

### Email Delivery Cronjob
- [ ] Cronjob läuft stündlich (z.B. alle 60 Minuten)
- [ ] Cronjob prüft: Welche User haben jetzt ihre Versandzeit erreicht? (z.B. 8:00 UTC)
- [ ] Für jeden User: Hole alle neuen Newsletter (Status: `newsletter_ready`)
- [ ] Falls neue Newsletter existieren: Sende Email
- [ ] Falls keine neuen Newsletter: Keine Email (skip)

### Email Content Structure
Email enthält:
- [ ] **Betreff:** "Deine neuen Podcast-Updates" (oder ähnlich)
- [ ] **Header:** "Hallo [User-Name], hier sind deine neuen Podcast-Highlights:"
- [ ] **Pro Episode:**
  - Podcast-Titel + Episode-Titel (fett)
  - Intro (2-3 Sätze)
  - Bullet Points (5-10)
  - Key Takeaways (3-5)
  - "→ Höre die Episode" Link (zu Original-Audio-URL)
- [ ] **Footer:** "Einstellungen ändern" Link (zu User Settings Page)

### Email Format
- [ ] HTML Email (responsive, mobile-friendly)
- [ ] Plain Text Fallback (für Email-Clients ohne HTML)
- [ ] Styling: Einfach, sauber, lesefreundlich (keine komplexen Layouts)

### Status Updates
- [ ] Nach erfolgreichem Versand: Episode Status → `newsletter_sent`
- [ ] Timestamp: `episodes.newsletter_sent_at` = NOW()
- [ ] Bei Email-Fehler: Log Error, kein Status-Update (Retry beim nächsten Cronjob)

### Error Handling
- [ ] **Email-Service Error (Rate Limit, Server Error):** Log Error, Retry beim nächsten Cronjob (1h später)
- [ ] **User hat keine Email-Adresse:** Skip (sollte nicht passieren, da User Settings Required)
- [ ] **Ungültige Email-Adresse:** Log Error, User-Benachrichtigung via In-App-Notification (optional)

### Performance
- [ ] Cronjob verarbeitet max. 100 User pro Run (Batch-Verarbeitung)
- [ ] Email-Versand: < 2 Sekunden pro Email
- [ ] Gesamte Cronjob-Execution: < 10 Minuten

## Edge Cases

### Was passiert wenn...?

#### User hat 10 neue Episoden auf einmal
- **Szenario:** User war 1 Woche inaktiv, 10 Podcasts haben neue Episoden
- **Verhalten:** EINE Email mit allen 10 Episoden (Daily Digest)
- **Hinweis:** Email kann lang werden, aber das ist OK (besser als 10 separate Emails)

#### User ändert Versandzeit nach Newsletter-Generierung
- **Szenario:** User ändert Versandzeit von 8:00 auf 10:00, aber Newsletter ist schon `newsletter_ready`
- **Verhalten:** Newsletter wird zur neuen Zeit (10:00) verschickt
- **Hinweis:** Status `newsletter_ready` bedeutet "bereit zum Versand", nicht "wird jetzt versendet"

#### Email-Versand schlägt fehl (Transient Error)
- **Szenario:** Email-Service gibt 500 Error zurück
- **Verhalten:** Status bleibt `newsletter_ready`, Retry beim nächsten Cronjob (1h später)
- **Max Retries:** 24 (24 Stunden = 1 Tag), danach Status → `newsletter_failed`

#### User hat keine neuen Episoden
- **Szenario:** Cronjob läuft, aber User hat keine Episodes mit Status `newsletter_ready`
- **Verhalten:** Keine Email versenden (skip)
- **Wichtig:** Keine "Du hast keine neuen Updates"-Email (wäre Spam)

#### User deaktiviert Email-Benachrichtigungen
- **Szenario:** User hat Setting "Email-Benachrichtigungen deaktiviert"
- **Verhalten:** Cronjob skippt diesen User (kein Email-Versand)
- **Hinweis:** User Settings haben `email_notifications_enabled` Flag (PROJ-7)

#### Email landet im Spam-Ordner
- **Szenario:** Email-Client markiert Newsletter als Spam
- **Verhalten:** Technisch nichts zu tun (ist Empfänger-Konfiguration)
- **Best Practice:** SPF, DKIM, DMARC konfigurieren (Email-Service handled das meist)
- **Nice-to-Have:** "Whitelist"-Anleitung im Footer

#### User hat Versandzeit in anderer Timezone als UTC
- **Szenario:** User wählt "8:00 Uhr" in Berlin (UTC+1), aber Server läuft auf UTC
- **Verhalten:** User Settings speichern Zeit als UTC (konvertiert bei Eingabe)
- **Hinweis:** Frontend konvertiert User-Eingabe → UTC, Backend arbeitet nur mit UTC

#### Episode wird gelöscht nach Newsletter-Generierung, aber vor Email-Versand
- **Szenario:** User entfernt Podcast-Abo nach Newsletter-Generierung
- **Verhalten:** Foreign Key CASCADE löscht Episode → Newsletter wird nicht versendet (kein Error)

#### Email-Service hat Rate Limit (z.B. 100 Emails/Stunde)
- **Szenario:** 500 User sollen zur gleichen Zeit (8:00) Newsletter erhalten
- **Verhalten:** Batch-Verarbeitung: 100 User pro Cronjob-Run, Rest beim nächsten Run (1h später)
- **Hinweis:** User bekommen Newsletter mit 1h Verzögerung (akzeptabel für MVP)

#### User abonniert 100+ Podcasts und hat täglich 50+ neue Episoden
- **Szenario:** Email wird extrem lang
- **Verhalten:** Für MVP: Alle Episoden in einer Email (keine Limitierung)
- **Nice-to-Have:** Max. 10 Episoden pro Email, Rest in separater Email oder "View more" Link

## Technische Anforderungen

### Supabase Schema: Update `episodes` Table
```sql
-- Add newsletter_sent_at timestamp
ALTER TABLE episodes
ADD COLUMN newsletter_sent_at TIMESTAMPTZ;

-- Index für Cronjob-Query (finde alle unsent newsletters)
CREATE INDEX idx_episodes_newsletter_sent ON episodes(status, newsletter_sent_at)
WHERE status = 'newsletter_ready';
```

### Email Service Integration
**Recommended:** Resend (Modern, Developer-friendly)
- Library: `resend` (npm package)
- API Key: `RESEND_API_KEY`
- From Email: `newsletter@yourdomain.com` (Custom Domain erforderlich)

**Alternative:** SendGrid, Postmark, AWS SES

**Example (Resend):**
```typescript
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendNewsletterEmail(userEmail: string, newsletters: Newsletter[]) {
  await resend.emails.send({
    from: 'Podletter <newsletter@podletter.app>',
    to: userEmail,
    subject: 'Deine neuen Podcast-Updates',
    html: generateEmailHTML(newsletters),
    text: generateEmailPlainText(newsletters), // Fallback
  });
}
```

### Email Template (HTML)
- Responsive Design (mobile-friendly)
- Clean Typography (lesefreundlich)
- CTA Buttons: "Höre die Episode" (Link zu audio_url)
- Footer: "Einstellungen ändern" Link, "Abmelden" Link (optional für MVP)

**Example Structure:**
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Deine neuen Podcast-Updates</title>
</head>
<body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1>Hallo [User-Name],</h1>
  <p>Hier sind deine neuen Podcast-Highlights:</p>

  <!-- Loop: Für jede Episode -->
  <div style="border: 1px solid #ddd; padding: 15px; margin-bottom: 20px;">
    <h2>[Podcast-Titel] - [Episode-Titel]</h2>
    <p><strong>Intro:</strong> [Intro-Text]</p>
    <h3>Inhalte:</h3>
    <ul>
      <li>[Bullet Point 1]</li>
      <li>[Bullet Point 2]</li>
      ...
    </ul>
    <h3>Key Takeaways:</h3>
    <ul>
      <li>[Key Takeaway 1]</li>
      <li>[Key Takeaway 2]</li>
      ...
    </ul>
    <a href="[Audio-URL]" style="display: inline-block; background: #0070f3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
      → Höre die Episode
    </a>
  </div>

  <hr>
  <p style="color: #666; font-size: 12px;">
    <a href="[Settings-URL]">Einstellungen ändern</a>
  </p>
</body>
</html>
```

### Cronjob Implementation
- **Option 1 (Recommended):** Vercel Cron Jobs
  - `vercel.json`: `"cron": ["0 * * * *"]` (every hour)
  - API Route: `/api/cron/send-newsletters`
- **Option 2:** GitHub Actions Workflow (hourly)
- **Option 3:** External Cron Service (Railway, Render)

### API Route: `/api/cron/send-newsletters`
**Flow:**
1. Get current hour (UTC): `const currentHour = new Date().getUTCHours();`
2. Query: Alle User mit `user_settings.newsletter_delivery_hour = currentHour`
3. Für jeden User:
   - Query: Alle Episodes mit `status = 'newsletter_ready'` UND `subscription_id IN (user's subscriptions)`
   - Falls keine Episodes: Skip
   - Falls Episodes existieren:
     - Fetch Newsletter-Content (join `episode_newsletters`)
     - Generate Email HTML
     - Send Email via Resend
     - Update Status → `newsletter_sent`, `newsletter_sent_at = NOW()`
4. Return: `{ success: true, emailsSent: 42 }`

### API Keys & Environment Variables
- `RESEND_API_KEY` (Required)
- `SUPABASE_URL` (Required)
- `SUPABASE_SERVICE_ROLE_KEY` (Required)

### Performance & Cost
- **Resend Pricing:** Free Tier: 100 Emails/Tag, Paid: $20/Monat (50k Emails)
- **Example:** 100 aktive User = ~100 Emails/Tag (1 Daily Digest pro User)
- **Rate Limits:** 10 Requests/Sekunde (Resend default)

### Monitoring & Logging
- Log jeden Email-Versand: User-ID, Anzahl Episoden, Timestamp
- Log Fehler: User-ID, Error Message, Timestamp
- Optional: Dashboard für Admins (Email-Versand-Statistiken)

## Nice-to-Have (nicht für MVP)
- Email-Unsubscribe-Link (User kann Notifications deaktivieren)
- Email-Tracking (Open Rate, Click Rate)
- Custom Email-Templates pro User (z.B. nur Key Takeaways, keine Bullet Points)
- Weekly Digest statt Daily Digest
- Push Notifications (statt nur Email)
- Email-Vorschau im Dashboard (User sieht Preview vor Versand)
- A/B Testing für Email-Templates

## Notizen für Entwickler
- Resend ist sehr developer-friendly (einfaches API, gutes DX)
- HTML-Email-Templates müssen responsive sein (viele User lesen auf Mobile)
- Plain Text Fallback ist wichtig (nicht alle Email-Clients unterstützen HTML)
- SPF/DKIM/DMARC: Resend handled das automatisch (Custom Domain erforderlich)
- Rate Limits beachten: Batch-Verarbeitung implementieren (max. 100 Emails pro Cronjob-Run)
- User-Timezone: Immer in UTC speichern und konvertieren (Frontend macht Conversion)
