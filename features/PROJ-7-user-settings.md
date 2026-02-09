# PROJ-7: User Settings

## Status: 🔵 Planned

## Abhängigkeiten
- **Benötigt:** PROJ-1 (User Authentication) - User müssen eingeloggt sein

## Übersicht
User-spezifische Einstellungen für Newsletter-Versand: Newsletter-Email-Adresse und Versandzeit (täglich). Settings werden in Supabase gespeichert und von PROJ-6 (Email Delivery) genutzt.

## User Stories

### Als User möchte ich Newsletter-Einstellungen konfigurieren
- Als **User** möchte ich meine Email-Adresse für Newsletter hinterlegen
- Als **User** möchte ich die tägliche Versandzeit für Newsletter wählen (z.B. "8:00 Uhr morgens")
- Als **User** möchte ich meine Einstellungen jederzeit ändern können

### Als User möchte ich klare Rückmeldungen
- Als **User** möchte ich eine Bestätigung sehen, wenn meine Einstellungen gespeichert wurden
- Als **User** möchte ich Fehlermeldungen sehen, wenn meine Eingaben ungültig sind

## Acceptance Criteria

### Settings Page
- [ ] User hat Zugriff auf `/settings` oder `/dashboard/settings` Page
- [ ] Page ist nur für eingeloggte User zugänglich (Protected Route)
- [ ] Page zeigt aktuelle Settings an (falls bereits gespeichert)

### Newsletter Email Einstellung
- [ ] Input-Feld: "Newsletter-Email-Adresse"
- [ ] Placeholder: User's Login-Email (als Default-Wert)
- [ ] Validation: Email-Format wird geprüft (Client-Side)
- [ ] Save Button: "Einstellungen speichern"

### Newsletter Versandzeit Einstellung
- [ ] Input-Feld: Time Picker oder Dropdown
- [ ] Options: Jede volle Stunde (0:00 - 23:00)
- [ ] Default-Wert: 8:00 (morgens)
- [ ] Timezone-Hinweis: "Alle Zeiten in deiner lokalen Zeitzone" (Frontend konvertiert zu UTC)

### Save Functionality
- [ ] Klick auf "Speichern" speichert Settings in Supabase (`user_settings` Tabelle)
- [ ] Bei erfolgreicher Speicherung: Success Message "Einstellungen gespeichert"
- [ ] Bei Fehler: Error Message (z.B. "Ungültige Email-Adresse")
- [ ] Page reload nicht nötig (optimistic UI update)

### Initial Setup (Onboarding)
- [ ] Nach erfolgreicher Registrierung: Redirect zu Settings Page
- [ ] Hinweis: "Bitte konfiguriere deine Newsletter-Einstellungen"
- [ ] User MUSS Email + Versandzeit eingeben, bevor Dashboard verfügbar ist (oder: optional überspringen)

### Settings Validation
- [ ] Email-Format: Standard Email-Regex
- [ ] Versandzeit: 0-23 (ganze Stunden)
- [ ] Pflichtfelder: Email + Versandzeit (beide required)

## Edge Cases

### Was passiert wenn...?

#### User gibt keine Email-Adresse ein
- **Szenario:** User lässt Email-Feld leer
- **Verhalten:** Error Message "Bitte gib eine Email-Adresse ein"
- **Fallback:** Default = Login-Email (User kann Login-Email als Newsletter-Email nutzen)

#### User gibt ungültige Email-Adresse ein
- **Szenario:** User gibt "test@" oder "test.com" ein
- **Verhalten:** Client-Side Validation: Error Message "Bitte gib eine gültige Email-Adresse ein"

#### User wählt keine Versandzeit
- **Szenario:** User lässt Versandzeit leer
- **Verhalten:** Default: 8:00 (automatisch vorausgewählt)

#### User ändert Versandzeit nach Newsletter-Generierung
- **Szenario:** User ändert Versandzeit von 8:00 auf 10:00
- **Verhalten:** Nächster Newsletter wird zur neuen Zeit (10:00) verschickt
- **Hinweis:** Bereits generierte Newsletter (Status: `newsletter_ready`) werden zur neuen Zeit versendet

