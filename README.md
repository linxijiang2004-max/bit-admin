# bit admin

Admin console for **bit** (image upload → LLM caption candidates → votes).
Separate Next.js app and Vercel project, same Supabase project as bit.

| Section  | Access |
| -------- | ------ |
| Overview | Stats: totals, 14-day generation activity, caption coverage, top captions, most active people, LLM calls by model |
| Media → AI captions | **CREATE / READ / UPDATE / DELETE** AI-generated captions. Filter by published state, text and created date; sort every numeric column; inline edit; typed `DELETE` confirmation; a provenance drawer with every generation step (prompt, model, raw output). New captions can use an existing image, an uploaded file or a pasted https link. |
| Media → Images | Every image with all of its captions. Images with no captions can be deleted (row and Storage file). |
| People   | **READ** profiles with uploads, captions, published captions, publish rate, votes cast and favorites received (counts only) |
| Votes    | **READ** every upvote / downvote, filtered by direction and date range |

All lists paginate server-side at 50 rows.

## The auth wall

Every route is behind two gates:

1. a valid Google OAuth session (`supabase.auth.getUser()`, provider `google`)
2. `rpc('is_superadmin')` returning exactly `true`

`proxy.ts` enforces both on every path except `/login` and `/auth/callback`
(exact match; new routes are gated by default). It is only a convenience:
`requireSuperadmin()` re-checks both gates in the layout, in every page, and
at the top of every Server Action.

## Data access

The app uses only the public anon key; there is no service-role key.

- **Reads** go through RLS as the signed-in superadmin. Sorting by aggregates
  uses `security_invoker` views (`admin_caption_rows`, `admin_people_rows`,
  `admin_image_rows`), so they expose nothing the caller couldn't already read.
- **Writes** go through `SECURITY DEFINER` RPCs that refuse non-superadmins:
  `admin_create_caption`, `admin_update_caption`, `admin_delete_caption`,
  `admin_create_image`, `admin_delete_image`. RLS-blocked writes return 200
  with no rows, so every action reads the row back to confirm the write landed.
- **Favorites** are private in bit. The admin sees counts only, via
  `admin_favorite_counts()`, never who favorited what.
- **Storage** can't be written from SQL. Uploads go to the admin's own folder
  in the `images` bucket (bit's own policy); superadmins may delete files in
  that bucket so a deleted image's public link stops working.

## "Won't I be locked out?"

The admin console requires `profiles.is_superadmin = true`, and the migration
stops anyone from setting that flag through the API. The way in is the
Supabase dashboard: as the project owner, the **SQL editor** runs as the
`postgres` role, which bypasses RLS. Sign in to bit once with Google (the
`on_auth_user_created` trigger creates your profile), then run:

```sql
update public.profiles set is_superadmin = true where email = 'you@example.com';
```

## Setup

1. `cp .env.example .env.local` and fill in the Supabase URL and anon key.
2. Run `supabase/migrations/20261025000000_superadmin_admin_access.sql` in the
   Supabase SQL editor (safe to re-run).
3. In Supabase → Auth → URL Configuration, add
   `http://localhost:3000/auth/callback` and `https://<vercel-domain>/auth/callback`
   to Redirect URLs.
4. `npm install && npm run dev`
