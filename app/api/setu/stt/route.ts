import { NextResponse } from "next/server";
import { transcribe } from "@/lib/setu/ai";
import { isSetuLanguage } from "@/lib/setu/core";
import { getMe } from "@/lib/session";

/** Speech in, text out. Proxied so the Sarvam key never reaches the browser. */
export async function POST(request: Request) {
  const me = await getMe();
  if (!me) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const form = await request.formData();
  const audio = form.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) {
    return NextResponse.json({ error: "No audio" }, { status: 400 });
  }
  // ~10 MB of 16-bit mono is several minutes; anything larger is not a reply.
  if (audio.size > 10_000_000) {
    return NextResponse.json({ error: "That recording is too long" }, { status: 413 });
  }

  const hint = String(form.get("language") ?? "");

  try {
    const result = await transcribe(audio, isSetuLanguage(hint) ? hint : undefined);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[setu] transcription failed:", err);
    return NextResponse.json({ error: "Could not hear that. Please try again." }, { status: 502 });
  }
}
