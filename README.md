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
- The sheet stays yours to format. Columns are matched by their headings
  rather than their position, the title and intro above the table carry over
  to the page, and a `Lien` cell reading "ICI" is followed to the URL behind
  it. See step 1 for the details.
- The public page (`/`) shows only items not yet claimed.
- Each item can carry a **category**, a **price** and a **shop**. All are
  optional, and the first two drive the browsing UI: items are grouped into
  collapsible sections by category, and guests can narrow the list by category
  and by a min/max price range. A category can come from a `Catégorie` column
  or from a section heading the sheet already has. See
  [Categories and prices](#categories-and-prices).
- Every item shows a small **picture**, so the list can be skimmed instead of
  read. Give the sheet an `Image` column and whatever address it holds is what
  the card shows; leave the cell empty, or the column out entirely, and the app
  pulls the preview image off the item's own `Lien`, the way a chat app
  previews a pasted URL. Items with neither keep a discreet 🎁 placeholder. See
  [Photos and link previews](#photos-and-link-previews).
- A **Comment ça marche ?** guide sits at the top of the page, above the name
  box: seven numbered steps that name the buttons literally ("Je m'en occupe",
  "Annuler") and say what happens after each tap, plus a short "Bon à savoir"
  section (no account, no card details, how to find your reservations again
  from another device). It's open on arrival, since a guest who needs it
  shouldn't have to find it first, and closing it is remembered in
  `localStorage` so a returning guest isn't made to scroll past it again. The
  wording lives in `app/HowTo.js`, not in the sheet — it describes the app's
  own buttons, which the sheet has no say over.
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
  The recap prices each item from the same price column the cards and the
  filters read, so the three always agree. Items with no price still appear in
  the recap; they're left out of the total, and the recap says how many.
  Each line also repeats the item's **Voir l'article** link: claiming an item
  takes it out of the list, and the list was the only place the link was
  shown — but the link is exactly what a guest needs *after* reserving, to go
  and buy the thing. Lines whose sheet row has no `Lien` simply don't show one.

## 1. Set up the Google Sheet

The app reads the sheet you already keep, rather than asking you to keep a
second one in its shape. Point it at your tab and it works out the layout
from the headings.

1. Create a Google Sheet, or use the tab of your own planning workbook that
   already holds the list.

   It has to be a **Google Sheet**, not an Excel file sitting in Drive. An
   uploaded `.xlsx` looks the same in the browser but the Sheets API can't
   open it: open it and use **File → Save as Google Sheets**, then use the
   ID of the copy that creates.

2. Somewhere in the tab, have a row that names the columns. It doesn't have
   to be row 1 — a title and an intro above it are fine, and are used (see
   below). These headings are understood, in any order, in French or
   English:

   | Heading | Holds | Required |
   |---|---|---|
   | `Quoi?` / `Item` | what the gift is | yes |
   | `Où?` / `Store` | where to get it | no |
   | `Lien` / `Link` | the product page | no |
   | `Prix` / `Price` | the price | no |
   | `Catégorie` / `Category` | which section it belongs in | no |
   | `Réservé par` / `ReservedBy` | who's bringing it | yes |
   | `Réservé le` / `ReservedAt` | when they claimed it | no |
   | `Image` / `Photo` | a picture of the gift | no |
   | `Notes` | anything else worth saying | no |

   Only two are required: the item column, and `Réservé par` — that's where
   a guest's name gets written. Accents, casing and a trailing space don't
   matter, and columns the app doesn't recognize are left alone.

3. Add one row per gift under that. Only the item column has to be filled
   in. Leave `Réservé par` empty — an item counts as taken as soon as there
   is a name in it, whether the app put it there or you did.

4. Optional, and worth doing:

   - **Prices** typed as plain numbers are shown as euros. A price you write
     out yourself (`12 €`, `à partir de 20`) is shown exactly as written.
   - **Links** can be a bare URL, or a short word like `ICI` with the link
     attached to it (Insert → Link) — the app follows the link, not the
     text. The second keeps the spreadsheet readable.
   - **Sections.** There are two ways to group items, and they end up in the
     same place. Either fill in a `Catégorie` column per row, or put a
     heading like `Textiles` or `Jeux et éveil` on its own row, merged across
     the table's columns — every row under it belongs to that section until
     the next heading. The merge is what marks a row as a heading rather
     than a gift nobody filled a price in for. A `Catégorie` cell wins over
     the heading a row sits under.
   - **Pictures.** An `Image` column lets you choose the thumbnail on each
     card, as a bare address or behind a word, exactly like `Lien`. Skip the
     column entirely and the cards still get pictures — the app falls back to
     the preview image the linked shop publishes. See
     [Photos and link previews](#photos-and-link-previews).
   - **A title and an intro** above the header row are used as the page's
     own title and intro paragraphs, so you can reword them without a
     deploy.

5. Copy the Sheet ID out of the URL:
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
- `GOOGLE_SHEET_TAB` — the name of the tab holding the gift list. Optional
  only when the spreadsheet has a single tab; required as soon as it has
  more, so a planning workbook can't publish its budget tab by accident
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

## Categories and prices

Both are free text, and both are optional — fill in as much or as little as
you like. Neither has to sit in a particular column; the app finds them by
their heading (step 1).

**Category** is whatever wording you want: `Chambre`, `Repas`, `Vêtements`.
It can come from a `Catégorie` / `Category` column, or from a merged section
heading above a run of rows — whichever suits the sheet. Every distinct value
becomes its own collapsible section on the public page, and guests get a row
of category chips to filter with. Sections appear in the order their category
first shows up in the sheet, so you set the running order by arranging rows.
Items with no category collect in a "Sans catégorie" section at the bottom. If
nothing has a category at all, the page stays a plain flat list.

**Price** is used two ways: to show a price on the item, and to power the
min/max filter. It's read leniently, so you don't have to think about
formatting:

- Either decimal separator works — `25,50` and `25.50` both mean 25.50.
- Currency symbols and thousands separators are fine — `39,90 €`, `$1,299.00`,
  `1 299,00 EUR` all parse.
- The cell is displayed **exactly as the sheet shows it**, so a cell you
  formatted as `$45.00` stays `$45.00` — the app won't convert or re-format
  your currency. A bare number like `25` has no currency of its own, so it's
  shown as `25 €`.
- Anything with no number in it (`offert`, `à voir`) is shown on the item just
  as you wrote it, but counts as "no price" for the filter — see below.

Two things worth knowing about how the filters behave:

- Selecting several category chips widens the list (`Repas` **or**
  `Vêtements`), it doesn't narrow it. No chips selected means no category
  filter.
- Setting a min or max hides items that have no price, since there's no honest
  way to place them in a range. The app says how many are hidden right under
  the filters, so nobody wonders where something went.

## Photos and link previews

Every card carries a thumbnail, and the app looks for one in two places, in
this order.

**1. An `Image` column, if your sheet has one.** Put the address of a picture
in the cell — right click an image in your browser and "Copy image address" —
and that's what the card shows. Like `Lien`, it can be a bare address or a
short word with the link attached to it, whichever keeps your sheet readable.

This always wins: it's your choice, it costs no extra request, and it's the way
to fix an item whose shop advertises a bad picture (a logo, a banner, the wrong
colourway).

A Google Drive share link works too. Drive hands you a link to its *viewer*
page rather than to the file, so the app rewrites it to Drive's thumbnail
address for you — just make sure the file itself is shared with "anyone with
the link", or nobody but you will see it.

**2. The item's `Lien`.** With no `Image` column, or an empty cell in it, the
app fetches the shop's page and reads the preview picture it publishes for
exactly this purpose (its `og:image`) — the same picture you get when you paste
that link into a chat app. This happens per card as it scrolls into view, and
the answer is cached, so a page of thirty items doesn't turn into thirty
requests on every visit.

Only links already in your sheet are ever fetched: the page asks for a preview
by row number, not by URL, so the endpoint can't be aimed at anything you
didn't put there yourself.

Not every shop plays along — some publish no preview image, some block
non-browser visitors, some serve pictures that refuse to be shown on another
site. Any of those leaves the card with its 🎁 placeholder, which is the cue
to fill in an `Image` cell by hand for that row.

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
