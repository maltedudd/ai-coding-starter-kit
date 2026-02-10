'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    // Validate passwords match
    if (password !== confirmPassword) {
      setError('Passwörter stimmen nicht überein')
      setLoading(false)
      return
    }

    // Validate password length
    if (password.length < 8) {
      setError('Passwort muss mindestens 8 Zeichen lang sein')
      setLoading(false)
      return
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/verify`,
        },
      })

      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }

      // Show success message
      setSuccess(true)
      setLoading(false)
    } catch (err) {
      setError('Ein unerwarteter Fehler ist aufgetreten')
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center container-spacing section-spacing">
        <Card className="w-full max-w-md shadow-sm">
          <CardHeader className="space-y-3 text-center">
            <CardTitle className="text-3xl font-bold">Account erstellt! 🎉</CardTitle>
            <CardDescription className="text-base">
              Fast geschafft - Bestätige jetzt deine Email
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert className="border-accent bg-accent/10">
              <AlertDescription className="text-center text-accent-foreground">
                Wir haben dir eine Bestätigungs-Email gesendet. Bitte klicke auf den Link in der Email, um deinen Account zu aktivieren.
              </AlertDescription>
            </Alert>

            <div className="space-y-3 text-sm text-muted-foreground">
              <p className="text-center">
                Nach der Bestätigung wirst du automatisch zu deinen Einstellungen weitergeleitet, wo du:
              </p>
              <ul className="space-y-2 text-left list-disc list-inside">
                <li>Deine Newsletter-Email-Adresse festlegen kannst</li>
                <li>Deine bevorzugte Versandzeit wählst</li>
                <li>Danach Podcasts abonnieren kannst</li>
              </ul>
            </div>

            <p className="text-sm text-muted-foreground text-center pt-2">
              Email nicht erhalten? Überprüfe deinen Spam-Ordner.
            </p>
          </CardContent>
          <CardFooter className="flex justify-center">
            <Link href="/login">
              <Button variant="outline">Zurück zur Anmeldung</Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center container-spacing section-spacing">
      <Card className="w-full max-w-md shadow-sm">
        <CardHeader className="space-y-3 text-center">
          <CardTitle className="text-3xl font-bold">Account erstellen</CardTitle>
          <CardDescription className="text-base">
            Erstelle deinen Castletter-Account und erhalte täglich Newsletter zu deinen Lieblings-Podcasts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRegister} className="form-spacing">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">
                Email-Adresse
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="deine@email.de"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">
                Passwort
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="Mindestens 8 Zeichen"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                className="h-11"
              />
              <p className="text-xs text-muted-foreground">
                Mindestens 8 Zeichen
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-sm font-medium">
                Passwort bestätigen
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Passwort wiederholen"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={loading}
                className="h-11"
              />
            </div>

            <Button
              type="submit"
              className="w-full h-11 mt-4"
              disabled={loading}
            >
              {loading ? 'Account wird erstellt...' : 'Account erstellen'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <div className="text-sm text-center text-muted-foreground">
            Bereits registriert?{' '}
            <Link
              href="/login"
              className="font-medium text-primary hover:text-primary/80 transition-colors"
            >
              Jetzt anmelden
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}
