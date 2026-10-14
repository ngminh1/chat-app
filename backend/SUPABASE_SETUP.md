# Dispatch — Supabase Storage Free (no credit card)

This setup only stores media. **MySQL/TiDB remains the database.** Do not migrate messages, users, AES keys or ElGamal keys.

## Supabase

1. Create a free project at https://supabase.com/dashboard.
2. Go to Storage -> New bucket. Name it `dispatch-media`, keep **Public bucket OFF**, and choose a per-file limit of 25 MB (or higher within the Free tier).
3. Go to Project Settings -> API Keys. Copy the **server-side secret key** (`sb_secret_...`) and the Project URL from API/Connect. Never use a publishable or anon key for backend uploads.

## Render > chatapp-backend > Environment

| Key | Value |
| --- | --- |
| `SUPABASE_URL` | `https://YOUR_PROJECT_REF.supabase.co` |
| `SUPABASE_BUCKET` | `dispatch-media` |
| `SUPABASE_SECRET_KEY` | Secret API key (`sb_secret_...`) |
| `MEDIA_STORAGE_BACKEND` | `supabase` |
| `SPRING_SERVLET_MULTIPART_MAX_FILE_SIZE` | `25MB` |
| `SPRING_SERVLET_MULTIPART_MAX_REQUEST_SIZE` | `30MB` |

**Wait until the branch is merged and deployed BEFORE setting `MEDIA_STORAGE_BACKEND=supabase`.**
Otherwise the current production version would keep storing files on Render local disk.

The private bucket is accessed only from Spring Boot after existing Dispatch authorization.
Never put `SUPABASE_SECRET_KEY` in GitHub, Vercel frontend, browser code, SQL, screenshots, or chat. 
Uploads are checked by SHA-256 before storage. New objects are stored as `dispatch/attachment-...`.

## Verify

1. CI backend compile/test checks must be green.
2. After deployment, send an image and text file between two independent browser sessions.
3. Confirm both users can open the file and `/api/media/upload` response contains a SHA-256 digest matching the request.
4. Inspect Storage bucket for `dispatch/attachment-...`.
5. Restart Render backend; reload and verify the same image remains visible.
6. Check an unauthenticated user and a non-member cannot download that private attachment.

## Important restrictions

- Old files missing from Render local storage CANNOT be recovered from TiDB or SHA-256. Reupload them from original copies.
- This service does not change AES-GCM, ElGamal, chat encryption or DB schema.
- Supabase Free has 1 GB storage, 5 GB monthly outgoing traffic, and may pause when inactive for seven days.
- A failed Supabase request returns a 503; missing objects return 404.
- Keep backups of important uploads and never turn the bucket public.
- The upload endpoint uses standard single-request transfers. For large files, 6+ MB, Supabase recommends resumable uploads; Dispatch currently accepts up to 25 MB.