#### User gibt Email-Adresse ein, die nicht existiert
- **Szenario:** User gibt typo-Email ein (z.B. "user@gmial.com")
- **Verhalten:** Email-Validierung prüft nur Format, NICHT ob Email existiert
- **Hinweis:** User wird es merken, wenn Newsletter nicht ankommen (dann Settings ändern)

#### User hat keine Settings gespeichert
- **Szenario:** User überspringt Settings-Konfiguration (falls optional)
- **Verhalten:** Keine Newsletter werden versendet (Email Delivery Cronjob skippt User)
- **Hinweis:** Dashboard zeigt Warnung: "Bitte konfiguriere deine Newsletter-Einstellungen"

#### User ist in anderer Timezone (z.B. Berlin statt UTC)
- **Szenario:** User wählt "8:00 Uhr" in Berlin (UTC+1)
- **Verhalten:** Frontend konvertiert zu UTC → speichert "7:00" in DB
- **Backend:** Arbeitet nur mit UTC, Frontend macht Timezone-Conversion
- **Display:** User sieht immer seine lokale Zeit (z.B. "8:00 Berlin")

#### User ändert Email-Adresse zu bereits verwendeter Email
- **Szenario:** User gibt Email ein, die bereits von anderem User genutzt wird
- **Verhalten:** Keine Unique-Constraint (mehrere User können gleiche Newsletter-Email haben)
- **Hinweis:** Für MVP akzeptabel (z.B. Team-Email für mehrere User)

#### User hat mehrere Browser-Tabs offen und ändert Settings in beiden
- **Szenario:** Race Condition bei gleichzeitigen Updates
- **Verhalten:** Letztes Update gewinnt (UPSERT in DB)
- **Hinweis:** Für MVP akzeptabel (selten Edge Case)

## Technische Anforderungen

### Supabase Schema: `user_settings`
```sql
CREATE TABLE user_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  newsletter_email TEXT NOT NULL,
  newsletter_delivery_hour INT NOT NULL CHECK (newsletter_delivery_hour >= 0 AND newsletter_delivery_hour <= 23),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index für Email Delivery Cronjob (PROJ-6)
CREATE INDEX idx_user_settings_delivery_hour ON user_settings(newsletter_delivery_hour);

-- RLS Policies
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- User kann nur eigene Settings sehen
CREATE POLICY "Users can view own settings"
  ON user_settings FOR SELECT
  USING (auth.uid() = user_id);

-- User kann nur eigene Settings erstellen
CREATE POLICY "Users can insert own settings"
  ON user_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- User kann nur eigene Settings updaten
CREATE POLICY "Users can update own settings"
  ON user_settings FOR UPDATE
  USING (auth.uid() = user_id);
```

### Frontend Components
- `SettingsPage` - Main Settings Page (`/settings`)
- `SettingsForm` - Form mit Email + Time Picker
- `TimePicker` - Dropdown oder Input für Stunden-Auswahl (0-23)
- `SaveButton` - Submit Button

### API Routes (optional, alternativ: Supabase Client-Side)
- `PUT /api/settings` - Update User Settings
- `GET /api/settings` - Get User Settings (optional: kann auch client-side via Supabase)

**Alternativ (Recommended):** Direkter Supabase-Client-Zugriff (kein API Route nötig)

### Supabase Client-Side Logic
```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function saveSettings(newsletterEmail: string, deliveryHour: number) {
  const { data, error } = await supabase
    .from('user_settings')
    .upsert({
      user_id: (await supabase.auth.getUser()).data.user?.id,
      newsletter_email: newsletterEmail,
      newsletter_delivery_hour: deliveryHour,
      updated_at: new Date().toISOString(),
    });

  if (error) throw error;
  return data;
}
```

### Timezone Handling (Frontend)
- User wählt Zeit in lokaler Timezone (z.B. "8:00 Berlin")
- Frontend konvertiert zu UTC vor Speicherung:
  ```typescript
  const localHour = 8; // User input
  const utcOffset = new Date().getTimezoneOffset() / 60; // Berlin = -1 (UTC+1)
  const utcHour = (localHour - utcOffset + 24) % 24; // 8 - (-1) = 9 (aber Berlin ist UTC+1, also 7)
  // Besser: Use Intl.DateTimeFormat oder date-fns-tz
  ```
