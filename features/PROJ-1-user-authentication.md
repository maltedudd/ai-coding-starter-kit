# PROJ-1: User Authentication

## Status: 🔵 Planned

## Abhängigkeiten
- Keine (Foundation Feature)

## Übersicht
Email + Passwort Authentication via Supabase Auth mit Email-Verifizierung. User müssen ihre Email bestätigen, bevor sie die Anwendung nutzen können.

## User Stories

### Als neuer User möchte ich mich registrieren
- Als **Podcast-Enthusiast** möchte ich mich mit Email + Passwort registrieren, um mein persönliches Podcast-Newsletter-Konto zu erstellen
- Als **neuer User** möchte ich nach Registrierung eine Bestätigungs-Email erhalten, um meine Email-Adresse zu verifizieren
- Als **neuer User** möchte ich klar sehen, dass ich meine Email bestätigen muss, um die Anwendung zu nutzen

### Als registrierter User möchte ich mich einloggen
- Als **registrierter User** möchte ich mich mit Email + Passwort einloggen, um auf meine Podcast-Abonnements zuzugreifen
- Als **eingeloggter User** möchte ich nach Browser-Reload eingeloggt bleiben, um nicht ständig neu einloggen zu müssen
- Als **eingeloggter User** möchte ich mich ausloggen können, um meine Session zu beenden

### Als User mit Account möchte ich klare Fehlermeldungen
- Als **User** möchte ich eine klare Fehlermeldung sehen, wenn ich versuche mich mit einer bereits registrierten Email zu registrieren
- Als **User** möchte ich eine klare Fehlermeldung sehen, wenn Email oder Passwort beim Login falsch sind

## Acceptance Criteria

### Registration Flow
- [ ] User kann Email + Passwort im Register-Formular eingeben
- [ ] Passwort muss mindestens 8 Zeichen lang sein
- [ ] Email-Format wird validiert (Standard-Email-Regex)
- [ ] Bei erfolgreicher Registrierung wird Bestätigungs-Email an User-Email gesendet
- [ ] User sieht Hinweis: "Bitte prüfe deine Emails und bestätige deine Email-Adresse"
- [ ] Bei doppelter Email-Registrierung: Error Message "Diese Email ist bereits registriert"
- [ ] User wird NICHT automatisch eingeloggt nach Registrierung (erst nach Email-Verifizierung)

### Email Verification
- [ ] User erhält Email mit Bestätigungs-Link
- [ ] Klick auf Bestätigungs-Link verifiziert Email-Adresse
- [ ] Nach Verifizierung: Weiterleitung zu Login-Page mit Success-Message
- [ ] Unbestätigte User können sich NICHT einloggen (Error: "Bitte bestätige zuerst deine Email")

### Login Flow
- [ ] User kann Email + Passwort im Login-Formular eingeben
- [ ] Bei korrekten Credentials: Erfolgreicher Login + Weiterleitung zum Dashboard
- [ ] Bei falschen Credentials: Error Message "Email oder Passwort falsch"
- [ ] Bei unbestätigter Email: Error Message "Bitte bestätige zuerst deine Email-Adresse"
- [ ] Session bleibt nach Browser-Reload erhalten (Supabase Session Management)

### Logout Flow
- [ ] User kann sich über Logout-Button ausloggen
- [ ] Nach Logout: Session wird beendet, Weiterleitung zu Login-Page
- [ ] Nach Logout: User kann nicht mehr auf geschützte Routen zugreifen

### Security
- [ ] Passwörter werden NIEMALS im Klartext gespeichert (Supabase Auth handled das)
- [ ] Alle Auth-Requests laufen über HTTPS
- [ ] Protected Routes redirecten nicht-eingeloggte User zum Login

## Edge Cases

### Was passiert wenn...?

#### Doppelte Registrierung
- **Szenario:** User versucht sich mit bereits registrierter Email zu registrieren
- **Verhalten:** Error Message "Diese Email ist bereits registriert" anzeigen
- **Hinweis:** NICHT automatisch zum Login weiterleiten (Security: vermeidet Email-Enumeration)

#### Email-Verifizierung läuft ab
- **Szenario:** User klickt auf veralteten Bestätigungs-Link (nach X Tagen)
- **Verhalten:** Error Message "Link ist abgelaufen" + Option "Neue Email senden"
- **Hinweis:** Supabase default: 24h Gültigkeit

#### User vergisst ob Email bestätigt ist
- **Szenario:** User versucht Login, aber Email ist unbestätigt
- **Verhalten:** Error Message "Bitte bestätige zuerst deine Email-Adresse" + Button "Bestätigungs-Email erneut senden"

#### Falsche Passwort-Eingabe (Brute Force)
- **Szenario:** User gibt 5x falsches Passwort ein
- **Verhalten:** Supabase Rate Limiting greift (Standard: max. 5 Login-Versuche pro Stunde pro IP)
- **Hinweis:** Wird von Supabase Auth automatisch gehandelt

#### Session läuft ab
- **Szenario:** User ist seit 7 Tagen inaktiv (Supabase default session expiry)
- **Verhalten:** Auto-Logout, Redirect zu Login mit Message "Session abgelaufen, bitte erneut einloggen"

#### User gibt ungültige Email ein
- **Szenario:** User gibt "test@" oder "test.com" ein
- **Verhalten:** Client-Side Validation: Error Message "Bitte gib eine gültige Email-Adresse ein"

#### User gibt zu kurzes Passwort ein
- **Szenario:** User gibt Passwort mit weniger als 8 Zeichen ein
- **Verhalten:** Error Message "Passwort muss mindestens 8 Zeichen lang sein"

