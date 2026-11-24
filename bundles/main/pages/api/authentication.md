---
title: Authentication
description: The four kinds of credentials the AudienceKit API accepts, and what each one can do.
sidebar:
  order: 2
---

Every request except a few public ones (`/up`, `/v1/branding`, the token endpoints and image redirects) needs an `Authorization` header with one scheme, `Bearer`:

```http
Authorization: Bearer <credential>
```

The credential is a session JWT (a signed-in person, or a venue device), a service JWT, or an application API key. The older `JWT <token>` scheme is no longer accepted: anything else gets `401 Unauthorized`.

## Choose a credential

| Credential | Who uses it | Scope |
| --- | --- | --- |
| Session JWT | Mobile and web apps acting for a signed-in person | That person, on the audience they signed in to (or the platform, for staff apps). |
| Application API key | Your server, acting as an app of one audience | One audience's GraphQL endpoint. |
| Service JWT | Workers, bots, AI agents and automation | One audience (or the platform), limited to the token's scopes. |

## Sign people in

Apps run the identity provider's own sign-in, then exchange what it gives them for an AudienceKit session. Each audience chooses which providers its apps offer; ask before drawing the sign-in screen:

```http
GET /v1/token/methods?host=hotmess.social
```

```json
{ "methods": ["facebook", "apple", "google"], "warnings": { "facebook": "Facebook login is only for testers" } }
```

Show only the methods listed. A method with a warning shows it, with Cancel and Continue, before signing in that way. A sign-in with a method the audience turned off gets `403` with `reason: "sign_in_method_disabled"`.

| Provider | Call | What the app sends |
| --- | --- | --- |
| Facebook | `POST /v1/token` | `facebook_token`: the Facebook user access token (or a Login for Business `code`). |
| Apple | `POST /v1/token/apple` | `identity_token` from Sign in with Apple, and optionally `authorization_code` (so deleting the account can revoke it), `first_name` and `last_name` (Apple sends the name only the first time). Android and the web flow also send `redirect_uri` and `nonce`. |
| Google | `POST /v1/token/google` | `id_token` from Google Identity or Credential Manager, optionally `access_token` and `name`. |
| Discord | `POST /v1/token/discord` | `ticket` and `verifier` from the browser half of the sign-in (below). |
| GitHub | `POST /v1/token/github` | `ticket` and `verifier`, the same way. |

Every call also takes `host`, which names the audience (its own verified domain, or `<subdomain>.admin.audiencekit.com`), and a `device`:

```http
POST /v1/token/apple
Content-Type: application/json

{
  "identity_token": "<JWT from Sign in with Apple>",
  "host": "hotmess.social",
  "device": {
    "identifier": "<stable device identifier>",
    "type": "apple",
    "model": "iPhone16,1",
    "version": "1.0",
    "build": "42"
  }
}
```

On an audience's host the provider token must come from that audience's own app (its Facebook app, its Sign in with Apple identifiers). `GET /v1/branding?host=…` returns the audience's IDs for the apps to use.

### Discord and GitHub: the browser half

Discord and GitHub sign in through the browser first. The page makes a random `verifier`, keeps it, and sends the browser to the API with its SHA-256 (hex) as `challenge` and the page to come back to:

```http
GET /v1/token/github/authorize?return_to=https://example.org/account&challenge=<sha-256 of the verifier>
```

The API sends the person to the provider and back to `return_to` with `github_ticket` (or `discord_ticket`), or `github_error` when they cancel. The page then posts the ticket and its verifier to `POST /v1/token/github`. `return_to` must be an https URL on one of the audience's hosts.

### Connect another provider

