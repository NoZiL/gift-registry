# Deploy Plan: Baby Registry App

Feed this whole file to a Claude Code session running on a machine with a
terminal, a browser the human can drive, and internet access. It picks up
where a prior session left off: the app itself is already built and tested
(`baby-registry.zip`) — what's left is standing up the real Google Sheet,
Google Cloud service account, and a live deployment.

Work through the steps in order. Where a step needs a human decision or a
browser-based login only a human can complete (OAuth consent screens,
account selection), **stop and ask** rather than guessing — this app holds
real credentials and will be shared with real guests, so getting the setup
right matters more than moving fast.

Never print the service account private key, the admin password, or any
`.env` contents to chat/logs in full — treat them as secrets throughout.

## 0. Prerequisites — confirm before starting

Ask the human for anything below that isn't already obvious from context:

- Which Google account to use for Cloud Console + the Sheet (Cloud Platform
  project creation and Sheets API both work on the free tier — no billing
  account should be required for this scale).
- Whether they already have `gcloud` and `vercel` CLIs installed
  (`gcloud --version`, `vercel --version`) and are logged in
  (`gcloud auth list`, `vercel whoami`). If not, install and prompt them to
  complete the login flow in their browser, then continue.
- Their preferred admin password for `/admin` (used to generate guest
  links/QR codes).
- Whether they have an actual gift list ready to seed the sheet, or want to
  start with just the header row and add items themselves later.
- Confirm the hosting target is Vercel. If they'd rather use something else
  (Netlify, Render, self-host), stop and adapt steps 5–7 accordingly instead
  of assuming Vercel.

## 1. Get the project on disk

```bash
mkdir -p ~/projects/baby-registry && cd ~/projects/baby-registry
unzip /path/to/baby-registry.zip -d .
# if the zip nests a baby-registry/ folder inside, flatten it so
# package.json ends up at ~/projects/baby-registry/package.json
npm install
```

Read `README.md` in the project root first — it documents the app's
architecture (public reserve page, `/admin` link+QR generator, the Sheets
data layer) so you have full context before touching infra.

If the zip isn't available in this session, ask the human to provide it
(it was delivered to them earlier) rather than reconstructing the app from
scratch.

## 2. Google Cloud: service account + Sheets API

Use the CLI so this is scripted, not click-through:

```bash
gcloud auth login   # human completes browser OAuth if not already logged in

# Create a fresh project (or ask the human if they'd rather reuse one)
PROJECT_ID="baby-registry-$(date +%s)"
gcloud projects create "$PROJECT_ID" --name="Baby Registry"
gcloud config set project "$PROJECT_ID"

gcloud services enable sheets.googleapis.com

gcloud iam service-accounts create baby-registry \
  --display-name="Baby Registry App"

SA_EMAIL="baby-registry@${PROJECT_ID}.iam.gserviceaccount.com"

gcloud iam service-accounts keys create ./service-account-key.json \
  --iam-account="$SA_EMAIL"
```

`service-account-key.json` now holds `client_email` and `private_key` —
you'll need both in step 4. Keep this file out of git (it's already covered
by the project's `.gitignore` pattern for `.env*`, but double check it
doesn't get committed if you initialize a repo later).

## 3. Create and share the Google Sheet

Service accounts don't have their own Drive storage, so create the sheet as
the human's own account rather than via the service account:

1. Ask the human to open Google Sheets and create a new spreadsheet (or
   point you to an existing one they want to reuse).
2. Have them rename a tab to `Items` (or tell you what tab name they used —
   that goes in `GOOGLE_SHEET_TAB`).
3. Have them paste this header row into row 1, columns A–F exactly in this
   order:

   ```
   Item	Link	Notes	Reserved	ReservedBy	ReservedAt
   ```

4. If a gift list was provided in step 0, ask the human to share the sheet
   with `$SA_EMAIL` as **Editor**, then write the items into rows 2+
   yourself via the Sheets API using the service account credentials (a
   short script with `googleapis`, or `curl` against
   `https://sheets.googleapis.com/v4/spreadsheets/{id}/values/Items!A2:C:append`
   with an OAuth2 bearer token minted from the service account key). Verify
   by reading the range back.
