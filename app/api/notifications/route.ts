import { NextResponse } from "next/server";
import { admin } from "@/lib/supabase/admin";
import { getMe } from "@/lib/session";
import type { AppNotification } from "@/lib/types";

/** The bell. Scoped to the signed-in profile, because RLS cannot do it here. */
export async function GET() {
  const me = await getMe();
  if (!me?.profile) return NextResponse.json({ items: [], unread: 0 });

  const { data, error } = await admin
    .from("notifications")
    .select("*")
    .eq("profile_id", me.userId)
    .order("created_at", { ascending: false })
    .limit(30)
    .returns<AppNotification[]>();

  // Before migration 0002 the table does not exist; an empty bell is fine.
  if (error) return NextResponse.json({ items: [], unread: 0 });

  const items = data ?? [];
  return NextResponse.json({
    items,
    unread: items.filter((n) => !n.read_at).length,
  });
}

/** Opening the bell marks what is in it as read. */
export async function POST() {
  const me = await getMe();
  if (!me?.profile) return NextResponse.json({ ok: false }, { status: 401 });

  const { error } = await admin
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("profile_id", me.userId)
    .is("read_at", null);

  return NextResponse.json({ ok: !error });
}
