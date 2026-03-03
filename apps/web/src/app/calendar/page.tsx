import { permanentRedirect } from "next/navigation";

/** Permanent redirect (308): /calendar → /xspaces */
export default function CalendarRedirect() {
  permanentRedirect("/xspaces");
}
