# Deploying to Cloudflare Pages (free)

Why Cloudflare Pages, and the limits that were checked: see [ADR-011](adr/011-hosting-and-pwa.md).

**Rules:** do not add a payment card anywhere. If any step asks for a card or a paid plan, stop. Cloudflare's screens change over time, so the wording below may differ slightly.

You make two Pages projects from the same GitHub repo: the private lab, and the public guide.

## Before you start

1. Merge the open pull requests into `main` in order (LAB-0 first, LAB-9 last). The sites are built from `main`, so the code must be there.
2. Create a free account at cloudflare.com (an email and a password). Check the screens do not ask for a card.

## Create the lab project

1. In the Cloudflare dashboard, open **Workers & Pages**, then **Create**, then the **Pages** tab, then **Connect to Git**.
2. Authorize GitHub and pick the `sulong-brew` repo.
3. Use these settings:
   - Project name: `sulong-lab` (this becomes `sulong-lab.pages.dev`)
   - Production branch: `main`
   - Framework preset: None
   - Build command: `npm ci && npm run build -w @sulong/lab`
   - Build output directory: `apps/lab/dist`
   - Environment variable: `NODE_VERSION` = `24`
4. Save and deploy. The first build takes a couple of minutes.

## Create the guide project

Repeat with:

- Project name: `sulong-guide`
- Build command: `npm ci && npm run build -w sulong-guide`
- Build output directory: `apps/guide/dist`
- Environment variable: `NODE_VERSION` = `24`

## Keep it under the free build limit

For each project, open **Settings**, then **Builds** (or **Branch control**), and turn off automatic builds for non-production branches (preview deployments). Otherwise every push to any branch uses one of the 500 free builds per month.

## Check it worked

1. Open the lab address on your iPhone in Safari. Tap Share, then **Add to Home Screen**. The Sulong logo should appear as the app icon, and the app opens full screen.
2. On the Mac in Chrome, open the lab address. An install icon appears at the right of the address bar.
3. Turn on airplane mode and open the app again. It should still open with your data.
4. Open the guide address. Try `/#the-still-pour` after the address to open a specific recipe.

## Good to know

- Each browser or home-screen app has its own data. The Home Screen app on your iPhone starts empty. Use Backup to export from one place and import into the other.
- The lab address is public but empty of data, and is hidden from search engines. Do not share it as if it were private.
- Do not print QR codes yet. The `pages.dev` address would be hard to change later. Decide on a domain first.
- If a deploy fails, open the project, then **Deployments**, then the failed one, and read the build log. Send it to me.
