---
title: Contribute to these docs
description: How developer.audiencekit.com is built, where its pages come from, and how to preview a change.
---

developer.audiencekit.com is built with [Astro Starlight](https://starlight.astro.build) in the public [lwm-luminx/developer.audiencekit.com](https://github.com/lwm-luminx/developer.audiencekit.com) repository, from four sources:

| Source | What it provides | Where to change it |
| --- | --- | --- |
| This repository | The home page, this page, the theme mapping and the site settings | Here |
| The API's docs bundle | The Start here, API and Guides pages, the Ruby SDK page, the GraphQL schema dumps and validator (from which the GraphQL and StaffQL references are generated), and the design system tokens | The AudienceKit team; open an issue here to suggest a change |
| [audience-kit-sdk](https://github.com/lwm-luminx/audience-kit-sdk) | The AudienceKit pages (Swift, Kotlin, the Kotlin Multiplatform core) and its changelog, from its READMEs | That repository's READMEs |
| StaffKit | The StaffKit pages (Swift, Android), from its READMEs, through the snapshot in `vendor/staff-kit/` | The AudienceKit team |

## The API's docs bundle

Each API release publishes a docs bundle to this repository: `bundles/main/` for production and `bundles/next/` for the upcoming release. Each bundle has a `manifest.json` with the channel, the commit it was built from, the API contract version, the public GraphQL views (endpoint path, SDL and introspection files) and a SHA-256 for every file. The push starts this site's build.

The site is built from the production bundle, so it documents what production serves. The upcoming release's schema dumps are published beside it:

| URL | What it is |
| --- | --- |
| `/graphql/schema.graphql`, `/graphql/schema.json` | The consumer view (SDL and introspection), as production serves it |
| `/graphql/staff_schema.graphql`, `/graphql/staff_schema.json` | The staff view (`staffql`) |
| `/graphql/check.mjs` | The [document validator](/api/validate-documents/) |
| `/graphql/next/…` | The same files for the upcoming release (api.next) |
| `/graphql/manifest.json` | Which bundle versions the site was built from |

## Preview locally

You need Node 22.

```sh
npm install
npm run dev     # http://localhost:4321
npm run build   # writes the static site to dist/
```

`dev` and `build` first install the sources (`npm run sources`): the bundle (`scripts/bundle.mjs`), the SDK pages (`scripts/sdks.mjs`) and the references (`scripts/graphql-reference.mjs`).

- The bundle comes from `bundles/main/`.
- The AudienceKit pages come from `../audience-kit-sdk`, or a shallow clone into `.sdk/`.
- The StaffKit pages come from the snapshot in `vendor/staff-kit/`. `node scripts/sdks.mjs --audience-kit <dir>` takes another directory.

## The references

`/reference/graphql/` documents the consumer view and `/reference/staffql/` the staff view, one page per module plus the root, the mutations and the subscriptions. A module is the API's own: it owns the mixin interfaces that declare it (`@mixin(extensionKey:)`), the permission namespace that guards its fields (`@requires`), and every type reached from those first; the ownership of shared helper types is inferred from that walk. The staff reference marks what the consumer view leaves out, and every field shows the permissions that allow it.

## Publishing

Every push to `main` (including each new bundle) and a daily run (to pick up SDK changes) build the site and deploy it to Cloudflare, which serves only the static build (`wrangler.jsonc`). Pull requests build without deploying.

`public/_headers` sets the response headers (security headers, long caching for Astro's hashed bundles, and CORS on `/graphql/` and `/schemas/` so client CI can fetch them). To try the Worker locally, run `npm run preview:cloudflare`.

## Look and feel

The docs use the AudienceKit design system's default theme. The bundle carries the design system's generated `tokens.css` and fonts, and `src/styles/audiencekit.css` maps them onto Starlight. Starlight's light and dark modes map to the design system's `light` and `dark` themes.

## Writing style

- Write in second person and sentence case, and lead with what the reader can do.
- Take facts from the code, and link to the file when it helps.
- Keep examples runnable: real endpoints, real field names, and placeholders in `<angle brackets>` or `$VARIABLES`.
- Don't edit the references by hand. They're generated from the bundle's schema dumps (`scripts/graphql-reference.mjs`).
- Don't edit the SDK pages here either: they're the repositories' READMEs, imported on every build.
