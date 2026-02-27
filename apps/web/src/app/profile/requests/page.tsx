import { redirect } from "next/navigation";

export default function ProfileRequestsRedirect() {
  redirect("/work/requests?tab=sent");
}
