import type { StyleProp, TextStyle } from "react-native";
import { Text } from "react-native";

import type { AppIconName } from "./app-icon";

const GLYPHS: Record<string, string> = {
  add: "+",
  "add-circle-outline": "⊕",
  "arrow-back": "←",
  "arrow-forward": "→",
  "arrow-upward": "↑",
  "arrow-downward": "↓",
  apps: "▦",
  archive: "▱",
  "attach-file": "⌕",
  "auto-awesome": "✦",
  bookmark: "🔖",
  "bookmark-border": "◇",
  calendar: "□",
  "chat-bubble-outline": "◌",
  chat: "●",
  check: "✓",
  "check-circle": "●",
  close: "×",
  code: "⌘",
  "content-copy": "⧉",
  create: "✎",
  dashboard: "▦",
  delete: "⌫",
  download: "↓",
  edit: "✎",
  error: "!",
  explore: "✧",
  "explore-off": "◇",
  favorite: "♥",
  "favorite-border": "♡",
  "filter-list": "≡",
  folder: "▰",
  help: "?",
  history: "↶",
  home: "⌂",
  image: "▧",
  info: "i",
  lock: "□",
  menu: "☰",
  more: "⋯",
  "more-vert": "⋮",
  notifications: "●",
  "notifications-none": "○",
  pause: "Ⅱ",
  person: "●",
  "person-outline": "○",
  "play-arrow": "▶",
  refresh: "↻",
  remove: "−",
  search: "⌕",
  send: "➤",
  settings: "⚙",
  share: "↗",
  "smart-toy": "✦",
  star: "★",
  "star-border": "☆",
  stop: "■",
  tune: "≡",
  upload: "↑",
  visibility: "◉",
  wallet: "▱",
  warning: "!",
};

export interface AppIconProps {
  name: AppIconName;
  size?: number;
  color: string;
  style?: StyleProp<TextStyle>;
}

/**
 * Browser-safe icon implementation. It intentionally uses the system sans-serif
 * stack and Unicode glyphs instead of loading the MaterialIcons web font.
 */
export function AppIcon({ name, size = 22, color, style }: AppIconProps) {
  const glyph = GLYPHS[name] ?? "•";
  return (
    <Text
      accessibilityRole="image"
      accessibilityLabel={name}
      style={[
        {
          width: size,
          height: size,
          color,
          fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
          fontSize: Math.max(14, size - 2),
          fontWeight: "700",
          lineHeight: size,
          textAlign: "center",
        },
        style,
      ]}
    >
      {glyph}
    </Text>
  );
}
