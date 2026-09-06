import { google } from "googleapis";
import { parsePrice } from "./registry";

// Columns in the sheet (row 1 is a header row, data starts at row 2):
// A: Item   B: Link   C: Notes   D: Reserved (TRUE/blank)   E: ReservedBy   F: ReservedAt
// G: Category   H: Price
//
// G and H were added after the first sheets were already in use, so they sit
// at the end rather than next to Item: an existing sheet keeps working
// untouched (both read as empty), and the reserve write below still lands on
// D:F. Filling them in is what turns the filters and the grouped sections on.
const RANGE_ALL = "A2:H";

// The private key reaches us through a dashboard field or a .env file, and
// arrives mangled in a handful of predictable ways. OpenSSL reports every one
// of them as the same opaque "DECODER routines::unsupported", so normalise the
// common cases rather than making someone guess which one they hit.
export function normalizePrivateKey(raw) {
  let key = String(raw || "").trim();

  // Copying the value out of a .env file or the JSON key brings the wrapping
  // quotes along, and they make the PEM unparseable.
  const quoted =
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"));
  if (quoted) key = key.slice(1, -1).trim();

  // Escaped newlines (the JSON form) -> real ones; drop CR from CRLF pastes.
  key = key.replace(/\\r/g, "").replace(/\\n/g, "\n").replace(/\r/g, "");

  // Some fields collapse the key onto a single line. If the PEM markers are
  // present, rebuild the body at the 64-char wrapping OpenSSL expects.
  const pem = key.match(/-----BEGIN ([A-Z ]+)-----([\s\S]*?)-----END \1-----/);
  if (pem) {
    const [, label, rawBody] = pem;
    const body = rawBody.replace(/\s+/g, "").replace(/(.{64})/g, "$1\n").trim();
    key = `-----BEGIN ${label}-----\n${body}\n-----END ${label}-----\n`;
  }

  return key;
}

function getSheetsClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = normalizePrivateKey(process.env.GOOGLE_PRIVATE_KEY);

  if (!email || !key) {
    throw new Error(
      "Missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_PRIVATE_KEY env vars."
    );
  }

  // Fail with something actionable instead of an OpenSSL decoder error.
  if (!/^-----BEGIN [A-Z ]+-----\n/.test(key)) {
    throw new Error(
      "GOOGLE_PRIVATE_KEY is not a PEM private key. Paste the whole " +
        "private_key value from the service account JSON, including the " +
        "-----BEGIN PRIVATE KEY----- and -----END PRIVATE KEY----- lines, " +
        "with no surrounding quotes."
    );
  }

  const auth = new google.auth.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return google.sheets({ version: "v4", auth });
}

// Resolved tab title, cached per serverless instance so the extra metadata
// call happens once rather than on every request.
let cachedTabTitle = null;

// Works out which tab to read. GOOGLE_SHEET_TAB is optional: with a single-tab
// spreadsheet the first tab is the obvious answer, and making the app discover
// it avoids a whole class of silent misconfiguration. When the variable is set
// but doesn't match, the error names the tabs that do exist -- the Sheets API
// reports a missing tab as "Unable to parse range", which sends you looking at
// your A1 syntax instead of at the name.
async function resolveTabTitle(sheets, spreadsheetId) {
  if (cachedTabTitle) return cachedTabTitle;

  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties.title",
  });
  const titles = (meta.data.sheets || [])
    .map((s) => s?.properties?.title)
    .filter(Boolean);

  if (titles.length === 0) {
    throw new Error("The spreadsheet has no tabs.");
  }

  const configured = (process.env.GOOGLE_SHEET_TAB || "").trim();
  if (!configured) {
    cachedTabTitle = titles[0];
    return cachedTabTitle;
  }

  // Exact first, then forgive stray whitespace and casing — both are easy to
  // introduce when copying a tab name into a dashboard field.
  const match =
    titles.find((t) => t === configured) ||
    titles.find((t) => t.trim().toLowerCase() === configured.toLowerCase());

  if (!match) {
    throw new Error(
      `GOOGLE_SHEET_TAB is set to "${configured}", but this spreadsheet's ` +
        `tabs are: ${titles.map((t) => `"${t}"`).join(", ")}. ` +
        `Set it to one of those, or remove it to use the first tab.`
    );
  }

  cachedTabTitle = match;
  return cachedTabTitle;
}

// A1 notation requires the tab name to be quoted once it contains spaces or
// punctuation ("Liste de naissance!A2:F" is a parse error), and an embedded
// apostrophe is escaped by doubling it. Quoting unconditionally is valid for
// simple names too, so there's no need to detect which case we're in.
async function tabRange(sheets, spreadsheetId, range) {
  const tab = await resolveTabTitle(sheets, spreadsheetId);
  return `'${tab.replace(/'/g, "''")}'!${range}`;
}

// Returns every item, both reserved and not — callers filter as needed.
export async function getItems() {
  const sheets = getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  if (!spreadsheetId) throw new Error("Missing GOOGLE_SHEET_ID env var.");

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: await tabRange(sheets, spreadsheetId, RANGE_ALL),
  });

  const rows = res.data.values || [];

  return rows
    .map((row, idx) => {
      const [item, link, notes, reserved, reservedBy, reservedAt, category, price] =
        row;
      if (!item) return null; // skip blank rows
      return {
        id: idx + 2, // actual sheet row number
        item: item || "",
        link: link || "",
        notes: notes || "",
        reserved: String(reserved || "").toUpperCase() === "TRUE",
        reservedBy: reservedBy || "",
        reservedAt: reservedAt || "",
        category: String(category || "").trim(),
        // Parsed once here so the number drives the filter, while the raw cell
        // is kept for display — the sheet's own currency formatting is the
        // owner's choice and shouldn't be reformatted away.
        price: parsePrice(price),
        priceRaw: String(price || "").trim(),
      };
    })
    .filter(Boolean);
}

// Attempts to claim a row for `name`. Re-reads the row first so two people
// tapping "Reserve" at nearly the same time can't both win.
export async function reserveItem(id, name) {
  const sheets = getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  if (!spreadsheetId) throw new Error("Missing GOOGLE_SHEET_ID env var.");

  const rowNum = Number(id);
  if (!Number.isInteger(rowNum) || rowNum < 2) {
    return { ok: false, reason: "invalid_id" };
  }

  const current = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: await tabRange(sheets, spreadsheetId, `A${rowNum}:F${rowNum}`),
  });

  const row = (current.data.values && current.data.values[0]) || [];
  const [item, , , reserved, reservedBy] = row;

  if (!item) {
    return { ok: false, reason: "not_found" };
  }
  if (String(reserved || "").toUpperCase() === "TRUE") {
    return { ok: false, reason: "already_reserved", reservedBy: reservedBy || "someone" };
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: await tabRange(sheets, spreadsheetId, `D${rowNum}:F${rowNum}`),
    valueInputOption: "RAW",
    requestBody: {
      values: [["TRUE", name, new Date().toISOString()]],
    },
  });

  return { ok: true };
}