5. If no gift list yet, just confirm the sheet is shared with `$SA_EMAIL`
   (Editor) and move on — they can fill in items later directly in Sheets.
6. Grab the spreadsheet ID from the URL:
   `https://docs.google.com/spreadsheets/d/`**`THIS_PART`**`/edit`

## 4. Populate environment variables

Create `.env.local` in the project root:

```bash
cat > .env.local <<EOF
GOOGLE_SERVICE_ACCOUNT_EMAIL=$SA_EMAIL
GOOGLE_PRIVATE_KEY="$(node -e "console.log(JSON.parse(require('fs').readFileSync('./service-account-key.json')).private_key)")"
GOOGLE_SHEET_ID=<paste from step 3>
GOOGLE_SHEET_TAB=Items
ADMIN_PASSWORD=<the password from step 0>
NEXT_PUBLIC_BASE_URL=http://localhost:3000
EOF
```

Double check `GOOGLE_PRIVATE_KEY` kept its `\n` escapes and surrounding
quotes intact — a common source of "invalid key" errors later.

## 5. Local smoke test before deploying

```bash
npm run build
npm run start -- -p 3100 &
sleep 3
curl -s http://localhost:3100/ | grep -q "Baby Registry" && echo "homepage OK"
curl -s -X POST http://localhost:3100/api/admin-auth \
  -H "Content-Type: application/json" \
  -d "{\"password\":\"<the real password>\"}" # expect {"ok":true}
kill %1
```

If the homepage shows a "couldn't load the list" error instead of items,
the Sheets credentials or sharing step is wrong — fix before deploying, not
after.

## 6. Deploy to Vercel

```bash
npm i -g vercel   # if not already installed
vercel login      # human completes browser OAuth if not already logged in
cd ~/projects/baby-registry
vercel link --yes # or omit --yes if it needs to prompt for project name

for key in GOOGLE_SERVICE_ACCOUNT_EMAIL GOOGLE_SHEET_ID GOOGLE_SHEET_TAB ADMIN_PASSWORD; do
  vercel env add "$key" production <<< "$(grep "^$key=" .env.local | cut -d= -f2-)"
done
# GOOGLE_PRIVATE_KEY needs the multiline value — pipe it in directly:
grep "^GOOGLE_PRIVATE_KEY=" .env.local | cut -d= -f2- | vercel env add GOOGLE_PRIVATE_KEY production

vercel --prod
```

Note the resulting production URL (e.g. `https://baby-registry-xyz.vercel.app`).

## 7. Fix the base URL and redeploy

The admin page needs to know its own public URL to build correct guest
links:

```bash
echo "https://<your-real-url>.vercel.app" | vercel env add NEXT_PUBLIC_BASE_URL production
vercel --prod
```

## 8. Verify the live deployment

```bash
BASE="https://<your-real-url>.vercel.app"
curl -s -o /dev/null -w "%{http_code}\n" "$BASE/"        # expect 200
curl -s -o /dev/null -w "%{http_code}\n" "$BASE/admin"   # expect 200
curl -s -o /dev/null -w "%{http_code}\n" "$BASE/api/qr?text=test"  # expect 200
```

Then ask the human to open `$BASE/admin` in their own browser, log in with
the admin password, generate one test guest link, and confirm the QR image
renders and the link opens the reserve list with the guest's name
pre-filled.

## 9. Report back to the human

Summarize, without repeating secrets in full:

- The live URL for the guest-facing list.
- The `/admin` URL and a reminder of where the password is stored (don't
  restate it in plain chat if it can be avoided — point them to
  `.env.local` or the Vercel dashboard's env var settings).
- Confirmation that the test guest link + QR worked end to end.
- Next manual step for them: go generate a personalized link/QR for each
  actual guest and send those out.

## If something blocks you

If `gcloud`/`vercel` login can't complete non-interactively, or a step
needs a decision only the human can make (which Google account, which
Vercel team, custom domain or not), stop and ask plainly rather than
guessing — this is a small family app, but it's still handling real
credentials and a real guest list.
