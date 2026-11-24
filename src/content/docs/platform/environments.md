---
title: Environments
description: The AudienceKit hosts you can call, which version of the API each one runs, and where to get each one's schema.
---

AudienceKit runs two public API environments. Both are hosted by Love Wins Media.

| Environment | API base URL | Runs | Schema |
| --- | --- | --- | --- |
| Production | `https://api.audiencekit.com` | The current release | [`/graphql/schema.graphql`](/graphql/schema.graphql), [`/graphql/staff_schema.graphql`](/graphql/staff_schema.graphql) |
| Next (preview) | `https://api.next.audiencekit.com` | The upcoming release, ahead of production | [`/graphql/next/schema.graphql`](/graphql/next/schema.graphql), [`/graphql/next/staff_schema.graphql`](/graphql/next/staff_schema.graphql) |

:::caution[Next reads production data]
The next preview runs newer code against the same data as production. Use it to try upcoming fields, not as a sandbox: anything you write there is real.
:::

These docs describe production. [`/graphql/manifest.json`](/graphql/manifest.json) says which API build each published schema came from.

## Hosts that name an audience

Most calls are about one audience, and the API works out which from the host or the path:

- **GraphQL** takes the audience in the path: `/v1/audience/<audience id>/graphql` (the consumer view) and `/staffql` (the staff view). See [GraphQL](/api/graphql/).
- **Sign-in and branding** take a `host`: the audience's own verified domain (`hotmess.social`), or `<subdomain>.admin.audiencekit.com`, which works as soon as the audience exists. See [Domains](/guides/domains/).
- **Admin consoles** live at `admin.<audience domain>`, and the platform console at `admin.audiencekit.com`.

## API versions

Every SDK sends the API contract it speaks in the `X-AudienceKit-API-Version` header, and the API refuses SDK versions older than its minimum. Keep up with the [SDK changelogs](/sdks/changelog/audiencekit/), and validate your own documents against the schema of the environment you call ([Validate documents](/api/validate-documents/)).

## Rate limits and complexity

Sign-in endpoints allow a limited number of attempts per address in each five-minute window, and answer `429` with a `Retry-After` beyond it. GraphQL operations are limited in size and complexity; [GraphQL: Limits](/api/graphql/#limits) has the details.
