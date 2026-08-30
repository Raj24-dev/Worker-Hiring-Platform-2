import { NextResponse } from "next/server";
import { setuTurn, speak, type SetuTurn } from "@/lib/setu/ai";
import {
  SETU_FIELDS,
  isSetuLanguage,
  type SetuLanguage,
  type SetuProfile,
} from "@/lib/setu/core";
import { saveSetuProfile } from "@/lib/setu/save";
import { getMe } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * One turn of the Setu conversation.
 *
 * Stateless on purpose: the browser holds the transcript and the profile so far
 * and sends both. Serverless instances do not share memory, so keeping the
 * conversation in a module-level map (as the original Setu did) would lose the
 * thread the moment a second instance answered.
 */
export async function POST(request: Request) {
  const me = await getMe();
  if (!me) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (me.profile?.role === "employer") {
    return NextResponse.json({ error: "Setu onboards workers only" }, { status: 403 });
  }

  let body: {
    message?: string;
    language?: string;
    profile?: SetuProfile;
    history?: SetuTurn[];
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const language: SetuLanguage =
    body.language && isSetuLanguage(body.language) ? body.language : "hi-IN";
  const message = String(body.message ?? "").slice(0, 1000).trim();
  if (!message) return NextResponse.json({ error: "Nothing was said" }, { status: 400 });

  // Trust only known field names, and only from our own prior state.
  const profile: SetuProfile = {};
  for (const f of SETU_FIELDS) {
    const v = body.profile?.[f];
    if (typeof v === "string" && v.trim()) profile[f] = v.trim().slice(0, 400);
  }

  const history = (Array.isArray(body.history) ? body.history : [])
    .slice(-20)
    .filter((t): t is SetuTurn => t?.role === "user" || t?.role === "model")
    .map((t) => ({ role: t.role, text: String(t.text ?? "").slice(0, 1000) }));

  let turn;
  try {
    turn = await setuTurn(language, profile, history, message);
  } catch (err) {
    console.error("[setu] model turn failed:", err);
    return NextResponse.json(
      { error: "Setu could not answer just now. Please try again." },
      { status: 502 },
    );
  }

  // Merge what the model just learned on top of what we already had.
  const merged: SetuProfile = { ...profile };
  for (const f of SETU_FIELDS) {
    const v = turn.fields?.[f];
    if (typeof v === "string" && v.trim()) merged[f] = v.trim().slice(0, 400);
  }

  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();

  // Persist every turn: a dropped call must not lose the conversation.
  let saved = null;
  try {
    saved = await saveSetuProfile({
      userId: me.userId,
      phone: (user?.user_metadata?.phone as string | null) ?? null,
      profile: merged,
      language,
      turns: [...history, { role: "user", text: message }, { role: "model", text: turn.reply }],
    });
  } catch (err) {
    console.error("[setu] save failed:", err);
  }

  const audio = await speak(turn.reply, language);

  return NextResponse.json({
    reply: turn.reply,
    audio,
    profile: merged,
    done: turn.done && !!saved?.complete,
    complete: !!saved?.complete,
    trustScore: saved?.trust.score ?? null,
    remarks: saved?.remarks ?? null,
  });
}
