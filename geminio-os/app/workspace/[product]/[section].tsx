import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { AppIcon, IconButton, ScreenHeader } from "@/components/super-app";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { accentAsText, onFill } from "@/lib/contrast";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";
import { getProductById, type MaterialIconName, type ProductDefinition, type ProductSection } from "@/lib/product-catalog";

type ScreenState = "ready" | "loading" | "empty" | "error";

type SectionBlueprint = {
  icon: MaterialIconName;
  eyebrow: string;
  title: string;
  description: string;
  primaryAction: string;
  rows: string[];
  form?: string;
};

const common: Record<string, Partial<SectionBlueprint>> = {
  Dashboard: { icon: "dashboard", eyebrow: "Overview", primaryAction: "Open overview" },
  Search: { icon: "search", eyebrow: "Workspace search", primaryAction: "Search" },
  History: { icon: "history", eyebrow: "Activity", primaryAction: "Refresh history" },
  Favorites: { icon: "star-outline", eyebrow: "Saved for later", primaryAction: "Add favorite" },
  Analytics: { icon: "insights", eyebrow: "Insights", primaryAction: "Refresh insights" },
  Settings: { icon: "settings", eyebrow: "Preferences", primaryAction: "Save settings" },
  Help: { icon: "help-outline", eyebrow: "Support", primaryAction: "Get help" },
  Profile: { icon: "person-outline", eyebrow: "Product profile", primaryAction: "Edit profile" },
};

