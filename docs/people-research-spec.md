# People Research Panel — Component Spec
# Blackhawk: Chief of Staff
# Version 1.0 | May 2026

---

## What this component is

A two-panel research view that surfaces on the People screen when the user taps
the Research button. Left panel shows what the vault knows about this person.
Right panel shows what a live web search returns. The two sources are visually
distinct and never conflated.

Nothing from the external panel writes to the vault automatically. Every transfer
requires an explicit "Add to vault" action by the user.

---

## Trigger

**Research button** — appears in the person header, right-aligned, next to the
person's name and organization. Label: "Research" with a ti-world-search icon.

Below the Research button: "Last researched: [DATE]" in muted uppercase label.
If never researched: label is absent entirely.

Tapping Research:
1. Expands the two-panel view below the person header (pushes the standard
   four-layer brief down, or replaces it — use pushdown)
2. The vault panel populates immediately from local data
3. The external panel shows a loading state while the web search runs
4. Both panels are visible simultaneously at all times once open

A second tap on Research (or an X button in the panel header) collapses the
research view and returns to the standard brief.

---

## Layout

```
[Person header: Name · Org · Research button · Last researched timestamp]
─────────────────────────────────────────────────────────────────────────
[Left panel: What you know]        [Right panel: What's out there]
  From vault (italic, muted)         Live web research (italic, muted)
  ─────────────────────────          ──────────────────────────────────
  Tabs: Current read / Open          Tabs: Overview / News / Writing /
        loops / Interactions               Network
  ─────────────────────────          ──────────────────────────────────
  Content                            Content + Add to vault buttons
  ─────────────────────────          ──────────────────────────────────
                                     [Suggested current read update]
                                     Accept / Dismiss
```

Grid: `grid-template-columns: 1fr 1fr`, `gap: 9px`, `padding: 10px`.

---

## Color and design tokens

All tokens from `/docs/design-system.md`. No new tokens introduced.

```css
Panel background:        #ffffff
Panel border:            0.5px solid rgba(0,0,0,0.08)
Panel border-radius:     10px

Content block bg:        #f0ede8  (warm secondary — same as CoS surface-2)
Content block border:    border-left: 2px solid rgba(0,0,0,0.15)
Content block radius:    6px
Content block padding:   7px 9px

Panel header labels:     font-size: 9px, font-weight: 600, uppercase,
                         letter-spacing: 0.07em, color: #a8a5a0
Panel source italic:     font-size: 9px, color: #a8a5a0, font-style: italic

Tab active:              background: #f0ede8, color: #1a1a1f
Tab inactive:            background: transparent, color: #6b6860

No colored dots. No colored borders on content blocks.
The only color on the screen is:
  - Notification dot: #b91c1c (pre-existing)
  - Suggested update block: background #fef3c7, label color #92400e
    (functional signal — action required)
```

---

## Left panel: What you know

Source: vault data for this person. Read-only in this view.

### Tabs

**Current read tab (default)**
- Section label: CURRENT READ
- Content block: the person's current read text
- If `[NEEDS ASSESSMENT]`: show "No current read yet. Add one from the
  person's brief." in muted italic

**Open loops tab**
- Each open loop as a content block
- Direction label above each: "I OWE" or "THEY OWE" in 8px uppercase muted
- If no open loops: "No open loops with this person." muted

**Interactions tab**
- Recent interactions log, most recent first
- Each entry: DATE · CONTEXT · WHAT CHANGED (one line)
- If no interactions: "No interactions logged yet." muted

---

## Right panel: What's out there

Source: live web search via Claude API with web search tool enabled.
Runs when Research button is tapped. Results stream in as they arrive.

### Loading state

While search is running:
- Show a subtle spinner (18px, border-top colored `#1a1a1f`, 0.8s linear)
- Label: "Searching..." in muted 11px
- No skeleton or placeholder content

### Tabs

**Overview tab (default)**
Current role block + any immediately relevant signals.

