# Baby Registry (Gift Registry POC)

A tiny web app: guests browse a list pulled live from a Google Sheet and tap
"I'll bring this" to claim an item. Claims write straight back to the sheet.
Personalized links/QR codes (generated from `/admin`) mean a guest's name is
attached automatically — no login, no typing required on their end.

This is the first proof of concept for a general-purpose gift registry
(this repo). It's scoped to a single occasion — a baby registry — on
purpose, so the idea can be validated end to end with the simplest possible
backend (a Google Sheet, no database). If it works well for the baby list,
the plan is to reuse the same pattern for other occasions (Christmas,
weddings, ...) rather than generalizing up front.

## How it works

- The gift list lives entirely in a Google Sheet you control. Add/remove/edit
  items there — the app always reads it live, nothing is duplicated.
- The public page (`/`) shows only items not yet claimed.
- `/admin` (password protected) generates a personal link + QR code per
  guest — e.g. `https://your-app.vercel.app/?g=Grandma%20Linda`. Opening that
  link pre-fills their name, so claiming is a single tap.
- Anyone without a personalized link can still use the plain link and type
  their name in first.
- The name is always changeable. It shows as a small "you're reserving as
  ..." line with a **Modifier** link next to it; that opens an editor, and
  saving updates the name everywhere. A guest who got the wrong link, or
  shares a tablet with someone else, can fix it without help.
- Once set, the name is remembered in the browser (`localStorage`), so the
  plain link works like a personalized one on the next visit. A `?g=` link is
  an explicit choice, so it wins over the remembered name and replaces it.
  Saving a new name also rewrites `?g=` in the address bar, so a refresh
  doesn't bring back the name that was just replaced.
- Claims are re-checked against the sheet at the moment of writing, so two
  people tapping the same item at nearly the same time can't both "win."
- Once a guest has claimed something, a **Vos réservations** recap appears
  above the list: what they've taken, what each one costs, and the total. Each
  line has an **Annuler** button that hands the item straight back to the list.
  A guest can only release what's reserved in their own name.
- Prices are read from the optional `Price` column, or — for a list imported
  with the price folded into the note text ("Poussette · Yoyo · 450 €") —
  from the `Notes`. Items with no recognizable price still show up in the
  recap, they just don't count toward the total, and the recap says so.

## 1. Set up the Google Sheet

1. Create a new Google Sheet (or use your existing one — just add a tab for
   this).
2. Name a tab (default expected name: `Items`) and add this header row,
   exactly in this column order:

   | A | B | C | D | E | F | G |
   |---|---|---|---|---|---|---|
   | Item | Link | Notes | Reserved | ReservedBy | ReservedAt | Price |

3. Starting on row 2, add one row per gift idea. Only **Item** is required —
   `Link` (e.g. an Amazon URL) and `Notes` are optional. Leave `Reserved`,
   `ReservedBy`, and `ReservedAt` blank; the app fills those in.
   `Price` is optional too: fill it in (`450`, `45,90 €`) and the recap totals
   it. Leave the whole column off and the app falls back to reading a price
   out of the note, which is what an imported list usually carries.
4. Copy the Sheet ID out of the URL:
   `https://docs.google.com/spreadsheets/d/`**`THIS_PART`**`/edit`

## 2. Create a Google service account (lets the app read/write the sheet)

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → create a
   project (or reuse one).
2. Enable the **Google Sheets API** for that project (APIs & Services →
   Enable APIs → search "Google Sheets API").
3. APIs & Services → Credentials → Create Credentials → **Service account**.
   Give it any name (e.g. `baby-registry`). No special roles needed.
4. Open the new service account → **Keys** tab → Add key → Create new key →
   JSON. This downloads a `.json` file — keep it private, don't commit it
   anywhere.
5. From that JSON file you need two values for later: `client_email` and
   `private_key`.
6. Back in your Google Sheet, click **Share** and share it with the
   `client_email` address from the JSON file, giving it **Editor** access.

## 3. Configure environment variables

Copy `.env.example` to `.env.local` for local testing, and fill in:

- `GOOGLE_SERVICE_ACCOUNT_EMAIL` — the `client_email` from the JSON key
- `GOOGLE_PRIVATE_KEY` — the `private_key` from the JSON key (keep the
  quotes and `\n` sequences as-is)
- `GOOGLE_SHEET_ID` — the ID from the sheet's URL
- `GOOGLE_SHEET_TAB` — the tab name (default `Items`)
- `ADMIN_PASSWORD` — whatever password you and your partner want to use to
  open `/admin`
- `NEXT_PUBLIC_BASE_URL` — fill this in once you know your deployed URL
  (step 4)

## 4. Run it locally (optional, to test before deploying)

```bash
npm install
npm run dev
```

Visit `http://localhost:3000` for the guest list, and
`http://localhost:3000/admin` to generate a test link.

## 5. Deploy (Vercel is the easiest fit for Next.js)

1. Push this folder to a GitHub repo (or use `npx vercel` directly from this
   folder without GitHub).
2. Go to [vercel.com](https://vercel.com), import the project.
3. In the Vercel project's Settings → Environment Variables, add the same
   variables from `.env.local`.
4. Deploy. Once you have your live URL (e.g.
   `https://baby-registry-xyz.vercel.app`), set `NEXT_PUBLIC_BASE_URL` to
   that value in Vercel's env vars and redeploy so `/admin` builds correct
   links.

## 6. Generate guest links

Go to `/admin`, enter the password, type a guest's name, and you'll get a
shareable link plus a QR code image (long-press or right-click to save it).
Send the link by text/email, or print the QR code for a shower.

## Notes & limits

- This is intentionally lightweight for a private family list — the `/admin`
  password is a deterrent, not bank-grade security. Don't reuse a sensitive
  password for it.
- A guest's "identity" is just a name they can edit — nothing stops someone
  from typing (or putting in the URL) a different one. Fine for a trusted
  guest list; not meant for a public/adversarial audience. The recap and the
  **Annuler** button follow from the same rule: they show and release what is
  reserved under the name currently in use (matched ignoring case, accents and
  extra spaces), so a guest who renames themselves stops seeing what they
  claimed under the old name.
- If you'd rather not deploy this yourselves, mention it and it can be
  walked through interactively, or deployed directly given the right
  credentials.
