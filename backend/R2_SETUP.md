# Dispatch: persistent media with private Cloudflare R2

This backend supports two modes via `MEDIA_STORAGE_BACKEND`:

- `local` (default): existing behavior for development; **NOT persistent on Render free**.
- `r2`: attachments and avatars are written to a **private Cloudflare R2 bucket**. Downloads remain proxied through `/api/media/files/{fileName}` and `/uploads/{fileName}`, preserving Dispatch's existing authorization checks.

## Cloudflare setup

1. In Cloudflare Dashboard > R2 > Create bucket, choose **Standard** storage and a name such as `dispatch-media`. Keep the bucket **private**.
2. Open R2 > Manage R2 API Tokens > Create R2 API token. Choose **Object Read & Write** and restrict permissions to this one bucket.
3. Copy the Access Key ID and Secret Access Key to a password manager. The Secret Access Key may be shown only once. Do not paste it into code, Git, chat, screenshots or TiDB.
4. Find the Cloudflare **Account ID** (32 hexadecimal characters) in the Cloudflare dashboard.

## Render service: Environment

Configure the following environment variables privately in your Render **backend** service:

| Name | Value |
| --- | --- |
| `R2_ACCOUNT_ID` | Cloudflare account ID |
| `R2_BUCKET` | The bucket name, e.g. `dispatch-media` |
| `R2_ACCESS_KEY_ID` | R2 API token's Access Key ID |
| `R2_SECRET_ACCESS_KEY` | R2 API token's Secret Access Key |
| `MEDIA_STORAGE_BACKEND` | `r2` |
| `SPRING_SERVLET_MULTIPART_MAX_FILE_SIZE` | `25MB` |
| `SPRING_SERVLET_MULTIPART_MAX_REQUEST_SIZE` | `30MB` |

**IMPORTANT:** Set all four R2 variables first, then set `MEDIA_STORAGE_BACKEND=r2`. Missing R2 credentials intentionally cause application startup to fail instead of silently using ephemeral local storage.

Render will redeploy after saving environment values.

No Cloudflare public bucket URL, custom domain, or browser-facing R2 credentials are required. Use the regular Render-hosted backend API.

## Validation

1. Run backend tests: `./mvnw.cmd "-Dtest=FileStorageSha256ValidationTest,MediaControllerSecurityTest" test` (Windows PowerShell in `backend/`). Also run `./mvnw.cmd clean package` and confirm BUILD SUCCESS.
2. Ensure the deployed backend starts and users can send/receive a **new** image and a `.txt` file. In Network, the upload response should include a SHA-256 matching the request hash.
3. In R2 Dashboard, verify the bucket contains `dispatch/attachment-...` for the new image. Files remain private.
4. Restart/redeploy the backend and reload Dispatch. Check that the **same image** still loads in both user accounts.
5. Test that an unauthenticated user, or a user outside the conversation, cannot download its attachments.

## Existing images and failures

- **Files uploaded before switching to R2 are NOT automatically moved.** Messages in TiDB can still refer to media that disappeared from ephemeral Render disk; those objects cannot be reconstructed from TiDB or SHA-256. Re-upload them from an original copy.
- If an object is absent in R2, backend checks for a surviving local legacy file as a migration fallback; missing files return HTTP 404 rather than 500.
- If R2 is unreachable, uploads/downloads fail with HTTP 503 rather than being silently stored in local ephemeral storage.
- Keep backups and limit token scope. R2 Standard free allowance is subject to current Cloudflare pricing and account/billing requirements.
- SHA-256 checks upload integrity but does **not** encrypt files or authenticate the hash against a malicious client.

## Architecture

Browser -> Dispatch Spring Boot authenticated media endpoint -> SHA-256 check -> R2 private bucket.

On read: browser -> Spring Boot media endpoint -> existing authorization -> R2 `getObject` -> stream to requester.

The database continues storing only the relative media URL and chat metadata. AES-GCM and ElGamal message processing are unchanged.
