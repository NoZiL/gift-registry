import { google } from "googleapis";

// The registry tab is a sheet a human keeps by hand, not a table this app owns.
// So rather than demanding fixed columns in fixed places, we read the layout out
// of the sheet itself:
//
//   - the header row is found by name, anywhere in the first rows, which leaves
//     room for a title and an intro paragraph above it;
//   - columns are matched by their heading ("Quoi?", "Prix", "Réservé par", and
//     the English equivalents), so extra columns can be added, and existing ones
//     moved or reordered, without touching this file;
//   - a heading merged across the table ("Textiles", "Jeux et éveil", ...) is a
//     section title rather than a gift. The merge is what tells the two apart:
//     an item with nothing but a name filled in looks identical otherwise.
//
// Links are read as links. A cell reading "ICI" with a URL behind it is the
// natural way to keep a spreadsheet readable, and it's what the sheet uses, so
// the URL comes from the cell's hyperlink and the text is ignored.

// How far down to look for the header row, and how far to read past it. Both are
// generous; the point is to bound the request, not to constrain the sheet.
const HEADER_SCAN_ROWS = 25;
const MAX_ROWS = 500;

// Column headings we understand, normalized (lowercased, unaccented, letters and
// digits only) so "Réservé par", "reserve par" and "ReservedBy" all land on the
// same field. Anything unrecognized is left alone — the sheet is free to carry
// columns that are none of our business.
const HEADINGS = {
  item: ["quoi", "item", "article", "cadeau", "objet"],
  store: ["ou", "magasin", "boutique", "enseigne", "marque", "store"],
  link: ["lien", "link", "url"],
  price: ["prix", "price", "montant"],
  notes: ["notes", "note", "commentaire", "commentaires", "caracteristiques", "details"],
  reserved: ["reserve", "reserved"],
  reservedBy: ["reservepar", "reservedby", "prispar", "offertpar", "apportepar"],
  reservedAt: ["reservele", "reservedat", "datedereservation"],
};

// Reserving needs somewhere to write the name; everything else is optional.
const REQUIRED_FIELD = "reservedBy";

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

function getSpreadsheetId() {
  const id = process.env.GOOGLE_SHEET_ID;
  if (!id) throw new Error("Missing GOOGLE_SHEET_ID env var.");
  return id;
}

// Resolved tab title, cached per serverless instance so the extra metadata
// call happens once rather than on every request.
let cachedTabTitle = null;

// Works out which tab to read. GOOGLE_SHEET_TAB is optional for a single-tab
// spreadsheet, where the only tab is the obvious answer. It is required as soon
// as there are several: a household spreadsheet usually keeps the public gift
// list next to tabs nobody outside the household should see (budgets, what was
// already bought), and guessing wrong would publish one of those. When the
// variable is set but doesn't match, the error names the tabs that do exist --
// the Sheets API reports a missing tab as "Unable to parse range", which sends
// you looking at your A1 syntax instead of at the name.
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
    if (titles.length > 1) {
      throw new Error(
        `This spreadsheet has several tabs (${titles
          .map((t) => `"${t}"`)
          .join(", ")}), so GOOGLE_SHEET_TAB must name the one holding the ` +
          `gift list. Leaving it unset would publish whichever tab happens to ` +
          `come first.`
      );
    }
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
        `Set it to one of those, or remove it to use the only tab.`
    );
  }

  cachedTabTitle = match;
  return cachedTabTitle;
}

// A1 notation requires the tab name to be quoted once it contains spaces or
// punctuation ("Liste de naissance!A2:F" is a parse error), and an embedded
// apostrophe is escaped by doubling it. Quoting unconditionally is valid for
// simple names too, so there's no need to detect which case we're in.
function tabRange(tab, range) {
  return `'${tab.replace(/'/g, "''")}'!${range}`;
}

