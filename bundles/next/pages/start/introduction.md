---
title: Introduction
description: What AudienceKit is, what it is made of, and how these docs are organized.
sidebar:
  order: 1
---

AudienceKit is a generic, multi-tenant system for creating **audiences** (sub-cultures and communities) and linking them to real-world places and events. Apps are built on top of it: [Hot Mess](https://hotmess.social), a guide to queer nights out, is the first and the reference audience.

## What's in the platform

The platform is split across a few repositories under [lwm-luminx](https://github.com/lwm-luminx):

| Component | Where | What it does |
| --- | --- | --- |
| API | `audience_kit_api` | Rails 8.1 on Ruby 4.0.7 with PostgreSQL/PostGIS and Redis. Serves GraphQL, a REST API under `/v1`, and Action Cable at `/connection`. |
| Admin console | `audience_kit_api`, `app/frontend/` | React and Relay, built and served by the API through Vite Ruby. Served at `admin.<audience domain>`, skinned and scoped to that audience. |
| Researcher worker | `audience-kit`, `workers/researcher/` | A local TypeScript worker that uses a model in LM Studio and Chrome to verify venues and events. |
| Ruby SDK | `audience-kit`, `sdk/ruby/` | The `audience-kit` gem. |
| SDK | [audience-kit-sdk](https://github.com/lwm-luminx/audience-kit-sdk) | The `AudienceKit` Swift package, the Kotlin Multiplatform core and the `audiencekit` Kotlin libraries for Android and the JVM, on one version. |
| These docs | `audience_kit_api`, `docs/developer/` | developer.audiencekit.com, built with Astro Starlight in [developer.audiencekit.com](https://github.com/lwm-luminx/developer.audiencekit.com). |

## How these docs are organized

- **Start here** explains the data model and how to run the platform on your machine.
- **API** covers endpoints, authentication, the GraphQL schema and realtime channels.
- **Guides** walk through common tasks: theming an audience, connecting a domain, automating with service tokens and deploying.
- **SDKs** describe the client libraries.

:::note[Early days]
AudienceKit is under active development, and these docs describe the `main` branch. Some endpoints still carry names from Hot Mess, where the platform started (the GraphQL schema class is `HotMessApiSchema`, for example).
:::
