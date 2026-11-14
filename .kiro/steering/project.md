# Project Steering — Expense & Budget Visualizer

## Overview

A mobile-friendly web app for tracking expenses and visualizing a budget.
Runs entirely in the browser with no backend, no build step, and no framework.

## Tech Stack

- **HTML** — single page, `index.html`
- **CSS** — single stylesheet, `css/style.css`
- **Vanilla JavaScript** — single script, `js/script.js` (no frameworks)
- **Chart.js** — loaded via CDN (`https://cdn.jsdelivr.net/npm/chart.js@4`) for the pie chart
- **Local Storage** — all data is persisted client-side under `ebv.*` keys

## Folder Structure

```
CodingCamp-9November26-Azhar/
├── index.html
├── css/
│   └── style.css
├── js/
│   └── script.js
├── .kiro/
│   └── steering/
│       └── project.md   ← this file
└── README.md
```

Rules: exactly one CSS file (`css/style.css`) and one JS file (`js/script.js`).
Do not add a second stylesheet or script unless the user explicitly asks.

## Features

### Required (implemented)
1. **Input form** — Item Name, Amount, Category dropdown. All fields must be filled;
   shows an inline error if validation fails.
2. **Transaction list** — scrollable list, each row shows name, amount, category,
   and a per-item delete button.
3. **Total balance** — displayed at the top, updates automatically on add and delete.
4. **Pie chart** — Chart.js pie of spending by category, updates automatically.

### Optional (implemented)
- **Custom categories** — choose "+ Add new category…" to create your own;
  saved in Local Storage and reused.
- **Sorting** — by most recent, amount (high→low / low→high), or category (A→Z).
- **Dark/light theme** — toggle in the header, remembers the choice and
  respects the OS preference on first load.

## Data Model

Transactions are stored as an array in `localStorage` under key `ebv.transactions`.
Each entry:
```json
{ "id": "string", "name": "string", "amount": "number", "category": "string", "date": "ISO-8601" }
```

Categories live under `ebv.categories` (defaults: Food, Transport, Fun).
Theme lives under `ebv.theme` (`"light"` or `"dark"`).

## Conventions

- **Theming** — colors are CSS custom properties on `[data-theme]`; the JS palette
  arrays (`PALETTE` / `PALETTE_DARK`) must stay in sync with the CSS variables.
- **No external dependencies** beyond Chart.js via CDN.
- **No build step** — open `index.html` directly in a browser.
- **Cross-browser** — must work in Chrome, Firefox, Edge, and Safari.
- **UI** — clean, minimal, clear visual hierarchy, mobile-first responsive layout.
- **No test setup** — the user has not asked for tests.

## Constraints

- Do not introduce a framework (React, Vue, etc.).
- Do not add a backend or any server-side code.
- Do not split CSS or JS into multiple files unless asked.
- Do not add a bundler, package.json, or node_modules.