**News tab**
Recent news mentions, press coverage, company announcements.
Each item: headline, source, date, Add to vault button.

**Writing tab**
Published articles, talks, podcast appearances, LinkedIn posts.
Each item: title, publication/platform, date, Add to vault button.

**Network tab**
Connections to Prologis ecosystem: shared investors, board overlaps,
former colleagues, mutual contacts. Sourced from public data only.

### Content block format (external items)

```
[LABEL — 8px uppercase muted]
[Content text — 10px, #1a1a1f, line-height 1.4]
[Source — 9px, #a8a5a0]
[+ Add to vault — button]
```

### Add to vault mechanic

Tapping "Add to vault" on an external item:
- Appends the item to the person's recent interactions log with tag:
  `[source: web research, DATE]`
- Does NOT update the current read
- Does NOT create open loops
- Shows a brief inline confirmation: "Added" replaces the button for 2 seconds

### Suggested current read update

When the external research contains information that materially changes
the relationship picture (job change, funding, significant news), the agent
surfaces a suggested current read update in an amber block at the bottom
of the right panel.

```
[SUGGESTED CURRENT READ UPDATE — 8px uppercase #92400e]
[Suggested text — 10px #1a1a1f]
[Accept] [Dismiss]
```

Accept: replaces the current read in the vault with the suggested text.
Adds a note to recent interactions: `[source: research update, DATE]`.

Dismiss: removes the block. Does not update anything.

The suggested update is generated only when:
- The external research reveals a role change
- The external research reveals a significant funding or business event
- The external research directly contradicts the current read

It is NOT generated for minor news or tangential information.

### Empty state (no results)

If web search returns nothing useful:
"No public information found for [Name] at [Organization]."
Muted, centered, 11px.

### Error state

If web search fails:
"Research unavailable right now. Try again."
Muted, centered, 11px. No retry button in v1.

---

## Last researched timestamp

Stored per person in the vault frontmatter:
```yaml
last_researched: [ISO date]
```

Updated automatically whenever the Research panel is opened and a
successful web search completes.

Displayed below the Research button in the person header:
"LAST RESEARCHED: [DATE]" — 9px uppercase muted.

If `last_researched` is null: timestamp is hidden entirely.

---

## What never happens automatically

- Current read is never rewritten by external data without Accept tap
- Open loops are never created from external data
- Recent interactions are never updated without Add to vault tap
- The Research panel never opens on its own
- Web search never runs without the user tapping Research

---

## API implementation

Uses the Anthropic Claude API with web search tool enabled.

```javascript
const response = await fetch("https://api.anthropic.com/v1/messages", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1000,
    tools: [{ type: "web_search_20250305", name: "web_search" }],
    system: `You are researching a professional contact for an executive's
chief of staff system. Return structured information in this JSON format:
{
  "current_role": { "text": "...", "source": "..." },
  "recent_news": [{ "headline": "...", "text": "...", "source": "...", "date": "..." }],
  "writing": [{ "title": "...", "platform": "...", "date": "..." }],
  "network": [{ "connection": "...", "context": "..." }],
  "suggested_read_update": "..." or null
}
Return only JSON. No preamble. If suggested_read_update would materially
change the current read, include it. Otherwise null.`,
    messages: [{
      role: "user",
      content: `Research this person: ${name} at ${organization}.
Current read: ${currentRead}
Find: current role, recent news, published writing, Prologis network connections.`
    }]
  })
});
```

Parse `data.content` for `mcp_tool_result` and `text` blocks.
Extract JSON from the text block.
Render each section into the appropriate tab.

---

## Vault frontmatter update on research

When research completes successfully, update the person's markdown
frontmatter:

```yaml
last_researched: 2026-05-11
```

This is the only automatic write. Everything else requires explicit user action.

---

## Version history

| Version | Date | Change |
|---------|------|--------|
| 1.0 | May 2026 | Initial spec. Two-panel layout. Vault left, external right. CoS color scheme. No auto-writes except last_researched timestamp. |
