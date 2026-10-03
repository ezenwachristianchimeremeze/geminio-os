// Cross-platform symbol wrapper. The platform-safe AppIcon facade uses native
// MaterialIcons where supported and system glyphs on web to avoid font startup timeouts.

import { SymbolWeight, SymbolViewProps } from "expo-symbols";
import { OpaqueColorValue, type StyleProp, type TextStyle } from "react-native";

import { AppIcon, type AppIconName } from "./app-icon";

type IconMapping = Record<SymbolViewProps["name"], AppIconName>;
type IconSymbolName = keyof typeof MAPPING;

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING = {
  "house.fill": "home",
  "paperplane.fill": "send",
  "chevron.left.forwardslash.chevron.right": "code",
  "chevron.right": "chevron-right",
  "wrench.fill": "build",
  "gearshape.fill": "settings",
} as IconMapping;

/**
 * Icon names are based on SF Symbols and map to the platform-safe AppIcon facade.
 * Native platforms keep their existing icon coverage; web uses system glyphs and never
 * blocks startup on a remote icon font.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <AppIcon color={color} size={size} name={MAPPING[name]} style={style} />;
}
