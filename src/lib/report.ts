/* Report issues / suggestions from the app (client-side relay via FormSubmit). */

export const REPORT_EMAIL = "lobocode@gmail.com";

export type ReportType = "bug" | "suggestion";

export interface Report {
  type: ReportType;
  message: string;
  /** Optional reply address. */
  email?: string;
}

const ENDPOINT = `https://formsubmit.co/ajax/${REPORT_EMAIL}`;

const SUBJECTS: Record<ReportType, string> = {
  bug: "[OLTN] Problem report",
  suggestion: "[OLTN] Suggestion",
};

/** Sends the report; `fetchImpl` is injected at the network boundary. */
export async function sendReport(
  report: Report,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  if (!report.message.trim()) return false;
  const email = report.email?.trim();
  const res = await fetchImpl(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      _subject: SUBJECTS[report.type],
      type: report.type,
      message: report.message.trim(),
      ...(email ? { email } : {}),
    }),
  });
  return res.ok;
}
