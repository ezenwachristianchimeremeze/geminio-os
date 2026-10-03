import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { AppIcon, IconButton, ScreenHeader } from "@/components/super-app";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";

type ModuleId = "developer-console" | "news-hub" | "markets" | "personal-assistant" | "phone-assistant" | "ai-builder" | "media-studio" | "career-hub" | "business-hub" | "learning-hub" | "ai-guardian" | "marketplace" | "wallet" | "credits";
type ViewState = "ready" | "loading" | "empty" | "error" | "offline" | "success";

const modules: Record<ModuleId, { name: string; tagline: string; icon: string; accent: string; sections: string[]; actions: string[]; items: string[] }> = {
  "developer-console": { name: "Developer Console", tagline: "Ship, inspect, and operate projects with confidence.", icon: "terminal", accent: "#5B5CE2", sections: ["Projects", "Tasks", "Logs", "Code review", "Tests", "Deployments", "Secrets", "Settings"], actions: ["New task", "Review code", "Run tests"], items: ["Mobile release hardening", "AI Builder acceptance run", "API contract review"] },
  "news-hub": { name: "News Hub", tagline: "A focused briefing across technology, business, finance, and AI.", icon: "newspaper", accent: "#0B7EA4", sections: ["Technology", "Business", "Finance", "AI News", "Trending", "Bookmarks", "Settings"], actions: ["Search stories", "Save briefing", "Share digest"], items: ["Today’s technology briefing", "AI model release watch", "Market context briefing"] },
  markets: { name: "Markets", tagline: "Track watchlists and market context without pretending to execute trades.", icon: "show-chart", accent: "#0E9F6E", sections: ["Overview", "Watchlists", "Asset detail", "Charts", "Alerts", "Settings"], actions: ["Add watchlist", "Set alert", "Refresh data"], items: ["My watchlist", "Market movers", "Data availability"] },
  "personal-assistant": { name: "Personal Assistant", tagline: "Turn intent into organized tasks, reminders, notes, and routines.", icon: "assistant", accent: "#D97706", sections: ["Tasks", "Calendar", "Reminders", "Notes", "Routines", "History", "Settings"], actions: ["Add task", "Create reminder", "Capture note"], items: ["Today’s priorities", "Upcoming reminders", "Recent notes"] },
  "phone-assistant": { name: "Phone Assistant", tagline: "Helpful device actions with explicit permissions and platform-safe fallbacks.", icon: "phone-android", accent: "#C2417A", sections: ["Contacts", "Calls", "Messages", "Device actions", "Permissions", "Settings"], actions: ["Find contact", "Compose message", "Check permissions"], items: ["Permission center", "Recent communication", "Available device actions"] },
  "ai-builder": { name: "AI Builder", tagline: "Plan, generate, review, test, and ship software with explicit approvals.", icon: "build", accent: "#5B5FE2", sections: ["Projects", "Templates", "Agents", "Workflows", "Deployments", "History", "Settings"], actions: ["New project", "Generate code", "Run review"], items: ["Active projects", "Pending approvals", "Recent builds"] },
  "media-studio": { name: "Media Studio", tagline: "Create and manage images, video, music, templates, and exports.", icon: "movie", accent: "#EC4899", sections: ["Images", "Videos", "Music", "Templates", "Projects", "Exports", "Settings"], actions: ["New project", "Create image", "Export media"], items: ["Recent projects", "Processing exports", "Saved templates"] },
  "career-hub": { name: "Career Hub", tagline: "Find opportunities, manage applications, and prepare for interviews.", icon: "work", accent: "#0EA5E9", sections: ["Jobs", "Scholarships", "Internships", "Applications", "Saved", "Resume", "Interview Coach", "Settings"], actions: ["Search opportunities", "Update resume", "Start interview practice"], items: ["Recommended opportunities", "Active applications", "Upcoming preparation"] },
  "business-hub": { name: "Business Hub", tagline: "Coordinate sales, CRM, inventory, marketing, and reporting workflows.", icon: "business", accent: "#14B8A6", sections: ["Sales", "CRM", "Inventory", "Marketing", "Reports", "Analytics", "Settings"], actions: ["Add CRM record", "Review sales", "Create report"], items: ["Pipeline summary", "Inventory watch", "Marketing performance"] },
  "learning-hub": { name: "Learning Hub", tagline: "Study with courses, tutoring, research, plans, exams, and certificates.", icon: "school", accent: "#F97316", sections: ["Courses", "Tutor", "Research", "Study Plans", "Exams", "Certificates", "Settings"], actions: ["Find a course", "Ask tutor", "Create study plan"], items: ["Current courses", "Study streak", "Upcoming exams"] },
  "ai-guardian": { name: "AI Guardian", tagline: "Monitor security posture, scans, threats, and privacy controls.", icon: "security", accent: "#EF4444", sections: ["Dashboard", "Scans", "Threats", "Audit Logs", "Permissions", "Alerts", "Settings"], actions: ["Start scan", "Review alerts", "Audit permissions"], items: ["Security posture", "Open findings", "Recent scans"] },
  marketplace: { name: "Marketplace", tagline: "Discover products, manage purchases, downloads, orders, and reviews.", icon: "storefront", accent: "#D946EF", sections: ["Categories", "Search", "Purchases", "Downloads", "Orders", "Reviews", "My Products", "Settings"], actions: ["Browse categories", "Review purchases", "List a product"], items: ["Recommended products", "Recent purchases", "Creator activity"] },
  wallet: { name: "Wallet", tagline: "Review connected accounts and financial workflows without fabricated balances.", icon: "account-balance-wallet", accent: "#16A34A", sections: ["Overview", "Accounts", "Transactions", "Send", "Receive", "Cards", "Budgets", "Analytics", "Settings"], actions: ["Connect account", "Review transfer", "Open analytics"], items: ["Connection status", "Provider requirements", "Recent activity"] },
  credits: { name: "Credits & Plans", tagline: "Review usage, entitlements, plans, trials, offers, and provider-safe billing.", icon: "local-offer", accent: "#7C3AED", sections: ["Overview", "Usage", "Plans", "Trials", "Invoices", "Offers", "Settings"], actions: ["Review plan", "View usage", "Check entitlements"], items: ["Current entitlement", "Usage summary", "Billing boundary"] },
};

