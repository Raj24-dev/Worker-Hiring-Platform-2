import { NextResponse, type NextRequest } from "next/server";
import { appliedJobIds, listOpenJobs } from "@/lib/queries";
import { getMe } from "@/lib/session";

/**
 * Backs the Discover Jobs search box. RLS blocks the browser from reading
 * jobs directly, so the search runs here where the caller is known.
 */
export async function GET(request: NextRequest) {
  const me = await getMe();
  if (!me?.profile) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  if (me.profile.role !== "worker") {
    return NextResponse.json({ error: "Workers only" }, { status: 403 });
  }

  const q = request.nextUrl.searchParams.get("q") ?? "";
  const [jobs, applied] = await Promise.all([listOpenJobs(q), appliedJobIds(me.userId)]);

  return NextResponse.json({ jobs, applied: [...applied] });
}
