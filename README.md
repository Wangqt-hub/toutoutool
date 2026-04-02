# toutoutool

`toutoutool` now runs as `EdgeOne Pages + CloudBase backend`.

## Architecture

- Frontend and Next.js BFF: EdgeOne Pages
- Auth: CloudBase SMS login on the browser, then app-owned HttpOnly session cookie
- Relational data: CloudBase MySQL (`default` / `love-0g6vbu3reb419ea6`)
- Object storage: CloudBase storage bucket `6c6f-love-0g6vbu3reb419ea6-1323186887`
- Business functions:
  - `toutoutool-user`
  - `toutoutool-bead`
- AI image pipeline: CloudRun service `toutoutool-ai`

## CloudBase Resources

- Environment ID: `love-0g6vbu3reb419ea6`
- Region: `ap-shanghai`
- MySQL tables:
  - `profiles`
  - `travel_plans`
  - `idea_box`
  - `bead_workspaces`
  - `user_current_workspaces`
  - `bead_ai_generations`
  - `user_active_generations`
- Cloud Functions:
  - `toutoutool-user`
  - `toutoutool-bead`
- CloudRun:
  - `toutoutool-ai`
- CloudRun public domain:
  - `https://toutoutool-ai-240787-8-1323186887.sh.run.tcloudbase.com`

## Auth Strategy

- Web login uses `@cloudbase/js-sdk` SMS OTP on `/login` and `/register`
- After CloudBase returns an access token, the site exchanges it at `/api/auth/session`
- Route protection is based on the app cookie `tt_session`
- CloudBase login strategy has been tightened to:
  - SMS login enabled
  - phone login enabled
  - email login disabled
  - anonymous login disabled
  - username/password login disabled
- Existing WeChat Mini Program providers in this environment were left untouched

## EdgeOne Environment Variables

Configure these in EdgeOne Pages for the production project:

- `NEXT_PUBLIC_CLOUDBASE_ENV_ID`
- `NEXT_PUBLIC_CLOUDBASE_REGION`
- `NEXT_PUBLIC_CLOUDBASE_ACCESS_KEY`
- `CLOUDBASE_ENV_ID`
- `CLOUDBASE_REGION`
- `CLOUDBASE_SERVER_API_KEY`
- `CLOUDBASE_AI_SERVICE_NAME`
- `SESSION_SECRET`
- `INTERNAL_API_SECRET`
- `DASHSCOPE_API_KEY`
- `SITE_URL`

Use `.env.local.example` as the template for local development.

## Deployment Notes

- EdgeOne Pages should stay connected to Git and auto-deploy from the main branch.
- The Next.js app keeps `middleware` and `/api/*` routes, so do not switch this repository to CloudBase static hosting.
- Cloud Functions and CloudRun are already provisioned in the CloudBase environment above.
- If you redeploy backend resources from local code:
  - Cloud Functions source: `cloudfunctions/`
  - CloudRun source: `cloudrun/toutoutool-ai/`

## Runtime Boundaries

- Browser never writes directly to MySQL.
- Browser never uploads private AI assets directly to CloudBase storage.
- All sensitive writes go through Next `/api` routes, Cloud Functions, or CloudRun.
- AI history image reads are proxied through `/api/ai-generate/history/[id]/image`.