export default function ModuleDashboardScreen() {
  const colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ module?: string; section?: string }>();
  const moduleId = (typeof params.module === "string" && params.module in modules ? params.module : "personal-assistant") as ModuleId;
  const module = modules[moduleId];
  const [activeSection, setActiveSection] = useState(typeof params.section === "string" ? params.section : "Dashboard");
  const [viewState, setViewState] = useState<ViewState>("ready");
  const [query, setQuery] = useState("");

  const filteredItems = useMemo(() => module.items.filter((item) => item.toLowerCase().includes(query.toLowerCase())), [module.items, query]);
  const openSection = (section: string) => {
    const unsupportedCatalogModule = moduleId === "developer-console" || moduleId === "markets";
    if (unsupportedCatalogModule) {
      const screen = `${moduleId}-${section.toLowerCase().replace(/\s+/g, "-")}`;
      router.push({ pathname: "/blueprint/[screen]", params: { screen } });
      return;
    }
    router.push({ pathname: "/workspace/[product]/[section]", params: { product: moduleId, section } });
  };

  const runAction = (action: string) => {
    const actionRoutes: Record<string, string> = {
      "New task": "developer-console-task",
      "Review code": "developer-console-review",
      "Run tests": "developer-console-tests",
      "Search stories": "news-hub-search",
      "Save briefing": "news-hub-bookmarks",
      "Share digest": "news-hub-briefing",
      "Add watchlist": "markets-watchlist",
      "Set alert": "markets-alerts",
      "Refresh data": "markets-refresh",
      "Add task": "personal-assistant-task",
      "Create reminder": "personal-assistant-reminder",
      "Capture note": "personal-assistant-note",
      "Find contact": "phone-assistant-contacts",
      "Compose message": "phone-assistant-messages",
      "Check permissions": "phone-assistant-permissions",
    };
    const blueprint = actionRoutes[action];
    if (blueprint) {
      router.push({ pathname: "/blueprint/[screen]", params: { screen: blueprint } });
      return;
    }
    setViewState("loading");
    setTimeout(() => setViewState(action === "Refresh data" ? "success" : "ready"), 350);
  };

  return (
    <ScreenContainer edges={["top", "left", "right", "bottom"]} className="p-0">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topRow}><IconButton icon="arrow-back" label="Back to workspace" onPress={() => router.back()} /><View style={styles.topActions}><IconButton icon="search" label="Search module" onPress={() => setActiveSection("Search")} /><IconButton icon="settings" label="Module settings" onPress={() => setActiveSection("Settings")} /></View></View>
        <View style={[styles.hero, { backgroundColor: module.accent }]}><View style={styles.heroIcon}><AppIcon name={module.icon as any} color="#FFFFFF" size={25} /></View><View style={styles.heroCopy}><Text style={styles.heroEyebrow}>Geminio OS product</Text><Text style={styles.heroTitle}>{module.name}</Text><Text style={styles.heroSubtitle}>{module.tagline}</Text></View><Text style={styles.heroMeta}>Dedicated dashboard · {module.sections.length} work areas · provider-safe actions</Text></View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>{["Dashboard", ...module.sections].map((section) => <Pressable key={section} onPress={() => openSection(section)} accessibilityRole="tab" accessibilityState={{ selected: activeSection === section }} style={({ pressed }) => [styles.tab, activeSection === section && { backgroundColor: module.accent }, pressed && styles.pressed]}><Text style={[styles.tabText, { color: activeSection === section ? "#FFFFFF" : colors.muted }]}>{section}</Text></Pressable>)}</ScrollView>
        {activeSection === "Search" ? <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.cardTitle, { color: colors.foreground }]}>Search {module.name}</Text><TextInput value={query} onChangeText={setQuery} placeholder="Search this product" placeholderTextColor={colors.muted} style={[styles.input, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]} /><ModuleList items={filteredItems} colors={colors} /></View> : <><View style={styles.metrics}><Metric label="Active area" value={activeSection} colors={colors} /><Metric label="State" value={viewState === "ready" ? "Ready" : viewState} colors={colors} /><Metric label="Next action" value={module.actions[0]} colors={colors} /></View><Text style={[styles.sectionTitle, { color: colors.foreground }]}>{activeSection === "Dashboard" ? "Quick actions" : activeSection}</Text><View style={styles.actions}>{module.actions.map((action) => <Pressable key={action} onPress={() => runAction(action)} style={({ pressed }) => [styles.action, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && styles.pressed]}><View style={[styles.actionIcon, { backgroundColor: `${module.accent}18` }]}><AppIcon name="add" color={module.accent} size={18} /></View><Text style={[styles.actionText, { color: colors.foreground }]}>{action}</Text><AppIcon name="chevron-right" color={colors.muted} size={18} /></Pressable>)}</View><View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.cardTitle, { color: colors.foreground }]}>{activeSection === "Dashboard" ? "Recent activity" : `${activeSection} workspace`}</Text>{viewState === "loading" ? <Text style={[styles.body, { color: colors.muted }]}>Processing securely…</Text> : viewState === "error" ? <Text style={[styles.body, { color: colors.error }]}>This area could not load. Retry when the connection is available.</Text> : viewState === "offline" ? <Text style={[styles.body, { color: colors.warning }]}>You are offline. Changes will remain local until sync resumes.</Text> : viewState === "empty" ? <Text style={[styles.body, { color: colors.muted }]}>Nothing here yet. Use a quick action to create the first item.</Text> : <ModuleList items={filteredItems} colors={colors} />}</View></>}
        <Pressable onPress={() => setViewState("offline")} style={({ pressed }) => [styles.secondary, { borderColor: colors.border }, pressed && styles.pressed]}><Text style={[styles.secondaryText, { color: colors.foreground }]}>Preview offline state</Text></Pressable>
      </ScrollView>
    </ScreenContainer>
  );
}

