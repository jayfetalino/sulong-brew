# LAB-9: installable app and free hosting

## What was built

- The lab is now a **PWA** (progressive web app): you can add it to your iPhone home screen or install it from Chrome, and it opens full screen like a normal app.
- It works **offline**. A service worker keeps the app files and fonts on your device, and your data was already stored locally.
- App icons made from your logo file, unchanged, centered on Obsidian.
- Hosting files for **Cloudflare Pages**, plus a click-by-click guide in `docs/deploy.md`.
- ADR-011 records which hosts were compared and the free limits that were checked.

## Key ideas

- **HTTPS is required.** Browsers only allow installing and offline apps on secure addresses. Cloudflare Pages gives HTTPS for free. (`localhost` also counts as secure while developing.)
- **A manifest** is a small file that tells the phone the app's name, icon and colors.
- **A service worker** is a script the browser keeps running in the background. It answers requests from saved files when there is no network. Auto-update means a new version downloads in the background and takes over next time you open the app.
- **Fingerprinted files.** Build output files have a code in their name that changes when the content changes, so they can be cached for a year safely. The pages that point to them (`index.html`, `sw.js`) must always be re-checked. The `_headers` file sets this.
- **Free means checking limits.** Vercel's free plan bans commercial use, and Netlify's caps pause your site. The choice was made from each host's own pages, and two unknowns are written down instead of assumed.

## Remember

Before trusting a free tier for a business, read its limits and its commercial-use terms. Write down what you could not confirm.
