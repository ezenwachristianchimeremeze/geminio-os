import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import type { ComponentProps } from "react";
import type { OpaqueColorValue } from "react-native";

export type AppIconName = ComponentProps<typeof MaterialIcons>["name"];

export interface AppIconProps {
  name: AppIconName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: ComponentProps<typeof MaterialIcons>["style"];
}

/**
 * Native icon implementation. The web implementation lives in app-icon.web.tsx
 * and deliberately avoids loading the MaterialIcons font during browser startup.
 */
export function AppIcon({ name, size = 22, color, style }: AppIconProps) {
  return <MaterialIcons name={name} size={size} color={color} style={style} />;
}