// 0-based column index -> A1 letter (0 -> A, 26 -> AA).
function columnLetter(index) {
  let n = index;
  let letters = "";
  do {
    letters = String.fromCharCode(65 + (n % 26)) + letters;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return letters;
}

// Lowercase, strip accents and anything that isn't a letter or digit, so the
// heading a person typed ("Où ?", "Réservé par ") matches the alias list.
function normalizeHeading(raw) {
  return String(raw || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function cellText(cell) {
  return String(cell?.formattedValue ?? "").trim();
}

// Names are often wrapped by hand inside their cell ("Cape de bain\net gant de
// toilette"), which is a column-width decision, not part of the name. Notes and
// the intro keep their line breaks; short labels don't.
function oneLine(text) {
  return text.replace(/\s+/g, " ").trim();
}

// A "Lien" cell is usually a word like "ICI" with the URL attached to it, either
// as a cell-wide hyperlink or as a link on the text. A pasted bare URL works too.
function cellLink(cell) {
  if (!cell) return "";
  if (cell.hyperlink) return cell.hyperlink;
  const linked = (cell.textFormatRuns || []).find((run) => run?.format?.link?.uri);
  if (linked) return linked.format.link.uri;
  const text = cellText(cell);
  return /^https?:\/\//i.test(text) ? text : "";
}

const EUROS = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
});

// Prices are typed as bare numbers in the sheet, so give them a currency here.
// A cell that already carries a symbol or any wording is passed through as it
// was written — that's a deliberate choice by whoever formatted the sheet.
function formatPrice(text) {
  if (!text) return "";
  const plain = text.replace(/\u00a0/g, " ");
  if (/[^\d\s.,]/.test(plain)) return text;
  const amount = Number(plain.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(amount) ? EUROS.format(amount) : text;
}

// Reserving stamps a time the family can read at a glance in their own sheet,
// rather than an ISO string they'd have to decode.
const STAMP = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Europe/Paris",
});

// Longest a section title is expected to be. Used only above the header row,
// where a title and an intro are merged across the table in exactly the same
// way a section is; below it, the merge on its own is the answer.
const SECTION_TITLE_MAX = 40;

function looksLikeSectionTitle(text) {
  return !text.includes("\n") && text.length <= SECTION_TITLE_MAX;
}

// Rows where the item column is merged across the table are section titles
// ("Textiles"), not gifts. Returns 1-based row numbers.
function sectionRows(merges, itemCol) {
  const rows = new Set();
  for (const merge of merges || []) {
    const startRow = merge.startRowIndex || 0;
    const startCol = merge.startColumnIndex || 0;
    const endRow = merge.endRowIndex ?? startRow + 1;
    const endCol = merge.endColumnIndex ?? startCol + 1;
    if (startCol === itemCol && endCol - startCol > 1 && endRow - startRow === 1) {
      rows.add(startRow + 1);
    }
  }
  return rows;
}

// Maps a candidate header row to { field: columnIndex }. Returns null when the
// row doesn't look like headings at all.
function readHeadings(cells) {
  const columns = {};
  cells.forEach((cell, index) => {
    const key = normalizeHeading(cellText(cell));
    if (!key) return;
    for (const [field, aliases] of Object.entries(HEADINGS)) {
      // First column wins, so a stray second "Notes" can't hijack the first.
      if (aliases.includes(key) && columns[field] === undefined) {
        columns[field] = index;
      }
    }
  });

  // An item column plus at least one more is what separates a header row from a
  // row that merely happens to start with the word "Article".
  if (columns.item === undefined || Object.keys(columns).length < 2) return null;
  return columns;
}

// One request brings back the values, the links behind them and the merges, for
// the registry tab only.
async function fetchGrid(sheets, spreadsheetId, tab) {
  const res = await sheets.spreadsheets.get({
    spreadsheetId,
    ranges: [tabRange(tab, `A1:Z${MAX_ROWS}`)],
    includeGridData: true,
    fields:
      "sheets(merges,data(rowData(values(formattedValue,hyperlink,textFormatRuns(format(link(uri)))))))",
  });

  const sheet = (res.data.sheets || [])[0] || {};
  const rowData = ((sheet.data || [])[0] || {}).rowData || [];
  return { rowData, merges: sheet.merges || [] };
}

// Reads the whole registry: the heading and intro the sheet carries above the
// table, and every row of it. Both callers need the column layout, so it comes
// back too.
async function loadRegistry() {
  const sheets = getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  const tab = await resolveTabTitle(sheets, spreadsheetId);
  const { rowData, merges } = await fetchGrid(sheets, spreadsheetId, tab);
  // The client comes back with the data: reserving reads before it writes, and
  // reusing the client reuses its access token instead of fetching a second one.
  return { sheets, spreadsheetId, tab, ...parseGrid(rowData, merges, tab) };
}

