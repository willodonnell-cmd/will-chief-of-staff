# People Search — Component Spec
# Blackhawk: Chief of Staff
# Version 1.0 | May 2026

---

## What this component is

A triggered search overlay for navigating to a person's relationship brief.
Activated via Cmd+K (global keyboard shortcut) or the magnifying glass icon in the
header. One overlay, two triggers, identical behavior.

This is not a directory. It is not a people list. It is a fast navigation layer
for someone who knows who they want and needs to get there in under three seconds.

---

## Trigger 1 — Keyboard shortcut

```
Shortcut:     Cmd+K (Mac) / Ctrl+K (Windows)
Scope:        Global. Works from any screen in Blackhawk, not just People.
Behavior:     Opens search overlay with input focused immediately.
              Does not navigate to People first.
              Works regardless of which screen is currently active.
```

---

## Trigger 2 — Header icon

```
Icon:         Magnifying glass (lucide: Search)
Placement:    Top-right header, left of the notifications bell
              [Blackhawk: Chief of Staff]          [🔍] [🔔]
Size:         36px circle (matches notification bell)
Style:        Same circular format as capture button but header-placed
              Background: transparent default, --color-sidebar-hover on hover
              Icon color: --color-sidebar-muted default,
                          --color-sidebar-text on hover
              Border: none
Active state: When overlay is open, icon uses --color-sidebar-text
              (same as active nav item treatment)
Scope:        Global. Visible in header across all screens.
```

---

## Header layout

```
┌─────────────────────────────────────────────────────────┐
│  Blackhawk: Chief of Staff                    [🔍] [🔔] │
└─────────────────────────────────────────────────────────┘

Search icon: 36px circle, lucide Search icon 16px centered
Bell icon:   36px circle, lucide Bell icon 16px centered
Gap between: 8px
Right margin: 16px from edge
```

---

## Overlay behavior

### Opening

```
Trigger:      Cmd+K or icon tap
Animation:    Fade in + scale from 0.96 to 1.0, 120ms ease
Backdrop:     rgba(0,0,0,0.4), full screen, blur(4px)
Position:     Centered horizontally, 20% from top vertically
              (not dead center — reading position is slightly high)
Input:        Focused immediately on open, no click required
Default state: Recently viewed people (last 5, most recent first)
               shown before any query is typed
```

### Input field

```
Width:        560px (desktop), 92vw (mobile)
Height:       52px
Placeholder:  "Search people..."
Font:         --text-lg, --weight-normal, --color-text-primary
Background:   --color-surface
Border:       1px solid --color-border-strong
Border-radius: 10px top corners, 0px bottom corners when results present
              10px all corners when no results
Icon:         16px magnifying glass, left-aligned inside input, --color-text-muted
Input padding: 0 16px 0 44px (left padding accounts for icon)
```

### Results list

```
Appears:      After 1 character typed
              Also shows recently viewed before any query (default state)
Max visible:  6 results before scroll
Width:        Matches input field width exactly
Background:   --color-surface
Border:       1px solid --color-border-strong, top border removed
              (visually connects to input field above)
Border-radius: 0px top corners, 10px bottom corners
Divider:      0.5px --color-border between results
Animation:    Results fade in, 80ms ease
```

### Result row

```
Height:       56px
Padding:      12px 16px
Layout:       Two lines

Line 1:       [Name] (--text-base, --weight-medium, --color-text-primary)
              [Organization] (--text-sm, --weight-normal, --color-text-muted)
              Name and organization on same line, organization right-aligned

Line 2:       First 8 words of current read (--text-sm, --weight-normal,
              --color-text-secondary, truncated with ellipsis)
              If current read is [NEEDS ASSESSMENT] or empty:
              show "No relationship brief yet" in --color-text-muted, italic

Hover state:  Background --color-surface-secondary, 80ms transition
Active/selected: Background --color-surface-secondary,
                 left border 2px --color-sidebar-indicator

No avatars. No icons. No badges. Two lines of text only.
```

### Recently viewed (default state, no query)

```
Header label: "RECENTLY VIEWED" in --text-xs, --weight-semibold,
              --tracking-labels, --color-text-muted
              Padding: 8px 16px 4px
Max results:  5 most recently viewed, most recent first
Row format:   Same as search result rows
Behavior:     Replaced immediately when user starts typing
```

