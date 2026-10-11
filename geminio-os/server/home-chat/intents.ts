/**
 * Navigation hints for the Home AI: which Geminio module a request belongs to.
 * This only SUGGESTS a destination (an "Open …" action). It never claims the module did the work.
 * Destinations are limited to routes that exist in the app (lib/product-catalog.ts ids).
 */
export type ModuleHint = { module: string; label: string; route: string; executable: boolean; note?: string };

const RULES: { test: RegExp; hint: ModuleHint }[] = [
  { test: /\b(remind me|reminder|to-?do|my tasks?|calendar|schedule (?:a|my)|plan my day)\b/i, hint: { module: "personal-assistant", label: "Open Personal Assistant", route: "/workspace/personal-assistant/Reminders", executable: false, note: "Creating reminders from chat is not connected yet." } },
  { test: /\b(cv|resume|r[eé]sum[eé]|cover letter|interview|job|jobs|scholarship|internship|career)\b/i, hint: { module: "career-hub", label: "Open Career Hub", route: "/workspace/career-hub/Resume", executable: true } },
  { test: /\b(teach me|learn|study plan|tutor|course|exam|python lesson|explain .* (?:to me|simply))\b/i, hint: { module: "learning-hub", label: "Open Learning Hub", route: "/workspace/learning-hub/Tutor", executable: true } },
  { test: /\b(business plan|crm|invoice|inventory|accounting|marketing plan|sales report)\b/i, hint: { module: "business-hub", label: "Open Business Hub", route: "/workspace/business-hub", executable: false, note: "Business Hub tools are not backed by data yet." } },
  { test: /\b(market data|stock|crypto|watchlist|forex|trading|analy[sz]e (?:this )?market)\b/i, hint: { module: "markets", label: "Open Markets", route: "/workspace/markets", executable: false, note: "Market data needs a licensed provider." } },
  { test: /\b(news|headlines?|top stories|tech(?:nology)? stories)\b/i, hint: { module: "news-hub", label: "Open News Hub", route: "/workspace/news-hub", executable: false, note: "News Hub needs a licensed news provider; web search is used when configured." } },
  { test: /\b(create|generate|make|design) (?:an? )?(?:image|picture|logo|poster|illustration|video|music|song)\b/i, hint: { module: "media-studio", label: "Open Media Studio", route: "/workspace/media-studio", executable: false, note: "Media generation needs a media provider." } },
  { test: /\b(call|phone|text message|send (?:a )?(?:sms|text) to|dial)\b/i, hint: { module: "phone-assistant", label: "Open Phone Assistant", route: "/workspace/phone-assistant", executable: false, note: "Device actions require OS permission and are not connected yet." } },
  { test: /\b(wallet|balance|send money|transfer|transactions?)\b/i, hint: { module: "wallet", label: "Open Wallet", route: "/workspace/wallet", executable: false, note: "Wallet transfers require a banking partner and secure authentication." } },
  { test: /\b(build|create|make|generate|develop)\b.*\b(app|application|website|web ?site|landing page|dashboard|backend|api|react|expo|store)\b/i, hint: { module: "ai-builder", label: "Open AI Builder", route: "/workspace/ai-builder", executable: true } },
  { test: /\b(scam|phishing|suspicious|is this safe|security check)\b/i, hint: { module: "security-guardian", label: "Open AI Guardian", route: "/workspace/security-guardian", executable: false } },
];

export function suggestModule(message: string): ModuleHint | null {
  for (const rule of RULES) if (rule.test.test(message)) return rule.hint;
  return null;
}

/** Attachment-aware hint: files route to analysis, never to an action that would execute them. */
export function describeAttachmentIntent(kind: "image" | "pdf" | "text" | "code" | "other"): string {
  switch (kind) {
    case "image": return "Analyze the attached image.";
    case "pdf": return "Read and explain the attached PDF.";
    case "code": return "Review the attached code. Do not execute it.";
    case "text": return "Read the attached text file.";
    default: return "The attachment type is not supported for analysis.";
  }
}
