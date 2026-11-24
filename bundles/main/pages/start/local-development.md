---
title: Run AudienceKit locally
description: Install the toolchains with mise, set up PostgreSQL, and run the API and admin console.
sidebar:
  order: 3
---

Toolchains and tasks are defined with [mise](https://mise.jdx.dev) in the `mise.toml` of lwm-luminx/audience_kit_api, the API repository.

## Prerequisites

- [mise](https://mise.jdx.dev)
- PostgreSQL with PostGIS, running locally. On macOS: `brew install postgresql@17 postgis`.
- Redis is not needed for local development.

## Set up

From the audience_kit_api checkout:

```sh
mise install            # Ruby 4.0.7, Node 26, Yarn and Bun
mise run api:setup      # install gems and create hotmess_development
mise run admin:setup    # install the admin console's packages
```

## Run the API and admin console

```sh
mise run api:dev     # Rails on http://localhost:3000
mise run admin:dev   # hot reload for the admin console, which the API serves on http://localhost:3000
```

GraphQL is served at `http://localhost:3000/v1/audience/:audience_id/graphql`, tenant management at `http://localhost:3000/v1/tenants/graphql`, and the admin console calls the API at `http://localhost:3000` by default. To see the console as a specific audience would, set `VITE_TENANT_HOST`, for example `VITE_TENANT_HOST=admin.hotmess.social`.

## Test and lint

```sh
mise run api:test    # the API specs; they need PostgreSQL running
mise run admin:test  # the admin console's tests
mise run lint
mise tasks           # list every task
```

The repository's [local stack guide](https://github.com/lwm-luminx/audience_kit_api/blob/next/doc/LOCAL_STACK.md) also covers local HTTPS names, Hedonism and setting up JetBrains IDEs, with run configurations for the API, admin console and tests.
