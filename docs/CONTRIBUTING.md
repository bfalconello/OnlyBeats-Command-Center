# Contributing

## Before starting
- Read the Project Bible and Architecture guide.
- Search existing issues before opening a duplicate.
- Keep work focused on one issue.

## Branch names
- `feature/short-description`
- `fix/short-description`
- `docs/short-description`

## Commit style
Use an imperative summary under 72 characters when possible.

Examples:
- `Add Saturday Wall filter state`
- `Fix missing live-page status target`
- `Document score provider fallback behavior`

## Pull requests
- Explain what changed and why.
- Include testing steps.
- Include screenshots for UI changes.
- Update documentation and changelog when applicable.
- Do not commit `node_modules`, `src-tauri/target`, installers, secrets, or personal data.

## Code principles
- Prefer readable code over clever code.
- Guard optional UI elements.
- Keep provider-specific parsing out of views.
- Preserve last-known data during network errors.
- Avoid duplicating logic.
