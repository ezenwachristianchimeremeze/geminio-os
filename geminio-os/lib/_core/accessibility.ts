/**
 * Geminio OS - Accessibility (WCAG Compliance)
 * 
 * Handles:
 * - ARIA labels
 * - Keyboard navigation
 * - Color contrast
 * - Screen reader support
 * - Focus management
 */

/**
 * ARIA labels for interactive elements
 */
export const ARIA_LABELS = {
  // Navigation
  homeTab: "Home tab",
  chatTab: "Chat with AI",
  advisorTab: "AI Advisor",
  toolsTab: "Tools and features",
  settingsTab: "Settings",

  // Chat
  sendButton: "Send message",
  messageInput: "Message input field",
  voiceInput: "Voice input button",
  attachFile: "Attach file",
  clearChat: "Clear chat history",

  // Job Hub
  searchJobs: "Search for jobs",
  filterJobs: "Filter job results",
  applyJob: "Apply for this job",
  saveJob: "Save job for later",
  jobDetails: "Job details",

  // Finance
  addTransaction: "Add transaction",
  viewBudget: "View budget",
  exportReport: "Export financial report",
  categoryChart: "Spending by category chart",

  // Settings
  toggleDarkMode: "Toggle dark mode",
  notificationSettings: "Notification settings",
  privacySettings: "Privacy settings",
  accountSettings: "Account settings",
  logout: "Logout",

  // General
  close: "Close",
  back: "Go back",
  menu: "Menu",
  search: "Search",
  filter: "Filter",
  sort: "Sort",
  delete: "Delete",
  edit: "Edit",
  save: "Save",
  cancel: "Cancel",
};

/**
 * Color contrast checker (WCAG AA standard: 4.5:1 for normal text)
 */
export function getContrastRatio(color1: string, color2: string): number {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);

  if (!rgb1 || !rgb2) return 0;

  const lum1 = getRelativeLuminance(rgb1);
  const lum2 = getRelativeLuminance(rgb2);

  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);

  return (lighter + 0.05) / (darker + 0.05);
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

function getRelativeLuminance(rgb: { r: number; g: number; b: number }): number {
  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((val) => {
    val = val / 255;
    return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function isWCAGCompliant(ratio: number, level: "AA" | "AAA" = "AA"): boolean {
  const minRatio = level === "AA" ? 4.5 : 7;
  return ratio >= minRatio;
}

/**
 * Keyboard navigation helpers
 */
export const KEYBOARD_KEYS = {
  ENTER: "Enter",
  ESCAPE: "Escape",
  SPACE: " ",
  TAB: "Tab",
  ARROW_UP: "ArrowUp",
  ARROW_DOWN: "ArrowDown",
  ARROW_LEFT: "ArrowLeft",
  ARROW_RIGHT: "ArrowRight",
};

export function handleKeyboardNavigation(
  event: KeyboardEvent,
  callbacks: Record<string, () => void>
) {
  const key = event.key;

  if (callbacks[key]) {
    event.preventDefault();
    callbacks[key]();
  }
}

/**
 * Focus management
 */
export function manageFocus(element: HTMLElement | null) {
  if (element) {
    element.focus();
    // Add visible focus indicator
    element.setAttribute("data-focused", "true");
  }
}

export function removeFocus(element: HTMLElement | null) {
  if (element) {
    element.removeAttribute("data-focused");
  }
}

/**
 * Screen reader announcements
 */
export function announceToScreenReader(message: string, priority: "polite" | "assertive" = "polite") {
  const announcement = document.createElement("div");
  announcement.setAttribute("role", "status");
  announcement.setAttribute("aria-live", priority);
  announcement.setAttribute("aria-atomic", "true");
  announcement.className = "sr-only"; // Screen reader only
  announcement.textContent = message;

  document.body.appendChild(announcement);

  // Remove after announcement
  setTimeout(() => {
    announcement.remove();
  }, 1000);
}

/**
 * Accessibility audit
 */
export interface AccessibilityIssue {
  type: "contrast" | "aria" | "keyboard" | "focus" | "semantic";
  severity: "error" | "warning" | "info";
  message: string;
  element?: string;
  suggestion: string;
}

export function auditAccessibility(): AccessibilityIssue[] {
  const issues: AccessibilityIssue[] = [];

  // Check for ARIA labels on buttons
  const buttons = document.querySelectorAll("button");
  buttons.forEach((btn) => {
    if (!btn.getAttribute("aria-label") && !btn.textContent?.trim()) {
      issues.push({
        type: "aria",
        severity: "error",
        message: "Button missing aria-label",
        element: btn.className,
        suggestion: 'Add aria-label="..." to button',
      });
    }
  });

  // Check for color contrast
  const textElements = document.querySelectorAll("p, span, a, button");
  textElements.forEach((el) => {
    const computed = window.getComputedStyle(el);
    const bgColor = computed.backgroundColor;
    const color = computed.color;

    const ratio = getContrastRatio(bgColor, color);
    if (!isWCAGCompliant(ratio)) {
      issues.push({
        type: "contrast",
        severity: "warning",
        message: `Low color contrast ratio: ${ratio.toFixed(2)}:1`,
        element: el.className,
        suggestion: `Increase contrast to at least 4.5:1 (current: ${ratio.toFixed(2)}:1)`,
      });
    }
  });

  // Check for keyboard accessibility
  const interactiveElements = document.querySelectorAll("button, a, input");
  interactiveElements.forEach((el) => {
    const tabindex = el.getAttribute("tabindex");
    if (tabindex === "-1" && el.getAttribute("role") !== "presentation") {
      issues.push({
        type: "keyboard",
        severity: "warning",
        message: "Interactive element not keyboard accessible",
        element: el.className,
        suggestion: "Remove tabindex='-1' or provide alternative keyboard access",
      });
    }
  });

  return issues;
}

/**
 * Accessibility settings
 */
export interface AccessibilitySettings {
  highContrast: boolean;
  largeText: boolean;
  reduceMotion: boolean;
  screenReaderMode: boolean;
  keyboardOnly: boolean;
}

export const defaultAccessibilitySettings: AccessibilitySettings = {
  highContrast: false,
  largeText: false,
  reduceMotion: false,
  screenReaderMode: false,
  keyboardOnly: false,
};

export function applyAccessibilitySettings(settings: Partial<AccessibilitySettings>) {
  const root = document.documentElement;

  if (settings.highContrast) {
    root.classList.add("high-contrast");
  }

  if (settings.largeText) {
    root.classList.add("large-text");
  }

  if (settings.reduceMotion) {
    root.classList.add("reduce-motion");
  }

  if (settings.screenReaderMode) {
    root.setAttribute("aria-label", "Screen reader mode enabled");
  }
}

/**
 * Semantic HTML helpers
 */
export const SEMANTIC_ELEMENTS = {
  header: "header",
  nav: "nav",
  main: "main",
  article: "article",
  section: "section",
  aside: "aside",
  footer: "footer",
};

export function createSemanticStructure(type: keyof typeof SEMANTIC_ELEMENTS) {
  const element = document.createElement(SEMANTIC_ELEMENTS[type]);
  return element;
}
