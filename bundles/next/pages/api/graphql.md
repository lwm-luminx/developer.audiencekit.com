---
title: GraphQL
description: Send GraphQL requests to an audience, administer audiences across the platform, and keep the schema dump current.
sidebar:
  order: 3
---

GraphQL is AudienceKit's main API. The schema is built with [graphql-ruby](https://graphql-ruby.org) in `app/graphql` and supports Relay-style global object IDs.

## Endpoints

| Endpoint | Credentials | Use it for |
| --- | --- | --- |
| `POST /v1/audience/:audience_id/graphql` | A JWT signed in on that audience or on the platform, or an API key for that audience | The apps: one audience, as a member sees it |
| `POST /v1/audience/:audience_id/staffql` | A JWT with a staff role there: a platform or audience admin, a listing manager (venues and talent), or a venue device | Staff tools (the admin console, Focus, Velvet, Backstage, working a door): the same audience, with your role |
| `POST /v1/tenants/graphql` | A platform admin JWT | Tenant management: listing and creating audiences, subdomains and domains |

Tenant management is its own schema, so its mutations don't exist on an audience endpoint, and an audience's records (venues, people, locales, theme) don't exist on the tenants endpoint.

### The consumer view and staffql

An audience's two endpoints serve the same graph. They differ in what they can grant:

- **`graphql`, the consumer view**, grants a signed-in member their own records (`*:*:self`) and nothing more, whatever their role. An admin signed in there is a member like anyone else: no transcripts, bans, door, or other people's presence. Fields no member could ever use are left out of its schema, so they aren't refused, they don't exist. Fields that fall back to a value for someone without their permission (mixin edges like `photography { accounts }`) stay, and resolve to that value.
- **`staffql`, the staff view**, is the full graph with your role's grants (see each field's `@requires`). Anyone without a staff role is turned away with `403 { "error": "no_permission" }`.

Pick the endpoint by what the client is: the apps people use go to `graphql`, staff tools go to `staffql`. The Swift and Kotlin SDKs take an `endpoint` for this (`GraphQLEndpoint.staff` / `GraphQLEndpoint.STAFF`), and their door calls (`doorVenues`, `door`/`venueDoor`, `scanAdmission`) always use staffql.

Send a JSON body with `query`, and optionally `variables` and `operationName`:

```sh
curl https://api.audiencekit.io/v1/audience/$AUDIENCE_ID/graphql \
  -H "Authorization: JWT $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "query Venues { name venues { list { nodes { id hidden locale { name } } } } }",
    "operationName": "Venues"
  }'
```

An unknown audience ID returns `404 Not Found`. A JWT issued for another audience, for an endpoint narrower than the one called, or by another AudienceKit instance returns `401 Unauthorized` (see [Authentication](../authentication/)); an API key for another audience returns `403 Forbidden`. The tenants endpoint takes only platform admin JWTs.

## Queries

### Integration metadata

Remote integration endpoints can expose this public, provider-independent query:

```graphql
query {
  integrationMetadata {
    websiteUrl
    companyName
    supportUrl
    supportEmail
  }
}
```

All four fields are nullable strings. Website and support links must use HTTPS;
support email must be a plain email address. This query requires no audience or
photographer credential and must not expose private account data. AudienceKit
reads it from the registered endpoint and displays it in the integration card.
Older providers and unavailable endpoints return no metadata in the management
schema, without preventing management of their connections. The same metadata
contract can be used by photography and future chat moderation providers.

The platform schema exposes these details at
`ExtensionRegistration.integrationMetadata`. AudienceKit uses its validated
HTTPS transport and deduplicates requests to the same endpoint within a query.

### Module settings

Payments owns the existing Stripe and Square integrations; Cover depends on
Payments. Push owns APNs and Android/Firebase configuration. Their settings live
inside their module cards on the audience's Extensions/Plugins page. Provider
credentials retain the existing platform-only management and encrypted storage.
Users owns admin role controls, audience access requests, and invite links.

