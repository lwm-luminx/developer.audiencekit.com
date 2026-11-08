---
title: API overview
description: The AudienceKit API's base URL, endpoints, request format and the audience each request is scoped to.
sidebar:
  order: 1
  label: Overview
---

The AudienceKit API is a Rails application (the `lwm-luminx/audience_kit_api` repository). It speaks three protocols:

| Protocol | Where | Use it for |
| --- | --- | --- |
| GraphQL | `POST /v1/audience/:audience_id/graphql` and `POST /v1/tenants/graphql` | Reading and administering an audience's data, and managing tenants. This is the main API. |
| REST | `/v1/...` | Mobile app flows (sign-in, "what's happening now", RSVPs), branding, and the research endpoints for workers. |
| Action Cable | `/connection` (WebSocket) | Realtime venue chat and GraphQL subscriptions. |

## Base URL

The Ruby SDK defaults to `https://api.audiencekit.io`. A self-hosted deployment serves the same paths from its own host, and a local server runs on `http://localhost:3000`.

`GET /up` is the health check. It returns 200 when the app has booted.

## Audience scope

Almost every request is about one audience. GraphQL makes the scope explicit in the path:

```http
POST /v1/audience/2f0c6d1e-6a4b-4f0e-9a43-1c1d2a7e8b90/graphql
```

The audience ID is a UUID. On this endpoint the query root is the audience itself (`{ name venues { list { nodes { name } } } }`), lists such as `venues` and `locales` return only that audience's records, `node(id:)` refuses objects from other audiences, and mutations act on that audience unless they say otherwise.

`POST /v1/tenants/graphql` is tenant management (listing and creating audiences, subdomains and domains). It has its own schema and requires a platform administrator. See [GraphQL](/api/graphql/).

## Requests and responses

- Send JSON bodies with `Content-Type: application/json`.
- Send credentials in the `Authorization` header. See [Authentication](/api/authentication/).
- Responses are JSON. Timestamps are ISO 8601.

## CORS

Browsers may call the API from the origins in the `ADMIN_ORIGINS` setting (by default `http://localhost:4000`) and from any `https://admin.<domain>` whose domain belongs to an audience. Native apps and servers are not affected by CORS.