## Technische Anforderungen

### Supabase Setup
- Supabase Auth aktiviert
- Email Provider konfiguriert (Standard: Supabase Email Service)
- Email Templates anpassen (optional für MVP)
- Session Persistence: Default (7 Tage)

### Frontend Pages/Components
- `/register` - Registrierungs-Formular
- `/login` - Login-Formular
- `/auth/verify` - Email-Verifizierungs-Callback-Seite
- Protected Route Middleware (redirects zu `/login` wenn nicht authentifiziert)

### Supabase Auth Methods
- `signUp()` - Registrierung mit Email + Passwort
- `signInWithPassword()` - Login
- `signOut()` - Logout
- `onAuthStateChange()` - Session Listener

### Performance
- Login/Register Response Time: < 500ms (abhängig von Supabase)
- Email-Versand: < 2 Sekunden

### Security
- HTTPS only (enforced by Vercel/Next.js)
- Supabase RLS Policies für User-Daten
- Session Cookies: httpOnly, secure, sameSite

## Nice-to-Have (nicht für MVP)
- Passwort-Reset Flow ("Passwort vergessen")
- Social Login (Google OAuth)
- Zwei-Faktor-Authentifizierung (2FA)
- Password Strength Indicator
- "Remember Me" Checkbox (Session-Länge anpassen)

## Tech-Design (Solution Architect)

### Component-Struktur

```
App
├── Login-Seite (/login)
│   ├── Login-Formular
│   │   ├── Email-Eingabefeld
│   │   ├── Passwort-Eingabefeld
│   │   └── "Einloggen" Button
│   └── Link zu Registrierung
│
├── Registrierungs-Seite (/register)
│   ├── Register-Formular
│   │   ├── Email-Eingabefeld
│   │   ├── Passwort-Eingabefeld
│   │   └── "Registrieren" Button
│   └── Link zu Login
│
├── Email-Verifizierungs-Seite (/auth/verify)
│   ├── Success-Nachricht (nach erfolgreicher Verifizierung)
│   └── Error-Nachricht (bei abgelaufenem Link)
│
└── Geschützte Bereiche (Dashboard, Settings, etc.)
    ├── Navigation mit Logout-Button
    └── Automatischer Redirect zu Login wenn nicht eingeloggt
```

### Daten-Model

**User-Account (verwaltet von Supabase Auth):**
- Email-Adresse (eindeutig)
- Passwort (verschlüsselt von Supabase)
- Email-Verifizierungs-Status (bestätigt oder nicht)
- Session-Token (für automatisches Eingeloggt-bleiben)
- Login-Zeitstempel

**Gespeichert in:** Supabase Auth (keine eigene Datenbank-Tabelle nötig)

**Session-Verwaltung:**
- Session bleibt 7 Tage aktiv (Standard)
- Bei Browser-Reload automatisch wiederhergestellt
- Session wird im sicheren Cookie gespeichert

### Tech-Entscheidungen

**Warum Supabase Auth?**
- Fertige Lösung (keine eigene Auth-Logik nötig)
- Email-Verifizierung bereits integriert
- Automatisches Passwort-Hashing (sichere Speicherung)
- Session-Management inklusive
- Rate Limiting gegen Brute-Force bereits aktiv

**Warum Email + Passwort (keine Social Logins)?**
- Einfacher für MVP
- Keine komplizierte OAuth-Integration nötig
- Datenschutz-freundlich (keine Daten an Drittanbieter)

**Warum Email-Verifizierung Pflicht?**
- Verhindert Spam-Accounts
- Stellt sicher, dass Newsletter-Empfänger-Email gültig ist
- Supabase sendet automatisch Bestätigungs-Emails

**Warum 7-Tage Session?**
- User müssen nicht ständig neu einloggen
- Guter Balance zwischen Komfort und Sicherheit
- Supabase Standard-Einstellung

### Dependencies

**Benötigte Packages:**
- `@supabase/supabase-js` (Supabase Client für Browser)
- `@supabase/auth-helpers-nextjs` (Integration mit Next.js)
- Bereits installierte shadcn/ui Components: `form`, `input`, `button`, `label`, `alert`

**Keine zusätzlichen Packages:**
- Kein bcrypt (Supabase handled Passwort-Hashing)
- Kein JWT-Library (Supabase managed Sessions)
- Kein Email-Service (Supabase sendet Verifizierungs-Emails)

### Seiten-Struktur

**Öffentliche Seiten (nicht eingeloggt):**
- `/login` - Login-Formular
- `/register` - Registrierungs-Formular
- `/auth/verify` - Email-Bestätigungs-Callback

**Geschützte Seiten (nur eingeloggt):**
- `/dashboard` - Hauptseite (Podcast-Liste)
- `/settings` - Einstellungen
- Alle anderen Feature-Seiten

**Automatische Redirects:**
- Nicht eingeloggte User → werden zu `/login` weitergeleitet
- Eingeloggte User auf `/login` → werden zu `/dashboard` weitergeleitet
- Nach erfolgreicher Registration → Hinweis-Seite "Prüfe deine Emails"
- Nach Email-Verifizierung → zu `/login` mit Success-Message

## Notizen für Entwickler
- Nutze Supabase Auth Helpers für Next.js (für Server-Side Auth)
- Session State in Context/Provider speichern (für Client-Side)
- Email Templates können später in Supabase Dashboard customized werden
- shadcn/ui Components nutzen: `form`, `input`, `button`, `label`, `alert`
