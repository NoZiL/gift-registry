import { google } from "googleapis";

// Columns in the sheet (row 1 is a header row, data starts at row 2):
// A: Item   B: Link   C: Notes   D: Reserved (TRUE/blank)   E: ReservedBy   F: ReservedAt
const RANGE_ALL = "A2:F";

function getSheetsClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n");

  if (!email || !key) {
    throw new Error(
      "Missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_PRIVATE_KEY env vars."
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
  return `${tab}!${range}`;
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
