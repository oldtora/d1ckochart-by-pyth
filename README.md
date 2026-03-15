# d1ckochart

**When you need a chart that actually chads.** 📈

Real-time crypto vibes powered by **Pyth Network** — price goes up, the thing goes up. Price dumps, the thing dumps. No hopium, no copium, just live feeds and a character that actually moves with the market.

**Live:** [d1ckochart.vercel.app](https://d1ckochart.vercel.app)

---

## What this thing does (no cap)

### Main character / indicator

- **Pyth data:** Prices from [Pyth Network](https://pyth.network) via [Hermes API](https://hermes.pyth.network). Indicator updates in real time. Green = pump, red = dump. It’s that simple.
- **Pairs:** BTC/USD, ETH/USD, SOL/USD, BNB/USD, HYPE/USD, PYTH/USD, FOGO/USD. Each has its own band (e.g. BTC 0–10k, SOL 0–20). Position in the band drives angle and size.
- **Male / Female:** Switch the variant — bar that tilts vs shape that scales. Your choice is saved so you don’t have to pick again.
- **Heads:** Pick a head (oldtora, pepito, planck, marc, noname_trader). Also saved. We remember.
- **Price + % change:** Current price next to the character; % change since page load so you know if you’re up or rekt.

### Chart (the actual graph)

- **Chart** button opens a full chart modal — live Pyth price line, same pairs.
- **Drag** the chart to pan. **Right slider** = price zoom (scale in/out). **Bottom slider** = time window: center = 1 min, left = narrower, right = wider. No minutes on the axis, just vibes.
- **Reset** brings everything back to default. **?** explains it in English. **Close** does what it says.
- Blurred PYTH logo in the background so you never forget who feeds you data.

### Confetti

- When price crosses milestones in the band, confetti goes brrr. Configurable per pair. Because why not.

### FAQ / Change request / Changelog

- **FAQ** — modal with blur backdrop. How the indicator works, bands per pair, what “price change %” means. Close with × only.
- **Change request** — suggest changes. Text only (no image). Empty message = Send stays disabled. Blur backdrop, × to close.
- **Changelog** — release notes and dates. Same blur, same ×. Degen-style copy.

### Layout

- **Desktop:** Chart, pair, head, Male/Female on the left; FAQ, Change request, Changelog, Test on the right. Clean.
- **Mobile:** Burger menu. Chart modal is responsive — header, prices, sliders, and time slider tuned for small screens (time slider shifted left so it’s not crooked).
- **Big screens (24″/34″):** Character and block scale with height; price stays visible; centered.
- **Small viewports:** Content sticks to bottom; price block uses clamp so font doesn’t go huge.

### Test panel

- Click the **Test** button in the header (or open the page with `?test=1`). Drive the indicator with a slider (t 0→1) and up/down buttons, no live price. Preview confetti. For degens who want to test before they rest.

---

## Stack (no framework, no LARP)

- **Frontend:** Vanilla JS, HTML5, CSS3.
- **Data:** Pyth Hermes API (off-chain price feeds).
- **Deploy:** Vercel (static + serverless `api/send-change-request` for Telegram).

---

## Run it

1. Clone, `cd` into the folder.
2. Serve with any static server (`npx serve .` or open `index.html`). For the change-request API you need Vercel or a proxy to the deployed API.

---

## License

Apache 2.0. See [LICENSE](LICENSE).

*Not financial advice. Chart chads only.*
