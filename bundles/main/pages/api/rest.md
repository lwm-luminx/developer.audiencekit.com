---
title: REST endpoints
description: The /v1 REST endpoints left beside GraphQL for sign-in, branding, workers, callbacks and webhooks.
sidebar:
  order: 6
---

Everything an app reads or changes goes through [GraphQL](/api/graphql/). REST is left for what has to happen before there is a session or an audience (sign-in, branding), for workers with service tokens, and for callbacks and webhooks from Facebook, Stripe, Square and Eventbrite. All paths are under `/v1` and need [credentials](/api/authentication/) unless marked public.

The older REST reads (`/v1/now`, `/v1/me`, `/v1/me/location`, `/v1/locales`, `/v1/venues`, `/v1/events`, `/v1/people`, `/v1/tracks`, `/v1/users` and `/v1/token/device`) are gone. Use the `reportLocation`, `locale`, `venue`, `event`, `person`, `rsvpEvent` and `registerDevice` GraphQL operations instead.

## Tokens

| Method and path | Description |
| --- | --- |
| `POST /v1/token` | Public. Exchange a Facebook token for a user JWT. |
| `POST /v1/token/service` | Public. Exchange a service token for a one-hour service JWT. |
| `GET /v1/token/methods?host=<host>` | Public. How the audience's apps let people sign in: `{ "methods": ["facebook", "apple", "google"], "warnings": { "facebook": "Facebook login is only for testers" } }`; each warning is shown with Cancel and Continue before that method. |

## Branding

| Method and path | Description |
| --- | --- |
| `GET /v1/branding?host=<host>` | Public. The audience that owns a host, with its theme. |

The admin console calls this before anyone signs in so it can skin itself. `host` defaults to the request's host, and `admin.` hosts match their audience's domain. It returns `404` when no audience owns the host.

```json
{
  "audience": { "id": "…", "name": "Hot Mess", "subdomain": "hotmess" },
  "sign_in_methods": ["facebook", "apple", "google"],
  "theme": {
    "preset": "hot_mess",
    "tagline": "Queer nights out, all in one place.",
    "light": { "accent": "#b8236f" },
    "dark": {}
  }
}
```

## Photos

| Method and path | Description |
| --- | --- |
| `GET /v1/photos/:id` | Public. Redirects to the stored photo. Every image URL the API returns (`PhotoURL`: `bannerUrl`, `avatarUrl`, `photoUrl`) points here. |

## Research

Used by the [researcher worker](/guides/researcher/) with a service JWT. Admins can call them too, naming the audience with `?audience_id=<uuid>` or `?audience=<subdomain>`.

| Method and path | Scope | Description |
| --- | --- | --- |
| `GET /v1/research/snapshot` | `research:read` | The audience's locales (with their metro towns and the local guides staff linked to them) and venues with their upcoming events. Filter with `?locale=<label>`. |
| `POST /v1/research/batch` | `places:write` and `events:write` | Upsert venues and events with provenance. Add `?dry_run=true` to validate without writing. |
| `GET /v1/research/batches` | `research:read` | The 50 most recent batches. |
| `POST /v1/research/imports` | `places:write` and `events:write` | Upload a listings file and start its dry run on the worker. The body is the file itself, or `{ "file": …, "filename": "ca.json", "kind": "locales" }`. Returns the upload (`202`) with its `id`, `kind` and `status: "previewing"`. |
| `GET /v1/research/imports` | `research:read` | The last ten uploads, newest first, each with its `status`, `summary` and `rows`. |
| `GET /v1/research/imports/:id` | `research:read` | One upload: poll it until `status` is `previewed` (then `rows` says what the import would do, a `kind`, `name` and `detail` per decision) or `failed` (`error` says why). |
| `POST /v1/research/imports/:id/import` | `places:write` and `events:write` | Import a previewed upload for real, on the worker; poll until `imported`. |

See [Automate with service tokens](/guides/service-tokens/) for the batch format.

A listings file is one of the JSON files the `listings:*` rake tasks take, and its `kind` is read from its shape unless
given: calendar listings (`calendar`: `{ source, regions, venues, events }`), researched locales and their venues
(`locales`), researched People (`people`, each with a `kind`), social profiles to fill in where missing (`socials`:
`people` or `venues` with their handles) or profiles to propose for review (`social_proposals`: entries with
`candidates`). Admins upload the same files on the console's Curate › Imports page.

## Alexa

`/alexa/events`, `/alexa/friends`, `/alexa/token` and `/alexa/ping` back the Hot Mess Alexa skill.
