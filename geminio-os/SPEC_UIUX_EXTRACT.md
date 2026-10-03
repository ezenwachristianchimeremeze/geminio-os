# Geminio OS UI/UX Specification Extract

Source: `/home/ubuntu/upload/Geminio_OS_Complete_UI_UX_Specification_v1.0.pdf`

## Authority and Vision
The document defines Geminio OS as an AI-first operating layer / AI super app. Home is conversation-first, while complexity lives in Workspace, Discover, and dedicated product dashboards. The product promise is: “Tell Geminio what you want done.”

## Global Navigation
The recommended global navigation is Home, Workspace, Discover, Notifications, and Profile. Home contains chat, voice, new chat, recent conversations, search, suggestions, attachments, and greeting. Workspace launches dedicated products. Discover exposes products, creations, templates, and approved content. Notifications contains task completion, approvals, security/payment events, and reminders. Profile contains identity, account controls, settings access, security, and preferences.

Home must not contain wallet, marketplace, builder, or other feature cards; those are reached through Workspace or universal-assistant routing.

## Visual System
The specified visual personality is minimal, premium, elegant, clean, professional, fast, modern, AI-first, and enterprise-grade. Avoid excessive gradients, glow effects, and decorative clutter. Light tokens specified by the document are: primary Deep Indigo #4F46E5; accent Electric Blue #3B82F6; success Emerald #10B981; warning Amber #F59E0B; error Red #EF4444; light background #F8FAFC; cards White; primary text #0F172A; secondary text #64748B; borders #E2E8F0. Typography direction is Inter, SF Pro, or Google Sans where available. Icons should use Material Symbols Rounded or Lucide. Use rounded cards, subtle shadows, and borders for structure.

## Responsive Behavior
Phone uses bottom global navigation, single-column content, compact cards, and full-screen workflows when needed. Tablet uses adaptive two-column layouts where useful and touch-friendly controls. Desktop/Web uses persistent navigation or sidebar and multi-column dashboards with larger work areas. Support responsive reflow, light/dark modes, reusable components, accessible contrast, safe areas, and touch targets.

## Shell and Product Pattern
The mobile shell has a top app bar, main content, optional contextual FAB, and bottom navigation. Every major product has its own home, not a temporary popup. Common product controls include Dashboard, Search, History, Favorites, Analytics, Settings, Help, and Profile where applicable.

## Core Screens
Required core screens include Splash, Authentication, Home Chat, Conversation, Voice Chat, Search Chats, Workspace, Discover, Notifications, Profile, Settings, Permissions, Appearance, Security, Marketplace, Wallet, AI Builder, Media Studio, Career Hub, Business Hub, Learning Hub, Markets, News Hub, Phone Assistant, and Developer Console.

## Home and Universal AI
Home requires daily greeting, primary conversation area, anchored composer, attachments, voice interaction, new chat, recent conversations, and context-aware suggestions, without feature-card clutter. AI responses require readable hierarchy, tool/long-running progress states, distinction between generated content and confirmed external actions, relevant action buttons, approval controls for sensitive actions, and share/remix controls where supported.

Universal AI must support intent recognition, cross-module navigation, tool calling, long-running tasks, checkpoints, notifications, and permission/approval gates. Intent routing should communicate transitions into dedicated products while preserving useful conversational context. Long-running states include Queued, Planning, Running, Waiting for user, Testing, Completed, Failed, and Retrying.

## Dedicated Product Navigation
AI Builder: Dashboard, Projects, Templates, Deployments, AI Agents, History, Settings.
Media Studio: Dashboard, Images, Videos, Music, Templates, Projects, Exports, Settings.
Wallet: Dashboard, Balance, Transactions, Send, Receive, Analytics, Cards, Settings.
Career Hub: Dashboard, Jobs, Scholarships, Internships, Applications, Saved, Resume, Interview Coach, Settings.
Marketplace: Dashboard, Categories, My Purchases, My Products, Downloads, Reviews, Orders, Settings.
Business Hub: Dashboard, Sales, CRM, Inventory, Marketing, Reports, Analytics, Settings.
Learning Hub: Dashboard, Courses, Tutor, Research, Study Plans, Exams, Certificates, Settings.
News Hub: Dashboard, Technology, Business, Finance, AI News, Trending, Bookmarks, Settings.

## AI Builder UX
Builder home must show project name, current build status, progress, recent activity, actions, and artifacts. Project flow: blank/template start; choose Mobile App, Website, Backend, or AI Agent; describe desired result; show plan; show artifacts and progress; testing/debugging; checkpoints; approval gates for sensitive operations; deployment state; history and recovery/resume.

## Source Notes
The PDF identifies exact typography sizes, line heights, breakpoints, dark palette, ranking behavior, and other values as implementation decisions where not explicitly defined. These must be implemented consistently and documented as decisions rather than treated as external requirements.
