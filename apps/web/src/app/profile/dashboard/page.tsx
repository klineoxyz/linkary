import { redirect } from "next/navigation";

/**
 * P0: Analytics ownership — /profile/dashboard no longer shows Profile Insights.
 * Redirect to the single deep analytics surface.
 */
export default async function ProfileDashboardRedirect() {
  redirect("/analytics");
}
