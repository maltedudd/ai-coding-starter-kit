/**
 * Email HTML template generator for daily newsletter digest
 * Uses inline styles for maximum email client compatibility
 */

interface NewsletterItem {
  podcastTitle: string
  episodeTitle: string
  intro: string
  bulletPoints: string[]
  keyTakeaways: string[]
  audioUrl: string
}

const COLORS = {
  primary: '#042940',
  secondary: '#005C53',
  accent: '#9FC131',
  highlight: '#DBF227',
  muted: '#D6D58E',
  bg: '#ffffff',
  border: '#eeeeee',
  textMuted: '#666666',
}

export function generateEmailHTML(
  userEmail: string,
  newsletters: NewsletterItem[],
  settingsUrl: string
): string {
  const episodeBlocks = newsletters
    .map((item) => generateEpisodeBlock(item))
    .join('')

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Deine neuen Podcast-Updates</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f9f9f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: ${COLORS.bg};">

    <!-- Header -->
    <tr>
      <td style="padding: 40px 30px 20px; text-align: center; background-color: ${COLORS.primary};">
        <h1 style="margin: 0; color: ${COLORS.bg}; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">Podletter</h1>
        <p style="margin: 8px 0 0; color: ${COLORS.muted}; font-size: 14px;">Deine täglichen Podcast-Highlights</p>
      </td>
    </tr>

    <!-- Greeting -->
    <tr>
      <td style="padding: 30px 30px 10px;">
        <p style="margin: 0; color: ${COLORS.primary}; font-size: 16px; line-height: 1.6;">
          Hallo,<br>hier sind deine neuen Podcast-Zusammenfassungen:
        </p>
      </td>
    </tr>

    <!-- Episode Blocks -->
    ${episodeBlocks}

    <!-- Footer -->
    <tr>
      <td style="padding: 30px; border-top: 1px solid ${COLORS.border};">
        <p style="margin: 0 0 10px; color: ${COLORS.textMuted}; font-size: 12px; text-align: center;">
          Diese Email wurde an ${userEmail} gesendet.
        </p>
        <p style="margin: 0; text-align: center;">
          <a href="${settingsUrl}" style="color: ${COLORS.secondary}; font-size: 12px; text-decoration: underline;">Einstellungen ändern</a>
        </p>
      </td>
    </tr>

  </table>
</body>
</html>`
}

function generateEpisodeBlock(item: NewsletterItem): string {
  const bulletPointsHTML = item.bulletPoints
    .map((bp) => `<li style="margin-bottom: 6px; color: ${COLORS.primary}; font-size: 14px; line-height: 1.5;">${escapeHtml(bp)}</li>`)
    .join('')

  const keyTakeawaysHTML = item.keyTakeaways
    .map((kt) => `<li style="margin-bottom: 6px; color: ${COLORS.primary}; font-size: 14px; line-height: 1.5; font-weight: 500;">${escapeHtml(kt)}</li>`)
    .join('')

  return `
    <tr>
      <td style="padding: 20px 30px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border: 1px solid ${COLORS.border}; border-radius: 8px; overflow: hidden;">
          <!-- Episode Header -->
          <tr>
            <td style="padding: 20px; background-color: ${COLORS.primary};">
              <p style="margin: 0 0 4px; color: ${COLORS.muted}; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">${escapeHtml(item.podcastTitle)}</p>
              <h2 style="margin: 0; color: ${COLORS.bg}; font-size: 18px; font-weight: 600;">${escapeHtml(item.episodeTitle)}</h2>
            </td>
          </tr>

          <!-- Intro -->
          <tr>
            <td style="padding: 20px 20px 10px;">
              <p style="margin: 0; color: ${COLORS.primary}; font-size: 15px; line-height: 1.6;">${escapeHtml(item.intro)}</p>
            </td>
          </tr>

          ${bulletPointsHTML ? `
          <!-- Bullet Points -->
          <tr>
            <td style="padding: 10px 20px;">
              <h3 style="margin: 0 0 8px; color: ${COLORS.secondary}; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Inhalte</h3>
              <ul style="margin: 0; padding-left: 20px;">
                ${bulletPointsHTML}
              </ul>
            </td>
          </tr>` : ''}

          ${keyTakeawaysHTML ? `
          <!-- Key Takeaways -->
          <tr>
            <td style="padding: 10px 20px;">
              <h3 style="margin: 0 0 8px; color: ${COLORS.accent}; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Key Takeaways</h3>
              <ul style="margin: 0; padding-left: 20px;">
                ${keyTakeawaysHTML}
              </ul>
            </td>
          </tr>` : ''}

          <!-- CTA Button -->
          <tr>
            <td style="padding: 15px 20px 20px;">
              <a href="${escapeHtml(item.audioUrl)}" style="display: inline-block; background-color: ${COLORS.secondary}; color: ${COLORS.bg}; padding: 10px 24px; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 500;">
                &#9654; Höre die Episode
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>`
}

/** Generate plain text version as fallback */
export function generateEmailPlainText(
  newsletters: NewsletterItem[],
  settingsUrl: string
): string {
  const blocks = newsletters.map((item) => {
    const bullets = item.bulletPoints.map((bp) => `  • ${bp}`).join('\n')
    const takeaways = item.keyTakeaways.map((kt) => `  ★ ${kt}`).join('\n')

    return `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${item.podcastTitle}
${item.episodeTitle}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${item.intro}

INHALTE:
${bullets}

KEY TAKEAWAYS:
${takeaways}

→ Höre die Episode: ${item.audioUrl}
`
  })

  return `Deine neuen Podcast-Updates
===========================

Hallo,
hier sind deine neuen Podcast-Zusammenfassungen:

${blocks.join('\n')}
---
Einstellungen ändern: ${settingsUrl}
`
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
