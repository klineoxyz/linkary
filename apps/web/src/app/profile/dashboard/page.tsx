import { redirect } from "next/navigation";

type Props = { searchParams?: Promise<{ username?: string }> | { username?: string } };

export default async function ProfileDashboardRedirect(props: Props) {
  const raw = props.searchParams;
  const searchParams = raw && typeof (raw as Promise<unknown>).then === "function" ? await (raw as Promise<{ username?: string }>) : (raw as { username?: string } | undefined);
  const username = searchParams?.username;
  const q = new URLSearchParams();
  q.set("tab", "insights");
  if (username) q.set("username", String(username));
  redirect(`/profile?${q.toString()}`);
}