// Turns one tab's grid into the registry. Split out from the fetch so the sheet
// the family actually uses can be parsed straight from a saved copy in a test.
export function parseGrid(rowData, merges, tab) {
  let headerRow = -1;
  let columns = null;
  for (let i = 0; i < Math.min(rowData.length, HEADER_SCAN_ROWS); i++) {
    const found = readHeadings(rowData[i]?.values || []);
    if (found) {
      headerRow = i;
      columns = found;
      break;
    }
  }

  if (!columns) {
    throw new Error(
      `No header row found in tab "${tab}". One row must name the columns, ` +
        `e.g. "Quoi?", "Où?", "Lien", "Prix", "Réservé par".`
    );
  }
  if (columns[REQUIRED_FIELD] === undefined) {
    throw new Error(
      `Tab "${tab}" has no "Réservé par" column (or "ReservedBy"). ` +
        `Guests' names are written there, so the app can't reserve without it.`
    );
  }

  const sections = sectionRows(merges, columns.item);

  // Whatever sits above the table is the family's own wording for the page --
  // except a section title, which the sheet puts above the header row when the
  // first group starts immediately under it. That one opens the list instead.
  //
  // A title and an intro paragraph are merged across the table just like a
  // section is, so the merge alone can't tell them apart up here. Only the row
  // touching the header row is a candidate, and only if it reads like a label
  // rather than a sentence.
  const above = [];
  let section = "";
  for (let i = 0; i < headerRow; i++) {
    const text = cellText((rowData[i]?.values || [])[columns.item]);
    if (!text) continue;
    if (i === headerRow - 1 && sections.has(i + 1) && looksLikeSectionTitle(text)) {
      section = oneLine(text);
    } else {
      above.push(text);
    }
  }

  const items = [];

  for (let i = headerRow + 1; i < rowData.length; i++) {
    const cells = rowData[i]?.values || [];
    const rowNumber = i + 1;
    const name = oneLine(cellText(cells[columns.item]));
    if (!name) continue;

    if (sections.has(rowNumber)) {
      section = name;
      continue;
    }

    const read = (field) =>
      columns[field] === undefined ? "" : cellText(cells[columns[field]]);
    const reservedBy = read("reservedBy");

    items.push({
      id: rowNumber, // actual sheet row number
      item: name,
      section,
      store: oneLine(read("store")),
      link: columns.link === undefined ? "" : cellLink(cells[columns.link]),
      price: formatPrice(oneLine(read("price"))),
      notes: read("notes"),
      // A name in "Réservé par" is what reserved means here — that column is the
      // one a guest would fill in by hand, and it's the only one the sheet has.
      // An explicit Reserved column is honoured as well when there is one.
      reserved: Boolean(reservedBy) || read("reserved").toUpperCase() === "TRUE",
      reservedBy,
      reservedAt: read("reservedAt"),
    });
  }

  return { columns, title: above[0] || "", intro: above.slice(1), items };
}

// Everything the guest page shows. Items come back reserved and unreserved
// alike — the caller filters.
export async function getRegistry() {
  const { title, intro, items } = await loadRegistry();
  return { title, intro, items };
}

// Attempts to claim a row for `name`. Re-reads the sheet first so two people
// tapping "Reserve" at nearly the same time can't both win.
export async function reserveItem(id, name) {
  const rowNum = Number(id);
  if (!Number.isInteger(rowNum) || rowNum < 2) {
    return { ok: false, reason: "invalid_id" };
  }

  const { sheets, spreadsheetId, tab, columns, items } = await loadRegistry();
  const row = items.find((item) => item.id === rowNum);

  if (!row) {
    return { ok: false, reason: "not_found" };
  }
  if (row.reserved) {
    return {
      ok: false,
      reason: "already_reserved",
      reservedBy: row.reservedBy || "quelqu'un",
    };
  }

  // The name and the timestamp rarely sit next to each other, so write them as
  // separate ranges rather than assuming one contiguous block.
  const writes = [
    {
      range: tabRange(tab, `${columnLetter(columns.reservedBy)}${rowNum}`),
      values: [[name]],
    },
  ];
  if (columns.reserved !== undefined) {
    writes.push({
      range: tabRange(tab, `${columnLetter(columns.reserved)}${rowNum}`),
      values: [["TRUE"]],
    });
  }
  if (columns.reservedAt !== undefined) {
    writes.push({
      range: tabRange(tab, `${columnLetter(columns.reservedAt)}${rowNum}`),
      values: [[STAMP.format(new Date())]],
    });
  }

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: { valueInputOption: "RAW", data: writes },
  });

  return { ok: true };
}
