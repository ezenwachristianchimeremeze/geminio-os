/** Pure, dependency-free Home chat intent helpers shared by server and client. */
const CURRENT = /\b(today|tonight|yesterday|this (?:week|month|year)|right now|currently|latest|breaking|recent(?:ly)?|news|headline|price of|stock|exchange rate|weather|score|results? of|who (?:won|is the (?:current|new))|what happened|just (?:announced|released))\b/i;
const EXPLICIT = /\b(search (?:the )?(?:web|internet|online)|look (?:it )?up|google|browse|find (?:sources|articles) (?:about|on)|with sources|cite sources)\b/i;
const OFFLINE = /\b(don'?t|do not|no need to) (?:search|browse|look up)\b/i;

export function needsWebSearch(message: string, mode: "auto" | "on" | "off" = "auto"): boolean {
  if (mode === "off") return false;
  if (mode === "on") return true;
  if (OFFLINE.test(message)) return false;
  return EXPLICIT.test(message) || CURRENT.test(message);
}

