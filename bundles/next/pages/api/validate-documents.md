---
title: Validate your GraphQL documents
description: Check the GraphQL operations in a client's source against the current schema in CI, so a renamed field fails before it ships.
sidebar:
  order: 5
  label: Validate your documents
---

No AudienceKit client uses codegen: the apps and SDKs keep their operations as string literals, which the API only
sees at runtime. `check.mjs` reads those literals out of Kotlin, Swift, TypeScript/JavaScript and Ruby source,
validates each against the schema dump of the endpoint it is sent to, and fails on anything the API would refuse
and on every use of a `@deprecated` field, argument or enum value.

This site serves the pieces a client repository needs, built from `main` of `lwm-luminx/audience-kit`:

| URL | What it is |
| --- | --- |
| `/graphql/schema.graphql` | The consumer view: `POST /v1/audience/:id/graphql`, where the apps and member SDKs go |
| `/graphql/staff_schema.graphql` | staffql, for staff tools (Focus, Velvet, Backstage, the admin console, StaffKit) |
| `/graphql/tenants_schema.graphql` | Tenant management, `POST /v1/tenants/graphql` |
| `/graphql/check.mjs` | The validator (Node 22+, depends only on the `graphql` package) |

## Add the check to a client repository

One workflow step, after checking out the source. Pick the schema your client sends its documents to, and point
the last argument at the directories (or globs) that hold them:

```yaml
- name: GraphQL documents match the API schema
  run: |
    mkdir -p .graphql-check && cd .graphql-check
    curl -fsSLO https://developer.audiencekit.com/graphql/check.mjs
    curl -fsSLO https://developer.audiencekit.com/graphql/schema.graphql
    npm install --silent --no-save --no-package-lock graphql@16
    node check.mjs --schema schema.graphql --endpoint consumer ../Sources
```

`node` 22 or later is needed (`actions/setup-node@v4` with `node-version: 22` on a runner image that lacks it). The
`.graphql-check` directory is scratch; add it to `.gitignore` if the step also runs locally.

The exit status is 1 when any document fails, so the step fails the job. Each finding is one line,
`file:line: message`, with the line pointing into your source:

```
Sources/Feed.swift:41: Cannot query field "coverUrl" on type "Venue". Did you mean "bannerUrl"?
Sources/Event.swift:12: The field Event.viewerRsvp is deprecated. Use rsvp { mine }.
2 documents in 9 files checked against schema.graphql: 2 failures, 0 skipped.
```

## What counts as a document

A string literal whose body (after any leading `#` comments) starts with `query`, `mutation`, `subscription`,
`fragment` or a `{` selection:

- **Kotlin and Swift**: `"""…"""` and `"…"` literals.
- **TypeScript and JavaScript**: ``graphql`…` `` and ``gql`…` `` tagged templates (whatever they start with), and
  plain templates or strings that start like a document.
- **Ruby**: `<<~GRAPHQL` and `<<~GQL` heredocs (whatever they start with), other heredocs and strings that start
  like one.

Fragments defined in any checked file can be spread from documents in other files of the same run.

### Interpolations

A document that interpolates a **string constant** is checked with the constant spliced in: Kotlin `$FIELDS` and
`${FIELDS}`, Swift `\(Self.fields)`, TypeScript `${FIELDS}` and Ruby `#{FIELDS}` all resolve when the name is a
`const val`, `static let`, `const` or Ruby constant in one of the checked files, including constants built by
concatenating other constants. Kotlin's `${'$'}` resolves to a dollar sign.

Anything else (a parameter, a computed field name) makes the document unverifiable. It's reported as **skipped**,
and the run still passes; pass `--strict` to fail on skipped documents instead. Keep the dynamic part as small as
possible, or move the choice into a constant per case, so the rest of the document is still checked.

### A client that talks to two endpoints

The Kotlin SDK sends most documents to the consumer view and its door operations to staffql. A document says so
with a comment on its first line, and the client runs the check once per endpoint:

```kotlin
public val doorVenues: String = """
    # endpoint: staff
    query DoorVenues { me { cover { doorVenues { nodes { id name } } } } }
""".trimIndent()
```

```sh
node check.mjs --schema schema.graphql --endpoint consumer src/main          # unmarked documents, and ones marked consumer
node check.mjs --schema staff_schema.graphql --only-endpoint staff src/main  # only the documents marked staff
```

The comment is legal GraphQL, so the document is sent as it is.

## Deprecated fields fail

A `@deprecated` field is one the API will remove; a client still reading it is a release blocker, not a warning,
so the check fails on it and prints the field's deprecation reason, which names the replacement. Until the first
release there are no deprecations at all (breaking changes land in one sweep across every client), so the rule
costs nothing now and catches drift later. If a client has to ride out a deprecation, run with `--allow-deprecated`
and say why in the workflow.

## Which schema is served

`/graphql/` is the API that production serves (the API's `main` branch). A client branch that tracks the API's
`next` branch fetches the same files from `/graphql/next/` instead, for example
`https://developer.audiencekit.com/graphql/next/schema.graphql`, so a field added on `next` passes before it ships.
`/graphql/manifest.json` says which API commit each set was built from.

## Inside this repository

`.github/workflows/graphql-documents.yml` runs the same script on every push and pull request that touches a
schema dump or a client: the Kotlin SDK against the consumer view (and its door documents against staffql), and
StaffKit with Focus, Velvet and Backstage against staffql. The admin console isn't in that workflow: the Relay
compiler validates it in `admin.yml`, against the staff and tenants dumps in `contracts/schema/`. Run the checks locally with `npm ci --prefix
scripts/graphql-documents`, then the commands in the workflow; `node scripts/graphql-documents/test.mjs` runs the
validator's own test, which includes deliberately broken documents.
