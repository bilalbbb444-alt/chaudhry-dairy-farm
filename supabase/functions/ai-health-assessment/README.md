# ai-health-assessment

Edge Function powering Chaudhry AI Care (AI Animal Health Assistant).

Deployed to Supabase project `ehnpsecmvtntnfooaoha`. Source of truth for the
deployed code is Supabase itself; this copy is kept for version tracking.

## Secrets required
- `GEMINI_API_KEY` — set via Supabase Dashboard → Project Settings → Edge Functions → Secrets.
  Never commit this value.

## Notes
- Model: `gemini-3.6-flash`. Google deprecated `gemini-2.0-flash` (retired 2026-09-11),
  which caused a 502 / "AI Health Assistant is temporarily unavailable" error until updated.
- Auth: caller's JWT is forwarded to PostgREST so existing Row Level Security
  decides what data the request can read. No service-role key is used.