- Display: Konvertiere UTC zurück zu User's Timezone

**Recommended Library:** `date-fns-tz` (für Timezone-Conversion)

### Performance
- Settings-Update: < 500ms (Supabase Insert/Update)
- Settings-Load: < 300ms (Supabase Query)

### Security
- RLS Policies: User kann nur eigene Settings sehen/ändern
- Email-Validation: Client-Side + Database Constraint
- Delivery Hour Constraint: CHECK (0-23) in DB

## Nice-to-Have (nicht für MVP)
- Email-Notifications deaktivieren (On/Off Toggle)
- Newsletter-Sprache auswählen (DE/EN)
- Newsletter-Format (Kurz/Mittel/Lang)
- Newsletter-Frequenz (Täglich/Wöchentlich)
- Email-Verifizierung für Newsletter-Email (wenn anders als Login-Email)
- Multiple Newsletter-Emails (z.B. Work + Personal)
- Timezone-Auswahl (falls User in anderer Zone ist als Browser)

## Tech-Design (Solution Architect)

### Component-Struktur

```
Settings-Seite (/settings)
├── Kopfzeile
│   ├── Titel: "Einstellungen"
│   └── Navigation (zurück zum Dashboard)
│
├── Einstellungs-Formular
│   ├── Newsletter-Email Bereich
│   │   ├── Label: "Newsletter-Email-Adresse"
│   │   ├── Input-Feld (vorausgefüllt mit Login-Email)
│   │   └── Hinweis: "An diese Adresse werden Newsletter verschickt"
│   │
│   ├── Versandzeit Bereich
│   │   ├── Label: "Tägliche Versandzeit"
│   │   ├── Dropdown/Time-Picker (0:00 - 23:00)
│   │   ├── Default: 8:00 Uhr
│   │   └── Hinweis: "In deiner lokalen Zeitzone"
│   │
│   └── Speichern Button
│       └── "Einstellungen speichern"
│
└── Success/Error Nachricht
    ├── Success: "Einstellungen gespeichert"
    └── Error: "Ungültige Email-Adresse"
```

### Daten-Model

**User-Einstellungen haben:**
- Newsletter-Email-Adresse (kann anders sein als Login-Email)
- Versandzeit (Stunde 0-23, gespeichert in UTC)
- Erstellungs-Datum
- Letztes Update-Datum

**Gespeichert in:** Supabase Datenbank (Tabelle: `user_settings`)

**Default-Werte (wenn User noch nichts gespeichert hat):**
- Email = Login-Email
- Versandzeit = 8:00 Uhr (morgens)

### Tech-Entscheidungen

**Warum separate Newsletter-Email?**
- User möchten vielleicht andere Email für Newsletter (z.B. Work vs. Personal)
- Flexibilität für User
- Default ist Login-Email (einfacher für die meisten)

**Warum nur volle Stunden (0-23)?**
- Einfacher für MVP (keine Minuten-Auswahl)
- Cronjob läuft sowieso nur stündlich
- Ausreichend für User-Bedürfnisse

**Warum Timezone-Conversion?**
- User denkt in lokaler Zeit ("8:00 Uhr morgens")
- Server arbeitet in UTC (verhindert Timezone-Chaos)
- Frontend konvertiert automatisch (User merkt nichts)

**Warum Settings-Seite statt Dashboard-Integration?**
- Dedizierte Seite = übersichtlicher
- Settings werden selten geändert (nicht im Weg)
- Kann später erweitert werden (mehr Settings)

**Warum UPSERT statt INSERT?**
- User kann Settings mehrfach speichern (Update statt Fehler)
- Einfacher für User (kein "Settings existieren bereits" Fehler)

**Warum nach Registration zu Settings?**
- User muss Email + Versandzeit konfigurieren
- Sonst keine Newsletter (User wundert sich)
- Einmal-Setup am Anfang

