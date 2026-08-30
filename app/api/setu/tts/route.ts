import { NextResponse } from "next/server";
import { speak } from "@/lib/setu/ai";
import { isSetuLanguage } from "@/lib/setu/core";
import { getMe } from "@/lib/session";

/** Replays a line Setu already said, for the "listen again" button. */
export async function POST(request: Request) {
  const me = await getMe();
  if (!me) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { text, language } = (await request.json()) as { text?: string; language?: string };
  if (!text?.trim()) return NextResponse.json({ error: "Nothing to say" }, { status: 400 });

  const audio = await speak(text, isSetuLanguage(language ?? "") ? (language as never) : "hi-IN");
  return audio
    ? NextResponse.json({ audio })
    : NextResponse.json({ error: "Voice unavailable" }, { status: 502 });
}
