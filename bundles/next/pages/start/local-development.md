---
title: Run AudienceKit locally
description: Install the toolchains with mise, set up PostgreSQL, and run the API and admin console.
sidebar:
  order: 3
---

Toolchains and tasks for every component are defined with [mise](https://mise.jdx.dev) in the `mise.toml` of lwm-luminx/audience-kit, the workspace repository. Clone it and the component repositories side by side; it links them in (the API at `api/`).

## Prerequisites

- [mise](https://mise.jdx.dev)
- PostgreSQL with PostGIS, running locally. On macOS: `brew install postgresql@17 postgis`.
- Redis is not needed for local development.

## Set up

From the audience-kit checkout:

```sh
mise run workspace:link   # clone the component repositories next to it if missing, and link them in
mise install     # Ruby 4.0.7, Node 26, Yarn and Bun
mise run setup   # install dependencies and create hotmess_development and hotmess_test
```

## Run the API and admin console

```sh
mise run api:dev     # Rails on http://localhost:3000
mise run admin:dev   # hot reload for the admin console, which the API serves on http://localhost:3000
```

GraphQL is served at `http://localhost:3000/v1/audience/:audience_id/graphql`, tenant management at `http://localhost:3000/v1/tenants/graphql`, and the admin console calls the API at `http://localhost:3000` by default. To see the console as a specific audience would, set `VITE_TENANT_HOST`, for example `VITE_TENANT_HOST=admin.hotmess.social`.

## Test and lint

```sh
mise run test        # every component; the API specs need PostgreSQL running
mise run api:test    # one component
mise run lint
mise tasks           # list every task
```

Swift is not managed by mise. Use Xcode on macOS or the `swift:6.1` image on Linux, and run `swift build` and `swift test` from the repository root.

The repository's [README](https://github.com/lwm-luminx/audience-kit#readme) also covers setting up JetBrains IDEs, with run configurations for the API, admin console and tests.
