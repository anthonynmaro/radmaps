# OAuth Branding And Redirect Runbook

RadMaps uses two OAuth paths:

- Google sign-in through Supabase Auth.
- Strava sign-in/import through RadMaps server routes, followed by a Supabase magic-link session handoff.

The goal is that users see RadMaps domains and branding during auth, not the raw Supabase project host (`jzwpiifddtgxbfmdfqco.supabase.co`) or localhost callback URLs.

## Current Target Domains

| Purpose | URL |
|---|---|
| Production app | `https://radmaps.studio` |
| Supabase Auth custom domain | `https://auth.radmaps.studio` |
| Supabase OAuth callback | `https://auth.radmaps.studio/auth/v1/callback` |
| Strava OAuth callback | `https://radmaps.studio/api/strava/callback` |
| App auth confirm page | `https://radmaps.studio/auth/confirm` |

## Required Platform State

### DNS

`radmaps.studio` currently uses Cloudflare nameservers:

- `gabe.ns.cloudflare.com`
- `lindsey.ns.cloudflare.com`

Vercel DNS records for `radmaps.studio` are not authoritative while those nameservers are active. Do not rely on `vercel dns add` alone for OAuth custom-domain verification.

Create these records in the active Cloudflare zone:

| Name | Type | Value | Notes |
|---|---|---|---|
| `auth` | `CNAME` | `jzwpiifddtgxbfmdfqco.supabase.co` | DNS-only, not proxied, for Supabase custom domain verification |
| `_acme-challenge.auth` | `TXT` | value returned by Supabase | Created after `supabase domains create` |

Keep Vercel nameserver migration out of this task unless every Cloudflare-dependent record and Worker custom domain has been audited. Moving nameservers can break `tiles.radmaps.studio`.

### Supabase

Use a Supabase access token or Dashboard owner/admin access.

1. Create the custom domain:

   ```bash
   supabase domains create \
     --project-ref jzwpiifddtgxbfmdfqco \
     --custom-hostname auth.radmaps.studio \
     --output json
   ```

2. Add the returned `_acme-challenge.auth.radmaps.studio` TXT record to Cloudflare.
3. Reverify until Supabase reports the certificate is ready:

   ```bash
   supabase domains reverify --project-ref jzwpiifddtgxbfmdfqco
   ```

4. Before activation, confirm provider callbacks are ready:
   - Google OAuth has both old and new Supabase callback URLs.
   - Supabase Auth redirect allow list includes `https://radmaps.studio/auth/confirm`.
   - The Magic Link email template uses the RadMaps confirm route, not
     `{{ .ConfirmationURL }}`:

     ```html
     <a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=magiclink">
       Sign in to RadMaps
     </a>
     ```

     `{{ .ConfirmationURL }}` visibly points at the Supabase Auth verify host.
     RadMaps verifies the app-owned `token_hash` link on `/auth/confirm`.

5. Activate only after the checks above:

   ```bash
   supabase domains activate --project-ref jzwpiifddtgxbfmdfqco
   ```

Do not activate the Supabase custom domain early. Supabase Auth advertises the custom callback immediately after activation, and Google sign-in can fail if Google has not been configured for the new callback.

### Google Auth Platform

In the Google OAuth client:

- Authorized JavaScript origins:
  - `https://radmaps.studio`
- Authorized redirect URIs:
  - `https://jzwpiifddtgxbfmdfqco.supabase.co/auth/v1/callback`
  - `https://auth.radmaps.studio/auth/v1/callback`

In Google Auth Platform Branding and Verification:

- App name: `RadMaps`
- App domain: `radmaps.studio`
- Logo: RadMaps logo
- Support email: RadMaps support/account email
- Privacy policy: `https://radmaps.studio/privacy-policy`
- Terms: `https://radmaps.studio/terms-of-service`

Google brand verification may take a few business days. Custom domain and verified branding are separate improvements; do both for best trust signals.

### Strava

In the Strava API application settings:

- Application name: `RadMaps`
- Website: `https://radmaps.studio`
- Authorization Callback Domain: `radmaps.studio`

The app sends the concrete redirect URI as:

```text
https://radmaps.studio/api/strava/callback
```

The Strava callback must remain inside the configured callback domain. Localhost and `127.0.0.1` are allowed by Strava for local development.

### Vercel

Production environment variables should include:

```dotenv
APP_URL=https://radmaps.studio
NUXT_PUBLIC_SITE_URL=https://radmaps.studio
STRAVA_REDIRECT_URI=https://radmaps.studio/api/strava/callback
SUPABASE_URL=https://auth.radmaps.studio
```

Only set `SUPABASE_URL=https://auth.radmaps.studio` after the Supabase custom domain is verified and activated. Until then, keep:

```dotenv
SUPABASE_URL=https://jzwpiifddtgxbfmdfqco.supabase.co
```

After changing Vercel env vars, redeploy from the latest production deployment or a clean commit:

```bash
vercel redeploy <latest-production-deployment-url> --target production
```

Prefer redeploying an existing deployment when the local worktree has unrelated changes.

## App Guardrails

The Nuxt Supabase redirect middleware must not protect the Strava OAuth entry points. These routes are part of sign-in:

- `/api/strava/connect`
- `/api/strava/callback`

Keep both routes in `supabase.redirectOptions.exclude` in `nuxt.config.ts`.

Do not replace the Strava session handoff with a direct client token write. The current flow exchanges Strava tokens server-side, creates or updates the Supabase user, then uses a Supabase-generated one-time magic link to establish the browser session.

## Verification

### Local Strava Redirect

Start Nuxt:

```bash
npm run dev -- --host 127.0.0.1 --port 3001
```

Check that the browser GET reaches Strava instead of bouncing to login:

```bash
curl -s -D - -o /dev/null \
  'http://127.0.0.1:3001/api/strava/connect?return_to=%2Fcreate' \
  | awk 'BEGIN{IGNORECASE=1} /^HTTP\// || /^location:/ {print}'
```

Expected:

```text
HTTP/1.1 302 Found
location: https://www.strava.com/oauth/authorize?...redirect_uri=http%3A%2F%2F127.0.0.1%3A3001%2Fapi%2Fstrava%2Fcallback...
```

`HEAD` requests are not a valid test for this route; it implements browser `GET`.

### Production Strava Redirect

After deployment:

```bash
curl -s -D - -o /dev/null \
  'https://radmaps.studio/api/strava/connect?return_to=%2Fcreate' \
  | awk 'BEGIN{IGNORECASE=1} /^HTTP\// || /^location:/ {print}'
```

Expected location contains:

```text
https://www.strava.com/oauth/authorize
redirect_uri=https%3A%2F%2Fradmaps.studio%2Fapi%2Fstrava%2Fcallback
```

### Google OAuth URL

After Supabase activation and Vercel redeploy, the Google OAuth flow should advertise:

```text
https://auth.radmaps.studio/auth/v1/callback
```

Google may show `RadMaps` from verified app branding, `auth.radmaps.studio` from the custom domain, or both depending on the account state and consent-screen step. It should not show `jzwpiifddtgxbfmdfqco.supabase.co`.

### Automated Tests

Run:

```bash
npm run test -- tests/oauth-branding-config.test.ts
npm run typecheck
```
