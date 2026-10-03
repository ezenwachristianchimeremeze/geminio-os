import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { router } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { AppIcon, IconButton, ProductCard, ScreenHeader, SectionTitle } from "@/components/super-app";
import { useColors } from "@/hooks/use-colors";
import { PRODUCT_CATEGORIES, PRODUCT_CATALOG, getProductsByCategory, searchProducts, type ProductCategory } from "@/lib/product-catalog";

export default function WorkspaceScreen() {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const columns = width >= 1200 ? 4 : width >= 760 ? 3 : 2;
  const contentWidth = Math.min(Math.max(width - 40, 320), 1120);
  const gridGap = 10;
  const gridItemWidth = (contentWidth - gridGap * (columns - 1)) / columns;
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<ProductCategory | "All">("All");
  const [favorites, setFavorites] = useState<string[]>(["ai-builder", "personal-assistant"]);

  const visibleProducts = useMemo(() => {
    const products = query.trim() ? searchProducts(query) : activeCategory === "All" ? PRODUCT_CATALOG : getProductsByCategory(activeCategory);
    return activeCategory === "All" || query.trim() ? products : products;
  }, [activeCategory, query]);
  const featured = PRODUCT_CATALOG[0];
  const recentProducts = PRODUCT_CATALOG.filter((product) => ["ai-builder", "wallet", "personal-assistant"].includes(product.id));
  const additionalModules = [
    { id: "developer-console", name: "Developer Console", icon: "terminal", accent: "#5B5CE2" },
    { id: "news-hub", name: "News Hub", icon: "newspaper", accent: "#0B7EA4" },
    { id: "markets", name: "Markets", icon: "show-chart", accent: "#0E9F6E" },
    { id: "phone-assistant", name: "Phone Assistant", icon: "phone-android", accent: "#C2417A" },
  ];

  const toggleFavorite = (id: string) => {
    setFavorites((previous) => previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id]);
  };

  return (
    <ScreenContainer className="p-0" edges={["top", "left", "right", "bottom"]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { maxWidth: 1120, width: "100%", alignSelf: "center" }]}>
        <ScreenHeader
          eyebrow="Your ecosystem"
          title="Workspace"
          subtitle="Everything you need to build, create, grow, and stay organized."
          action={<IconButton icon="tune" label="Workspace preferences" onPress={() => router.push("/profile/settings")} />}
        />

        <View style={styles.searchBlock}>
          <View style={[styles.searchField, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <AppIcon name="search" color={colors.muted} size={20} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search products and workflows"
              placeholderTextColor={colors.muted}
              style={[styles.searchInput, { color: colors.foreground }]}
              accessibilityLabel="Search Workspace products"
            />
            {query ? <Pressable accessibilityRole="button" accessibilityLabel="Clear product search" onPress={() => setQuery("")}><AppIcon name="close" color={colors.muted} size={18} /></Pressable> : <Text style={[styles.searchHint, { color: colors.muted }]}>⌘ K</Text>}
          </View>
        </View>

        <View style={styles.categoryScrollWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
            {["All", ...PRODUCT_CATEGORIES].map((category) => {
              const isActive = activeCategory === category;
              return (
                <Pressable
                  key={category}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: isActive }}
                  accessibilityLabel={`${category} products`}
                  onPress={() => setActiveCategory(category as ProductCategory | "All")}
                  style={({ pressed }) => [styles.categoryPill, { backgroundColor: isActive ? colors.primary : colors.surface, borderColor: isActive ? colors.primary : colors.border }, pressed && styles.pressed]}
                >
                  <Text style={[styles.categoryPillText, { color: isActive ? "#FFFFFF" : colors.muted }]}>{category}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {!query && activeCategory === "All" ? (
          <>
            <SectionTitle title="Featured workspace" />
            <Pressable accessibilityRole="button" accessibilityLabel={`Open ${featured.name}`} onPress={() => router.push({ pathname: "/workspace/[product]", params: { product: featured.id } })} style={({ pressed }) => [styles.featuredCard, { backgroundColor: featured.accent }, pressed && styles.featuredPressed]}>
              <View style={styles.featuredCopy}>
                <View style={styles.featuredPill}><AppIcon name="auto-awesome" color="#FFFFFF" size={14} /><Text style={styles.featuredPillText}>Recommended for you</Text></View>
                <Text style={styles.featuredTitle}>{featured.name}</Text>
                <Text style={styles.featuredDescription}>{featured.description}</Text>
                <View style={styles.featuredCta}><Text style={styles.featuredCtaText}>Open workspace</Text><AppIcon name="arrow-forward" color="#FFFFFF" size={17} /></View>
              </View>
              <View style={styles.featuredOrb}><AppIcon name="auto-awesome" color="#FFFFFF" size={56} /></View>
            </Pressable>

            <SectionTitle title="Recently opened" action="See all" onAction={() => setActiveCategory("All")} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recentScroll}>
              {recentProducts.map((product) => (
                <View key={product.id} style={styles.recentProductWrap}>
                  <ProductCard product={product} />
                  <Pressable accessibilityRole="button" accessibilityLabel={`${favorites.includes(product.id) ? "Remove" : "Add"} ${product.name} favorite`} onPress={() => toggleFavorite(product.id)} style={({ pressed }) => [styles.favoriteButton, { backgroundColor: colors.background, borderColor: colors.border }, pressed && styles.pressed]}>
                    <AppIcon name={favorites.includes(product.id) ? "star" : "star-outline"} color={favorites.includes(product.id) ? "#F6B73C" : colors.muted} size={17} />
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          </>
        ) : null}

        {!query && activeCategory === "All" ? <><SectionTitle title="More Geminio OS products" /><View style={styles.moduleGrid}>{additionalModules.map((module) => <Pressable key={module.id} accessibilityRole="button" accessibilityLabel={`Open ${module.name}`} onPress={() => router.push({ pathname: "/module/[module]", params: { module: module.id } })} style={({ pressed }) => [styles.moduleCard, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && styles.pressed]}><View style={[styles.moduleIcon, { backgroundColor: module.accent }]}><AppIcon name={module.icon as any} color="#FFFFFF" size={19} /></View><Text style={[styles.moduleTitle, { color: colors.foreground }]}>{module.name}</Text><AppIcon name="chevron-right" color={colors.muted} size={17} /></Pressable>)}</View></> : null}

        <SectionTitle title={query ? "Search results" : activeCategory === "All" ? "All products" : `${activeCategory} products`} />
        {visibleProducts.length > 0 ? (
            <View style={[styles.grid, { gap: gridGap }]}>
            {visibleProducts.map((product) => (
              <View style={[styles.gridItem, { width: gridItemWidth }]} key={product.id}>
                <ProductCard product={product} />
                <Pressable accessibilityRole="button" accessibilityLabel={`${favorites.includes(product.id) ? "Remove" : "Add"} ${product.name} favorite`} onPress={() => toggleFavorite(product.id)} style={({ pressed }) => [styles.gridFavorite, { backgroundColor: colors.background, borderColor: colors.border }, pressed && styles.pressed]}>
                  <AppIcon name={favorites.includes(product.id) ? "star" : "star-outline"} color={favorites.includes(product.id) ? "#F6B73C" : colors.muted} size={17} />
                </Pressable>
              </View>
            ))}
          </View>
        ) : (
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <AppIcon name="search-off" color={colors.muted} size={28} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No products found</Text>
            <Text style={[styles.emptyDescription, { color: colors.muted }]}>Try a different product name or category.</Text>
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 17, paddingBottom: 40 },
  searchBlock: { marginTop: 20 },
  searchField: { minHeight: 50, borderRadius: 17, borderWidth: 1, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 10 },
  searchInput: { flex: 1, fontSize: 14, minHeight: 45 },
  searchHint: { fontSize: 11, fontWeight: "700" },
  categoryScrollWrap: { marginHorizontal: -20, marginTop: 13 },
  categoryScroll: { paddingHorizontal: 20, gap: 7 },
  categoryPill: { minHeight: 34, borderWidth: 1, borderRadius: 12, paddingHorizontal: 13, alignItems: "center", justifyContent: "center" },
  categoryPillText: { fontSize: 12, fontWeight: "800" },
  featuredCard: { minHeight: 184, borderRadius: 25, padding: 19, flexDirection: "row", overflow: "hidden", alignItems: "stretch" },
  featuredCopy: { flex: 1, gap: 8, zIndex: 2 },
  featuredPill: { alignSelf: "flex-start", borderRadius: 9, backgroundColor: "rgba(255,255,255,0.18)", paddingHorizontal: 9, minHeight: 25, flexDirection: "row", alignItems: "center", gap: 5 },
  featuredPillText: { color: "#FFFFFF", fontSize: 10, fontWeight: "800" },
  featuredTitle: { color: "#FFFFFF", fontSize: 25, fontWeight: "800", letterSpacing: -0.6, marginTop: 6 },
  featuredDescription: { color: "rgba(255,255,255,0.83)", fontSize: 13, lineHeight: 18, maxWidth: 250 },
  featuredCta: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: "auto" },
  featuredCtaText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
  featuredOrb: { width: 112, height: 112, borderRadius: 56, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center", alignSelf: "center", marginRight: -25 },
  recentScroll: { gap: 10, paddingBottom: 4 },
  recentProductWrap: { width: 192, position: "relative" },
  favoriteButton: { position: "absolute", top: 10, right: 10, width: 30, height: 30, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  moduleGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  moduleCard: { minHeight: 66, flexGrow: 1, flexBasis: 220, borderWidth: 1, borderRadius: 17, padding: 12, flexDirection: "row", alignItems: "center", gap: 10 },
  moduleIcon: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  moduleTitle: { flex: 1, fontSize: 13, fontWeight: "800" },
  gridItem: { width: "48.5%", position: "relative" },
  gridFavorite: { position: "absolute", top: 10, right: 10, width: 30, height: 30, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  emptyCard: { minHeight: 170, borderRadius: 20, borderWidth: 1, alignItems: "center", justifyContent: "center", gap: 7, padding: 20 },
  emptyTitle: { fontSize: 16, fontWeight: "800" },
  emptyDescription: { fontSize: 13, textAlign: "center" },
  pressed: { opacity: 0.72 },
  featuredPressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
});
