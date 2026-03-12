# d1ckochart

A real-time crypto “chart” that turns **Pyth Network** price feeds into a live visual. The on-screen character’s indicator (bar or female variant) moves with the selected pair—price up, indicator up; price down, indicator down.

**Live demo:** [d1ckochart.vercel.app](https://d1ckochart.vercel.app) *(replace with your URL if different)*

---

## What the site does

### Real-time price chart

- **Pyth data:** Prices come from [Pyth Network](https://pyth.network) via the [Hermes API](https://hermes.pyth.network). The indicator updates in real time as the price changes.
- **Supported pairs:** BTC/USD, ETH/USD, SOL/USD, BNB/USD, HYPE/USD, PYTH/USD, FOGO/USD. Each pair has its own price band (e.g. BTC 0–10,000, ETH 0–500, SOL 0–20).
- **Position in band:** The indicator’s position, angle, and size are driven by where the current price sits inside that band (0→1). Green = price rising, red = price falling.

### Chart variants

- **Male:** A bar indicator that moves and tilts with the price.
- **Female:** A scaling shape that grows/shrinks with the price within the band.
- Your choice is saved in `localStorage` so it persists across visits.

### Customization

- **Head select:** Pick a character head (oldtora, pepito, planck, marc, noname_trader). Selection is also saved in `localStorage`.
- **Feed select:** Switch between the listed pairs in the header. The selected pair is remembered.

### Price display

- **Current price:** Shown next to the character (e.g. `$97,234`).
- **Price change since load:** Percentage change from the first price when the page loaded to the current price. Displayed with up/down styling.

### Confetti

- When the price crosses certain milestones within the band (e.g. every 0.5 step for SOL), a short confetti animation runs. Thresholds are configurable per pair.

### FAQ

- **FAQ** button opens a modal with a short explanation: how the indicator works, band ranges per pair, and what “price change %” means.

### Change request

- **Change request** opens a form where users can suggest changelog ideas. Text (and an optional image, max 3 MB) is sent to the maintainer via a Telegram bot (serverless API on Vercel).

### Changelog

- **Changelog** button shows a modal with release notes and dates.

### Test panel

- When the app is opened with `?test=1`, a **Test** panel appears. It lets you drive the indicator with a slider (t from 0 to 1) and up/down buttons without live price, and preview the confetti animation.

---

## Tech stack

- **Frontend:** Vanilla JavaScript, HTML5, CSS3. No framework.
- **Data:** Pyth Network Hermes API (off-chain price feeds).
- **Deployment:** Vercel (static site + serverless `api/send-change-request` for Telegram).

---

## Run locally

1. Clone the repo and open the project folder.
2. Serve the files with any static server (e.g. `npx serve .` or open `index.html` in the browser; for the change-request API you need to deploy to Vercel or run a local proxy to the deployed API).

---

## License

Apache 2.0. See [LICENSE](LICENSE).
