import QRCode from "qrcode";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const text = searchParams.get("text");

  if (!text) {
    return new Response("Missing ?text=", { status: 400 });
  }

  const buffer = await QRCode.toBuffer(text, {
    width: 320,
    margin: 1,
  });

  return new Response(buffer, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "no-store",
    },
  });
}
