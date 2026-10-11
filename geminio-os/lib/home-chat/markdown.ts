/**
 * Minimal, SAFE markdown -> block/inline tree for chat bubbles. No HTML is ever produced or interpreted;
 * links are limited to http(s)/mailto so model or web-source text cannot smuggle javascript: URLs.
 */
export type Inline =
  | { t: "text"; v: string } | { t: "bold"; v: string } | { t: "italic"; v: string } | { t: "code"; v: string }
  | { t: "link"; v: string; href: string } | { t: "cite"; n: number };
export type Block =
  | { t: "p"; inline: Inline[] } | { t: "h"; level: 1 | 2 | 3; inline: Inline[] }
  | { t: "code"; lang: string | null; code: string }
  | { t: "ul" | "ol"; items: Inline[][] }
  | { t: "quote"; inline: Inline[] } | { t: "hr" }
  | { t: "table"; header: Inline[][]; rows: Inline[][][] };

const SAFE_HREF = /^(https?:\/\/|mailto:)/i;
export const isSafeHref = (href: string) => SAFE_HREF.test(href.trim()) && !/[\s<>"]/.test(href.trim());

export function parseInline(src: string): Inline[] {
  const out: Inline[] = [];
  const re = /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(\*[^*\s][^*\n]*\*)|(\[([^\]\n]+)\]\(((?:[^()\s]|\([^()\s]*\))+)\))|(\[(\d{1,2})\])/g;
  let last = 0; let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    if (m.index > last) out.push({ t: "text", v: src.slice(last, m.index) });
    if (m[1]) out.push({ t: "code", v: m[1].slice(1, -1) });
    else if (m[2]) out.push({ t: "bold", v: m[2].slice(2, -2) });
    else if (m[3]) out.push({ t: "italic", v: m[3].slice(1, -1) });
    else if (m[4]) { isSafeHref(m[6]) ? out.push({ t: "link", v: m[5], href: m[6].trim() }) : out.push({ t: "text", v: m[5] }); }
    else if (m[7]) out.push({ t: "cite", n: Number(m[8]) });
    last = m.index + m[0].length;
  }
  if (last < src.length) out.push({ t: "text", v: src.slice(last) });
  return out;
}

const splitRow = (line: string) => line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
const isTableSep = (line: string) => /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/.test(line) && line.includes("-");

export function parseMarkdown(src: string): Block[] {
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    const fence = line.match(/^\s*(`{3,}|~{3,})\s*([\w+#.-]*)\s*$/);
    if (fence) {
      const code: string[] = []; i++;
      while (i < lines.length && !new RegExp(`^\\s*${fence[1][0]}{${fence[1].length},}\\s*$`).test(lines[i])) code.push(lines[i++]);
      i++; // closing fence (or EOF for streams cut mid-block)
      blocks.push({ t: "code", lang: fence[2] || null, code: code.join("\n") });
      continue;
    }
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) { blocks.push({ t: "h", level: h[1].length as 1 | 2 | 3, inline: parseInline(h[2]) }); i++; continue; }
    if (/^\s*([-*_])\s*(\1\s*){2,}$/.test(line)) { blocks.push({ t: "hr" }); i++; continue; }
    if (line.includes("|") && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const header = splitRow(line).map(parseInline); i += 2;
      const rows: Inline[][][] = [];
      while (i < lines.length && lines[i].includes("|") && lines[i].trim()) rows.push(splitRow(lines[i++]).map(parseInline));
      blocks.push({ t: "table", header, rows }); continue;
    }
    if (/^\s*>\s?/.test(line)) { const q: string[] = []; while (i < lines.length && /^\s*>\s?/.test(lines[i])) q.push(lines[i++].replace(/^\s*>\s?/, "")); blocks.push({ t: "quote", inline: parseInline(q.join(" ")) }); continue; }
    const ul = /^\s*[-*+]\s+/; const ol = /^\s*\d+[.)]\s+/;
    if (ul.test(line) || ol.test(line)) {
      const ordered = ol.test(line); const items: Inline[][] = [];
      while (i < lines.length && (ordered ? ol : ul).test(lines[i])) items.push(parseInline(lines[i++].replace(ordered ? ol : ul, "")));
      blocks.push({ t: ordered ? "ol" : "ul", items }); continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^\s*(`{3,}|~{3,}|#{1,3}\s|>\s?|[-*+]\s|\d+[.)]\s)/.test(lines[i]) && !(lines[i].includes("|") && i + 1 < lines.length && isTableSep(lines[i + 1]))) para.push(lines[i++]);
    if (!para.length) { para.push(lines[i++]); }
    blocks.push({ t: "p", inline: parseInline(para.join(" ")) });
  }
  return blocks;
}

/** Plain text for speech: no code blocks, no markup, no raw URLs, no citation markers. */
export function toSpeechText(src: string): string {
  return parseMarkdown(src).map((b) => {
    const flat = (inl: Inline[]) => inl.map((x) => (x.t === "cite" ? "" : x.t === "link" ? x.v : "v" in x ? x.v : "")).join("").replace(/\s+/g, " ").trim();
    switch (b.t) {
      case "code": return "(code block omitted)";
      case "p": case "quote": return flat(b.inline);
      case "h": return flat(b.inline) + ".";
      case "ul": case "ol": return b.items.map(flat).join(". ");
      case "table": return "(table omitted)";
      default: return "";
    }
  }).filter(Boolean).join(" ").trim();
}

export function codeBlocks(src: string): { lang: string | null; code: string }[] {
  return parseMarkdown(src).filter((b): b is Extract<Block, { t: "code" }> => b.t === "code").map(({ lang, code }) => ({ lang, code }));
}

/** Splits text at sentence boundaries into chunks no longer than max (TTS engines cap utterance length). */
export function chunkForSpeech(text: string, max = 3000): string[] {
  const out: string[] = []; let cur = "";
  for (const s of text.split(/(?<=[.!?])\s+/)) {
    if (s.length > max) { if (cur) { out.push(cur); cur = ""; } for (let i = 0; i < s.length; i += max) out.push(s.slice(i, i + max)); continue; }
    if ((cur + " " + s).trim().length > max) { out.push(cur); cur = s; } else cur = (cur + " " + s).trim();
  }
  if (cur) out.push(cur);
  return out;
}
