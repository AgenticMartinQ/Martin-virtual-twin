# Martin Virtual Twin

Personal website and backend shell for Martin's virtual twin.

The app is a Next.js site with:

- A full-screen avatar video intro.
- Visitor chat shell UI.
- A left-side conversation history panel.
- A right-side streaming transcript panel.
- Supabase-backed memory storage.
- ElevenLabs webhook and session endpoints.

## Local Development

Install dependencies:

```bash
pnpm install
```

Create `.env.local` from `.env.example` and fill in the private values:

```bash
cp .env.example .env.local
```

Run the app:

```bash
pnpm dev
```

Build check:

```bash
pnpm build
```

## Key Routes

Website:

```text
/
```

Dynamic variables for starting an ElevenLabs session:

```text
POST /api/elevenlabs/session
```

ElevenLabs post-call webhook:

```text
POST /api/elevenlabs/post-call
```

Production webhook URL after domain setup:

```text
https://www.martinqiao.com/api/elevenlabs/post-call
```

## Environment Variables

Required in Vercel:

```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
MARTIN_USER_ID=martin

ELEVENLABS_AGENT_ID=
NEXT_PUBLIC_ELEVENLABS_AGENT_ID=
ELEVENLABS_API_KEY=
ELEVENLABS_WEBHOOK_SECRET=
```

Do not commit `.env.local`.

## Database

Run this file in Supabase SQL Editor:

```text
supabase/schema.sql
```

The schema creates:

- `users`
- `conversations`
- `memories`
- `memory_profiles`

It also seeds the `martin` user/profile.
