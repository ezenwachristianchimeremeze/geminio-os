import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { AppIcon as PlatformAppIcon } from "@/components/ui/app-icon";
import { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";
import type { MaterialIconName, ProductDefinition, ProductMetric, ProductSection } from "@/lib/product-catalog";

export function AppIcon({ name, color, size = 22 }: { name: MaterialIconName; color: string; size?: number }) {
  return <PlatformAppIcon name={name} size={size} color={color} />;
}

export function ScreenHeader({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  const colors = useColors();
  return (
    <View style={styles.headerRow}>
      <View style={styles.headerCopy}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={[styles.screenTitle, { color: colors.foreground }]}>{title}</Text>
        {subtitle ? <Text style={[styles.screenSubtitle, { color: colors.muted }]}>{subtitle}</Text> : null}
      </View>
      {action}
    </View>
  );
}

export function IconButton({
  icon,
  label,
  onPress,
  badge,
}: {
  icon: MaterialIconName;
  label: string;
  onPress: () => void;
  badge?: number;
}) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={({ pressed }) => [
        styles.iconButton,
        { backgroundColor: colors.surface, borderColor: colors.border },
        pressed && styles.pressed,
      ]}
    >
      <AppIcon name={icon} color={colors.foreground} size={21} />
      {badge ? (
        <View style={[styles.iconBadge, { backgroundColor: colors.primary }]}>
          <Text style={styles.iconBadgeText}>{badge > 9 ? "9+" : badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export function SearchPill({ placeholder, onPress }: { placeholder: string; onPress?: () => void }) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="search"
      accessibilityLabel={placeholder}
      onPress={onPress}
      style={({ pressed }) => [
        styles.searchPill,
        { backgroundColor: colors.surface, borderColor: colors.border },
        pressed && styles.pressed,
      ]}
    >
      <AppIcon name="search" size={20} color={colors.muted} />
      <Text style={[styles.searchPlaceholder, { color: colors.muted }]}>{placeholder}</Text>
      <View style={[styles.searchShortcut, { borderColor: colors.border }]}>
        <Text style={[styles.searchShortcutText, { color: colors.muted }]}>⌘ K</Text>
      </View>
    </Pressable>
  );
}

export function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const colors = useColors();
  return (
    <View style={styles.sectionTitleRow}>
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{title}</Text>
      {action ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={action}
          onPress={onAction}
          style={({ pressed }) => [pressed && styles.pressed]}
        >
          <Text style={[styles.sectionAction, { color: colors.primary }]}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function ProductCard({ product, onPress }: { product: ProductDefinition; onPress?: () => void }) {
  const colors = useColors();
  const handlePress = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (onPress) {
      onPress();
      return;
    }
    router.push({ pathname: "/workspace/[product]", params: { product: product.id } });
  };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${product.name}`}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.productCard,
        { backgroundColor: colors.surface, borderColor: colors.border },
        pressed && styles.cardPressed,
      ]}
    >
      <View style={styles.productCardTop}>
        <View style={[styles.productIcon, { backgroundColor: product.surface }]}>
          <AppIcon name={product.icon} color={product.accent} size={23} />
        </View>
        <View style={[styles.openArrow, { backgroundColor: product.surface }]}>
          <AppIcon name="arrow-outward" color={product.accent} size={16} />
        </View>
      </View>
      <Text style={[styles.productName, { color: colors.foreground }]}>{product.name}</Text>
      <Text style={[styles.productDescription, { color: colors.muted }]} numberOfLines={2}>
        {product.description}
      </Text>
      <View style={styles.productFooter}>
        <View style={[styles.categoryDot, { backgroundColor: product.accent }]} />
        <Text style={[styles.categoryText, { color: colors.muted }]}>{product.category}</Text>
      </View>
    </Pressable>
  );
}

export function MetricStrip({ metrics }: { metrics: ProductMetric[] }) {
  const colors = useColors();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.metricScroll}>
      {metrics.map((metric) => (
        <View key={metric.label} style={[styles.metricCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.metricLabel, { color: colors.muted }]}>{metric.label}</Text>
          <Text style={[styles.metricValue, { color: colors.foreground }]}>{metric.value}</Text>
          {metric.change ? <Text style={[styles.metricChange, { color: colors.success }]}>{metric.change}</Text> : null}
        </View>
      ))}
    </ScrollView>
  );
}

export function QuickActionRow({ product, onAction }: { product: ProductDefinition; onAction?: (section?: ProductSection) => void }) {
  const colors = useColors();
  const [activeAction, setActiveAction] = useState<string | null>(null);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.actionScroll}>
      {product.actions.map((action) => (
        <Pressable
          key={action.label}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setActiveAction(action.label);
            onAction?.(action.section);
          }}
          style={({ pressed }) => [
            styles.actionCard,
            { backgroundColor: colors.surface, borderColor: activeAction === action.label ? product.accent : colors.border },
            pressed && styles.cardPressed,
          ]}
        >
          <View style={[styles.actionIcon, { backgroundColor: product.surface }]}>
            <AppIcon name={action.icon} color={product.accent} size={20} />
          </View>
          <Text style={[styles.actionLabel, { color: colors.foreground }]}>{action.label}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

export function ProductDashboard({ product }: { product: ProductDefinition }) {
  const colors = useColors();
  const { isAuthenticated, loading: authLoading } = useAuth({ autoFetch: product.id === "ai-builder" });
  const builderProjectsQuery = trpc.liveBuilder.list.useQuery(undefined, { enabled: product.id === "ai-builder" && isAuthenticated && !authLoading, retry: false });
  const [activeSection, setActiveSection] = useState<ProductSection>("Dashboard");
  const activeIndex = useMemo(() => product.sections.indexOf(activeSection), [activeSection, product.sections]);
  const sectionIsDashboard = activeSection === "Dashboard";
  const builderWorkspaces = builderProjectsQuery.data?.data ?? [];
  const dashboardMetrics = useMemo<ProductMetric[]>(() => {
    if (product.id !== "ai-builder") return product.stats;
    if (!isAuthenticated) return [
      { label: "Projects", value: "Sign in", change: "Connect your workspace" },
      { label: "Runtime", value: "Protected", change: "Account required" },
      { label: "Build health", value: "Unknown", change: "No data loaded" },
    ];
    if (builderProjectsQuery.isLoading) return [
      { label: "Projects", value: "…", change: "Loading" },
      { label: "Runtime", value: "…", change: "Loading" },
      { label: "Build health", value: "…", change: "Loading" },
    ];
    return [
      { label: "Projects", value: String(builderWorkspaces.length), change: builderWorkspaces.length ? "Persisted workspaces" : "Create your first project" },
      { label: "Runtime", value: builderWorkspaces.length ? "Controlled" : "Not started", change: "External runner remains gated" },
      { label: "Build health", value: builderProjectsQuery.isError ? "Unavailable" : builderWorkspaces.length ? "Ready" : "No data", change: builderProjectsQuery.isError ? "Retry the API" : "Based on saved workspaces" },
    ];
  }, [builderProjectsQuery.isError, builderProjectsQuery.isLoading, builderWorkspaces.length, isAuthenticated, product.id, product.stats]);
  const dashboardActivity = product.id === "ai-builder"
    ? builderProjectsQuery.isError
      ? ["Builder activity is unavailable until the API reconnects"]
      : builderProjectsQuery.isLoading
        ? ["Loading persisted Builder activity…"]
        : builderWorkspaces.length
          ? builderWorkspaces.slice(0, 3).map((workspace) => `Project ${workspace.projectId.slice(0, 8)} · ${workspace.status}`)
          : ["No Builder projects yet"]
    : product.recent;
  return (
    <ScreenContainer className="p-0" edges={["top", "left", "right", "bottom"]}>
      <ScrollView contentContainerStyle={styles.dashboardContent} showsVerticalScrollIndicator={false}>
        <View style={styles.dashboardTopRow}>
          <IconButton icon="arrow-back" label="Go back" onPress={() => router.back()} />
          <View style={styles.dashboardTopActions}>
            <IconButton icon="search" label={`Search ${product.name}`} onPress={() => router.push({ pathname: "/workspace/[product]/[section]", params: { product: product.id, section: "Search" } })} />
            <IconButton icon="more-horiz" label="More options" onPress={() => router.push({ pathname: "/workspace/[product]/[section]", params: { product: product.id, section: "Settings" } })} />
          </View>
        </View>

        <View style={styles.productHero}>
          <View style={[styles.productHeroIcon, { backgroundColor: product.surface }]}>
            <AppIcon name={product.icon} color={product.accent} size={28} />
          </View>
          <View style={styles.productHeroCopy}>
            <Text style={[styles.productHeroCategory, { color: product.accent }]}>{product.category} / Geminio OS</Text>
            <Text style={[styles.productHeroTitle, { color: colors.foreground }]}>{product.name}</Text>
            <Text style={[styles.productHeroDescription, { color: colors.muted }]}>{product.description}</Text>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.productNavScroll}>
          {product.sections.map((section, index) => (
            <Pressable
              key={section}
              accessibilityRole="tab"
              accessibilityState={{ selected: activeSection === section }}
              accessibilityLabel={`${section} in ${product.name}`}
              onPress={() => router.push({ pathname: "/workspace/[product]/[section]", params: { product: product.id, section } })}
              style={({ pressed }) => [
                styles.productNavItem,
                activeSection === section && { backgroundColor: product.accent },
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.productNavText, { color: activeSection === section ? "#FFFFFF" : colors.muted }]}>
                {section}
              </Text>
              {index === activeIndex && activeSection !== "Dashboard" ? <View style={styles.activeDot} /> : null}
            </Pressable>
          ))}
        </ScrollView>

        {sectionIsDashboard ? (
          <>
            <SectionTitle title="Overview" />
            <MetricStrip metrics={dashboardMetrics} />
            <SectionTitle title="Quick actions" />
            <QuickActionRow product={product} onAction={(section) => {
              if (product.id === "ai-builder" && section === "Deployments") {
                router.push("/live-build-studio");
                return;
              }
              if (section) router.push({ pathname: "/workspace/[product]/[section]", params: { product: product.id, section } });
            }} />
            <SectionTitle title="Recent activity" action="View all" onAction={() => router.push({ pathname: "/workspace/[product]/[section]", params: { product: product.id, section: "History" } })} />
            <View style={[styles.activityCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {dashboardActivity.map((item, index) => (
                <View key={item} style={[styles.activityRow, index > 0 && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
                  <View style={[styles.activityDot, { backgroundColor: product.accent }]} />
                  <Text style={[styles.activityText, { color: colors.foreground }]}>{item}</Text>
                  <AppIcon name="chevron-right" color={colors.muted} size={18} />
                </View>
              ))}
            </View>
            <View style={[styles.recommendationCard, { backgroundColor: product.surface }]}>
              <View style={[styles.recommendationIcon, { backgroundColor: product.accent }]}>
                <AppIcon name="auto-awesome" color="#FFFFFF" size={17} />
              </View>
              <View style={styles.recommendationCopy}>
                <Text style={[styles.recommendationEyebrow, { color: product.accent }]}>Geminio recommendation</Text>
                <Text style={[styles.recommendationText, { color: colors.foreground }]}>{product.recommendation}</Text>
              </View>
            </View>
          </>
        ) : (
          <ProductSectionView product={product} section={activeSection} />
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

function ProductSectionView({ product, section }: { product: ProductDefinition; section: ProductSection }) {
  const colors = useColors();
  const [boundaryStatus, setBoundaryStatus] = useState<string | null>(null);
  const isWalletTransfer = product.id === "wallet" && (section === "Send" || section === "Receive");
  const sectionCopy: Record<string, { icon: MaterialIconName; title: string; description: string }> = {
    Search: { icon: "search", title: `Search ${product.name}`, description: "Find projects, activity, and saved work across this product." },
    History: { icon: "history", title: "History", description: "Review your recent activity and return to an earlier workflow." },
    Favorites: { icon: "star-outline", title: "Favorites", description: "Keep the workflows, assets, and recommendations you use most close at hand." },
    Analytics: { icon: "insights", title: "Analytics", description: "Track progress, outcomes, and the next best action for this product." },
    Settings: { icon: "settings", title: "Settings", description: "Customize preferences, notifications, permissions, and integrations." },
    Help: { icon: "help-outline", title: "Help center", description: "Get contextual guidance, documentation, and support for this product." },
    Profile: { icon: "person-outline", title: "Product profile", description: "Manage the identity, access, and preferences connected to this product." },
  };
  const copy = sectionCopy[section] ?? {
    icon: "dashboard",
    title: section,
    description: `Manage ${section.toLowerCase()} in your ${product.name} workspace.`,
  };
  return (
    <View style={styles.sectionView}>
      <View style={[styles.sectionHero, { backgroundColor: product.surface }]}>
        <View style={[styles.sectionHeroIcon, { backgroundColor: product.accent }]}>
          <AppIcon name={copy.icon} color="#FFFFFF" size={24} />
        </View>
        <Text style={[styles.sectionHeroTitle, { color: colors.foreground }]}>{copy.title}</Text>
        <Text style={[styles.sectionHeroDescription, { color: colors.muted }]}>{copy.description}</Text>
      </View>
      {isWalletTransfer ? (
        <View style={[styles.boundaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.boundaryIcon, { backgroundColor: `${product.accent}18` }]}><AppIcon name="verified-user" color={product.accent} size={20} /></View>
          <Text style={[styles.boundaryTitle, { color: colors.foreground }]}>Secure provider boundary</Text>
          <Text style={[styles.boundaryText, { color: colors.muted }]}>No {section.toLowerCase()} request is created here. Connect an approved provider, authenticate the account, and review the final result before confirmation.</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={`Review ${section.toLowerCase()} requirements`} onPress={() => { setBoundaryStatus("Ready for provider setup"); Alert.alert("Provider setup", "Geminio has not sent or received funds. Complete provider connection and secure authentication before continuing."); }} style={({ pressed }) => [styles.boundaryButton, { backgroundColor: product.accent }, pressed && styles.cardPressed]}>
            <Text style={styles.boundaryButtonText}>Review requirements</Text>
          </Pressable>
          {boundaryStatus ? <Text style={[styles.boundaryStatus, { color: colors.success }]}>{boundaryStatus}</Text> : null}
        </View>
      ) : null}
      <View style={[styles.sectionList, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {["Personalized workspace", "Recent updates", "Suggested next step"].map((item, index) => (
          <View key={item} style={[styles.sectionListRow, index > 0 && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
            <View style={[styles.sectionListIcon, { backgroundColor: product.surface }]}>
              <AppIcon name={index === 0 ? "tune" : index === 1 ? "update" : "lightbulb-outline"} color={product.accent} size={19} />
            </View>
            <View style={styles.sectionListCopy}>
              <Text style={[styles.sectionListTitle, { color: colors.foreground }]}>{item}</Text>
              <Text style={[styles.sectionListDescription, { color: colors.muted }]}>Ready for your next action in {product.name}.</Text>
            </View>
            <AppIcon name="chevron-right" color={colors.muted} size={18} />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 16 },
  headerCopy: { flex: 1, gap: 5 },
  eyebrow: { color: "#635BFF", fontSize: 12, fontWeight: "700", letterSpacing: 0.7, textTransform: "uppercase" },
  screenTitle: { fontSize: 30, lineHeight: 36, fontWeight: "800", letterSpacing: -0.6 },
  screenSubtitle: { fontSize: 15, lineHeight: 21 },
  iconButton: { width: 42, height: 42, borderRadius: 15, borderWidth: 1, alignItems: "center", justifyContent: "center", position: "relative" },
  iconBadge: { position: "absolute", top: -5, right: -5, minWidth: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  iconBadgeText: { color: "#FFFFFF", fontSize: 10, fontWeight: "800" },
  searchPill: { minHeight: 48, borderRadius: 16, borderWidth: 1, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 10 },
  searchPlaceholder: { flex: 1, fontSize: 14 },
  searchShortcut: { borderWidth: 1, borderRadius: 7, paddingHorizontal: 7, paddingVertical: 3 },
  searchShortcutText: { fontSize: 11, fontWeight: "700" },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 22, marginBottom: 10 },
  sectionTitle: { fontSize: 18, fontWeight: "800", letterSpacing: -0.2 },
  sectionAction: { fontSize: 13, fontWeight: "700" },
  productCard: { flex: 1, minWidth: 160, borderRadius: 22, borderWidth: 1, padding: 16, gap: 9 },
  productCardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  productIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  openArrow: { width: 27, height: 27, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  productName: { fontSize: 16, fontWeight: "800", letterSpacing: -0.2 },
  productDescription: { fontSize: 13, lineHeight: 18, minHeight: 36 },
  productFooter: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 3 },
  categoryDot: { width: 7, height: 7, borderRadius: 4 },
  categoryText: { fontSize: 12, fontWeight: "700" },
  metricScroll: { gap: 10, paddingBottom: 3 },
  metricCard: { width: 140, minHeight: 108, borderRadius: 19, borderWidth: 1, padding: 14, justifyContent: "space-between" },
  metricLabel: { fontSize: 12, fontWeight: "600" },
  metricValue: { fontSize: 24, fontWeight: "800", letterSpacing: -0.6 },
  metricChange: { fontSize: 11, fontWeight: "700" },
  actionScroll: { gap: 10, paddingBottom: 3 },
  actionCard: { minWidth: 128, minHeight: 82, borderRadius: 18, borderWidth: 1, padding: 12, gap: 9 },
  actionIcon: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  actionLabel: { fontSize: 13, fontWeight: "800" },
  dashboardContent: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 40, gap: 2 },
  dashboardTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 22 },
  dashboardTopActions: { flexDirection: "row", gap: 8 },
  productHero: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 22 },
  productHeroIcon: { width: 58, height: 58, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  productHeroCopy: { flex: 1, gap: 3 },
  productHeroCategory: { fontSize: 11, fontWeight: "800", letterSpacing: 0.6, textTransform: "uppercase" },
  productHeroTitle: { fontSize: 28, lineHeight: 32, fontWeight: "800", letterSpacing: -0.6 },
  productHeroDescription: { fontSize: 14, lineHeight: 19 },
  productNavScroll: { gap: 7, paddingBottom: 7 },
  productNavItem: { minHeight: 35, borderRadius: 12, paddingHorizontal: 13, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 5 },
  productNavText: { fontSize: 12, fontWeight: "800" },
  activeDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: "#FFFFFF" },
  activityCard: { borderWidth: 1, borderRadius: 20, overflow: "hidden" },
  activityRow: { minHeight: 58, paddingHorizontal: 15, flexDirection: "row", alignItems: "center", gap: 10 },
  activityDot: { width: 8, height: 8, borderRadius: 4 },
  activityText: { flex: 1, fontSize: 14, fontWeight: "700" },
  recommendationCard: { borderRadius: 20, padding: 16, marginTop: 16, flexDirection: "row", alignItems: "flex-start", gap: 12 },
  recommendationIcon: { width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  recommendationCopy: { flex: 1, gap: 4 },
  recommendationEyebrow: { fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },
  recommendationText: { fontSize: 14, lineHeight: 20, fontWeight: "700" },
  sectionView: { gap: 16, marginTop: 12 },
  sectionHero: { borderRadius: 22, padding: 19, gap: 9 },
  sectionHeroIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", marginBottom: 2 },
  sectionHeroTitle: { fontSize: 22, fontWeight: "800" },
  sectionHeroDescription: { fontSize: 14, lineHeight: 20 },
  boundaryCard: { borderRadius: 20, borderWidth: 1, padding: 16, gap: 8 },
  boundaryIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  boundaryTitle: { fontSize: 15, fontWeight: "800" },
  boundaryText: { fontSize: 12, lineHeight: 18 },
  boundaryButton: { minHeight: 44, borderRadius: 13, paddingHorizontal: 14, alignItems: "center", justifyContent: "center", marginTop: 4 },
  boundaryButtonText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
  boundaryStatus: { fontSize: 12, fontWeight: "700" },
  sectionList: { borderRadius: 20, borderWidth: 1, overflow: "hidden" },
  sectionListRow: { minHeight: 76, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 11 },
  sectionListIcon: { width: 37, height: 37, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  sectionListCopy: { flex: 1, gap: 3 },
  sectionListTitle: { fontSize: 14, fontWeight: "800" },
  sectionListDescription: { fontSize: 12, lineHeight: 17 },
  pressed: { opacity: 0.72 },
  cardPressed: { opacity: 0.82, transform: [{ scale: 0.985 }] },
});
