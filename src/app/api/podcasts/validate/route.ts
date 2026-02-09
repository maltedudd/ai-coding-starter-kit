import { NextRequest, NextResponse } from 'next/server'
import Parser from 'rss-parser'
import { createClient } from '@/lib/supabase/server'

const parser = new Parser()

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })
    }

    const body = await request.json()
    const { feedUrl } = body

    if (!feedUrl || typeof feedUrl !== 'string') {
      return NextResponse.json(
        { error: 'Bitte gib eine gültige URL ein' },
        { status: 400 }
      )
    }

    // Basic URL validation
    let url: URL
    try {
      url = new URL(feedUrl)
    } catch {
      return NextResponse.json(
        { error: 'Bitte gib eine gültige URL ein (z.B. https://...)' },
        { status: 400 }
      )
    }

    if (!['http:', 'https:'].includes(url.protocol)) {
      return NextResponse.json(
        { error: 'Bitte gib eine gültige URL ein (z.B. https://...)' },
        { status: 400 }
      )
    }

    // SSRF protection: block private/internal IP ranges
    const hostname = url.hostname.toLowerCase()
    if (isPrivateHost(hostname)) {
      return NextResponse.json(
        { error: 'Diese URL ist nicht erlaubt' },
        { status: 400 }
      )
    }

    // Fetch RSS feed manually to handle malformed XML
    let feed
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10_000)
      const response = await fetch(feedUrl, { signal: controller.signal })
      clearTimeout(timeout)

      if (!response.ok) {
        return NextResponse.json(
          { error: 'RSS-Feed konnte nicht geladen werden. Bitte prüfe die URL.' },
          { status: 422 }
        )
      }

      const xml = await response.text()
      feed = await parser.parseString(xml)
    } catch (err) {
      const message = err instanceof Error ? err.message : ''
      if (message.includes('ENOTFOUND') || message.includes('ETIMEDOUT') || message.includes('abort') || message.includes('fetch')) {
        return NextResponse.json(
          { error: 'RSS-Feed konnte nicht geladen werden. Bitte prüfe die URL.' },
          { status: 422 }
        )
      }
      return NextResponse.json(
        { error: 'Das ist kein gültiger Podcast-RSS-Feed' },
        { status: 422 }
      )
    }

    if (!feed.title) {
      return NextResponse.json(
        { error: 'Das ist kein gültiger Podcast-RSS-Feed' },
        { status: 422 }
      )
    }

    // Extract cover image: try itunes image first, then feed.image
    const coverImageUrl =
      feed.itunes?.image ??
      feed.image?.url ??
      null

    return NextResponse.json({
      title: feed.title,
      description: feed.description || null,
      coverImageUrl,
      feedUrl,
    })
  } catch {
    return NextResponse.json(
      { error: 'Ein unerwarteter Fehler ist aufgetreten' },
      { status: 500 }
    )
  }
}

function isPrivateHost(hostname: string): boolean {
  // Block localhost
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
    return true
  }

  // Block common private/metadata hostnames
  if (hostname === 'metadata.google.internal' || hostname.endsWith('.internal')) {
    return true
  }

  // Block private IP ranges
  const parts = hostname.split('.').map(Number)
  if (parts.length === 4 && parts.every((p) => !isNaN(p) && p >= 0 && p <= 255)) {
    const [a, b] = parts
    if (a === 10) return true                          // 10.0.0.0/8
    if (a === 172 && b >= 16 && b <= 31) return true   // 172.16.0.0/12
    if (a === 192 && b === 168) return true            // 192.168.0.0/16
    if (a === 169 && b === 254) return true            // 169.254.0.0/16 (AWS metadata)
    if (a === 0) return true                           // 0.0.0.0/8
    if (a === 127) return true                         // 127.0.0.0/8
  }

  return false
}
