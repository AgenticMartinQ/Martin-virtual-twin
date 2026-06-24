# Deployment Checklist

## 1. Rotate Secrets Before Production

The Supabase server-side secret was shared during local setup. Before deploying:

1. Open Supabase.
2. Go to Project Settings.
3. Open API Keys / Data API.
4. Rotate or regenerate the secret/service-role key.
5. Use the new key in Vercel.

## 2. Push Project To GitHub

Create a GitHub repository, then push this project.

Make sure these files are not committed:

```text
.env
.env.local
.env*.local
node_modules
.next
```

## 3. Import Into Vercel

1. Open Vercel.
2. Add New Project.
3. Import the GitHub repository.
4. Framework should auto-detect as Next.js.
5. Build command should be `next build`.

## 4. Add Environment Variables In Vercel

Set these for Production, Preview, and Development unless you intentionally want separate values:

```env
SUPABASE_URL=https://peeoccjhbdrbqrugtmig.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<rotated-secret-key>
MARTIN_USER_ID=martin

NEXT_PUBLIC_ELEVENLABS_AGENT_ID=
ELEVENLABS_AGENT_ID=
ELEVENLABS_VOICE_ID=
ELEVENLABS_API_KEY=
ELEVENLABS_WEBHOOK_SECRET=
```

Use the rotated Supabase secret key, not the old local setup key.

## 5. Deploy

Deploy the project from Vercel.

After deployment, test:

```text
https://<your-vercel-project>.vercel.app
https://<your-vercel-project>.vercel.app/api/elevenlabs/session
```

The session endpoint expects a POST request:

```json
{
  "mode": "socialization"
}
```

## 6. Connect Domain

In Vercel:

1. Open Project Settings.
2. Open Domains.
3. Add `www.martinqiao.com`.
4. Add the DNS record Vercel shows at your domain registrar.

Usually this is:

```text
Type: CNAME
Name: www
Value: cname.vercel-dns.com
```

Use the exact value Vercel displays.

Recommended:

1. Also add `martinqiao.com`.
2. Point it to Vercel using the record Vercel shows.
3. Redirect `martinqiao.com` to `www.martinqiao.com`.

## 7. Configure ElevenLabs

After the domain is live, set ElevenLabs post-call webhook URL to:

```text
https://www.martinqiao.com/api/elevenlabs/post-call
```

Then copy the ElevenLabs webhook secret into Vercel:

```env
ELEVENLABS_WEBHOOK_SECRET=
```

Production webhook requests are rejected unless this value is configured. Local development can still accept unsigned mock payloads.

Redeploy after changing environment variables.

## 8. Final Smoke Tests

Confirm:

- Home page loads at `https://www.martinqiao.com`.
- `/api/elevenlabs/session` returns dynamic variables.
- ElevenLabs webhook receives a test call and creates a Supabase conversation.
- Supabase creates a pending memory from the post-call analysis.
