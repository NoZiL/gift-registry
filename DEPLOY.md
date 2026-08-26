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

> **Status: done.** The sheet `Baby Registry — Items` exists in the owner's
> Drive, populated with the 35 items imported from the `Liste de naissance`
> tab of the couple's own planning workbook (name, product link, and a
> `Category · Brand · Price` note per item). Reservation columns are empty.
> Two things remain: renaming the tab to `Items`, and sharing it with the
> service account. Keep the spreadsheet ID out of this repo — it goes in the
> Vercel env vars only.

Service accounts don't have their own Drive storage, so the sheet must be
owned by a real Google account, not created by the service account.

The layout the app expects — row 1 is the header, data starts at row 2:

```
Item	Link	Notes	Reserved	ReservedBy	ReservedAt
```

Only `Item` is required. The app writes `Reserved`, `ReservedBy` and
`ReservedAt` itself when a guest claims something; leave them empty.

Remaining steps:

1. Rename the sheet's tab to `Items` so it matches `GOOGLE_SHEET_TAB`.
   (A CSV import names the tab after the file, so it won't be `Items` by
   default. Either rename the tab or set the env var to the real name —
   they just have to agree.)
2. Share the spreadsheet with the service account's `client_email` as
   **Editor**. Read-only is not enough; the app writes reservations back.
   Missing this share is the single most common cause of the homepage
   showing "couldn't load the list".
3. Grab the spreadsheet ID from the URL for `GOOGLE_SHEET_ID`:
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
curl -s http://localhost:3100/ | grep -q "Liste de naissance" && echo "homepage OK"
curl -s -X POST http://localhost:3100/api/admin-auth \
  -H "Content-Type: application/json" \
  -d "{\"password\":\"<the real password>\"}" # expect {"ok":true}
kill %1
```

If the homepage shows a "couldn't load the list" error instead of items,
the Sheets credentials or sharing step is wrong — fix before deploying, not
after.

## 6. Deploy to Vercel via the GitHub import

The repo already lives on GitHub, so the browser import is the shortest
path — no CLI, no login token, and every later push auto-deploys.

1. Go to [vercel.com/new](https://vercel.com/new) and import
   `NoZiL/gift-registry`. Vercel detects Next.js on its own; leave the
   build settings alone.
2. Before clicking **Deploy**, expand **Environment Variables** and add all
   six from `.env.example`:

   | Variable | Value |
   |---|---|
   | `GOOGLE_SERVICE_ACCOUNT_EMAIL` | `client_email` from the JSON key |
   | `GOOGLE_PRIVATE_KEY` | `private_key` from the JSON key — paste the whole thing including the `-----BEGIN/END-----` lines |
   | `GOOGLE_SHEET_ID` | the ID from the Sheet URL |
   | `GOOGLE_SHEET_TAB` | `Items` |
   | `ADMIN_PASSWORD` | your chosen `/admin` password |
   | `NEXT_PUBLIC_BASE_URL` | leave blank for now — step 7 |

   Pasting `GOOGLE_PRIVATE_KEY` into the dashboard is the one place the
   `\n`-escape confusion disappears: paste the real multi-line key and
   Vercel stores it verbatim. `lib/sheets.js` handles both forms.
3. Deploy, and note the production URL.

Cost note: the Hobby plan is free and includes custom domains. It is
licensed for non-commercial use only, which a family registry satisfies.

## 7. Set the base URL and redeploy

`/admin` needs to know its own public URL to build guest links. In
Settings → Environment Variables, set `NEXT_PUBLIC_BASE_URL` to the final
public URL — the custom domain if you're doing step 7b, otherwise the
`.vercel.app` one — with no trailing slash. This is a
`NEXT_PUBLIC_*` variable, so it is baked in at build time: you must
**redeploy** after changing it, not just save it.

### 7b. Custom domain on Cloudflare DNS

1. Vercel → project → Settings → Domains → add the domain. Vercel shows
   the exact A/CNAME record to create; use the values it gives you rather
   than any hardcoded IP, since these have changed over time.
2. In Cloudflare DNS, create that record and set it to **DNS only (grey
   cloud), not Proxied (orange cloud)**.

   This is the step that silently breaks deploys. With the proxy on,
   Cloudflare terminates TLS itself, Vercel can never complete its
   Let's Encrypt challenge, and the certificate simply never issues — the
   domain sits broken with no obvious error. Grey cloud it.
3. Wait for Vercel to report the domain as Valid, then redeploy so
   `NEXT_PUBLIC_BASE_URL` picks up the custom domain.

Note that the app stays publicly reachable at its `*.vercel.app` URL even
after a custom domain is attached; that cannot be disabled on Hobby. The
registry is world-readable to anyone who knows either URL, which matches
the app's existing "trusted guest list, not adversarial" threat model.

## 8. Verify the live deployment

```bash
BASE="https://<your-real-url>"
curl -s -o /dev/null -w "%{http_code}\n" "$BASE/"        # expect 200
curl -s -o /dev/null -w "%{http_code}\n" "$BASE/admin"   # expect 200
curl -s -o /dev/null -w "%{http_code}\n" "$BASE/api/qr?text=test"  # expect 200
```

A 200 on `/` only means the page rendered — it renders fine with a
"couldn't load the list" error too. Confirm the items themselves are
there, which is the real test of the credentials and the sheet share:

```bash
curl -s "$BASE/" | grep -c "Je m'en occupe"   # expect the item count, not 0
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
