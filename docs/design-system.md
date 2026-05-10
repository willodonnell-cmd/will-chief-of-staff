# Shared Design System
# Chief of Staff · Dossier (Investment)
# Version 1.0 | May 2026
---
## Philosophy
Two products. One person. Different workflows, different information density, different
emotional registers. But they should feel like they were designed by the same hand.
The unifying principle: **calm authority**. These tools surface complex, high-stakes
information without drama. The design never competes with the content. Every visual
decision earns its place by reducing cognitive load, not adding personality for its own sake.
What separates them: CoS operates in relationship time (people, commitments, conversations).
Investment operates in analytical time (evidence, conviction, thesis evolution). CoS should
feel like a trusted aide. Dossier should feel like a rigorous research partner.
---
## Color system
### Shared neutrals (identical in both products)
```css
--color-sidebar-bg:        #1a1a1f;   /* Near-black. Warm undertone, not blue-black. */
--color-sidebar-text:      #e8e6e0;   /* Warm off-white for primary nav labels */
--color-sidebar-muted:     #6b6860;   /* Muted warm grey for secondary labels */
--color-sidebar-active:    #ffffff;   /* Active nav item text */
--color-sidebar-indicator: #ffffff;   /* Active nav left border or dot */
--color-sidebar-hover:     rgba(255,255,255,0.05); /* Subtle hover state */
--color-border:            rgba(0,0,0,0.08);       /* Card and section borders */
--color-border-strong:     rgba(0,0,0,0.15);       /* Table rules, dividers */
```
### CoS surface colors
```css
--color-bg:                #f4f3f0;   /* Page background. Warm near-white. */
--color-surface:           #ffffff;   /* Card surface */
--color-surface-secondary: #f0ede8;   /* Secondary panels, quiet state blocks */
--color-text-primary:      #1a1a1f;   /* Matches sidebar bg. Creates unity. */
--color-text-secondary:    #6b6860;   /* Supporting copy, metadata */
--color-text-muted:        #a8a5a0;   /* Labels, timestamps, captions */
```
### Dossier surface colors
```css
--color-bg:                #ede9e0;   /* Page background. Warmer parchment. Dossier's signature. */
--color-surface:           #f5f2eb;   /* Card surface. Slightly lighter than bg. */
--color-surface-secondary: #e8e4d8;   /* Secondary panels */
--color-text-primary:      #1a1a1f;   /* Same as CoS. Shared anchor. */
--color-text-secondary:    #6b6860;   /* Same as CoS. */
--color-text-muted:        #a8a5a0;   /* Same as CoS. */
```
### Identity anchors (product-specific, used once each)
```css
/* CoS: The Stingray photograph in the sidebar panel.
   No gradient. No color accent. The photograph IS the identity mark.
   Dimensions: full width of sidebar, ~160px tall, object-fit: cover.
   Black and white only. No filter effects. */
/* Dossier: Warm amber gradient mark replacing the flat "GD" avatar.
   Used ONLY in the top-left sidebar header. Nowhere else. */
--dossier-mark-gradient: radial-gradient(
  circle at 40% 40%,
  #d4a843 0%,        /* Warm amber center */
  #c4892a 45%,       /* Deeper gold */
  #a86e1a 100%       /* Rich ochre edge */
);
/* Shape: 36×36px rounded square, border-radius: 8px.
   This is the Headlands gradient logic applied once, precisely. */
```
### Functional colors (identical in both products)
```css
/* Status and signal colors. Used for labels, dots, pipeline stages only.
   Never used as backgrounds at page or card level. */
--color-live:        #2d6a4f;   /* Deep green. Live / active / confirmed. */
--color-live-bg:     #e8f5ef;   /* Green tint for live label backgrounds. */
--color-actionable:  #92400e;   /* Amber-brown. Actionable / high priority. */
--color-actionable-bg: #fef3c7;
--color-watch:       #1e4d6b;   /* Teal-blue. Watch / tracking. */
--color-watch-bg:    #e0f0f8;
--color-hypothesis:  #4a1d6b;   /* Purple. Hypothesis / speculative. */
--color-hypothesis-bg: #f3e8ff;
--color-pressure:    #1e3a5f;   /* Dark blue. Pressure test / scrutiny. */
--color-pressure-bg: #e0eaf8;
--color-signal:      #4b5563;   /* Neutral grey. Signal / unvalidated. */
--color-signal-bg:   #f3f4f6;
--color-high-priority: #b91c1c;  /* Red. High priority flags only. */
--color-high-priority-bg: #fef2f2;
--color-decision:    #1a1a1f;   /* Black pill. Decisions, primary actions. */
--color-decision-bg: #1a1a1f;
--color-decision-text: #ffffff;
```
---
## Typography
One typeface family across both products. No mixing.
```css
/* Primary typeface: Geist (Vercel's type system).
   Clean, authoritative, slightly geometric without being cold.
   Available via: npm install geist */
/* Fallback stack if Geist unavailable: */
font-family: 'Geist', 'DM Sans', 'Helvetica Neue', sans-serif;
/* Type scale */
--text-xs:   11px;  /* Labels, timestamps, metadata. Tracking: 0.06em. Uppercase only. */
--text-sm:   13px;  /* Supporting copy, table cells, tag chips */
--text-base: 15px;  /* Body copy, sidebar nav */
--text-lg:   18px;  /* Card subtitles, form labels */
--text-xl:   24px;  /* Section headers (PRIORITY INBOX level) */
--text-2xl:  32px;  /* Page hero headlines */
--text-3xl:  42px;  /* CoS Today screen hero only */
/* Weight usage */
--weight-normal:   400;   /* Body, metadata */
--weight-medium:   500;   /* Nav labels, card titles, table headers */
--weight-semibold: 600;   /* Section labels (uppercase), priority counts, scores */
/* Line heights */
--leading-tight:  1.15;  /* Headlines */
--leading-snug:   1.35;  /* Subheadlines, card copy */
--leading-normal: 1.55;  /* Body copy */
/* Letter spacing */
--tracking-labels: 0.07em;  /* ALL section labels in uppercase */
--tracking-normal: 0;
```
### Type rules
**Section labels** (ACTIVE THESES, PRIORITY INBOX, TODAY, PEOPLE, LIBRARY):
Always uppercase. `--text-xs`. `--weight-semibold`. `--tracking-labels`. `--color-text-muted`.
Identical in both products. This is the primary visual consistency signal.
**Page hero headlines** (the big declarative statements):
`--text-2xl` or `--text-3xl`. `--weight-semibold`. `--leading-tight`. `--color-text-primary`.
CoS uses them as orienting copy ("A calm operating view for the day.").
Dossier uses them as section titles ("Active Theses", "Evidence Dashboard").
**Body / supporting copy**:
`--text-base`. `--weight-normal`. `--leading-normal`. `--color-text-secondary`.
---
## Layout
### Sidebar
```
Width:           210px (fixed, not collapsible in v1)
Background:      --color-sidebar-bg
Padding:         0 (full bleed to edges)
Identity panel (top):
  CoS:           Stingray photograph, full width, 168px tall, object-fit: cover
  Dossier:       36px gradient mark + "DOSSIER" wordmark in --color-sidebar-text,
                 --text-sm, --weight-semibold, --tracking-labels
                 Contained in a 56px tall header block, padding: 0 16px
                 NO photograph equivalent in Dossier.
Section labels in sidebar:
  Text:          --color-sidebar-muted, --text-xs, uppercase, --tracking-labels
  Padding:       24px top, 16px horizontal
  Example:       WORKSPACE, ANALYSIS, STAGE
Nav items:
  Height:        36px
  Padding:       0 16px
  Icon:          16px, --color-sidebar-muted (inactive), --color-sidebar-text (active)
  Label:         --text-base, --weight-medium
  Active state:  3px left border in --color-sidebar-indicator + --color-sidebar-active text
  Hover state:   --color-sidebar-hover background
Bottom of sidebar (CoS only):
  Microphone button: 40px circle, --color-sidebar-muted background, centered
  User avatar: 32px circle, bottom left, 16px padding
```
### Content area
```
Background:      --color-bg (product-specific)
Left offset:     210px (sidebar width)
Padding:         40px 48px (desktop)
Max content width: 1100px
Top bar (both products):
  Height:        56px
  Contents (CoS):      eyebrow label "RESPONSIVE WEB APP" + product name
  Contents (Dossier):  tab switcher (Standalone / Prologis-Aware / vs Prologis)
                       + macro regime bar (right-aligned)
  Border-bottom:       1px solid --color-border-strong
  Background:          transparent (shows page --color-bg)
```
### Cards
```css
.card {
  background:    var(--color-surface);
  border:        1px solid var(--color-border);
  border-radius: 12px;
  padding:       24px;
}
.card-secondary {
  background:    var(--color-surface-secondary);
  border:        1px solid var(--color-border);
  border-radius: 10px;
  padding:       20px 24px;
}
/* Card grid: use CSS grid with gap: 16px.
   Never use card shadows — border is sufficient on warm backgrounds. */
```
### Tables (Dossier primary pattern)
```css
.data-table {
  width: 100%;
  border-collapse: collapse;
}
.data-table th {
  font-size:      var(--text-xs);
  font-weight:    var(--weight-semibold);
  text-transform: uppercase;
  letter-spacing: var(--tracking-labels);
  color:          var(--color-text-muted);
  padding:        8px 16px;
  border-bottom:  1px solid var(--color-border-strong);
  text-align:     left;
}
.data-table td {
  font-size:   var(--text-sm);
  color:       var(--color-text-primary);
  padding:     14px 16px;
  border-bottom: 1px solid var(--color-border);
}
/* No alternating row backgrounds. Border only. */
```
---
## Components
### Stage / status pills (Dossier thesis pipeline)
```css
.pill {
  display:       inline-flex;
  align-items:   center;
  padding:       3px 8px;
  border-radius: 4px;
  font-size:     var(--text-xs);
  font-weight:   var(--weight-semibold);
  letter-spacing: var(--tracking-labels);
  text-transform: uppercase;
}
/* Apply color pairs from functional color tokens above:
   .pill-live       { color: --color-live;       background: --color-live-bg; }
   .pill-actionable { color: --color-actionable;  background: --color-actionable-bg; }
   etc. */
```
### Tag chips (CoS inbox triage)
```css
.chip {
  display:       inline-flex;
  align-items:   center;
  padding:       4px 10px;
  border-radius: 999px;     /* Full pill */
  border:        1px solid var(--color-border-strong);
  background:    transparent;
  font-size:     var(--text-xs);
  font-weight:   var(--weight-medium);
  color:         var(--color-text-secondary);
  letter-spacing: var(--tracking-labels);
  text-transform: uppercase;
}
/* Chips use outline style. Pills use filled style.
   Never mix the two within one screen zone. */
```
### Primary action buttons
```css
.btn-primary {
  background:    var(--color-decision-bg);
  color:         var(--color-decision-text);
  border:        none;
  border-radius: 8px;
  padding:       10px 18px;
  font-size:     var(--text-sm);
  font-weight:   var(--weight-medium);
  cursor:        pointer;
}
.btn-secondary {
  background:    transparent;
  color:         var(--color-text-primary);
  border:        1px solid var(--color-border-strong);
  border-radius: 8px;
  padding:       10px 18px;
  font-size:     var(--text-sm);
  font-weight:   var(--weight-medium);
  cursor:        pointer;
}
/* CoS: "Open details" is primary, "Save reference" is secondary.
   Dossier: "Score" filter active state uses primary. Others use secondary outline. */
```
### Stat cards (CoS Today: Needs Decision / Quietly On Track / Protected)
```css
.stat-card {
  background:    var(--color-surface-secondary);
  border:        1px solid var(--color-border);
  border-radius: 10px;
  padding:       20px 24px;
}
.stat-card-label {
  font-size:     var(--text-xs);
  font-weight:   var(--weight-semibold);
  text-transform: uppercase;
  letter-spacing: var(--tracking-labels);
  color:         var(--color-text-muted);
  margin-bottom: 8px;
}
.stat-card-value {
  font-size:     var(--text-2xl);
  font-weight:   var(--weight-semibold);
  color:         var(--color-text-primary);
  line-height:   1;
}
/* Dossier equivalent: score values in the evidence dashboard table use
   the same font-size and weight as stat-card-value. Visual rhyme, not copy. */
```
### Macro regime bar (Dossier only)
```css
.regime-bar {
  display:     flex;
  align-items: center;
  gap:         6px;
}
.regime-tag {
  display:     flex;
  align-items: center;
  gap:         5px;
  font-size:   var(--text-xs);
  font-weight: var(--weight-medium);
  color:       var(--color-text-secondary);
}
.regime-tag::before {
  content:       '';
  width:         7px;
  height:        7px;
  border-radius: 50%;
  background:    currentColor;  /* Inherits from parent color */
}
/* Color each regime dot using functional colors:
   Rates High → --color-high-priority
   Late Cycle → --color-actionable
   Rates Normal → --color-text-muted
   Neutral → --color-text-muted
   Strong → --color-live
   Restrictive → --color-pressure */
```
### Tab switcher (Dossier: Standalone / Prologis-Aware / vs Prologis)
```css
.tab-group {
  display:       inline-flex;
  background:    var(--color-surface);
  border:        1px solid var(--color-border-strong);
  border-radius: 8px;
  padding:       3px;
  gap:           2px;
}
.tab {
  padding:       6px 14px;
  border-radius: 6px;
  font-size:     var(--text-sm);
  font-weight:   var(--weight-medium);
  color:         var(--color-text-secondary);
  border:        none;
  background:    transparent;
  cursor:        pointer;
}
.tab.active {
  background:  var(--color-surface-secondary);
  color:       var(--color-text-primary);
  font-weight: var(--weight-semibold);
}
```
---
## Motion
Minimal. Functional. Never decorative for its own sake.
```css
/* Standard transition for interactive state changes */
--transition-fast:   120ms ease;
--transition-base:   200ms ease;
/* Apply to: hover states, active tabs, pill selection, sidebar nav items */
/* Never apply to: page transitions, data loading, background elements */
/* Loading states: skeleton shimmer only. No spinners. */
@keyframes shimmer {
  0%   { background-position: -400px 0; }
  100% { background-position: 400px 0; }
}
.skeleton {
  background: linear-gradient(
    90deg,
    var(--color-surface-secondary) 25%,
    var(--color-border) 50%,
    var(--color-surface-secondary) 75%
  );
  background-size: 800px 100%;
  animation: shimmer 1.4s infinite linear;
  border-radius: 4px;
}
```
---
## Spacing system
```css
--space-1:   4px;
--space-2:   8px;
--space-3:   12px;
--space-4:   16px;
--space-5:   20px;
--space-6:   24px;
--space-8:   32px;
--space-10:  40px;
--space-12:  48px;
/* Between section label and first card:  --space-4 */
/* Between cards in a grid:               --space-4 */
/* Between major page sections:           --space-8 or --space-10 */
/* Card internal padding:                 --space-6 */
/* Table cell padding vertical:           14px (not in system; deliberate) */
```
---
## What stays different between the two products
| Element | Chief of Staff | Dossier |
|---------|---------------|---------|
| Page background | `#f4f3f0` cool near-white | `#ede9e0` warm parchment |
| Identity mark | Stingray photograph | Amber gradient square |
| Hero copy style | Declarative, human ("A calm operating view") | Functional, precise ("Active Theses") |
| Primary pattern | Cards and lists | Tables and pipeline kanban |
| Sidebar top | Full-bleed photo panel | Compact header with gradient mark + wordmark |
| Color accent | None (black buttons only) | Amber gradient on identity mark only |
| Data density | Low. Prioritize white space. | High. Prioritize information. |
| Macro context bar | Absent | Present, persistent |
---
## What is identical between the two products
- Sidebar background color and all sidebar token values
- Section label treatment (uppercase, muted, tracked)
- Typeface and type scale
- Border radius values (12px cards, 8px buttons, 4px pills)
- Functional status color tokens
- Spacing system
- Button styles (primary black / secondary outline)
- Card border style (1px, --color-border, no shadow)
- Motion timing values
- Table header treatment
---
## The one rule that covers everything
If you're about to add a second accent color, a drop shadow, a gradient background, or a
decorative element, ask: does this reduce the cognitive load of reading this screen, or does
it add to it? If it adds to it, remove it.
The Dossier amber gradient and the CoS Stingray photograph each survive this test exactly
once, in exactly one place. Everything else is typography, spacing, and structure.
