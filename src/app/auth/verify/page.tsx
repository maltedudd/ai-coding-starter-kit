'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

export default function VerifyEmailPage() {
  const [verifying, setVerifying] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const router = useRouter()
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null)

  function getSupabase() {
    if (!supabaseRef.current) {
      supabaseRef.current = createClient()
    }
    return supabaseRef.current
  }

  useEffect(() => {
    const supabase = getSupabase()
    const verifyEmail = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()

        if (user?.email_confirmed_at) {
          setSuccess(true)
          setVerifying(false)
          setTimeout(() => {
            router.push('/settings')
          }, 2000)
          return
        }

        setVerifying(false)
      } catch (err) {
        setError('Email-Bestätigung fehlgeschlagen')
        setVerifying(false)
      }
    }

    verifyEmail()
  }, [router])

  // Listen for auth state changes
  useEffect(() => {
    const supabase = getSupabase()
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user.email_confirmed_at) {
          setSuccess(true)
          setVerifying(false)
          setTimeout(() => {
            router.push('/settings')
          }, 2000)
        }
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [router])

  if (verifying) {
    return (
      <div className="min-h-screen flex items-center justify-center container-spacing section-spacing">
        <Card className="w-full max-w-md shadow-sm">
          <CardHeader className="space-y-3 text-center">
            <CardTitle className="text-3xl font-bold">Email wird bestätigt...</CardTitle>
            <CardDescription className="text-base">
              Einen Moment bitte
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center container-spacing section-spacing">
        <Card className="w-full max-w-md shadow-sm">
          <CardHeader className="space-y-3 text-center">
            <CardTitle className="text-3xl font-bold">Bestätigung fehlgeschlagen</CardTitle>
            <CardDescription className="text-base">
              Es gab ein Problem bei der Email-Bestätigung
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter className="flex flex-col space-y-3">
            <Link href="/login" className="w-full">
              <Button variant="outline" className="w-full">
                Zur Anmeldung
              </Button>
            </Link>
            <p className="text-sm text-muted-foreground text-center">
              Probleme? Kontaktiere unseren Support
            </p>
          </CardFooter>
        </Card>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center container-spacing section-spacing">
        <Card className="w-full max-w-md shadow-sm">
          <CardHeader className="space-y-3 text-center">
            <CardTitle className="text-3xl font-bold">Email bestätigt!</CardTitle>
            <CardDescription className="text-base">
              Dein Account wurde erfolgreich aktiviert
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertDescription className="text-center">
                Du wirst automatisch zu deinen Einstellungen weitergeleitet...
              </AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter className="flex justify-center">
            <Link href="/settings">
              <Button>Zu den Einstellungen</Button>
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
          <CardTitle className="text-3xl font-bold">Bestätige deine Email</CardTitle>
          <CardDescription className="text-base">
            Überprüfe dein Email-Postfach
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertDescription className="text-center">
              Bitte klicke auf den Link in der Email, die wir dir gesendet haben, um deinen Account zu aktivieren.
            </AlertDescription>
          </Alert>
          <p className="text-sm text-muted-foreground text-center">
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
