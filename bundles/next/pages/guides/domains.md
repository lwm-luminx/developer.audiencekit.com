---
title: Connect a domain
description: Give an audience its own domain and a branded admin console at admin.<domain>.
sidebar:
  order: 2
---

An audience can own any number of domains. The API uses them to find the audience for a host, which is how each audience gets its own admin console.

## Add a domain

Add domains on the tenant's **Settings** page in the platform console, or with the `createAudienceDomain` mutation on `POST /v1/tenants/graphql`:

```graphql
mutation {
  createAudienceDomain(input: { audienceId: "…", dnsName: "hotmess.social" }) {
    audienceDomain { id adminHost txtRecordName txtRecordValue dnsTarget }
  }
}
```

When the API has `HEROKU_API_KEY` and `HEROKU_APP_NAME`, adding a domain also adds `admin.<domain>` to the Heroku app through the Platform API, and `dnsTarget` is the CNAME target Heroku assigned. Without them, add the host yourself with `heroku domains:add admin.<domain>`. Remove a domain with `deleteAudienceDomain(input: { id: "…" })`, which also removes its host from Heroku.

## Verify it

Create two DNS records:

| Type | Name | Value |
| --- | --- | --- |
| TXT | `_audiencekit.<domain>` | `txtRecordValue`, e.g. `audiencekit-verification=…` |
| CNAME | `admin.<domain>` | `dnsTarget` |

Then press **Check DNS** in Settings, or call `verifyAudienceDomain(input: { id: "…" })`. It reports whether the TXT record was found and where `admin.<domain>` points. Once the TXT record is found the domain is verified, and the console, CORS and sign-in start treating its hosts as the audience's.

## How hosts match

A host belongs to an audience when, ignoring case, a port and a trailing dot:

- it is `<subdomain>.admin.audiencekit.com` (`PLATFORM_ADMIN_HOST`), where `<subdomain>` is the audience's subdomain. This works before any domain is set up.
- or it equals one of the audience's **verified** domains, or is `admin.` followed by one.

An audience's consoles sign in with its production Facebook app (the AudienceKit app if it has none), so add each console host to that app's **Allowed Domains for the JavaScript SDK**. People who sign in there become the audience's members. A platform admin can make members admins on the tenant's Settings page; their tokens then carry `audience_role: admin` and can change that audience.

## Serve the admin console

When the API runs with the admin console built into `public/vite` (as it does on Heroku), it serves the console to any `admin.*` host, to `*.admin.audiencekit.com`, and to hosts listed in `ADMIN_HOSTS`. API paths (`/v1/…`, `/connection`, `/up`) still reach Rails on those hosts. The console calls `GET /v1/branding`, skins itself with the audience's theme and limits itself to that audience.

Browsers on those hosts may call the API cross-origin, because CORS allows any console host that belongs to an audience.
