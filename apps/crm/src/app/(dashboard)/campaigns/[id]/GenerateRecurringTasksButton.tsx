"use client";

import { useTransition, useState } from "react";
import { generateRecurringTasksAction } from "./actions";

export function GenerateRecurringTasksButton({ campaignId }: { campaignId: string }) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  return (
    <>
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          setMessage(null);
          startTransition(async () => {
            const result = await generateRecurringTasksAction(campaignId);
            if (result.error) {
              setMessage({ type: "error", text: result.error });
            } else {
              setMessage({
                type: "ok",
                text:
                  result.tasks_created !== undefined && result.tasks_created > 0
                    ? `Created ${result.tasks_created} task(s) for this week.`
                    : "No new tasks needed for this week.",
              });
            }
          });
        }}
        className="rounded-lg bg-[var(--crm-primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {isPending ? "Generating…" : "Generate this week's tasks"}
      </button>
      {message && (
        <p
          className={`mt-2 text-sm ${message.type === "error" ? "text-red-600" : "text-[var(--crm-muted)]"}`}
        >
          {message.text}
        </p>
      )}
    </>
  );
}
