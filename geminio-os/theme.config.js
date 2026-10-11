/**
 * Geminio OS design tokens.
 *
 * Brand colours come from the Master Blueprint and are used UNCHANGED for fills,
 * icons, borders and tints: primary #4F46E5, accent #3B82F6, success #10B981,
 * warning #F59E0B, error #EF4444, light background #F8FAFC, text #0F172A.
 *
 * The blueprint palette fails WCAG 1.4.3 (4.5:1) when used as TEXT on white, and
 * white text fails on several brand fills. So text always uses a paired token:
 *   <name>Text        text on background / surface / surfaceMuted and on the
 *                     20% tint of the brand fill (e.g. bg-success/20)
 *   <name>Foreground  text on the solid brand fill (e.g. bg-success)
 * Values were derived by darkening/lightening the brand colour in HSL (hue and
 * saturation preserved) until the requirement was met. They are enforced by
 * tests/design-tokens.test.ts; do not edit one without re-running it.
 *
 * `focus` is the keyboard focus ring (WCAG 1.4.11, >= 3:1 on every background).
 *
 * @type {const}
 */
const themeColors = {
  primary: { light: '#4F46E5', dark: '#818CF8' },
  primaryForeground: { light: '#FFFFFF', dark: '#0F172A' },
  primaryText: { light: '#4940E5', dark: '#99A4F8' },
  accent: { light: '#3B82F6', dark: '#60A5FA' },
  accentForeground: { light: '#0F172A', dark: '#0F172A' },
  accentText: { light: '#0959D6', dark: '#74AFFA' },
  background: { light: '#F8FAFC', dark: '#0B1120' },
  surface: { light: '#FFFFFF', dark: '#111827' },
  surfaceMuted: { light: '#F1F5F9', dark: '#1E293B' },
  foreground: { light: '#0F172A', dark: '#F8FAFC' },
  muted: { light: '#617188', dark: '#94A3B8' },
  border: { light: '#E2E8F0', dark: '#334155' },
  success: { light: '#10B981', dark: '#34D399' },
  successForeground: { light: '#0F172A', dark: '#0F172A' },
  successText: { light: '#10715D', dark: '#34D399' },
  warning: { light: '#F59E0B', dark: '#FBBF24' },
  warningForeground: { light: '#0F172A', dark: '#0F172A' },
  warningText: { light: '#80630A', dark: '#FBBF24' },
  error: { light: '#EF4444', dark: '#F87171' },
  errorForeground: { light: '#0F172A', dark: '#0F172A' },
  errorText: { light: '#BF1010', dark: '#F88585' },
  info: { light: '#3B82F6', dark: '#60A5FA' },
  infoForeground: { light: '#0F172A', dark: '#0F172A' },
  infoText: { light: '#0959D6', dark: '#74AFFA' },
  focus: { light: '#4F46E5', dark: '#A5B4FC' },
};

module.exports = { themeColors };
