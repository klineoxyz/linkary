import { redirect } from "next/navigation";

export default function ProfileInboxRedirect() {
  redirect("/work/requests?tab=inbox");
}
