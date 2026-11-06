---
title: Authentication
description: The four kinds of credentials the AudienceKit API accepts, and what each one can do.
sidebar:
  order: 2
---

Every request except a few public ones (`/up`, `/v1/branding`, the token endpoints and image redirects) needs an `Authorization` header. The API accepts two schemes:

```http
Authorization: JWT <token>      # user, admin and service JWTs
Authorization: Bearer <api key> # application API keys
```

Anything else gets `401 Unauthorized` with an empty JSON body.

## Choose a credential

| Credential | Who uses it | Scheme | Scope |
| --- | --- | --- | --- |
| User JWT | Mobile and web apps acting for a signed-in person | `JWT` | That user. Admin users can also administer every audience. |
| Application API key | Your server, acting as an app of one audience | `Bearer` | One audience's GraphQL endpoint. |
| Service JWT | Workers and automation | `JWT` | One audience, limited to the token's scopes. |

## User JWTs (Facebook sign-in)

Apps sign people in with Facebook, then exchange the Facebook token for an AudienceKit JWT:

```http
POST /v1/token
Content-Type: application/json

{
  "facebook_token": "<Facebook user access token>",
  "host": "admin.hotmess.social",
  "device": {
    "identifier": "<stable device identifier>",
    "type": "apple",
    "model": "iPhone16,1",
    "version": "1.0",
    "build": "42"
  }
}
```

`host` is optional. On an audience's host (`admin.<audience domain>`) the Facebook token must come from that audience's Facebook app; otherwise it must come from the AudienceKit app. `GET /v1/branding?host=…` returns the app ID to use as `facebook_app_id`.

The API exchanges the token for a long-lived one, creates or updates the user from their Facebook profile, records the device and a new session, and returns:

```json
{
  "token": "<jwt>",
  "access_token": "<jwt>",
  "refresh_token": "<jwt>",
  "user": { "id": "…", "name": "…" }
}
```

Send it as `Authorization: JWT <jwt>`. The JWT is signed with HS256. Its claims are built at sign-in by the transforms in `app/services/login_claims/`: the user's `id` and app-scoped `fb_id`, a `jti` that identifies the session, a `role` of `user` or `admin`, `fb_app_id` (the Facebook app used), and, for a sign-in on an audience's host, `audience_id`. A JWT with `audience_id` only works on that audience's endpoint.

Every JWT also says which AudienceKit instance issued it and which endpoint it's for, and the API checks both:

- `iss` is the issuing instance's origin, such as `https://api.audiencekit.com`. Production and staging tokens don't work on each other. Any host of the same instance (an audience's API host, a custom domain) accepts it.
- `aud` is the full URL of the widest endpoint the token is for: the audience's `/v1/audience/<id>/graphql` for people signed in on the audience, its `/staffql` for its admins, listing managers, venue devices and audience consoles, and `/v1/tenants/graphql` for platform sign-ins. An endpoint accepts its own URL and the wider ones: `graphql` takes `graphql`, `staffql` and tenants tokens; `staffql` takes `staffql` and tenants tokens; tenants takes only tenants tokens. Anything else gets `401`.

`aud` decides where a token may be sent, not what it may do there: that's still the role, and staffql serves only staff roles. Tokens from before `aud` named an endpoint are refused, so people sign in again.

A user JWT works only while its session exists. Sessions end when someone removes one of our Facebook apps: every app's Deauthorize callback is `POST /v1/facebook/deauthorize`, which signs that Facebook user out everywhere and forgets their Facebook token. Their data stays until they ask Facebook to delete it, which calls `POST /v1/facebook/data_deletion`. Both verify Facebook's `signed_request` against the AudienceKit app and every audience's apps.

To register a device for push notifications, call the `registerDevice` GraphQL mutation with its `notificationToken`.

:::caution
User JWTs have no expiry today, so treat them like passwords: store them in the platform keychain and never log them.
:::

## Admin access

An admin is a user whose `isAdmin` flag is set; their JWTs carry `role: admin`. Admins can:

- with a platform JWT (no `audience_id`), call `POST /v1/tenants/graphql` to list and create audiences and manage their domains,
- run every GraphQL mutation (mutations refuse anyone else with "Administrator access required"),
- call the research endpoints for any audience, and hold every service scope.

## Application API keys

An application belongs to one audience and has an `api_key`. Send it as a bearer token:

```sh
curl https://api.audiencekit.io/v1/audience/$AUDIENCE_ID/graphql \
  -H "Authorization: Bearer $AUDIENCE_KIT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query":"{ venues { id page { name } } }"}'
```

A key only works on its own audience's endpoint; any other audience returns `403 Forbidden`. Requests made with a key have no current user, so `me` returns `null`.

## Service tokens

Machines that keep an audience's data fresh use service tokens. A service token is a secret shaped like `akst_<prefix>_<secret>` that belongs to one audience and carries scopes. Exchange it for a one-hour JWT:

```http
POST /v1/token/service
Content-Type: application/json

{ "service_token": "akst_…" }
```

```json
{
  "token": "<jwt>",
  "token_type": "JWT",
  "expires_at": "2026-10-06T06:00:00Z",
  "audience_id": "…",
  "audience": "LGBT",
  "scopes": ["research:read", "places:write", "events:write"]
}
```

The API checks on every request that the token behind a service JWT hasn't been revoked or expired. An unknown, revoked or expired secret returns `401` with `{"error": "invalid_service_token"}`, and a missing scope returns `403` with `{"error": "insufficient_scope", "required": "…"}`.

| Scope | Allows |
| --- | --- |
| `research:read` | `GET /v1/research/snapshot` and `GET /v1/research/batches` |
| `places:write` | Upserting venues through `POST /v1/research/batch` (needs `events:write` too) |
| `events:write` | Upserting events through `POST /v1/research/batch` (needs `places:write` too) |

See [Automate with service tokens](/guides/service-tokens/) to create and manage them.
