import { NextResponse } from "next/server";
import { reserveItem } from "../../../lib/sheets";

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "bad_request" }, { status: 400 });
  }

  const { id, name } = body || {};
  const cleanName = String(name || "").trim().slice(0, 80);

  if (!id || !cleanName) {
    return NextResponse.json({ ok: false, reason: "missing_fields" }, { status: 400 });
  }

  try {
    const result = await reserveItem(id, cleanName);
    return NextResponse.json(result);
  } catch (err) {
    console.error("reserve error", err);
    return NextResponse.json({ ok: false, reason: "server_error" }, { status: 500 });
  }
}