function ModuleList({ items, colors }: { items: string[]; colors: ReturnType<typeof useColors> }) { return items.length ? <View>{items.map((item, index) => <View key={item} style={[styles.listRow, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}><View style={[styles.dot, { backgroundColor: colors.primary }]} /><Text style={[styles.body, { color: colors.foreground }]}>{item}</Text><AppIcon name="chevron-right" color={colors.muted} size={16} /></View>)}</View> : <Text style={[styles.body, { color: colors.muted }]}>No matching items found.</Text>; }
function Metric({ label, value, colors }: { label: string; value: string; colors: ReturnType<typeof useColors> }) { return <View style={[styles.metric, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.metricLabel, { color: colors.muted }]}>{label}</Text><Text numberOfLines={1} style={[styles.metricValue, { color: colors.foreground }]}>{value}</Text></View>; }

const styles = StyleSheet.create({ content: { padding: 20, gap: 18, paddingBottom: 48, maxWidth: 1180, width: "100%", alignSelf: "center" }, topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, topActions: { flexDirection: "row", gap: 8 }, hero: { borderRadius: 26, padding: 22, gap: 10 }, heroIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: "#FFFFFF28", alignItems: "center", justifyContent: "center" }, heroCopy: { gap: 3 }, heroEyebrow: { color: "#FFFFFFB8", fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 }, heroTitle: { color: "#FFFFFF", fontSize: 26, fontWeight: "800" }, heroSubtitle: { color: "#FFFFFFDD", fontSize: 13, lineHeight: 19 }, heroMeta: { color: "#FFFFFFCC", fontSize: 12, fontWeight: "700" }, tabs: { gap: 8, paddingVertical: 2 }, tab: { minHeight: 40, borderRadius: 14, paddingHorizontal: 14, justifyContent: "center" }, tabText: { fontSize: 12, fontWeight: "800" }, metrics: { flexDirection: "row", flexWrap: "wrap", gap: 10 }, metric: { flexGrow: 1, minWidth: 150, borderWidth: 1, borderRadius: 16, padding: 14, gap: 5 }, metricLabel: { fontSize: 11, fontWeight: "700" }, metricValue: { fontSize: 15, fontWeight: "800" }, sectionTitle: { fontSize: 19, fontWeight: "800", marginTop: 4 }, actions: { flexDirection: "row", flexWrap: "wrap", gap: 10 }, action: { minHeight: 58, flexGrow: 1, minWidth: 220, borderWidth: 1, borderRadius: 17, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", gap: 10 }, actionIcon: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" }, actionText: { flex: 1, fontSize: 13, fontWeight: "800" }, card: { borderWidth: 1, borderRadius: 20, padding: 16, gap: 12 }, cardTitle: { fontSize: 16, fontWeight: "800" }, listRow: { minHeight: 54, flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 }, dot: { width: 8, height: 8, borderRadius: 8 }, body: { flex: 1, fontSize: 13, lineHeight: 19 }, input: { minHeight: 48, borderWidth: 1, borderRadius: 14, paddingHorizontal: 13, fontSize: 14 }, secondary: { minHeight: 48, borderWidth: 1, borderRadius: 14, alignItems: "center", justifyContent: "center" }, secondaryText: { fontSize: 13, fontWeight: "800" }, pressed: { opacity: 0.72, transform: [{ scale: 0.985 }] },});