A person who signed in one way can add another to the same account: call the provider's sign-in with `"connect": true` and the current session's token in `Authorization`. The answer is a new session for the joined account. A conflict (the other account can't be joined) is a `400`, and the current session stays signed in. Discord and GitHub can be connected even where the audience doesn't offer them for signing in.

### The token JSON

Every sign-in answers with the same JSON, so clients never decode the JWT:

```json
{
  "token": "<jwt>",
  "userId": "…",
  "audienceId": "…",
  "role": "member",
  "endpoint": "https://api.audiencekit.com/v1/audience/<id>/graphql",
  "venueDeviceId": null,
  "expiresAt": "2027-02-22T18:00:00Z"
}
```

| Field | What it is |
| --- | --- |
| `token` | The session JWT. Send it as `Authorization: Bearer <token>`. |
| `userId` | The signed-in person. |
| `audienceId` | The audience signed in to; `null` for a platform sign-in (the staff apps before they choose an audience). |
| `role` | The person's role there: `member`, `listing`, `admin` or `venue_device`. |
| `endpoint` | The widest GraphQL endpoint the token is for: the audience's `/graphql` for members, its `/staffql` for its staff, `/v1/tenants/graphql` for a platform sign-in. |
| `venueDeviceId` | For a venue device's session, the grant it was redeemed from; otherwise `null`. |
| `expiresAt` | When the token stops working: 90 days for members, 30 for staff. |

### Keep the session

- **Refresh** before `expiresAt` with `POST /v1/token/refresh` and the current token: it answers the token JSON for the same session with a new expiry and the person's current roles. On launch, and whenever less than a third of the token's life is left, is a good rule. A token up to 30 days past its expiry is still taken there (and only there) while its session exists.
- **Sign out** with `DELETE /v1/token`: the session ends and its token stops working everywhere.
- A `401` on any call means the session ended (signed out elsewhere, or the person removed the app from Facebook): forget the token and show the sign-in screen.

Store tokens in the platform keychain and never log them. The SDKs do all of this for you.

### Inside the JWT

You don't need to decode it, but the API checks two claims on every request:

- `iss` is the issuing instance's origin, such as `https://api.audiencekit.com`. Production tokens don't work on another instance.
- `aud` is the endpoint URL above. An endpoint accepts its own URL and the wider ones: `graphql` takes `graphql`, `staffql` and tenants tokens; `staffql` takes `staffql` and tenants tokens; tenants takes only tenants tokens. Anything else gets `401`.

`aud` decides where a token may be sent, not what it may do there: that is still the person's role, and `staffql` serves only staff.

To register a device for push notifications, call the `registerDevice` GraphQL mutation with its `notificationToken`.

## Application API keys

An application belongs to one audience and has an `api_key`. Send it as a bearer token:

```sh
curl https://api.audiencekit.com/v1/audience/$AUDIENCE_ID/graphql \
  -H "Authorization: Bearer $AUDIENCE_KIT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query":"{ name venues { list(first: 5) { nodes { id name } } } }"}'
```

A key only works on its own audience's endpoint; any other audience returns `403 Forbidden`. Requests made with a key have no current user, so `me` returns `null`.

## Service tokens

Machines that keep an audience's data fresh use service tokens. A service token is a secret shaped like `akst_<prefix>_<secret>` that belongs to one audience (or, for a few platform scopes, to the platform) and carries scopes. Exchange it for a short-lived service JWT:

```http
POST /v1/token/service
Content-Type: application/json

{ "service_token": "akst_…" }
```

The answer is the token JSON with `userId` null and `role` `service`, plus the audience's name and the token's scopes:

```json
{
  "token": "<jwt>",
  "userId": null,
  "audienceId": "…",
  "role": "service",
  "endpoint": "https://api.audiencekit.com/v1",
  "venueDeviceId": null,
  "expiresAt": "2026-10-06T06:00:00Z",
  "audience": "Hot Mess",
  "scopes": ["research:read", "places:write", "events:write"]
}
```

Mint a new service JWT from the same secret when it expires. The API checks on every request that the token behind a service JWT hasn't been revoked or expired. An unknown, revoked or expired secret returns `401` with `{"error": "invalid_service_token"}`, and a missing scope returns `403` with `{"error": "insufficient_scope", "required": "…"}`.

| Scope | Allows |
| --- | --- |
| `research:read` | `GET /v1/research/snapshot` and `GET /v1/research/batches` |
| `places:write` | Upserting venues through `POST /v1/research/batch` (needs `events:write` too) |
| `events:write` | Upserting events through `POST /v1/research/batch` (needs `places:write` too) |

See [Automate with service tokens](/guides/service-tokens/) to create and manage them.
