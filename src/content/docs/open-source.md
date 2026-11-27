---
title: Open-source libraries
description: The MIT-licensed Ruby libraries Love Wins Media builds alongside AudienceKit, what each does and how to install it.
---

Alongside AudienceKit, Love Wins Media publishes general-purpose libraries that have nothing AudienceKit-specific in them. Unlike the [SDKs](/licensing/), these are **open source under the MIT License**: use them in any project, with any database or service, and fork them freely.

| Library | What it's for | Install | License |
| --- | --- | --- | --- |
| [graph_query](#graph_query) | Graph traversals and Cypher queries for Active Record on PostgreSQL | [RubyGems](https://rubygems.org/gems/graph_query) | MIT |
| [retcon](#retcon) | VCS-style history, proposals and reverts for Active Record | [RubyGems](https://rubygems.org/gems/retcon) | MIT |
| [diverse_shuffle](#diverse_shuffle) | A seeded shuffle where neighbouring songs aren't too alike | From GitHub (RubyGems release coming) | MIT |

## graph_query

Graph traversals and Cypher queries for Active Record on PostgreSQL. Declare edges on your models from the associations they already have, then walk them in a Ruby chain, a Cypher-style pattern or a Cypher query, and get Active Record relations back. Every walk is one recursive CTE, so nothing has to be installed in the database (no Apache AGE, no extension): it runs on Heroku Postgres, RDS, Supabase or your laptop. AudienceKit's API uses it.

```ruby
gem 'graph_query'
```

```ruby
class Locale < ApplicationRecord
  has_many :children, class_name: 'Locale', foreign_key: :parent_id
  has_many :venues

  graph_edge :contains, association: :children
  graph_edge :has_venue, association: :venues
end

washington = Locale.where(name: 'Washington')
# Every bar in the state, still a relation:
washington.traverse(:contains, depth: 0..).traverse(:has_venue)
  .where(kind: 'bar').order(:name)
```

- Edges from associations, join models or SQL; walks of any depth, in either direction, with node and edge filters.
- `GraphQuery.match` patterns and `GraphQuery.cypher` queries, plus batched GraphQL fields backed by walks.
- RBS and Sorbet type signatures included. Ruby 4.0 or later.

[Docs](https://lwm-luminx.github.io/graph_query/) · [Source](https://github.com/lwm-luminx/graph_query) · [RubyGems](https://rubygems.org/gems/graph_query)

## retcon

Retroactive continuity for Active Record: change the past without breaking the story. retcon adds a VCS-style layer to Active Record on PostgreSQL, so many people can edit shared records with full attribution, and damage (bad deletes, misinformation, bad actors) can be repaired without losing the good work that came after it.

```ruby
gem 'retcon'
```

```ruby
class Venue < ApplicationRecord
  include Retcon::Model
end

Retcon.as(current_user) { venue.update!(name: 'The Eagle') }          # an attributed, applied changeset

proposal = Retcon.propose(actor: member) { |p| p.update(venue, phone: '555-0100') }
proposal.apply!(committer: reviewer)                                    # or reject!, withdraw!, amend!

Retcon.revert_actor(vandal, actor: staff)                               # drops their changes, keeps later work
```

- Field-level history tables are the source of truth; live tables stay fast as a projection written in the same transaction.
- Proposals reviewed before they apply, like pull requests, with field-level conflicts.
- Tombstones instead of lost rows, drift detection for writes made outside retcon, and redaction for privacy requests.
- Ruby 3.3 or later.

[Guide](https://lwm-luminx.github.io/retcon/) · [Source](https://github.com/lwm-luminx/retcon) · [RubyGems](https://rubygems.org/gems/retcon)

## diverse_shuffle

A seeded shuffle where neighbouring songs aren't too alike. Give it songs, how far apart pairs of tracks are (cosine distances from your vector store, say) and which attributes they share (voice, era, show), plus hard rules over those: how far a song must be from the songs just before it, how many of a window may share an attribute, how many songs must pass before an attribute comes back. It places every song, in the same order for the same seed.

The work runs in Rust as a native extension, with a pure-Ruby engine that gives exactly the same result where the extension isn't built. On a 500-song pool with six rules, the Rust engine places every song in about 40 to 55 ms.

diverse_shuffle isn't on RubyGems yet. Until its first release, install it from GitHub (building the extension needs a Rust toolchain):

```ruby
gem 'diverse_shuffle', github: 'lwm-luminx/diverse_shuffle'
```

- Three modes: `:greedy`, `:mmr` (maximal marginal relevance) and `:dpp` (determinantal point process).
- Vector-distance and shared-attribute rules that loosen in levels when nothing else fits, and report how far they loosened.
- Ruby 3.4 or later.

[Source](https://github.com/lwm-luminx/diverse_shuffle)

## Contributing

Issues and pull requests are welcome on each library's repository. Security reports go to [hello@audiencekit.com](mailto:hello@audiencekit.com).
