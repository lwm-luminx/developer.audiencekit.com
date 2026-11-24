---
title: Ruby SDK
description: Install and configure the audience-kit gem.
sidebar:
  order: 3
  label: Ruby
---

The `audience-kit` gem wraps an audience's [GraphQL](/api/graphql/) API. It is early: it fetches venues and events by ID, and `Audience::Kit.query` runs any other document.

Requires Ruby 3.2 or newer.

## Install

The gem lives in `ruby/` of the AudienceKit SDK repository. Install it from Git with Bundler:

```ruby
gem "audience-kit", git: "https://github.com/lwm-luminx/audience-kit-sdk.git", glob: "ruby/*.gemspec"
```

## Configure

```ruby
require "audience-kit"

Audience::Kit.configure do |c|
  c.token = ENV["AUDIENCE_KIT_TOKEN"]        # sent as "Authorization: Bearer <token>"
  c.audience_id = ENV["AUDIENCE_KIT_AUDIENCE_ID"]
  c.base_url = "https://api.audiencekit.io"  # the default
end
```

Without `configure`, the gem reads `AUDIENCE_KIT_TOKEN`, `AUDIENCE_KIT_AUDIENCE_ID` and `AUDIENCE_KIT_BASE_URL` from the environment. The token is sent with the `Bearer` scheme, so use an [application API key](/api/authentication/#application-api-keys).

## Use

```ruby
venue = Audience::Kit::Venue.find(venue_id)
venue.data["name"]

event = Audience::Kit::Event.find(event_id)
event.data["startAt"]

Audience::Kit.query("query { locales { id name } }")["locales"]
```

`data` is the record's GraphQL fields, with camelCase keys. A missing record, a GraphQL error or an HTTP failure raises `Audience::Kit::Error`.