### Dependencies

**Benötigte Packages:**
- `date-fns` oder `date-fns-tz` (Timezone-Conversion)
- Bereits installierte shadcn/ui Components: `form`, `input`, `select`, `button`, `label`, `alert`

**Backend-Logik:**
- Supabase Client (direkter Zugriff, kein API Route nötig)
- UPSERT-Operation (Update oder Insert)

### System-Workflow

**Erster Besuch (nach Registration):**
1. User wird zu `/settings` weitergeleitet
2. Formular zeigt Default-Werte:
   - Email = Login-Email (vorausgefüllt)
   - Versandzeit = 8:00 Uhr
3. User kann ändern oder direkt speichern
4. Nach Speichern → Redirect zu Dashboard

**Spätere Besuche:**
1. User klickt "Einstellungen" in Navigation
2. Formular zeigt gespeicherte Werte
3. User ändert Werte
4. Klick auf "Speichern" → Success-Message

**Validation:**
- Email: Standard-Email-Format (z.B. "test@example.com")
- Versandzeit: Muss 0-23 sein
- Beide Felder sind Pflicht

**Speichern:**
- Frontend konvertiert lokale Zeit → UTC
- Speichert in Supabase via UPSERT
- Success-Message wird angezeigt

### Timezone-Handling

**Beispiel: User in Berlin (UTC+1)**

1. **User wählt:** "8:00 Uhr" (in Berlin)
2. **Frontend konvertiert:** 8:00 Berlin → 7:00 UTC
3. **Speichert in DB:** 7 (als Stunde in UTC)
4. **Beim Laden:**
   - DB hat: 7 (UTC)
   - Frontend konvertiert: 7 UTC → 8:00 Berlin
   - User sieht: "8:00 Uhr"

**Wichtig:** User sieht IMMER seine lokale Zeit!

### Frontend-Komponenten

**Main Components:**
- `SettingsPage` - Haupt-Seite (Layout)
- `SettingsForm` - Formular mit Inputs
- `TimePicker` - Dropdown für Stunden-Auswahl
- `EmailInput` - Email-Eingabefeld mit Validation

**shadcn/ui Components:**
- `form` - Formular-Wrapper
- `input` - Email-Feld
- `select` - Stunden-Dropdown
- `button` - Speichern-Button
- `alert` - Success/Error Messages
- `label` - Beschriftungen

### User-Experience

**User merkt:**
- Einfaches Formular (nur 2 Felder)
- Schnelles Speichern (< 500ms)
- Klare Success-Message
- Zeiten in seiner lokalen Zeitzone

**User kann:**
- Email jederzeit ändern
- Versandzeit jederzeit ändern
- Mehrfach speichern (kein Fehler)

### Onboarding-Flow

**Nach Registration:**
1. Success-Message: "Account erstellt! Bitte konfiguriere deine Newsletter-Einstellungen"
2. Redirect zu `/settings`
3. User gibt Email + Versandzeit ein
4. Speichert → Redirect zu `/dashboard`
5. Hinweis: "Jetzt kannst du Podcasts abonnieren!"

**Optional:** User kann Settings überspringen (dann Default-Werte)

### Backend-Speicherung

**Direkt über Supabase Client:**
- Kein API Route nötig (Frontend → Supabase)
- UPSERT-Query (user_id als Unique Key)
- RLS Policy: User kann nur eigene Settings sehen/ändern

**Sicherheit:**
- Supabase RLS verhindert Zugriff auf fremde Settings
- Email-Validation im Frontend UND Datenbank

## Notizen für Entwickler
- UPSERT statt INSERT (User kann Settings mehrfach speichern)
- Default-Werte: Newsletter-Email = Login-Email, Delivery-Hour = 8
- Timezone-Conversion ist wichtig: User sieht lokale Zeit, DB speichert UTC
- `date-fns-tz` ist ideal für Timezone-Handling (besser als native Date)
- shadcn/ui Components: `form`, `input`, `select`, `button`, `label`, `alert`
- Initial Setup: Nach Registration zu Settings redirecten (oder: Modal mit "Complete Setup")
