import { Redirect, useLocalSearchParams } from "expo-router";

import { ProductDashboard } from "@/components/super-app";
import { getProductById } from "@/lib/product-catalog";

export default function ProductDashboardRoute() {
  const { product } = useLocalSearchParams<{ product?: string }>();
  const definition = typeof product === "string" ? getProductById(product) : undefined;

  if (!definition) {
    return <Redirect href="/" />;
  }

  return <ProductDashboard product={definition} />;
}
