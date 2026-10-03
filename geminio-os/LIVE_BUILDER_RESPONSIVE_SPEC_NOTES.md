# Live Builder Responsive Specification Notes

Source: `/home/ubuntu/upload/Geminio_OS_Complete_Professional_UI_UX_Design_System_and_Responsive_Specification_v1.0.pdf`

## Core layout rules

The specification defines one shared Geminio OS geometry and navigation system. Screens must reuse shared tokens, layout grid, and navigation hierarchy rather than inventing per-screen geometry.

| Rule | Mobile | Tablet | Desktop/Web |
|---|---|---|---|
| Outer gutter | 16 px | 24 px | 32 px |
| Grid columns | 4 | 8 | 12 |
| Column gap | 12 px | 16 px | 24 px |
| Section gap | 24 px | 32 px | 40 px |
| Content max width | Full width minus gutters | Full width minus gutters | 1200 px recommended max |

## Screen anatomy and navigation

| Region | Mobile | Tablet | Desktop/Web |
|---|---|---|---|
| Top bar | 56 px | 64 px | 64 px |
| Primary navigation | Bottom navigation | Bottom nav or compact rail | Left rail |
| Main content | Scrollable | Scrollable | Scrollable |
| Profile position | Top-right | Top-right | Upper-right account area |
| Floating action | Optional/contextual | Optional/contextual | Optional/contextual |

Primary destinations remain **Home**, **Workspace**, **Discover**, **Notifications**, and **Profile**.

| Viewport | Required navigation pattern |
|---|---|
| 0–599 px | Bottom navigation |
| 600–1023 px | Bottom navigation or compact rail |
| 1024–1439 px | Left rail |
| 1440 px+ | Expanded left rail |

## Shared component standards

| Token | Standard |
|---|---|
| Primary nav icon | 24 px visual box |
| Compact icon | 20 px |
| Large feature icon | 32 px |
| Touch target | Minimum 44 × 44 px |
| Icon-to-label gap | 8 px |
| Search height | 48 px |
| Input/select height | 48 px |
| Primary button height | 48 px |
| Card radius | 16 px |
| Button/input radius | 12 px |
| Modal radius | 16–20 px |
| Divider | 1 px |
| Avatar | 32 px standard, 40–48 px prominent |

Typography scale from the specification:

| Token | Size / line height | Use |
|---|---|---|
| Display | 32 / 40 px | Major product or landing headings |
| H1 | 28 / 36 px | Page heading |
| H2 | 22 / 28 px | Section heading |
| H3 | 18 / 24 px | Card/module heading |
| Body | 16 / 24 px | Primary content |
| Body Small | 14 / 20 px | Secondary content |
| Caption | 12 / 16 px | Metadata/helper text |
| Button | 14–16 px | Action labels |

Spacing scale excerpt from the specification:

| Token | Value | Typical use |
|---|---|---|
| XS | 4 px | Micro spacing |
| S | 8 px | Icon/text gaps |
| M | 12 px | Compact component gaps |
| L | 16 px | Default padding/gutter |
| XL | 24 px | Cards/sections |
| 2XL | 32 px | Major sections |
| 3XL | 40 px | Desktop section separation |
| 4XL | 48 px | Large page rhythm |

## AI interaction rules relevant to Live Builder

| Element | Placement |
|---|---|
| AI input | Bottom of conversation area, full available width within gutter |
| Attachment | Left side of input row |
| Voice | Right side action in input row |
| Send | Rightmost action |
| Suggested actions | Below greeting/empty state or approved prompt area |
| Task status | Inside the relevant task/conversation area |

## Responsive and split-view behavior

The responsive behavior section requires mobile single-column layouts with bottom navigation and full-width primary actions. Tablet layouts may add more columns or optional split views. Desktop layouts should use a persistent left rail with centered content and may use multi-column layouts where appropriate. Wide desktop should increase whitespace rather than stretching text or controls indefinitely. Side panels collapse into sheets on narrow screens, and no supported viewport may produce horizontal overflow or overlapping controls.

| Viewport class | Split-view rule |
|---|---|
| Mobile | Single column; secondary content below or in sheet |
| Tablet | Optional 60/40 or 50/50 split for approval workflows |
| Desktop | Primary/secondary split with readable minimum widths |
| Wide desktop | Keep content within max width; avoid indefinite stretching |

## Accessibility and governance rules

The specification requires identical light/dark hierarchy, visible keyboard focus on desktop/web, accessible labels for icons and images, and a minimum interactive target of 44 × 44 px. Generated screens must reuse approved navigation, header/footer, components, and tokens. The Builder must not invent new navigation patterns without approval, and automated UI validation should flag unsupported variants and arbitrary spacing values.

## Required viewport validation set for Live Builder preview

| Class | Representative viewport | Required check |
|---|---|---|
| Small phone | 360 × 800 | No overflow; fixed header/nav; readable controls |
| Large phone | 430 × 932 | Consistent spacing and density |
| Tablet portrait | 768 × 1024 | Grid expansion and navigation |
| Tablet landscape | 1024 × 768 | Split-view and transition behavior |
| Laptop | 1366 × 768 | Left rail and content alignment |
| Desktop | 1440 × 900 | Max-width and whitespace |
| Wide desktop | 1920 × 1080 | No uncontrolled stretching |

## Done criteria relevant to AI Builder upgrade

Every new or AI-generated screen must use the approved template/navigation, tokenized geometry, approved components, validated responsive behavior, light/dark themes, required states, accessibility labels, and visual/functional regression checks. The Builder must continue implementation and correction until all in-scope screens comply.
