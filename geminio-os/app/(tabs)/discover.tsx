import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { AppIcon, IconButton, ProductCard, ScreenHeader, SectionTitle } from "@/components/super-app";
import { useColors } from "@/hooks/use-colors";
import { PRODUCT_CATALOG, type ProductDefinition } from "@/lib/product-catalog";

const TOPICS = ["For you", "AI & software", "Creativity", "Career", "Business", "Learning"];

export default function DiscoverScreen() {
  const colors = useColors();
  const [activeTopic, setActiveTopic] = useState(TOPICS[0]);
  const [query, setQuery] = useState("");
  const featured = PRODUCT_CATALOG.filter((product) => ["ai-builder", "learning-hub", "media-studio"].includes(product.id));
  const filtered = useMemo(() => {
    if (!query.trim()) return PRODUCT_CATALOG;
    const normalized = query.trim().toLowerCase();
    return PRODUCT_CATALOG.filter((product) => `${product.name} ${product.description} ${product.category}`.toLowerCase().includes(normalized));
  }, [query]);

  return (
    <ScreenContainer className="p-0" edges={["top", "left", "right", "bottom"]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <ScreenHeader
          eyebrow="Explore the ecosystem"
          title="Discover"
          subtitle="Find ideas, products, and intelligent workflows tailored to you."
          action={<IconButton icon="bookmark-border" label="Saved discoveries" onPress={() => router.push({ pathname: "/workspace/[product]", params: { product: "marketplace" } })} />}
        />

        <View style={[styles.searchField, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <AppIcon name="search" color={colors.muted} size={20} />
          <TextInput value={query} onChangeText={setQuery} placeholder="Search products and ideas" placeholderTextColor={colors.muted} style={[styles.searchInput, { color: colors.foreground }]} accessibilityLabel="Search Discover" />
          {query ? <Pressable accessibilityRole="button" accessibilityLabel="Clear Discover search" onPress={() => setQuery("")}><AppIcon name="close" color={colors.muted} size={18} /></Pressable> : null}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.topicScroll}>
          {TOPICS.map((topic) => {
            const active = activeTopic === topic;
            return (
              <Pressable key={topic} accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={() => setActiveTopic(topic)} style={({ pressed }) => [styles.topicPill, { backgroundColor: active ? colors.foreground : colors.surface, borderColor: active ? colors.foreground : colors.border }, pressed && styles.pressed]}>
                <Text style={[styles.topicText, { color: active ? colors.background : colors.muted }]}>{topic}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {!query ? (
          <>
            <SectionTitle title="Picked for you" action="Refresh" onAction={() => setQuery("")} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.featuredScroll}>
              {featured.map((product) => <DiscoveryFeature key={product.id} product={product} />)}
            </ScrollView>
            <SectionTitle title="Trending this week" />
          </>
        ) : <SectionTitle title="Search results" />}

        <View style={styles.grid}>
          {filtered.map((product) => <View key={product.id} style={styles.gridItem}><ProductCard product={product} /></View>)}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

function DiscoveryFeature({ product }: { product: ProductDefinition }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Discover ${product.name}`} onPress={() => router.push({ pathname: "/workspace/[product]", params: { product: product.id } })} style={({ pressed }) => [styles.featureCard, { backgroundColor: product.accent }, pressed && styles.featurePressed]}>
      <View style={[styles.featureIcon, { backgroundColor: product.surface }]}><AppIcon name={product.icon} color={product.accent} size={22} /></View>
      <Text style={styles.featureCategory}>{product.category}</Text>
      <Text style={styles.featureTitle}>{product.name}</Text>
      <Text style={styles.featureDescription}>{product.description}</Text>
      <View style={styles.featureFooter}><Text style={styles.featureCta}>Explore</Text><AppIcon name="arrow-forward" color="#FFFFFF" size={16} /></View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 17, paddingBottom: 40 },
  searchField: { minHeight: 50, borderRadius: 17, borderWidth: 1, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 10, marginTop: 20 },
  searchInput: { flex: 1, minHeight: 45, fontSize: 14 },
  topicScroll: { gap: 7, paddingVertical: 14 },
  topicPill: { minHeight: 34, borderWidth: 1, borderRadius: 12, paddingHorizontal: 13, alignItems: "center", justifyContent: "center" },
  topicText: { fontSize: 12, fontWeight: "800" },
  featuredScroll: { gap: 10, paddingBottom: 3 },
  featureCard: { width: 210, minHeight: 190, borderRadius: 22, padding: 16, gap: 7 },
  featureIcon: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  featureCategory: { color: "rgba(255,255,255,0.75)", fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.6 },
  featureTitle: { color: "#FFFFFF", fontSize: 19, fontWeight: "800" },
  featureDescription: { color: "rgba(255,255,255,0.82)", fontSize: 12, lineHeight: 17, flex: 1 },
  featureFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 5 },
  featureCta: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  gridItem: { width: "48.5%" },
  pressed: { opacity: 0.72 },
  featurePressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
});