const sectionDetails: Record<string, SectionBlueprint> = {
  Projects: { icon: "folder-open", eyebrow: "Build workspace", title: "Projects", description: "Create, resume, and organize work in this product.", primaryAction: "Create project", rows: ["Recently updated project", "Draft project awaiting review", "Shared project activity"], form: "Project name" },
  Templates: { icon: "collections", eyebrow: "Starter library", title: "Templates", description: "Start from a curated workflow and customize it for your goals.", primaryAction: "Browse templates", rows: ["Recommended for your workspace", "Popular this week", "Saved template" ] },
  Deployments: { icon: "cloud-upload", eyebrow: "Delivery", title: "Deployments", description: "Review build status, approvals, environments, and rollback options.", primaryAction: "Start deployment", rows: ["Production environment", "Staging environment", "Recent deployment log"] },
  "AI Agents": { icon: "smart-toy", eyebrow: "Automation", title: "AI Agents", description: "Configure assistants with explicit tools, permissions, and approval boundaries.", primaryAction: "Create agent", rows: ["Active agent", "Agent awaiting approval", "Agent run history"], form: "Agent name" },
  Images: { icon: "image", eyebrow: "Visual creation", title: "Images", description: "Generate, edit, organize, and export visual assets.", primaryAction: "Create image", rows: ["Latest generated asset", "In-progress generation", "Saved visual" ] },
  Videos: { icon: "videocam", eyebrow: "Motion studio", title: "Videos", description: "Edit clips, apply treatments, and manage export jobs.", primaryAction: "New video", rows: ["Recent edit", "Processing export", "Saved project" ] },
  Music: { icon: "music-note", eyebrow: "Audio studio", title: "Music", description: "Create sound beds, voice tracks, and production-ready exports.", primaryAction: "Create track", rows: ["Latest track", "Draft composition", "Export history" ] },
  Exports: { icon: "download", eyebrow: "Delivery library", title: "Exports", description: "Track completed and processing exports with retry-safe actions.", primaryAction: "Refresh exports", rows: ["Completed export", "Processing export", "Failed export with retry" ] },
  Jobs: { icon: "work-outline", eyebrow: "Opportunities", title: "Jobs", description: "Discover roles matched to your skills and preferences.", primaryAction: "Search roles", rows: ["Recommended role", "New matching role", "Saved search" ] },
  Scholarships: { icon: "school", eyebrow: "Funding", title: "Scholarships", description: "Review funding opportunities and eligibility requirements.", primaryAction: "Find scholarships", rows: ["High-match scholarship", "Deadline approaching", "Saved opportunity" ] },
  Internships: { icon: "business-center", eyebrow: "Early career", title: "Internships", description: "Find practical opportunities and track your applications.", primaryAction: "Search internships", rows: ["Recommended internship", "Application in progress", "Saved internship" ] },
  Applications: { icon: "assignment", eyebrow: "Pipeline", title: "Applications", description: "Track application stages, follow-ups, and next actions.", primaryAction: "Add application", rows: ["In review", "Interview scheduled", "Follow-up due"], form: "Company or role" },
  Saved: { icon: "bookmark", eyebrow: "Your shortlist", title: "Saved", description: "Keep the opportunities and resources you want to revisit.", primaryAction: "Search more", rows: ["Saved opportunity", "Saved resource", "Saved interview prompt" ] },
  Resume: { icon: "description", eyebrow: "Career materials", title: "Resume", description: "Create versions of your resume and prepare them for review.", primaryAction: "Create resume", rows: ["Current resume", "Draft version", "Exported PDF" ], form: "Resume version" },
  "Interview Coach": { icon: "record-voice-over", eyebrow: "Practice", title: "Interview Coach", description: "Practice role-specific questions with structured feedback.", primaryAction: "Start practice", rows: ["Recommended session", "Previous score", "Saved answer" ] },
  Sales: { icon: "trending-up", eyebrow: "Revenue", title: "Sales", description: "Manage pipeline stages, forecasts, and follow-up actions.", primaryAction: "Add opportunity", rows: ["High-value opportunity", "Follow-up due", "Forecast movement" ], form: "Opportunity name" },
  CRM: { icon: "people", eyebrow: "Customers", title: "CRM", description: "Keep customer records, notes, and next actions together.", primaryAction: "Add customer", rows: ["Recent customer", "Renewal due", "Unassigned contact" ], form: "Customer name" },
  Inventory: { icon: "inventory-2", eyebrow: "Operations", title: "Inventory", description: "Monitor stock, reorder points, and supplier actions.", primaryAction: "Add item", rows: ["Low-stock item", "Recent adjustment", "Supplier update" ], form: "Item name" },
  Marketing: { icon: "campaign", eyebrow: "Growth", title: "Marketing", description: "Plan campaigns, content, audiences, and performance reviews.", primaryAction: "Create campaign", rows: ["Active campaign", "Draft content", "Performance alert" ], form: "Campaign name" },
  Reports: { icon: "bar-chart", eyebrow: "Reporting", title: "Reports", description: "Build and review business reports with export-safe data.", primaryAction: "Create report", rows: ["Monthly report", "Scheduled report", "Shared report" ], form: "Report name" },
  Courses: { icon: "menu-book", eyebrow: "Curriculum", title: "Courses", description: "Continue learning and keep your course progress visible.", primaryAction: "Browse courses", rows: ["Continue learning", "Recommended course", "Completed course" ] },
  Tutor: { icon: "psychology", eyebrow: "AI learning", title: "Tutor", description: "Ask questions, request explanations, and practice with feedback.", primaryAction: "Ask tutor", rows: ["Open tutoring session", "Saved explanation", "Practice recommendation" ], form: "Question" },
  Research: { icon: "manage-search", eyebrow: "Knowledge", title: "Research", description: "Collect sources, notes, and structured findings for a project.", primaryAction: "Start research", rows: ["Active research brief", "Saved source", "Unfinished synthesis" ], form: "Research topic" },
  "Study Plans": { icon: "event-note", eyebrow: "Planning", title: "Study Plans", description: "Create focused plans with milestones and reminders.", primaryAction: "Create study plan", rows: ["Active study plan", "Next milestone", "Plan recommendation" ], form: "Plan name" },
  Exams: { icon: "quiz", eyebrow: "Assessment", title: "Exams", description: "Prepare for assessments and review performance safely.", primaryAction: "Start practice", rows: ["Upcoming exam", "Practice set", "Latest result" ] },
  Certificates: { icon: "workspace-premium", eyebrow: "Achievements", title: "Certificates", description: "Review earned certificates and completion requirements.", primaryAction: "View requirements", rows: ["Earned certificate", "In progress", "Recommended credential" ] },
  Balance: { icon: "account-balance-wallet", eyebrow: "Wallet", title: "Balance", description: "Review connected account status without implying unverified funds.", primaryAction: "Connect account", rows: ["Provider connection status", "Available local records", "Verification requirement" ] },
  Transactions: { icon: "receipt-long", eyebrow: "Wallet", title: "Transactions", description: "Review imported or local records with clear source and status labels.", primaryAction: "Add local record", rows: ["Recent transaction", "Pending provider sync", "Local record" ], form: "Record description" },
  Send: { icon: "north-east", eyebrow: "Wallet", title: "Send", description: "Prepare a transfer only after provider authentication and explicit review.", primaryAction: "Review requirements", rows: ["Provider not connected", "Recipient validation", "Confirmation required" ] },
  Receive: { icon: "south-west", eyebrow: "Wallet", title: "Receive", description: "Create a receive request only through a configured and verified provider.", primaryAction: "Review requirements", rows: ["Provider not connected", "Request details", "Confirmation required" ] },
  Categories: { icon: "explore", eyebrow: "Marketplace", title: "Categories", description: "Browse trusted templates, agents, plugins, and creator products.", primaryAction: "Browse catalog", rows: ["Recommended category", "Trending collection", "Saved category" ] },
  "My Purchases": { icon: "shopping-bag", eyebrow: "Marketplace", title: "My Purchases", description: "Access purchases and their provider-verified availability.", primaryAction: "Refresh purchases", rows: ["Recent purchase", "Download available", "Receipt record" ] },
  "My Products": { icon: "inventory-2", eyebrow: "Creator studio", title: "My Products", description: "Manage products, pricing, visibility, and creator activity.", primaryAction: "Create product", rows: ["Published product", "Draft product", "Review needed" ], form: "Product name" },
  Downloads: { icon: "download", eyebrow: "Marketplace", title: "Downloads", description: "Manage available downloads and retry failed transfers.", primaryAction: "Refresh downloads", rows: ["Ready download", "Processing download", "Failed download with retry" ] },
  Reviews: { icon: "reviews", eyebrow: "Marketplace", title: "Reviews", description: "Review feedback and respond to product activity.", primaryAction: "Write review", rows: ["Pending review", "Recent feedback", "Creator response" ] },
  Orders: { icon: "shopping-cart", eyebrow: "Marketplace", title: "Orders", description: "Track order status, receipts, and support paths.", primaryAction: "Refresh orders", rows: ["Processing order", "Completed order", "Support request" ] },
  Calls: { icon: "call", eyebrow: "Phone Assistant", title: "Calls", description: "Review call actions and permission-safe assistant commands.", primaryAction: "Start voice", rows: ["Recent call action", "Permission required", "Saved command" ] },
  Messages: { icon: "message", eyebrow: "Phone Assistant", title: "Messages", description: "Prepare messages with explicit review before sending.", primaryAction: "Compose message", rows: ["Draft message", "Permission required", "Recent activity" ], form: "Message" },
  Automations: { icon: "bolt", eyebrow: "Phone Assistant", title: "Automations", description: "Create routines with visible triggers, permissions, and pause controls.", primaryAction: "Create automation", rows: ["Active automation", "Needs permission", "Paused automation" ], form: "Automation name" },
  "Threat Scan": { icon: "security", eyebrow: "Protection", title: "Threat Scan", description: "Scan supported content and review findings without overstating coverage.", primaryAction: "Run scan", rows: ["Latest scan", "Permission status", "Recommended action" ] },
  "Audit Log": { icon: "history", eyebrow: "Protection", title: "Audit Log", description: "Review security events, access changes, and resolution history.", primaryAction: "Refresh log", rows: ["Recent security event", "Access change", "Resolved alert" ] },
  Technology: { icon: "computer", eyebrow: "News", title: "Technology", description: "Read technology stories matched to your interests.", primaryAction: "Refresh stories", rows: ["Featured story", "Trending topic", "Saved source" ] },
  Business: { icon: "business", eyebrow: "News", title: "Business", description: "Follow business coverage with source and timestamp context.", primaryAction: "Refresh stories", rows: ["Featured story", "Market context", "Saved source" ] },
  Finance: { icon: "payments", eyebrow: "News", title: "Finance", description: "Review finance coverage with clear informational boundaries.", primaryAction: "Refresh stories", rows: ["Featured story", "Market context", "Saved source" ] },
  "AI News": { icon: "auto-awesome", eyebrow: "News", title: "AI News", description: "Follow AI developments with source-aware reading states.", primaryAction: "Refresh stories", rows: ["Featured story", "Research update", "Saved source" ] },
  Trending: { icon: "trending-up", eyebrow: "News", title: "Trending", description: "See what is receiving attention across your selected topics.", primaryAction: "Refresh trends", rows: ["Trending story", "Fast-rising topic", "Saved trend" ] },
  Bookmarks: { icon: "bookmark", eyebrow: "News", title: "Bookmarks", description: "Keep stories and sources available for later reading.", primaryAction: "Search news", rows: ["Saved story", "Saved topic", "Unread bookmark" ] },
  Tasks: { icon: "check-circle", eyebrow: "Planning", title: "Tasks", description: "Capture, prioritize, and complete your next actions.", primaryAction: "Add task", rows: ["Due today", "Upcoming task", "Completed task" ], form: "Task title" },
  Notes: { icon: "note-add", eyebrow: "Planning", title: "Notes", description: "Capture ideas and turn them into organized next steps.", primaryAction: "Capture note", rows: ["Recent note", "Pinned note", "Unsorted note" ], form: "Note title" },
  Routines: { icon: "schedule", eyebrow: "Planning", title: "Routines", description: "Build repeatable routines with reminders and pause controls.", primaryAction: "Create routine", rows: ["Morning routine", "Evening routine", "Paused routine" ], form: "Routine name" },
};

