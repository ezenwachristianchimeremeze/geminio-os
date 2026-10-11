export const themeColors: {
  primary: { light: string; dark: string };
  primaryForeground: { light: string; dark: string };
  primaryText: { light: string; dark: string };
  accent: { light: string; dark: string };
  accentForeground: { light: string; dark: string };
  accentText: { light: string; dark: string };
  background: { light: string; dark: string };
  surface: { light: string; dark: string };
  surfaceMuted: { light: string; dark: string };
  foreground: { light: string; dark: string };
  muted: { light: string; dark: string };
  border: { light: string; dark: string };
  success: { light: string; dark: string };
  successForeground: { light: string; dark: string };
  successText: { light: string; dark: string };
  warning: { light: string; dark: string };
  warningForeground: { light: string; dark: string };
  warningText: { light: string; dark: string };
  error: { light: string; dark: string };
  errorForeground: { light: string; dark: string };
  errorText: { light: string; dark: string };
  info: { light: string; dark: string };
  infoForeground: { light: string; dark: string };
  infoText: { light: string; dark: string };
  focus: { light: string; dark: string };
};

declare const themeConfig: {
  themeColors: typeof themeColors;
};

export default themeConfig;
