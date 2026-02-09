import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createAdminClient } from '@/lib/supabase/admin'

const MAX_TRANSCRIPT_CHARS = 150_000 // ~150k chars ≈ safe for Claude context

export const maxDuration = 60 // Vercel Hobby plan

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const openrouter = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
  })

  let generated = 0
  let failed = 0

  try {
    // Fetch transcribed episodes that need newsletter generation
    const { data: episodes, error: fetchError } = await supabase
      .from('episodes')
      .select(`
        id, title, transcript, audio_url, subscription_id,
        podcast_subscriptions!inner(title)
      `)
      .eq('status', 'transcribed')
      .order('published_at', { ascending: true })
      .limit(2) // Max 2 per run (60s timeout on Hobby plan)

    if (fetchError || !episodes) {
      return NextResponse.json(
        { error: 'Failed to fetch episodes', details: fetchError?.message },
        { status: 500 }
      )
    }

    if (episodes.length === 0) {
      return NextResponse.json({ success: true, generated: 0, failed: 0, message: 'No transcribed episodes' })
    }

    // Process sequentially (rate limits)
    for (const episode of episodes) {
      try {
        await generateNewsletter(supabase, openrouter, episode)
        generated++
      } catch {
        failed++
      }
    }

    return NextResponse.json({ success: true, generated, failed })
  } catch (err) {
    return NextResponse.json(
      { error: 'Newsletter generation failed', details: err instanceof Error ? err.message : 'Unknown' },
      { status: 500 }
    )
  }
}

interface EpisodeWithPodcast {
  id: string
  title: string
  transcript: string | null
  audio_url: string
  subscription_id: string
  podcast_subscriptions: { title: string }[]
}

async function generateNewsletter(
  supabase: ReturnType<typeof createAdminClient>,
  openrouter: OpenAI,
  episode: EpisodeWithPodcast
): Promise<void> {
  // Mark as generating
  await supabase
    .from('episodes')
    .update({ status: 'generating_newsletter' })
    .eq('id', episode.id)

  try {
    if (!episode.transcript) {
      throw new PermanentError('Kein Transkript vorhanden')
    }

    const podcastTitle = episode.podcast_subscriptions[0]?.title || 'Podcast'
    // Truncate transcript if too long
    const transcript = episode.transcript.length > MAX_TRANSCRIPT_CHARS
      ? episode.transcript.slice(0, MAX_TRANSCRIPT_CHARS) + '\n\n[Transkript gekürzt]'
      : episode.transcript

    const completion = await openrouter.chat.completions.create({
      model: process.env.OPENROUTER_MODEL || 'anthropic/claude-sonnet-4',
      max_tokens: 2000,
      temperature: 0.7,
      messages: [{
        role: 'user',
        content: `Du bist ein Newsletter-Autor. Erstelle eine strukturierte Zusammenfassung dieser Podcast-Episode.

Podcast: ${podcastTitle}
Episode: ${episode.title}

Transkript:
${transcript}

Erstelle folgende Struktur (exakt diese Überschriften verwenden):

## Intro
[2-3 Sätze Überblick über das Thema der Episode]

## Inhalte
- [5-10 Bullet Points mit den wichtigsten Themen und Aussagen]

## Key Takeaways
- [3-5 wichtigste Erkenntnisse/Highlights]

Schreibe prägnant und leserfreundlich. Mindestens 3 Bullet Points pro Sektion.`
      }]
    })

    const responseText = completion.choices[0]?.message?.content
    if (!responseText) {
      throw new PermanentError('Keine Textantwort vom Modell erhalten')
    }

    const parsed = parseNewsletter(responseText)

    // Save newsletter content
    const { error: insertError } = await supabase
      .from('episode_newsletters')
      .insert({
        episode_id: episode.id,
        intro: parsed.intro,
        bullet_points: parsed.bulletPoints,
        key_takeaways: parsed.keyTakeaways,
      })

    if (insertError) {
      throw new PermanentError(`DB insert failed: ${insertError.message}`)
    }

    // Update status
    await supabase
      .from('episodes')
      .update({ status: 'newsletter_ready', error_message: null })
      .eq('id', episode.id)
  } catch (err) {
    const isPermanent = err instanceof PermanentError

    if (isPermanent) {
      await supabase
        .from('episodes')
        .update({ status: 'newsletter_failed', error_message: (err as Error).message })
        .eq('id', episode.id)
    } else {
      // Temporary error (rate limit, network) – reset for retry
      await supabase
        .from('episodes')
        .update({
          status: 'transcribed',
          error_message: `Temporärer Fehler: ${err instanceof Error ? err.message : 'Unknown'}`,
        })
        .eq('id', episode.id)
    }

    throw err
  }
}

/** Parse markdown response into structured data */
function parseNewsletter(markdown: string): {
  intro: string
  bulletPoints: string[]
  keyTakeaways: string[]
} {
  const introMatch = markdown.match(/## Intro\n([\s\S]*?)(?=\n## )/i)
  const bulletPointsMatch = markdown.match(/## Inhalte\n([\s\S]*?)(?=\n## )/i)
  const keyTakeawaysMatch = markdown.match(/## Key Takeaways\n([\s\S]*?)$/i)

  const intro = introMatch?.[1]?.trim() || markdown.split('\n').slice(0, 3).join(' ').trim()

  const bulletPoints = extractBulletPoints(bulletPointsMatch?.[1] || '')
  const keyTakeaways = extractBulletPoints(keyTakeawaysMatch?.[1] || '')

  // Fallback: if parsing failed, use the whole response as intro
  if (!intro && bulletPoints.length === 0 && keyTakeaways.length === 0) {
    return {
      intro: markdown.trim(),
      bulletPoints: [],
      keyTakeaways: [],
    }
  }

  return { intro, bulletPoints, keyTakeaways }
}

/** Extract bullet points from a markdown section */
function extractBulletPoints(section: string): string[] {
  return section
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- ') || line.startsWith('* '))
    .map((line) => line.replace(/^[-*]\s+/, ''))
    .filter((line) => line.length > 0)
}

class PermanentError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PermanentError'
  }
}
