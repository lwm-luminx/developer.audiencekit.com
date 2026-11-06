---
title: Core concepts
description: Audiences, domains, locales, venues, people, events and users, and how they fit together.
sidebar:
  order: 2
---

AudienceKit's data model is small. Every object below is defined in `app/models`.

## Audience

An **audience** is a tenant: a community with a `name` and a unique `subdomain` (lowercase letters, digits and hyphens). Everything an app shows belongs to an audience: its locales, venues, people and events. An audience also stores a **theme**, which decides how its apps and admin console look (see [Theme an audience](/guides/theming/)).

Users join audiences through `AudienceUser` records.

## Audience domain

An audience can own one or more **domains**, such as `hotmess.social`. The API uses them to find the audience for a request: a host matches an audience when it equals one of its domains or is `admin.` plus one of them. That is how `admin.hotmess.social` serves the Hot Mess admin console. See [Connect a domain](/guides/domains/).

## Locale

A **locale** is a city or metro area inside an audience, such as Seattle. It has a `label`, a `name`, a list of `cityNames`, an IANA `timeZone` (`America/Los_Angeles`, taken from its Google place when an admin doesn't set one), and a geographic `envelope`: the area Google frames its place in (its viewport), stretched to take in any of its visible venues outside it. A locale without a Google place, or whose place Google can't look up, gets the box around its visible venues instead. A locale can also be linked to a Meta metro area (`metaMetro`, a Nielsen DMA such as `DMA:819`) for Facebook targeting. When one is linked, rebuilding envelopes asks Meta for that metro's area and uses it in place of the Google viewport, falling back to the viewport when Meta sends none.

## Venue

A **venue** is a place that holds events: a bar, club or community space. It belongs to a locale and an audience, and it can have a `location` (a point plus Google Places data) and a legacy Facebook `page`. Venues have an `order`, can be `hidden`, and have a `distanceTolerance` used when the API decides whether a user is at the venue.

Venues maintained by the [researcher worker](/guides/researcher/) also carry an `external_key`, a `confidence` between 0 and 1, `provenance` and `last_verified_at`.

## Person

A **person** is a promoter, performer or organization. People belong to an audience (or are `global`) and link to a page that holds their name and photos. Events list the people involved.

## Event

An **event** happens at a venue, with a `name`, `startAt` and `endAt`. Events can be featured, can have ticket types, and can be RSVPed to with the `rsvpEvent` mutation. Most lists return only future events: those that start or end after now.

## User, device and session

A **user** signs in with Facebook from a **device**. Each sign-in creates a **session** on that device and returns a JWT for it. Users can be administrators (`isAdmin`), which gives them access to cross-audience administration. See [Authentication](/api/authentication/).

## Application

An **application** is an API key that belongs to one audience. Server-side apps use it to call that audience's endpoints without a user.

## Service token

A **service token** is a long-lived secret for a machine, such as the researcher worker. It belongs to one audience, carries scopes, and is exchanged for short-lived JWTs. See [Automate with service tokens](/guides/service-tokens/).
