import { NextResponse } from "next/server";
import { getReservationsFor } from "../../../lib/sheets";
import { sanitizeName } from "../../../lib/guestName";

// The guest's name usually comes from localStorage, which the server can't see
// at render time, so the recap asks for it here instead of being baked into the
// page. Only that guest's rows come back, which keeps the rest of the list's
// "who reserved what" off the wire.
export async function GET(request) {
  const name = sanitizeName(new URL(request.url).searchParams.get("name"));

  if (!name) {
    return NextResponse.json({ ok: false, reason: "missing_name" }, { status: 400 });
  }

  try {
    const items = await getReservationsFor(name);
    return NextResponse.json({ ok: true, items });
  } catch (err) {
    // Same reasoning as the page: log the detail, tell the guest nothing that
    // describes the sheet.
    console.error("reservations error", err);
    return NextResponse.json({ ok: false, reason: "server_error" }, { status: 500 });
  }
}
