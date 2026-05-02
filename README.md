# Family Network Dashboard

A private wealth overview for the family — clean, high-end UI for tracking account balances and projecting time-to-goal.

## Features

- **Unified net worth view** with animated total
- **Per-member tabs** (start with Morgan, add more anytime)
- **Account list** grouped by category (Cash, Retirement, Investment, Other)
- **Goal planner** — enter target + monthly contribution + expected return; the dashboard computes time to goal and projected completion date using the standard future-value formula
- **Local-only storage** — all data lives in your browser's `localStorage`. Nothing is sent anywhere.

## Run locally

Just open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## Deploy to GitHub Pages

1. Push to GitHub.
2. Settings → Pages → Source: `Deploy from a branch`, Branch: `main` / `(root)`.
3. Visit the published URL.

## Tech

Plain HTML / CSS / JS. No build step, no dependencies. Fonts from Google Fonts (Fraunces + Inter).