function makeBlueprint(product: ProductDefinition, section: ProductSection): SectionBlueprint {
  const detail = sectionDetails[section];
  const base = common[section];
  if (detail) return detail;
  return {
    icon: base?.icon ?? "dashboard",
    eyebrow: base?.eyebrow ?? product.name,
    title: base?.title ?? section,
    description: base?.description ?? `Manage ${section.toLowerCase()} in your ${product.name} workspace.`,
    primaryAction: base?.primaryAction ?? "Continue",
    rows: ["Personalized workspace", "Recent updates", "Suggested next step"],
    form: base?.form,
  };
}

export default function ProductSectionRoute() {
  const router = useRouter();
  const colors = useColors();
  const { isAuthenticated, loading: authLoading } = useAuth({ autoFetch: true });
  const createWorkspaceMutation = trpc.liveBuilder.create.useMutation();
  const params = useLocalSearchParams<{ product?: string; section?: string }>();
  const product = typeof params.product === "string" ? getProductById(params.product) : undefined;
  const section = typeof params.section === "string" ? decodeURIComponent(params.section) as ProductSection : "Dashboard";
  const [state, setState] = useState<ScreenState>("ready");
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const blueprint = useMemo(() => product ? makeBlueprint(product, section) : null, [product, section]);

  if (!product || !blueprint) {
    return <ScreenContainer className="p-5"><Text style={{ color: colors.foreground }}>This workspace could not be found.</Text></ScreenContainer>;
  }

  const executePrimary = async () => {
    if (product.id === "ai-builder" && section === "Projects") {
      if (authLoading || !isAuthenticated) {
        Alert.alert("Sign in required", "AI Builder projects are account-scoped. Sign in before creating a persistent project.");
        return;
      }
      if (!draft.trim()) {
        setState("error");
        return;
      }
      setState("loading");
      try {
        const result = await createWorkspaceMutation.mutateAsync({ name: draft.trim(), description: "Created from the AI Builder Projects workspace", kind: "website", existingProjectId: null });
        if (!result.data?.id) throw new Error("The project was not persisted.");
        router.push({ pathname: "/live-build-studio", params: { workspaceId: result.data.id } });
      } catch (error) {
        setState("error");
        Alert.alert("Project creation failed", error instanceof Error ? error.message : "The project could not be created.");
      }
      return;
    }
    if (product.id === "wallet" && (section === "Send" || section === "Receive")) {
      Alert.alert("Provider setup required", "No financial action has been sent. Connect and authenticate an approved provider before confirmation.");
      return;
    }
    setState("loading");
    setTimeout(() => setState("ready"), 450);
  };

  const retrySection = () => {
    if (product.id === "wallet" && (section === "Send" || section === "Receive")) {
      setState("ready");
      return;
    }
    executePrimary();
  };

  const filteredRows = blueprint.rows.filter((row) => row.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <ScreenContainer edges={["top", "left", "right", "bottom"]} className="p-0">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.topRow}>
          <IconButton icon="arrow-back" label={`Back to ${product.name}`} onPress={() => router.back()} />
          <View style={styles.topActions}>
            <IconButton icon="help-outline" label={`Help for ${blueprint.title}`} onPress={() => Alert.alert("Help", `Contextual help for ${blueprint.title} is ready. Review the guidance and try again if needed.`)} />
            <IconButton icon="more-horiz" label="More section options" onPress={() => Alert.alert("Section options", "Export, share, and notification controls are available through the connected provider boundary.")} />
          </View>
        </View>

        <ScreenHeader eyebrow={`${blueprint.eyebrow} / ${product.name}`} title={blueprint.title} subtitle={blueprint.description} action={<View style={[styles.iconTile, { backgroundColor: product.surface }]}><AppIcon name={blueprint.icon} color={product.accent} size={25} /></View>} />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sectionNav}>
          {product.sections.map((item) => (
            <Pressable key={item} accessibilityRole="tab" accessibilityState={{ selected: item === section }} onPress={() => router.replace({ pathname: "/workspace/[product]/[section]", params: { product: product.id, section: item } })} style={({ pressed }) => [styles.navItem, { borderColor: item === section ? product.accent : colors.border, backgroundColor: item === section ? product.accent : colors.surface }, pressed && styles.pressed]}>
              <Text style={{ color: item === section ? "#FFFFFF" : colors.muted, fontWeight: "700", fontSize: 12 }}>{item}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.stateRow}>
          {(["ready", "loading", "empty", "error"] as ScreenState[]).map((value) => (
            <Pressable key={value} accessibilityRole="button" accessibilityLabel={`Show ${value} state`} onPress={() => setState(value)} style={({ pressed }) => [styles.stateChip, { borderColor: state === value ? product.accent : colors.border, backgroundColor: state === value ? product.surface : colors.surface }, pressed && styles.pressed]}>
              <Text style={{ color: state === value ? accentAsText(product.accent, colors.surface) : colors.muted, fontSize: 11, fontWeight: "800", textTransform: "capitalize" }}>{value}</Text>
            </Pressable>
          ))}
        </View>

        <View style={[styles.heroCard, { backgroundColor: product.surface }]}>
          <View style={[styles.heroIcon, { backgroundColor: onFill(product.accent).fill }]}><AppIcon name={blueprint.icon} color={onFill(product.accent).text} size={24} /></View>
          <View style={styles.heroCopy}><Text style={[styles.heroTitle, { color: colors.foreground }]}>{state === "loading" ? "Updating this workspace…" : state === "error" ? "Something needs attention" : state === "empty" ? "Nothing here yet" : blueprint.title}</Text><Text style={[styles.heroText, { color: colors.muted }]}>{state === "error" ? "The request could not be completed. Check your connection and retry." : state === "empty" ? "Start with the primary action to create the first item." : "Every action remains reviewable, reversible where possible, and explicit about provider state."}</Text></View>
        </View>

        {(section === "Search" || blueprint.form) ? <View style={[styles.formCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.formLabel, { color: colors.foreground }]}>{section === "Search" ? "Search this workspace" : blueprint.form}</Text>
          <TextInput value={section === "Search" ? query : draft} onChangeText={section === "Search" ? setQuery : setDraft} placeholder={section === "Search" ? `Search ${product.name}` : `Enter ${blueprint.form?.toLowerCase()}`} placeholderTextColor={colors.muted} style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]} returnKeyType="done" />
          <Pressable accessibilityRole="button" onPress={executePrimary} style={({ pressed }) => [styles.primaryButton, { backgroundColor: onFill(product.accent).fill }, pressed && styles.pressed]}><AppIcon name={section === "Search" ? "search" : "add"} size={18} color={onFill(product.accent).text} /><Text style={[styles.primaryButtonText, { color: onFill(product.accent).text }]}>{blueprint.primaryAction}</Text></Pressable>
        </View> : null}

        {state === "error" ? <View style={[styles.notice, { backgroundColor: `${colors.error}12`, borderColor: colors.error }]}><AppIcon name="error-outline" color={colors.error} size={20} /><Text style={[styles.noticeText, { color: colors.foreground }]}>We could not load this screen. Your local draft is safe.</Text><Pressable accessibilityRole="button" onPress={retrySection}><Text style={{ color: colors.error, fontWeight: "800" }}>Retry</Text></Pressable></View> : null}
        {state === "empty" ? <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}><AppIcon name="inbox" color={colors.muted} size={28} /><Text style={[styles.emptyTitle, { color: colors.foreground }]}>No items yet</Text><Text style={[styles.emptyText, { color: colors.muted }]}>Your first {blueprint.title.toLowerCase()} will appear here.</Text><Pressable accessibilityRole="button" onPress={executePrimary} style={({ pressed }) => [styles.primaryButton, { backgroundColor: product.accent }, pressed && styles.pressed]}><Text style={styles.primaryButtonText}>{blueprint.primaryAction}</Text></Pressable></View> : null}

        {state === "ready" || state === "loading" ? <View style={[styles.listCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.listTitle, { color: colors.foreground }]}>{state === "loading" ? "Loading updates" : "Workspace activity"}</Text>
          {filteredRows.length ? filteredRows.map((row, index) => <Pressable key={row} accessibilityRole="button" accessibilityLabel={row} onPress={() => Alert.alert(row, `Open the ${row.toLowerCase()} detail workflow for ${product.name}.`)} style={({ pressed }) => [styles.listRow, index > 0 && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth }, pressed && styles.pressed]}><View style={[styles.rowIcon, { backgroundColor: product.surface }]}><AppIcon name={index === 0 ? blueprint.icon : index === 1 ? "update" : "lightbulb-outline"} color={product.accent} size={18} /></View><View style={styles.rowCopy}><Text style={[styles.rowTitle, { color: colors.foreground }]}>{row}</Text><Text style={[styles.rowText, { color: colors.muted }]}>Review status, details, and next action.</Text></View><AppIcon name="chevron-right" color={colors.muted} size={18} /></Pressable>) : <Text style={[styles.emptyText, { color: colors.muted }]}>No matching items.</Text>}
        </View> : null}

        <Pressable accessibilityRole="button" onPress={executePrimary} style={({ pressed }) => [styles.primaryButton, { backgroundColor: product.accent }, pressed && styles.pressed]}><AppIcon name="arrow-forward" size={18} color="#FFFFFF" /><Text style={styles.primaryButtonText}>{blueprint.primaryAction}</Text></Pressable>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 18, paddingBottom: 48, maxWidth: 1120, width: "100%", alignSelf: "center" },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  topActions: { flexDirection: "row", gap: 8 },
  iconTile: { width: 54, height: 54, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  sectionNav: { gap: 8, paddingVertical: 2 },
  navItem: { minHeight: 40, borderRadius: 14, borderWidth: 1, paddingHorizontal: 13, alignItems: "center", justifyContent: "center" },
  stateRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  stateChip: { minHeight: 36, borderRadius: 12, borderWidth: 1, paddingHorizontal: 11, justifyContent: "center" },
  heroCard: { borderRadius: 24, padding: 18, flexDirection: "row", gap: 13, alignItems: "center" },
  heroIcon: { width: 46, height: 46, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  heroCopy: { flex: 1, gap: 5 },
  heroTitle: { fontSize: 18, fontWeight: "800" },
  heroText: { fontSize: 13, lineHeight: 19 },
  formCard: { borderRadius: 20, borderWidth: 1, padding: 16, gap: 10 },
  formLabel: { fontSize: 14, fontWeight: "800" },
  input: { minHeight: 48, borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, fontSize: 15 },
  primaryButton: { minHeight: 48, borderRadius: 15, paddingHorizontal: 17, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  primaryButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  notice: { borderRadius: 18, borderWidth: 1, padding: 14, flexDirection: "row", gap: 10, alignItems: "center" },
  noticeText: { flex: 1, fontSize: 13, lineHeight: 18 },
  emptyCard: { borderRadius: 20, borderWidth: 1, padding: 24, alignItems: "center", gap: 9 },
  emptyTitle: { fontSize: 17, fontWeight: "800" },
  emptyText: { fontSize: 13, lineHeight: 18, textAlign: "center" },
  listCard: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 15 },
  listTitle: { fontSize: 16, fontWeight: "800", paddingTop: 15, paddingBottom: 6 },
  listRow: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 12 },
  rowIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  rowCopy: { flex: 1, gap: 3 },
  rowTitle: { fontSize: 14, fontWeight: "700" },
  rowText: { fontSize: 12, lineHeight: 17 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.985 }] },
});
