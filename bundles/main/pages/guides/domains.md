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

`dnsTarget` is the CNAME target for the domain's admin console. Remove a domain with `deleteAudienceDomain(input: { id: "…" })`.

## Verify it

Create two DNS records:

| Type | Name | Value |
| --- | --- | --- |
| TXT | `_audiencekit.<domain>` | `txtRecordValue`, e.g. `audiencekit-verification=…` |
| CNAME | `admin.<domain>` | `dnsTarget` |

Then press **Check DNS** in Settings, or call `verifyAudienceDomain(input: { id: "…" })`. It reports whether the TXT record was found and where `admin.<domain>` points. Once the TXT record is found the domain is verified, and the console, CORS and sign-in start treating its hosts as the audience's.

## How hosts match

A host belongs to an audience when, ignoring case, a port and a trailing dot:

- it is `<subdomain>.admin.audiencekit.com` , where `<subdomain>` is the audience's subdomain. This works before any domain is set up.
- or it equals one of the audience's **verified** domains, or is `admin.` followed by one.

An audience's consoles sign in with its production Facebook app (the AudienceKit app if it has none), so add each console host to that app's **Allowed Domains for the JavaScript SDK**. People who sign in there become the audience's members. A platform admin can make members admins on the tenant's Settings page; their tokens then carry `audience_role: admin` and can change that audience.

## The admin console

Each verified domain's `admin.<domain>` host serves the audience's admin console. The console calls `GET /v1/branding`, skins itself with the audience's theme and limits itself to that audience, and browsers there may call the API cross-origin.
