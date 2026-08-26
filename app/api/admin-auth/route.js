import { NextResponse } from "next/server";

// A lightweight deterrent, not real security: keeps casual visitors from
// finding /admin and minting their own guest links. The private data (the
// Google service account key) never touches the client either way.
export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const expected = process.env.ADMIN_PASSWORD;

  if (!expected) {
    return NextResponse.json({ ok: false, reason: "not_configured" }, { status: 500 });
  }
  if (body.password === expected) {
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ ok: false }, { status: 401 });
}
