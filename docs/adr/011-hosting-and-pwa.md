# ADR-011: Free HTTPS hosting on Cloudflare Pages, and the lab as an installable PWA

- **Status:** Accepted, with two unverified points listed below
- **Date:** 2026-11-11

## Context

Both apps are static files with no backend. They need HTTPS (required for installing a PWA, and for Web Bluetooth later) and must cost nothing. Sulong is a business, so a host whose free plan forbids commercial use is not acceptable. Limits were checked on each host's own pages on 2026-11-11.

## Decision

Host both apps on **Cloudflare Pages** (free plan, a free `*.pages.dev` address, HTTPS included): one project for the lab and one for the guide, built from this repo.

Verified on Cloudflare's docs (developers.cloudflare.com/pages/platform/limits and /pages/functions/pricing):

- Requests to static assets are free and unlimited.
- 500 builds per month, 1 build at a time. Uploading a built folder directly does not count as a build.
- Up to 20,000 files per site and 25 MiB per file. Our built sites are about 1 MB and under 110 files in total.
- Up to 100 projects per account and 100 custom domains per project.

To stay under the build limit, only the `main` branch is built automatically (preview builds for other branches are switched off). Every push to a branch would otherwise use one of the 500.

The lab is made installable with `vite-plugin-pwa` (MIT): a web manifest, icons made from the supplied logo file (unchanged, centered on Obsidian), and a service worker that keeps the app and its fonts for offline use. The service worker updates itself in the background. The lab sends `noindex` so search engines skip it. The guide is not a PWA.

## Alternatives

- **GitHub Pages:** free for public repos only (a private repo needs a paid plan, per GitHub's docs and community answers). Soft limits of 1 GB site size and 100 GB per month. A good fallback if the repo is public.
- **Vercel Hobby:** limited to non-commercial use. Not allowed for a business.
- **Netlify Free:** now credit-based (300 credits a month, bandwidth costs credits) with a hard cap that pauses sites, and its commercial-use terms were unclear. Rejected as less predictable.

## Not verified (to check when signing up)

1. Cloudflare's pages do not say whether a card is needed to create a free account or use Pages. **Do not add a card.** If sign-up requires one, stop and pick another host.
2. Cloudflare's pages do not state commercial-use terms for the free plan. Read the terms at sign-up before depending on it for the public guide.

## Consequences

- No domain is bought. QR codes must wait: the `*.pages.dev` address is free but is a Cloudflare name, and changing address later would break printed codes. Jay decides the domain first.
- The lab's address is public (anyone can open it) but holds no data: all data lives in each person's own browser. It is hidden from search engines, not password protected.
- The service worker keeps the last-opened version available offline. A new version arrives after the next open.
- `npm audit` reports 6 low or moderate findings in build-time tools pulled in by the PWA plugin (workbox, via the glob and minimatch helpers). They run only on this computer during a build and are not shipped to users. The offered fix is a forced downgrade, so they are left alone for now.
- If the free plan ever changes, both sites are plain static folders and can move to GitHub Pages or another host in minutes.
