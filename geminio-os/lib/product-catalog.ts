import type { ComponentProps } from "react";
import type MaterialIcons from "@expo/vector-icons/MaterialIcons";

export type ProductCategory = "Build" | "Create" | "Grow" | "Organize" | "Protect" | "Discover";
export type ProductSection =
  | "Dashboard"
  | "Search"
  | "History"
  | "Favorites"
  | "Analytics"
  | "Settings"
  | "Help"
  | "Profile"
  | "Projects"
  | "Templates"
  | "Deployments"
  | "AI Agents"
  | "Images"
  | "Videos"
  | "Music"
  | "Exports"
  | "Jobs"
  | "Scholarships"
  | "Internships"
  | "Applications"
  | "Saved"
  | "Resume"
  | "Interview Coach"
  | "Sales"
  | "CRM"
  | "Inventory"
  | "Marketing"
  | "Reports"
  | "Courses"
  | "Tutor"
  | "Research"
  | "Study Plans"
  | "Exams"
  | "Certificates"
  | "Balance"
  | "Transactions"
  | "Send"
  | "Receive"
  | "Categories"
  | "My Purchases"
  | "My Products"
  | "Downloads"
  | "Reviews"
  | "Orders"
  | "Calls"
  | "Messages"
  | "Automations"
  | "Threat Scan"
  | "Audit Log"
  | "Technology"
  | "Business"
  | "Finance"
  | "AI News"
  | "Trending"
  | "Bookmarks"
  | "Tasks"
  | "Notes"
  | "Routines";

export type MaterialIconName = ComponentProps<typeof MaterialIcons>["name"];

export interface ProductMetric {
  label: string;
  value: string;
  change?: string;
}

export interface ProductAction {
  label: string;
  icon: MaterialIconName;
  section?: ProductSection;
}

export interface ProductDefinition {
  id: string;
  name: string;
  category: ProductCategory;
  description: string;
  icon: MaterialIconName;
  accent: string;
  surface: string;
  stats: ProductMetric[];
  actions: ProductAction[];
  sections: ProductSection[];
  recent: string[];
  recommendation: string;
}

