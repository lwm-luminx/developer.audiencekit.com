---
title: Introduction
description: What AudienceKit is, what it is made of, and how these docs are organized.
sidebar:
  order: 1
---

AudienceKit is a generic, multi-tenant system for creating **audiences** (sub-cultures and communities) and linking them to real-world places and events. Apps are built on top of it: [Hot Mess](https://hotmess.social), a guide to queer nights out, is the first and the reference audience.

## What's in the platform

| Component | What it does |
| --- | --- |
| API | Serves GraphQL (the main API), a small REST API under `/v1` for sign-in, branding and automation, and realtime subscriptions over WebSockets and Server-Sent Events. |
| Admin consoles | Each audience's console at `admin.<audience domain>`, skinned and scoped to that audience, and the platform console at admin.audiencekit.com. |
| [SDKs](/sdks/) | Source-available clients for Swift, Kotlin, Node, Python, PHP, Rust and Ruby. |
| These docs | developer.audiencekit.com, from the public [developer.audiencekit.com](https://github.com/lwm-luminx/developer.audiencekit.com) repository. |

## How these docs are organized

- **Start here** explains the data model.
- **API** covers endpoints, authentication, the GraphQL schema and realtime channels.
- **Guides** walk through common tasks: theming an audience, connecting a domain, importing listings and automating with service tokens.
- **SDKs** describe the client libraries.

:::note[Early days]
AudienceKit is under active development, and these docs describe what production serves today.
:::
