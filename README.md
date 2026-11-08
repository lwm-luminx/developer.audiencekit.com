# developer.audiencekit.com

The AudienceKit developer documentation, built with [Astro Starlight](https://starlight.astro.build) and served at
https://developer.audiencekit.com.

```sh
npm install
npm run dev     # http://localhost:4321
npm run build   # static site in dist/
```

The site is built from four sources:

- **This repository**: the home page, the site settings (`astro.config.mjs`), the theme mapping
  (`src/styles/audiencekit.css`) and the build scripts.
- **The API's docs bundle**: the guides and API pages, the GraphQL schema dumps (SDL and introspection) of the public
  endpoints, the document validator, and the design system tokens. The AudienceKit API exports it on every build of
  its `main` and `next` branches and commits it here as [`bundles/main/` and `bundles/next/`](bundles/).
  `scripts/bundle.mjs` installs it, and `scripts/graphql-reference.mjs` generates the GraphQL (consumer view) and
  StaffQL (staff view) references from it, one page per module.
- **[audience-kit-sdk](https://github.com/lwm-luminx/audience-kit-sdk)**: the AudienceKit SDK pages for Swift and
  Kotlin, from its READMEs and changelog (`scripts/sdks.mjs`).
- **[staff-kit](https://github.com/lwm-luminx/staff-kit)** (private): the StaffKit SDK pages, from its READMEs, through
  the snapshot committed in [`vendor/staff-kit/`](vendor/staff-kit/). A checkout beside this one (or `.staff-kit/`
  in CI, when the `STAFF_KIT_TOKEN` secret is set) refreshes the snapshot.

Pushes to `main` (including each new bundle) and a daily run publish the build to the `gh-pages` branch (`.github/workflows/site.yml`).
See [Contribute to these docs](src/content/docs/project/contributing-docs.md) for details and the writing guide.

## License and copyright

Copyright © 2026 Love Wins Media, Inc. All rights reserved; see [LICENSE](LICENSE), which grants no license of any kind. This code is public so it can be read and security-scanned, **not** so it can be reused. Copying this work beyond what [LICENSE](LICENSE) allows is copyright infringement, and willful copying can be a federal crime (17 U.S.C. §§ 501, 506). Removing, altering or faking copyright or attribution notices is unlawful under 17 U.S.C. § 1202, and a federal crime under § 1204 when done willfully for commercial advantage or private financial gain. See [NOTICE.md](NOTICE.md) for the details.
