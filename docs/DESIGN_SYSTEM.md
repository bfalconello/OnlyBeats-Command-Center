# Design System

## Brand
**Name:** OnlyBeats Command Center  
**Tagline:** Your Complete College Football Command Center

## Core palette
| Token | Value | Use |
|---|---:|---|
| `--ob-bg` | `#0b0f14` | Main dark background |
| `--ob-surface` | `#141a22` | Cards and panels |
| `--ob-surface-2` | `#1b2430` | Elevated controls |
| `--ob-gold` | `#f5b82e` | Primary brand accent |
| `--ob-text` | `#f7f9fc` | Main text |
| `--ob-muted` | `#9ca8b7` | Secondary text |
| `--ob-success` | `#22c55e` | Healthy/live success |
| `--ob-warning` | `#f59e0b` | Delayed or attention state |
| `--ob-danger` | `#ef4444` | Errors |
| `--ob-info` | `#3b82f6` | Informational state |

Existing CSS may use equivalent values. New components should converge on tokens instead of introducing arbitrary colors.

## Typography
- UI body: system sans-serif stack for speed and clarity
- Display headings: bold, compact, high-contrast
- Numeric scores: tabular numerals when available
- Minimum body target: 14 px
- Avoid all-caps for long text; reserve it for compact labels

## Spacing
Use a 4 px base rhythm. Preferred values: 4, 8, 12, 16, 20, 24, 32, 40.

## Radius
- Compact controls: 8 px
- Standard cards: 12 px
- Feature panels and drawers: 16 px

## Components
### Buttons
- Primary: gold background, dark text
- Secondary: elevated surface with visible border
- Ghost: transparent until hover/focus
- Destructive: danger color and confirmation for irreversible actions

Every button needs hover, keyboard focus, disabled, and pending states.

### Cards
Cards use consistent padding, restrained borders, and one clear visual hierarchy. Game cards must make teams, score, and game state readable at a glance.

### Status badges
Use icon/label plus color. Never rely on color alone.

### Drawers and dialogs
- Escape closes when safe
- Visible close action
- Focus begins inside the surface
- Background interaction is blocked for modal dialogs

### Loading and empty states
- Preserve layout during refresh
- Use concise skeletons or progress labels
- Empty states explain what the user can do next
- Provider failures identify last successful sync when possible

## Motion
- Typical duration: 120–220 ms
- Score changes may briefly highlight
- Avoid continuous decorative motion
- Respect reduced-motion preferences

## Accessibility
- Maintain readable contrast
- Provide visible keyboard focus
- Use descriptive labels for icon-only buttons
- Support keyboard navigation for primary workflows
- Do not encode game state using color alone