Photography currently exposes `Audience.photography`. Venue-scoped photography
and chat moderation providers remain follow-up work: a venue mixin must filter
by venue and must never substitute the whole audience photo feed. Shared audience
settings stay on Settings until a module has a clear ownership contract.

### Audience queries

On an audience endpoint the query root is the audience itself: its fields, the modules on it (`venues`, `events`, `people`, `chat`, …) and `me`, `node` and `nodes` are all at the top level, and there's no `audience` or `audiences` field. Records are looked up through their module: `venues { venue(id:) }`, `events { event(id:) eventSeries(id:) }`, `people { person(id:) }`. On `/v1/tenants/graphql`, `audiences` lists every audience and `audience(id:)` fetches one.

The root is the audience's; whatever is the viewer's is under `me`, a `UserState` (`null` when nobody is signed in, as with API keys):

- `me { self }` is a `SelfUser`, the viewer's own profile: the public user fields plus what only they see (`lastName`, `emailAddress`, `facebookId`, `facebookScopes`, `hasFacebook`, `signedInWithApple`, `isAdmin`, `currentVenue`, `venueLastAt`, `createdAt`, `updatedAt`). `self { user }` is their public `User`.
- `me` itself holds their state: `blockedUsers`, `termsAcceptedAt`, `canPretendLocation`, the venues and talent they manage (`listings { venues people troupes }`, a `ViewerListings`), and the modules' viewer state: `ping { myPing friendPings }` and `cover { admissions doorVenues }`.
- `User` is the public user, the record anyone who reaches them sees: `id`, `name`, `firstName`, `photo`, `presence`, `tribes` (the `IUser` interface, which `SelfUser` implements too) and `ping { activePing }`.

Per-record viewer fields stay on their record (`event { rsvp { mine } }`, `venue { ping { myPing } }`), and audience-wide data stays on the root (`ping { count }`).

```graphql
query Audience {
  id
  name
  subdomain
  theme { preset tagline light { name value } dark { name value } }
  me { self { name emailAddress } listings { venues { id } } }
}
```

### Object IDs

IDs are Relay global IDs, so `node(id:)` and `nodes(ids:)` can fetch any object. Every query root has them (`interface IRelay`): the audience on its endpoints and the tenants `Query`. On an audience endpoint they return `null` for objects that belong to a different audience.

## Mutations

Every mutation requires an admin JWT. Others get an error with the message "Administrator access required". Mutations follow the Relay convention: one `input` argument, with an optional `clientMutationId` that is echoed back.

Mutations that take an `audienceId` default to the endpoint's audience. On an audience endpoint, passing a different `audienceId` is an error; on `/v1/tenants/graphql` you must pass one. Subdomains change only on the tenants endpoint.

```graphql
mutation Rebrand($input: AudienceThemeUpdateInput!) {
  updateAudienceTheme(input: $input) {
    audience { theme { preset tagline } }
  }
}
```

```json
{
  "input": {
    "theme": {
      "preset": "hot_mess",
      "tagline": "Queer nights out, all in one place.",
      "light": [{ "name": "accent", "value": "#b8236f" }]
    }
  }
}
```

When a record fails validation, the error's `extensions` carry the field errors. See [Errors](/api/errors/).

The full list of types, queries and mutations is in the [GraphQL reference](/api/graphql-reference/).

## Limits

A query may contain at most 5,000 tokens, and validation stops after 100 errors.

## Keep the schema dump current

The API checks in `contracts/schema/schema.graphql` and `contracts/schema/schema.json` (the consumer view), `contracts/schema/staff_schema.graphql` and `contracts/schema/staff_schema.json` (staffql), and `contracts/schema/tenants_schema.graphql` and `contracts/schema/tenants_schema.json` (tenant management). The admin console's Relay compiler and the [GraphQL reference](/api/graphql-reference/) are built from the dumps, so regenerate them whenever you change a type:

```sh
cd api
bin/rails graphql:schema:dump graphql:staff:schema:dump graphql:tenants:schema:dump
```
