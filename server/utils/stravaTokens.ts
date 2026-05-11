import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

const TOKEN_PREFIX = 'enc:v1:'

export interface StoredStravaToken {
  access_token: string
  refresh_token: string
  expires_at: number
  athlete_id?: number
}

interface StravaRefreshResponse {
  access_token: string
  refresh_token: string
  expires_at: number
}

function encryptionSecret(config: ReturnType<typeof useRuntimeConfig>): string {
  const secret = String(config.stravaTokenEncryptionKey || config.renderTicketSecret || '')
  if (!secret) {
    throw createError({ statusCode: 500, message: 'Strava token encryption is not configured' })
  }
  return secret
}

function encryptionKey(config: ReturnType<typeof useRuntimeConfig>): Buffer {
  return createHash('sha256').update(encryptionSecret(config)).digest()
}

function isEncrypted(value: string): boolean {
  return value.startsWith(TOKEN_PREFIX)
}

export function encryptStravaToken(value: string, config: ReturnType<typeof useRuntimeConfig>): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(config), iv)
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [
    TOKEN_PREFIX.slice(0, -1),
    iv.toString('base64url'),
    tag.toString('base64url'),
    ciphertext.toString('base64url'),
  ].join(':')
}

export function decryptStravaToken(value: string, config: ReturnType<typeof useRuntimeConfig>): string {
  if (!isEncrypted(value)) return value
  const [, version, ivRaw, tagRaw, ciphertextRaw] = value.split(':')
  if (version !== 'v1' || !ivRaw || !tagRaw || !ciphertextRaw) {
    throw createError({ statusCode: 500, message: 'Stored Strava token is malformed' })
  }
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(config), Buffer.from(ivRaw, 'base64url'))
  decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'))
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextRaw, 'base64url')),
    decipher.final(),
  ]).toString('utf8')
}

export function encryptedStravaTokenPayload(
  token: StoredStravaToken,
  config: ReturnType<typeof useRuntimeConfig>,
) {
  return {
    access_token: encryptStravaToken(token.access_token, config),
    refresh_token: encryptStravaToken(token.refresh_token, config),
    expires_at: token.expires_at,
    ...(token.athlete_id ? { athlete_id: token.athlete_id } : {}),
  }
}

export function decryptStoredStravaToken(
  token: StoredStravaToken,
  config: ReturnType<typeof useRuntimeConfig>,
): StoredStravaToken {
  return {
    ...token,
    access_token: decryptStravaToken(token.access_token, config),
    refresh_token: decryptStravaToken(token.refresh_token, config),
  }
}

export async function getValidStravaAccessToken(
  userId: string,
  supabase: any,
  config: ReturnType<typeof useRuntimeConfig>,
): Promise<string> {
  const { data: tokenRow, error } = await supabase
    .from('strava_tokens')
    .select('access_token, refresh_token, expires_at')
    .eq('user_id', userId)
    .single()

  if (error || !tokenRow) {
    throw createError({ statusCode: 403, message: 'Strava account not connected' })
  }

  let token = decryptStoredStravaToken(tokenRow as StoredStravaToken, config)
  const needsEncryptionMigration =
    !isEncrypted(String(tokenRow.access_token)) || !isEncrypted(String(tokenRow.refresh_token))
  const nowSec = Math.floor(Date.now() / 1000)
  if (token.expires_at >= nowSec + 300) {
    if (needsEncryptionMigration) {
      await supabase
        .from('strava_tokens')
        .update(encryptedStravaTokenPayload(token, config))
        .eq('user_id', userId)
    }
    return token.access_token
  }

  const refreshed = await $fetch<StravaRefreshResponse>('https://www.strava.com/oauth/token', {
    method: 'POST',
    body: {
      client_id: config.stravaClientId,
      client_secret: config.stravaClientSecret,
      grant_type: 'refresh_token',
      refresh_token: token.refresh_token,
    },
  })

  token = {
    access_token: refreshed.access_token,
    refresh_token: refreshed.refresh_token,
    expires_at: refreshed.expires_at,
  }

  await supabase
    .from('strava_tokens')
    .update(encryptedStravaTokenPayload(token, config))
    .eq('user_id', userId)

  return token.access_token
}
