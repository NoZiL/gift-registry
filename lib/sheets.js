import { google } from "googleapis";

// Columns in the sheet (row 1 is a header row, data starts at row 2):
// A: Item   B: Link   C: Notes   D: Reserved (TRUE/blank)   E: ReservedBy   F: ReservedAt
const RANGE_ALL = "A2:F";

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

function tabRange(range) {
  const tab = process.env.GOOGLE_SHEET_TAB || "Items";
  // A1 notation requires the tab name to be quoted once it contains spaces or
  // punctuation ("Liste de naissance!A2:F" is a parse error), and an embedded
  // apostrophe is escaped by doubling it. Quoting unconditionally is valid for
  // simple names too, so there's no need to detect which case we're in.
  return `'${tab.replace(/'/g, "''")}'!${range}`;
}

// Returns every item, both reserved and not — callers filter as needed.
export async function getItems() {
  const sheets = getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  if (!spreadsheetId) throw new Error("Missing GOOGLE_SHEET_ID env var.");

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: tabRange(RANGE_ALL),
  });

  const rows = res.data.values || [];

  return rows
    .map((row, idx) => {
      const [item, link, notes, reserved, reservedBy, reservedAt] = row;
      if (!item) return null; // skip blank rows
      return {
        id: idx + 2, // actual sheet row number
        item: item || "",
        link: link || "",
        notes: notes || "",
        reserved: String(reserved || "").toUpperCase() === "TRUE",
        reservedBy: reservedBy || "",
        reservedAt: reservedAt || "",
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
    range: tabRange(`A${rowNum}:F${rowNum}`),
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
    range: tabRange(`D${rowNum}:F${rowNum}`),
    valueInputOption: "RAW",
    requestBody: {
      values: [["TRUE", name, new Date().toISOString()]],
    },
  });

  return { ok: true };
}