export const PRODUCT_CATALOG: ProductDefinition[] = [
  {
    id: "ai-builder",
    name: "AI Builder",
    category: "Build",
    description: "Design, generate, review, and ship software with Geminio.",
    icon: "auto-awesome",
    accent: "#635BFF",
    surface: "#F0EEFF",
    stats: [
      { label: "Active projects", value: "12", change: "+3 this week" },
      { label: "Deployments", value: "28", change: "+18%" },
      { label: "Build health", value: "98%", change: "Excellent" },
    ],
    actions: [
      { label: "New project", icon: "add", section: "Projects" },
      { label: "Open studio", icon: "code", section: "Deployments" },
      { label: "AI agents", icon: "smart-toy", section: "AI Agents" },
    ],
    sections: ["Dashboard", "Projects", "Templates", "Deployments", "AI Agents", "History", "Favorites", "Analytics", "Settings", "Help"],
    recent: ["Geminio mobile refresh", "Creator marketplace API", "Voice assistant workflow"],
    recommendation: "Your Workspace project is ready for a security review before the next deployment.",
  },
  {
    id: "media-studio",
    name: "Media Studio",
    category: "Create",
    description: "Generate and refine images, videos, music, and campaigns.",
    icon: "movie-creation",
    accent: "#E85AAD",
    surface: "#FFF0F8",
    stats: [
      { label: "Assets created", value: "86", change: "+12 this month" },
      { label: "Exports", value: "34", change: "+9%" },
      { label: "Saved time", value: "11h", change: "This month" },
    ],
    actions: [
      { label: "Create image", icon: "image", section: "Images" },
      { label: "Edit video", icon: "videocam", section: "Videos" },
      { label: "Open templates", icon: "collections", section: "Templates" },
    ],
    sections: ["Dashboard", "Images", "Videos", "Music", "Templates", "Projects", "Exports", "History", "Favorites", "Analytics", "Settings", "Help"],
    recent: ["Launch campaign visuals", "Podcast highlight reel", "Product music bed"],
    recommendation: "Try the new cinematic preset on your latest product launch storyboard.",
  },
  {
    id: "career-hub",
    name: "Career Hub",
    category: "Grow",
    description: "Find opportunities, improve your profile, and practice with AI.",
    icon: "work-outline",
    accent: "#2B8A78",
    surface: "#EAF8F4",
    stats: [
      { label: "Applications", value: "18", change: "4 in review" },
      { label: "Profile score", value: "86", change: "+8 points" },
      { label: "Interviews", value: "3", change: "Next: Friday" },
    ],
    actions: [
      { label: "Find roles", icon: "search", section: "Jobs" },
      { label: "Update resume", icon: "description", section: "Resume" },
      { label: "Practice", icon: "record-voice-over", section: "Interview Coach" },
    ],
    sections: ["Dashboard", "Jobs", "Scholarships", "Internships", "Applications", "Saved", "Resume", "Interview Coach", "History", "Favorites", "Analytics", "Settings", "Help"],
    recent: ["Senior Product Designer application", "Resume v4", "Leadership interview prep"],
    recommendation: "Three saved roles match your updated skills profile. Review them today.",
  },
  {
    id: "business-hub",
    name: "Business Hub",
    category: "Grow",
    description: "Run sales, customers, inventory, marketing, and reporting in one place.",
    icon: "business-center",
    accent: "#E58A2B",
    surface: "#FFF6E8",
    stats: [
      { label: "Pipeline", value: "$84k", change: "+14%" },
      { label: "Customers", value: "248", change: "+22 this month" },
      { label: "Open tasks", value: "17", change: "5 due today" },
    ],
    actions: [
      { label: "View pipeline", icon: "trending-up", section: "Sales" },
      { label: "Add customer", icon: "person-add", section: "CRM" },
      { label: "Create report", icon: "bar-chart", section: "Reports" },
    ],
    sections: ["Dashboard", "Sales", "CRM", "Inventory", "Marketing", "Reports", "Analytics", "History", "Favorites", "Settings", "Help"],
    recent: ["Q3 revenue report", "Northstar customer renewal", "Inventory reorder plan"],
    recommendation: "Your highest-value pipeline segment needs follow-up from the sales team.",
  },
  {
    id: "learning-hub",
    name: "Learning Hub",
    category: "Grow",
    description: "Study with an AI tutor, build plans, and track progress.",
    icon: "school",
    accent: "#3478F6",
    surface: "#EEF4FF",
    stats: [
      { label: "Study streak", value: "12d", change: "+1 day" },
      { label: "Course progress", value: "64%", change: "+9%" },
      { label: "Focus time", value: "8.4h", change: "This week" },
    ],
    actions: [
      { label: "Ask tutor", icon: "psychology", section: "Tutor" },
      { label: "Study plan", icon: "event-note", section: "Study Plans" },
      { label: "Research", icon: "menu-book", section: "Research" },
    ],
    sections: ["Dashboard", "Courses", "Tutor", "Research", "Study Plans", "Exams", "Certificates", "History", "Favorites", "Analytics", "Settings", "Help"],
    recent: ["Product strategy course", "Machine learning flashcards", "Certification practice exam"],
    recommendation: "A 20-minute review session will keep your current study streak on track.",
  },
  {
    id: "wallet",
    name: "Wallet",
    category: "Organize",
    description: "See your balance, transactions, budgets, and financial insights.",
    icon: "account-balance-wallet",
    accent: "#169C67",
    surface: "#EAF8F1",
    stats: [
      { label: "Account", value: "Not linked", change: "Connect to sync" },
      { label: "Transactions", value: "No data", change: "Add a local record" },
      { label: "Insights", value: "Ready", change: "After setup" },
    ],
    actions: [
      { label: "Send money", icon: "north-east", section: "Send" },
      { label: "Add funds", icon: "south-west", section: "Receive" },
      { label: "View insights", icon: "insights", section: "Analytics" },
    ],
    sections: ["Dashboard", "Balance", "Transactions", "Send", "Receive", "Analytics", "History", "Favorites", "Settings", "Help"],
    recent: ["No synced activity yet", "Connect an account to import transactions", "Manual records stay on this device"],
    recommendation: "Connect a supported account or add a local record to unlock financial insights.",
  },
  {
    id: "marketplace",
    name: "Marketplace",
    category: "Organize",
    description: "Discover trusted templates, agents, plugins, and creator products.",
    icon: "storefront",
    accent: "#D45F3B",
    surface: "#FFF0EC",
    stats: [
      { label: "Saved items", value: "24", change: "+4 this week" },
      { label: "Purchases", value: "16", change: "All time" },
      { label: "Creator earnings", value: "$620", change: "+18%" },
    ],
    actions: [
      { label: "Browse", icon: "explore", section: "Categories" },
      { label: "My products", icon: "inventory-2", section: "My Products" },
      { label: "Downloads", icon: "download", section: "Downloads" },
    ],
    sections: ["Dashboard", "Categories", "My Purchases", "My Products", "Downloads", "Reviews", "Orders", "History", "Favorites", "Analytics", "Settings", "Help"],
    recent: ["Minimal dashboard kit", "Customer support agent", "SaaS launch workflow"],
    recommendation: "New creator packs match your AI Builder projects and saved themes.",
  },
  {
    id: "phone-assistant",
    name: "Phone Assistant",
    category: "Organize",
    description: "Control daily phone actions with natural language and voice.",
    icon: "phone-iphone",
    accent: "#7259D6",
    surface: "#F2EFFF",
    stats: [
      { label: "Commands", value: "42", change: "This week" },
      { label: "Time saved", value: "3.5h", change: "+24%" },
      { label: "Automations", value: "8", change: "Active" },
    ],
    actions: [
      { label: "Start voice", icon: "mic", section: "Calls" },
      { label: "Messages", icon: "message", section: "Messages" },
      { label: "Automations", icon: "bolt", section: "Automations" },
    ],
    sections: ["Dashboard", "Calls", "Messages", "Automations", "History", "Favorites", "Analytics", "Settings", "Help"],
    recent: ["Morning briefing automation", "Call with Jordan", "Inbox cleanup"],
    recommendation: "Your morning briefing can be scheduled 15 minutes earlier on weekdays.",
  },
  {
    id: "security-guardian",
    name: "Security Guardian",
    category: "Protect",
    description: "Scan links, permissions, documents, and account activity for threats.",
    icon: "verified-user",
    accent: "#C93D5B",
    surface: "#FFF0F3",
    stats: [
      { label: "Protection score", value: "94", change: "+2 points" },
      { label: "Threats blocked", value: "7", change: "This month" },
      { label: "Devices secure", value: "4/4", change: "Healthy" },
    ],
    actions: [
      { label: "Run scan", icon: "security", section: "Threat Scan" },
      { label: "Audit log", icon: "history", section: "Audit Log" },
      { label: "Review access", icon: "manage-accounts", section: "Settings" },
    ],
    sections: ["Dashboard", "Threat Scan", "Audit Log", "History", "Favorites", "Analytics", "Settings", "Help", "Profile"],
    recent: ["Suspicious login blocked", "Browser permission review", "Identity vault check"],
    recommendation: "One connected integration has not been reviewed in 30 days.",
  },
  {
    id: "news-hub",
    name: "News Hub",
    category: "Discover",
    description: "Stay current with personalized technology, business, finance, and AI news.",
    icon: "newspaper",
    accent: "#2870B8",
    surface: "#EDF6FF",
    stats: [
      { label: "Saved stories", value: "38", change: "+6 this week" },
      { label: "Reading time", value: "42m", change: "Today" },
      { label: "Topics followed", value: "9", change: "Personalized" },
    ],
    actions: [
      { label: "Read trending", icon: "trending-up", section: "Trending" },
      { label: "AI news", icon: "auto-awesome", section: "AI News" },
      { label: "Bookmarks", icon: "bookmark", section: "Bookmarks" },
    ],
    sections: ["Dashboard", "Technology", "Business", "Finance", "AI News", "Trending", "Bookmarks", "History", "Favorites", "Analytics", "Settings", "Help"],
    recent: ["AI infrastructure outlook", "Creator economy briefing", "Market morning digest"],
    recommendation: "Your morning briefing is ready with five stories matched to your interests.",
  },
  {
    id: "personal-assistant",
    name: "Personal Assistant",
    category: "Organize",
    description: "Coordinate tasks, notes, routines, and the next best action.",
    icon: "assistant",
    accent: "#397C7C",
    surface: "#ECF8F8",
    stats: [
      { label: "Tasks complete", value: "24", change: "+12%" },
      { label: "Focus score", value: "81", change: "+5 points" },
      { label: "Routines", value: "6", change: "Active" },
    ],
    actions: [
      { label: "Add task", icon: "add-task", section: "Tasks" },
      { label: "Capture note", icon: "note-add", section: "Notes" },
      { label: "View routines", icon: "schedule", section: "Routines" },
    ],
    sections: ["Dashboard", "Tasks", "Notes", "Routines", "History", "Favorites", "Analytics", "Settings", "Help", "Profile"],
    recent: ["Prepare product review", "Capture grocery list", "Evening shutdown routine"],
    recommendation: "You have a 25-minute focus window before your next calendar event.",
  },
];

export const PRODUCT_CATEGORIES: ProductCategory[] = ["Build", "Create", "Grow", "Organize", "Protect", "Discover"];

export function getProductById(id: string) {
  return PRODUCT_CATALOG.find((product) => product.id === id);
}

export function getProductsByCategory(category: ProductCategory) {
  return PRODUCT_CATALOG.filter((product) => product.category === category);
}

export function searchProducts(query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return PRODUCT_CATALOG;
  return PRODUCT_CATALOG.filter((product) =>
    [product.name, product.description, product.category].some((value) => value.toLowerCase().includes(normalized)),
  );
}