### Empty state (query with no results)

```
Height:       72px
Content:      "[Query] not found"
              "Check spelling or try a different name."
Font:         --text-sm, --color-text-muted, centered
No create button. No suggestions. Clean empty state only.
```

### Keyboard navigation

```
↓ / ↑:        Move selection through results
Enter:         Navigate to selected person's brief, close overlay
Escape:        Close overlay, return to previous screen, no navigation
Tab:           Move to next result (same as ↓)
Any character: Types into search input, results update
```

---

## Closing

```
Escape key:   Close immediately, no animation
Backdrop tap: Close immediately
Navigation:   Close with 80ms fade out as brief loads
              Brief loads behind the fade so transition feels instant
```

---

## Navigation behavior on selection

```
Action:       Load selected person's People brief
URL:          /people/[person-id] or equivalent
Sidebar:      People nav item becomes active
Overlay:      Closes as brief loads
Recently viewed: Person moves to top of recently viewed list
```

---

## Mobile behavior

```
Trigger:      Header icon only (no Cmd+K on mobile)
Overlay:      Full-width bottom sheet instead of centered modal
              Slides up from bottom, 200ms ease
Input:        At top of sheet, focused immediately
              Native keyboard opens below
Results:      Same row format, full width
Max visible:  4 results before scroll (smaller viewport)
Dismiss:      Swipe down or tap backdrop above sheet
```

---

## People landing screen — recently viewed strip

When no person is selected and the People screen is active:

```
Position:     Below the hero copy block, above the empty brief state
Label:        "RECENTLY VIEWED" — --text-xs, --weight-semibold,
              --tracking-labels, --color-text-muted
Layout:       Horizontal strip of tiles, scrollable if overflow
Tile count:   Show last 5, most recent leftmost

Tile:
  Width:      160px
  Height:     64px
  Background: --color-surface
  Border:     1px solid --color-border
  Border-radius: 10px
  Padding:    12px 14px
  Line 1:     Name — --text-sm, --weight-medium, --color-text-primary
  Line 2:     Organization — --text-xs, --color-text-muted
  Hover:      Background --color-surface-secondary, 80ms transition
  Click:      Load that person's brief

Empty state:  Strip is hidden entirely if no recently viewed history.
              Do not show "No recently viewed" placeholder.
              The empty People screen stands on its own.
```

---

## What this component does NOT do

- Does not search Library, Initiatives, or other Blackhawk objects
- Does not create new people records
- Does not show full contact details in the overlay
- Does not filter by category, organization, or tag
- Does not show avatars, photos, or icons in result rows
- Does not persist the search query after closing

People search is navigation only. Everything else is a separate workflow.

---

## Implementation notes

```
Search scope:     Name and organization fields only in v1.
                  Do not search current read text in v1 — too slow,
                  too noisy. Add in v2 if needed.

Matching:         Prefix match on first name, last name, organization.
                  Case insensitive.
                  "jo" matches "John", "Jose", "Johnson Capital"
                  Fuzzy match (Levenshtein) in v2 only.

Data source:      /cos/people/ vault pages via API.
                  Cache people index client-side on page load.
                  Re-fetch on people data change.
                  Index contains: id, name, organization, title,
                  current_read_snippet (first 8 words), last_viewed.

Performance:      Search runs client-side against cached index.
                  No API call on keystroke.
                  Target: results appear in < 50ms after keystroke.

Recently viewed:  Stored in localStorage keyed by user.
                  Max 10 stored, 5 shown.
                  Updated on every successful navigation to a person brief.
```

---

## Shared design tokens used

All values from /docs/design-system.md. No new tokens introduced.

```
--color-surface
--color-surface-secondary
--color-border
--color-border-strong
--color-text-primary
--color-text-secondary
--color-text-muted
--color-sidebar-muted
--color-sidebar-text
--color-sidebar-hover
--color-sidebar-indicator
--text-xs, --text-sm, --text-base, --text-lg
--weight-normal, --weight-medium, --weight-semibold
--tracking-labels
--transition-fast (120ms ease)
--transition-base (200ms ease)
```

---

## Version history

| Version | Date | Change |
|---------|------|--------|
| 1.0 | May 2026 | Initial spec. Search icon in header left of notifications. Cmd+K global shortcut. Centered overlay desktop, bottom sheet mobile. Recently viewed strip on People landing. |
