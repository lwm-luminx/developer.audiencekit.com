---
title: MCP server
description: Connect Claude and other Model Context Protocol clients to an audience, read-only by default, with OAuth or a service token.
sidebar:
  order: 9
  label: MCP server
---

The API serves a [Model Context Protocol](https://modelcontextprotocol.io) server, so an AI assistant such as Claude can look at an audience directly: its rooms and their transcripts, its AI host's decisions, and its venues, events and people listings. It answers at:

```text
https://api.audiencekit.com/v1/mcp
```

Every tool is read-only unless the connection was given the listings import scope, and nothing it returns names a person beyond what the room shows everyone.

## Credential

A connection acts with a **service token**:

| Token | Scope | Reaches |
| --- | --- | --- |
| An audience's token | `diagnostics:read` | That audience. |
| An audience's token | `diagnostics:read` and `listings:import` | That audience, and can import listings files into it. |
| A platform token | `platform_diagnostics:read` (and optionally `platform_listings:import`) | Every audience; each tool then takes an `audience` argument (its subdomain, name or id), and `list_audiences` lists them. |

None of these scopes is a default, because they read chat transcripts. Mint a token in the admin console under **System › Service tokens**, or let the connector mint one for you by approving it in the console (below). Revoking the token cuts off every client using it at once.

## Connect

**claude.ai** (web, desktop and mobile, and Claude Code on the web): **Settings › Connectors › Add custom connector**, with the URL above and no client ID or secret. Claude registers itself and opens AudienceKit's authorize page, which offers two ways in:

- **Approve in the console.** Sign in to the admin console, pick the audience (platform administrators can pick **All audiences**, and tick *Also import listings*), and approve. The console mints a token for this connection, named after the client and who approved it, and sends you back. Nothing to copy; revoke the token to disconnect.
- **Paste a service token** you minted yourself.

Either way the client then holds a one-hour access token and a 90-day refresh token, never the service token itself. Any OAuth 2.1 MCP client with dynamic client registration and PKCE connects the same way.

**Claude Code** (or any client with a fixed header) can send the token's secret directly:

```sh
claude mcp add --transport http audiencekit https://api.audiencekit.com/v1/mcp \
  --header "Authorization: Bearer $AUDIENCEKIT_DIAGNOSTICS_TOKEN"
```

A [service JWT](/api/authentication/#service-tokens) works as the bearer too.

## Tools

| Tool | What it returns |
| --- | --- |
| `audience_overview` | The audience, its chat provider, connected moderation providers, and counts for the last 24 hours |
| `find_rooms` | Venue and locale rooms by name, with their latest activity |
| `room_messages` | A room's transcript (a time window, or `around` a message), with removed messages marked and the AI host's ruling on each |
| `message_analyses` | The AI host's per-message analyses: ruling, category, confidence and actions |
| `host_decisions`, `host_decision` | The AI host's decisions, filterable by room, source, tool and state; one with its whole trace |
| `moderation_actions` | What moderation providers did |
| `find_venues`, `find_events` | Venues by name or locale; events in a window, by name or venue |
| `find_people`, `person` | People listings by name, locale or kind (or a list of names checked for duplicates); one listing in full |
| `server_health` | The API process itself: its release, memory, sockets and subscriptions |
| `graphql_deprecations` | Every deprecated field, argument and enum value, and which clients still send it |

Times are ISO 8601, or a span back from now (`90m`, `6h`, `2d`, `1w`). A tool that can't do what it was asked answers with `isError` and a sentence saying why, so the assistant can correct itself.

### Importing listings

With the import scope, three more tools write, exactly like an upload in the console's imports page:

| Tool | What it does |
| --- | --- |
| `upload_listings` | Uploads a [listings file](/guides/listings-imports/) and starts its dry run. Nothing changes yet. |
| `listing_imports` | The latest uploads, or one with its summary and rows. |
| `import_listings` | Imports an upload whose dry run is done, as the dry run said. |

An assistant should import only after a person has seen the dry run and said to.

## Privacy

- People appear as their rooms show them to everyone: first name and last initial, or the venue, listing or host a message was posted as. Full names, user IDs, emails, phone numbers, photos, tribes, tags and locations never leave the server.
- Each sender carries an opaque `sender_ref`, so an assistant can follow one person through a transcript without learning who they are. It means nothing outside the audience.
- Without the import scope, nothing writes: no tool posts, removes, bans or changes a setting.

## Protocol

Streamable HTTP without sessions: each `POST` gets one `application/json` answer, notifications get `202 Accepted`, and `GET` and `DELETE` are `405`. Protocol versions `2025-06-18`, `2025-03-26` and `2024-11-05`. Methods: `initialize`, `ping`, `tools/list` and `tools/call`.

OAuth discovery follows the MCP authorization spec:

| Step | Endpoint |
| --- | --- |
| A request without a bearer gets `401` with `WWW-Authenticate: Bearer resource_metadata=…` | `POST /v1/mcp` |
| Protected resource metadata (RFC 9728) | `GET /.well-known/oauth-protected-resource/v1/mcp` |
| Authorization server metadata (RFC 8414) | `GET /.well-known/oauth-authorization-server` |
| Dynamic client registration (RFC 7591); redirect URIs must be `https`, or `http` to localhost | `POST /v1/mcp/oauth/register` |
| Authorize, with PKCE `S256` | `GET /v1/mcp/oauth/authorize` |
| Exchange a code or refresh token | `POST /v1/mcp/oauth/token` |

Codes last five minutes and are bound to the client, its redirect URI and the PKCE challenge.
