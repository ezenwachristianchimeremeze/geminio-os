import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { parseMarkdown, type Block, type Inline } from "@/lib/home-chat/markdown";

type Source = { index: number; title: string; url: string; host: string };
const mono = { fontFamily: "monospace" as const };

function Inlines({ items, sources, color }: { items: Inline[]; sources: Source[]; color: string }) {
  const c = useColors();
  return (
    <Text style={[styles.body, { color }]} selectable>
      {items.map((x, i) => {
        switch (x.t) {
          case "bold": return <Text key={i} style={styles.bold}>{x.v}</Text>;
          case "italic": return <Text key={i} style={styles.italic}>{x.v}</Text>;
          case "code": return <Text key={i} style={[mono, { backgroundColor: c.surfaceMuted }]}>{` ${x.v} `}</Text>;
          case "link": return <Text key={i} accessibilityRole="link" style={[styles.link, { color: c.accentText }]} onPress={() => void Linking.openURL(x.href)}>{x.v}</Text>;
          case "cite": {
            const s = sources.find((y) => y.index === x.n);
            // Only render a citation chip when it maps to a REAL retrieved source; otherwise show plain text.
            return s ? <Text key={i} accessibilityRole="link" accessibilityLabel={`Source ${x.n}: ${s.title}`} style={{ color: c.accentText, fontWeight: "700" }} onPress={() => void Linking.openURL(s.url)}>{`[${x.n}]`}</Text> : <Text key={i}>{`[${x.n}]`}</Text>;
          }
          default: return <Text key={i}>{x.v}</Text>;
        }
      })}
    </Text>
  );
}

export function MessageContent({ markdown, sources = [], onCopyCode, onRunCode, color }: { markdown: string; sources?: Source[]; onCopyCode: (code: string) => void; onRunCode?: (lang: string, code: string) => void; color?: string }) {
  const c = useColors();
  const fg = color ?? c.foreground;
  const blocks: Block[] = parseMarkdown(markdown);
  return (
    <View style={{ gap: 8 }}>
      {blocks.map((b, i) => {
        switch (b.t) {
          case "p": return <Inlines key={i} items={b.inline} sources={sources} color={fg} />;
          case "h": return <Text key={i} accessibilityRole="header" style={[styles.heading, { color: fg, fontSize: 20 - (b.level - 1) * 2 }]}>{b.inline.map((x) => ("v" in x ? x.v : "")).join("")}</Text>;
          case "quote": return <View key={i} style={[styles.quote, { borderLeftColor: c.border }]}><Inlines items={b.inline} sources={sources} color={c.muted} /></View>;
          case "hr": return <View key={i} style={{ height: 1, backgroundColor: c.border }} />;
          case "ul": case "ol": return (
            <View key={i} style={{ gap: 4 }}>
              {b.items.map((it, j) => (
                <View key={j} style={{ flexDirection: "row", gap: 8 }}>
                  <Text style={[styles.body, { color: fg, minWidth: 18 }]}>{b.t === "ol" ? `${j + 1}.` : "•"}</Text>
                  <View style={{ flex: 1 }}><Inlines items={it} sources={sources} color={fg} /></View>
                </View>
              ))}
            </View>
          );
          case "code": return (
            <View key={i} style={[styles.codeBox, { backgroundColor: c.surfaceMuted, borderColor: c.border }]}>
              <View style={[styles.codeHeader, { borderBottomColor: c.border }]}>
                <Text style={[styles.codeLang, { color: c.muted }]}>{b.lang ?? "code"}</Text>
                {onRunCode && b.lang && /^(js|javascript|ts|typescript|py|python)$/i.test(b.lang) ? <Pressable accessibilityRole="button" accessibilityLabel={`Run ${b.lang} code in a sandbox`} onPress={() => onRunCode(b.lang!, b.code)} style={styles.codeCopy} hitSlop={8}><Text style={{ color: c.primaryText, fontWeight: "600", fontSize: 13 }}>Run</Text></Pressable> : null}
                <Pressable accessibilityRole="button" accessibilityLabel={`Copy ${b.lang ?? ""} code block`} onPress={() => onCopyCode(b.code)} style={styles.codeCopy} hitSlop={8}>
                  <Text style={{ color: c.primaryText, fontWeight: "600", fontSize: 13 }}>Copy code</Text>
                </Pressable>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator accessibilityLabel="Code block, scrolls horizontally"><Text selectable style={[mono, styles.code, { color: c.foreground }]}>{b.code}</Text></ScrollView>
            </View>
          );
          case "table": return (
            <ScrollView key={i} horizontal accessibilityLabel="Table, scrolls horizontally" style={[styles.table, { borderColor: c.border }]}>
              <View>
                <View style={{ flexDirection: "row", backgroundColor: c.surfaceMuted }}>{b.header.map((h, j) => <View key={j} style={[styles.cell, { borderColor: c.border }]}><Text style={[styles.bold, { color: fg }]}>{h.map((x) => ("v" in x ? x.v : "")).join("")}</Text></View>)}</View>
                {b.rows.map((r, ri) => <View key={ri} style={{ flexDirection: "row" }}>{r.map((cell, j) => <View key={j} style={[styles.cell, { borderColor: c.border }]}><Inlines items={cell} sources={sources} color={fg} /></View>)}</View>)}
              </View>
            </ScrollView>
          );
        }
      })}
    </View>
  );
}

export function SourceList({ sources }: { sources: Source[] }) {
  const c = useColors();
  if (!sources.length) return null;
  return (
    <View accessibilityLabel="Web sources" style={[styles.sources, { borderColor: c.border }]}>
      <Text style={{ color: c.muted, fontSize: 12, fontWeight: "700" }}>Retrieved from the web</Text>
      {sources.map((s) => (
        <Pressable key={s.index} accessibilityRole="link" accessibilityLabel={`Open source ${s.index}: ${s.title} on ${s.host}`} onPress={() => void Linking.openURL(s.url)} style={styles.sourceRow}>
          <Text style={{ color: c.accentText, fontSize: 13 }} numberOfLines={1}>{`[${s.index}] ${s.title}`}</Text>
          <Text style={{ color: c.muted, fontSize: 12 }} numberOfLines={1}>{s.host}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { fontSize: 16, lineHeight: 24 }, bold: { fontWeight: "700" }, italic: { fontStyle: "italic" }, link: { textDecorationLine: "underline" },
  heading: { fontWeight: "700", marginTop: 4 }, quote: { borderLeftWidth: 3, paddingLeft: 10 },
  codeBox: { borderWidth: 1, borderRadius: 10, overflow: "hidden" }, codeHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 12, borderBottomWidth: 1, minHeight: 40 },
  codeLang: { fontSize: 12, textTransform: "lowercase" }, codeCopy: { minHeight: 44, minWidth: 44, justifyContent: "center", alignItems: "flex-end" }, code: { fontSize: 13, lineHeight: 20, padding: 12 },
  table: { borderWidth: 1, borderRadius: 8 }, cell: { borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 10, paddingVertical: 6, minWidth: 96 },
  sources: { borderTopWidth: 1, marginTop: 8, paddingTop: 8, gap: 2 }, sourceRow: { minHeight: 44, justifyContent: "center" },
});
