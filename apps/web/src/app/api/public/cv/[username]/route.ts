/**
 * GET /api/public/cv/[username]
 * Redirects to a short-lived signed URL for the profile's CV (when published and CV is set).
 * No auth required; only published profiles with cv_document_id are allowed.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/x-analytics-server";
import { normalizeIdentifier } from "@/lib/entityResolver";

const BUCKET = "profile-documents";
const EXPIRY_SECONDS = 60;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const username = (await params).username?.trim();
  const segmentLower = normalizeIdentifier(username ?? "");
  if (!segmentLower) {
    return NextResponse.json({ error: "Invalid username" }, { status: 400 });
  }

  let serviceSupabase;
  try {
    serviceSupabase = createServiceSupabase();
  } catch {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const { data: profile } = await serviceSupabase
    .from("public_profile_view")
    .select("id, username")
    .or(`username.ilike.${segmentLower},twitter_username.ilike.${segmentLower}`)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const profileId = (profile as { id: string }).id;
  const { data: profileRow } = await serviceSupabase
    .from("profiles")
    .select("cv_document_id")
    .eq("id", profileId)
    .maybeSingle();

  const docId = (profileRow as { cv_document_id?: string | null } | null)?.cv_document_id;
  if (!docId) {
    return NextResponse.json({ error: "CV not available" }, { status: 404 });
  }

  const { data: doc } = await serviceSupabase
    .from("profile_documents")
    .select("file_path")
    .eq("id", docId)
    .eq("profile_id", profileId)
    .eq("doc_type", "cv")
    .maybeSingle();

  const filePath = (doc as { file_path?: string } | null)?.file_path;
  if (!filePath || typeof filePath !== "string" || filePath.includes("..")) {
    return NextResponse.json({ error: "CV not found" }, { status: 404 });
  }

  const { data: signed } = await serviceSupabase.storage
    .from(BUCKET)
    .createSignedUrl(filePath, EXPIRY_SECONDS);

  if (!signed?.signedUrl) {
    return NextResponse.json({ error: "Could not generate download link" }, { status: 500 });
  }

  return NextResponse.redirect(signed.signedUrl, 302);
}
