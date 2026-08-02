# v0.13.1 — Dashboard Widget Customization Hotfix

## Fixed

- Customize Widgets now opens reliably after dashboard rerenders.
- The button changes to `Hide widgets` while the builder is open.
- The page scrolls the widget builder into view.
- The button exposes its open/closed state through `aria-expanded`.

## Test

- Open Dashboard.
- Click Customize widgets.
- Confirm the builder appears and scrolls into view.
- Toggle widgets.
- Reorder widgets.
- Click Hide widgets.
- Restart and confirm saved layout remains.
