import { NextRequest, NextResponse } from "next/server";
import { requireOpsApiAccess } from "@/lib/opsAccess";
import { searchOpsOrgs, searchOpsProfiles } from "@/lib/opsData";

export async function GET(request: NextRequest) {
  const gate = await requireOpsApiAccess();
  if (gate instanceof NextResponse) return gate;

  const q = request.nextUrl.searchParams.get("q") ?? "";
  const typesRaw = request.nextUrl.searchParams.get("types") ?? "profile,org";
  const wantProfile = typesRaw.includes("profile");
  const wantOrg = typesRaw.includes("org");

  const [profiles, orgs] = await Promise.all([
    wantProfile ? searchOpsProfiles(gate.service, q, 12) : Promise.resolve([]),
    wantOrg ? searchOpsOrgs(gate.service, q, 12) : Promise.resolve([]),
  ]);

  return NextResponse.json({
    ok: true as const,
    data: { profiles, orgs, q: q.trim() },
  });
}
