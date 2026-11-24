---
title: Realtime
description: GraphQL subscriptions over Action Cable or Server-Sent Events, for chat rooms, who is in them, the door, and the moderation feed.
sidebar:
  order: 7
---

Everything live is a GraphQL subscription. The API mounts [Action Cable](https://guides.rubyonrails.org/action_cable_overview.html) at `/connection` (backed by Redis in production), and the cable is only a way to carry GraphQL: queries, mutations and subscriptions, with the same context as `POST /v1/audience/:audience_id/graphql`, or as `staffql` when the subscription asks for the staff view (see [the consumer view and staffql](/api/graphql/#the-consumer-view-and-staffql)).

## Connect

Open the WebSocket with the user's session JWT in the `Authorization` header:

```http
Authorization: JWT <session jwt>
```

Browsers can't set headers on a WebSocket, so a web client offers the token as a subprotocol instead, beside Action Cable's own: `actioncable-v1-json` and `jwt.<session jwt>`. A connection without a live session is refused.

Keep one connection per app and run every operation on it, each as its own channel subscription: every connection costs a token check, so a socket per feature multiplies the work on each reconnect. Action Cable pings every 3 seconds; treat about 12 seconds without any frame as a dead socket, close it, reconnect with backoff, and subscribe every live operation again. The Swift SDK's `AudienceCable` (AudienceCore) does this for the iOS apps.

## Run an operation

The protocol is graphql-ruby's, which its JavaScript clients speak. For each operation:

1. Subscribe to `GraphQLChannel` with the audience and an id of your choosing, which keeps the identifiers of your operations apart:

   ```json
   { "command": "subscribe",
     "identifier": "{\"channel\":\"GraphQLChannel\",\"audience_id\":\"<audience UUID>\",\"channelId\":\"<random>\"}" }
   ```

   A token signed in on another audience, one whose `aud` doesn't reach the endpoint asked for (an app's token at staffql), an unknown audience, or someone the audience banned gets `reject_subscription`. Staff tools add `"endpoint": "staffql"` for the staff view, where only a staff role is let in; without it the operations run in the consumer view.

2. Once `confirm_subscription` arrives, perform `execute`:

   ```json
   { "command": "message", "identifier": "<the same identifier>",
     "data": "{\"action\":\"execute\",\"query\":\"subscription($v: ID!) { venueChat(venueId: $v) { __typename } }\",\"variables\":{\"v\":\"<venue UUID>\"}}" }
   ```

3. The result arrives as `{ "result": { "data": …, "errors": … }, "more": <bool> }`. For a query or mutation `more` is false and you're done. For a subscription the first result is its first event, and every later event arrives the same way with `more: true`, until the server ends it with `more: false`.

Unsubscribing from the channel ends the operation: you leave the chat room you were following, and so on. When the socket drops, reconnect and subscribe again; each subscription starts over with its first event (`ChatJoined`, `DoorOpened`), so a client never needs to replay what it missed.

### Many operations on one channel subscription

One channel subscription can carry any number of operations, so a client needs one subscribe for all of them (queries and mutations included, without a request each). Give every `execute` an `id` of your choosing, unique among the operations you have open there:

```json
{ "command": "message", "identifier": "<identifier>",
  "data": "{\"action\":\"execute\",\"id\":\"room-1\",\"query\":\"subscription($v: ID!) { venueChat(venueId: $v) { __typename } }\",\"variables\":{\"v\":\"<venue UUID>\"}}" }
```

Every message about that operation carries the same `id`: its result, a subscription's updates, and the `more: false` that ends it (`{ "id": "room-1", "result": …, "more": true }`). To end one subscription and keep the others, perform `stop`:

```json
{ "command": "message", "identifier": "<identifier>", "data": "{\"action\":\"stop\",\"id\":\"room-1\"}" }
```

An `execute` without an `id` gets messages without one, as graphql-ruby's own clients expect when they open a channel subscription per operation. Unsubscribing from the channel still ends everything on it.

## Server-Sent Events

A client that would rather not hold a WebSocket (a server-side moderation provider, a script) can run a subscription as a plain HTTP request instead: POST it to the audience's GraphQL endpoint with `Accept: text/event-stream` (`/v1/audience/:audience_id/graphql` for the consumer view, `/v1/audience/:audience_id/staffql` for the staff view), and the response is a stream of its events, in the [GraphQL over SSE](https://github.com/enisdenjo/graphql-sse/blob/master/PROTOCOL.md) protocol's "distinct connections" mode. Authentication, context and who is let in are the endpoint's own: a session JWT (`Authorization: JWT <session jwt>` or `Bearer <session jwt>`), or a moderation provider's service JWT (`Authorization: Bearer <service jwt>`) on `staffql`, which reaches only the moderation feed there, as on the cable. Either way the token's `iss` and `aud` are checked as for any request to that endpoint (see [Authentication](/api/authentication/)): an app's token streams from `graphql` but gets `401` at `staffql`.

```sh
curl -N https://api.audiencekit.com/v1/audience/<audience UUID>/staffql \
  -H 'Authorization: Bearer <service jwt>' \
  -H 'Accept: text/event-stream' \
  -H 'Content-Type: application/json' \
  -d '{"query":"subscription { chatModeration { __typename ... on IChatModerationEvent { cursor } ... on ChatModerationCaughtUp { cursor } } }"}'
```

```text
event: next
id: 4812
data: {"data":{"chatModeration":{"__typename":"ChatModerationMessageCreated","cursor":"4812"}}}

event: next
id: 4812
data: {"data":{"chatModeration":{"__typename":"ChatModerationCaughtUp","cursor":"4812"}}}

: keepalive
```

- Each event is `event: next` with an execution result (`{ "data": …, "errors": … }`) as its data, as the cable's `result`. The first result comes first, then every later event, as on the cable.
- `event: complete` (with empty data) ends the stream, and the server closes the connection: the subscription ended from the server's side (`ChatLeft`, a revoked token). To unsubscribe, close the connection; the subscription ends as when a socket drops (you leave the chat room you were following, and so on).
- A comment line (`: keepalive`) arrives every 25 seconds while nothing else does, so proxies keep an idle stream open. Ignore it.
- A subscription that can't start (not at the venue, banned, a permission missing) is answered with its errors as one `next` event, then `complete`. A request that fails authentication gets `401` or `403` with a JSON body, as any request to the endpoint.
- Queries and mutations are answered with JSON, as always, even when the request accepts an event stream.

### Resuming

Where a subscription's events have a `cursor` (`chatModeration`), each event that selects it carries it as its SSE `id`. Reconnect with the last one you handled as `Last-Event-ID`, and the stream picks up after it, instead of after the `after` argument: it replays what you missed, then `ChatModerationCaughtUp`. Subscriptions without a cursor (chat rooms, the door) start over with their first event, as on the cable.

```sh
curl -N https://api.audiencekit.com/v1/audience/<audience UUID>/staffql \
  -H 'Authorization: Bearer <service jwt>' -H 'Accept: text/event-stream' -H 'Content-Type: application/json' \
  -H 'Last-Event-ID: 4812' \
  -d '{"query":"subscription { chatModeration { __typename ... on IChatModerationEvent { cursor } } }"}'
```

Events reach an SSE stream exactly as they reach the cable: through the same pubsub (so any server's events reach every stream), each resolved for its own subscriber.

## Subscriptions

Each module contributes its own subscription root fields, which are left out of an audience's schema where the module isn't installed.

| Field | Module | What it follows |
| --- | --- | --- |
| `venueChat(venueId)` | chat | A venue's chat room, for people at the venue and the room's admins. |
| `localeChat(localeId)` | chat | A locale's chat room, for people out in the locale and not at a venue. |
| `chatRooms` | chat | The audience's room list, as `chat { rooms }` gives it: each room's counts and latest message. |
| `door(venueId)` | cover | A venue's door tonight, for whoever may work it. |
| `myNotifications` | core | Your notifications while the app is open, beside your device's push. |
| `nodeChanged(id)` | core | Any record you can see, by its ID: when it changes or is deleted. |
| `edgeChanged(id, edge)` | core | A record's lists (a venue's `events`): when a member joins, leaves or changes. |
| `chatModeration(after)` | moderation | The audience's moderation feed, for a moderation provider's service token. |

A subscription that isn't allowed (not at the venue, banned, a device without the permission) returns an error and no events.

### Chat rooms

`venueChat` and `localeChat` deliver `ChatRoomEvent`s, each made for the subscriber:

| Event | When |
| --- | --- |
| `ChatJoined` | First, on joining: `roster` (who is in the room, your friends first and named in full, everyone else as "First L."; all your `friends`; and `recent`, who left in the last 30 minutes or hosts what's on in the room now, each with `presence` (`PUSH` or `OFFLINE`, as below), `lastSeenAt` and `recentUntil`), `history` (the last 100 messages, oldest first: the last 24 hours, or everything for the room's admins), `pinnedMessage` (the announcement under the room's title) and `outOfRange`. |
| `ChatMessagePosted` | A message arrives. `senderPresence` is `ONLINE` when its sender is in the room, `PUSH` when they aren't but a notification reaches them (shown only to their friends and the room's admins), otherwise null. |
| `ChatMessageUpdated` | An announcement or special was edited. |
| `ChatMessageRemoved` | A message was taken down. |
| `ChatPinChanged` | An announcement was pinned (with `announcement`) or unpinned. |
| `ChatRoomCleared` | An admin cleared the room: everything sent at or before `clearedAt` is gone. |
| `ChatPresenceChanged` | Someone's first connection joined (`ONLINE`, with their short name and avatar), or their last one left (`PUSH` or `OFFLINE`, as above), with `recentUntil`: the room keeps listing them, offline, until then (30 minutes after they were last there, or when the event they host ends). People who turned on `setRecentChatPush` are pushed about new messages there while they're listed and away, at most once every 10 minutes per room (`kind: recent_chat`, `url` opening the room). |
| `ChatRangeChanged` | An admin crossed the edge of the room; they stay in it either way. |
| `ChatLeft` | Last: you're out of the room (`reason` `AWAY`, `BANNED` or `REMOVED`) and the subscription ends. |

Messages and presence from someone you blocked never reach you. Messages are `ChatMessage`s (a `VenueMessage` or a `LocaleMessage`), with the same fields as the `chat` queries.

To speak in a room, use the `sendMyChatMessage(venueId | localeId, message)` mutation, over the cable or HTTP. The same people may speak as may join; someone who is no longer allowed in gets an error, and their subscriptions to the room end with `ChatLeft`. The room's admins post announcements, events, photos and posts as the venue with `sendChatMessage`.

Only people who reported a position at the venue in the last 15 minutes can join its room (for a locale's room, a position in the locale and not at a venue). Platform admins and admins of the room's audience join from anywhere and are never sent away; `outOfRange` tells them they're only there because they're an admin.

### The room list

`chatRooms` keeps a list of rooms (the console's Chat page) current without polling: it delivers a `ChatRoom`, fresh, whenever someone's first connection joins it or their last one leaves (`onlineCount`), and whenever a message there is posted, edited, removed or cleared (`lastMessage`, `lastMessageAt`, `recentCount`). You hear the rooms `chat { rooms }` gives you: every room for the audience's admins, your own venues' rooms as a venue listing manager. Nothing arrives on subscribing, so load the list with `chat { rooms }` first. Following the list doesn't put you in any room.

### The door

`door(venueId)` delivers `DoorEvent`s: `DoorOpened` with the night as it stands (its admissions and totals) when you start following and when the night rolls over at 6 AM, then `DoorAdmissionChanged` for every cover that's paid, scanned in (`ADMIT`, `RE_ENTRY`) or refunded, with the night's fresh totals. Scanning a pass stays the `scanAdmission` mutation; its result reaches every station at the door.

### The moderation feed

A moderation provider connects with its service token (`Authorization: Bearer <service jwt>`, from `POST /v1/token/service`) instead of a session, over the cable or as an SSE stream (see [Server-Sent Events](#server-sent-events)), and may run only `chatModeration`, `chat { moderation { … } }` queries and the `chat { moderation { … } }` mutations, in its token's audience. The token needs `chat:moderate:*`, which only a token minted for a provider holds.

`chatModeration(after: ID)` delivers `ChatModerationEvent`s, each with a `cursor`, `at` and `room`. It first replays everything after `after` that is still kept (7 days), sending `ChatModerationFeedGap` if events between are gone, then `ChatModerationCaughtUp`, then new events as they happen: `ChatModerationMessageCreated` (with the lines before it), `ChatModerationMessageReported`, `ChatModerationMessageRemoved`, `ChatModerationRoomCleared`, `ChatModerationUserKicked`, `ChatModerationUserBanned` and `ChatModerationUserUnbanned`. Delivery is at least once, so keep the last cursor you handled and pass it as `after` when you reconnect (or, over SSE, send it as `Last-Event-ID`). People appear only as opaque `subject` handles, stable for your provider. The feed ends when the token is revoked.

### Your notifications

`myNotifications` brings each notification sent to you (a friend's ping, someone joining yours) to the app while it's open, as `PushNotification { notificationId title body category data sentAt }`. It's the same notification APNs or FCM delivers to your device, not instead of it: both copies carry the same `notification_id` in their data, so an app in front shows this one itself (in-app, without a system banner) and drops the system copy when it arrives with an id it has seen. Each subscription hears only its own person's notifications, from the audience whose app it was opened in. Nothing arrives on subscribing.

### Records and their lists

`nodeChanged(id)` and `edgeChanged(id, edge)` let a client keep any screen fresh without polling, for any `Node` it can see (the same records `node(id:)` finds for it). Nothing arrives on subscribing; events follow each committed change.

- `nodeChanged` delivers `NodeChanged { id change fields node }`: `change` is `UPDATED` (with `fields`, the record's own fields that changed, as GraphQL names them) or `DELETED`. `node` is the record as you may read it now, so select what the screen shows on it and skip the refetch:

  ```graphql
  subscription($id: ID!) { nodeChanged(id: $id) { change fields node { ... on Venue { name description } } } }
  ```

- `edgeChanged` delivers `EdgeChanged { id edge change nodeId node }` when a record joins (`ADDED`: created there, or moved in), leaves (`REMOVED`: deleted, or moved out) or changes in (`UPDATED`) one of the record's lists. `edge` names the list by its association (`events`, `appearances`); pass `edge` to follow one list only. `node` is the member as you may read it, null when it left.

You hear about a change only while you can still see the record, and about a list member only when you can see it too. Following many records is cheap on one channel subscription with request ids (above).

## Older channels

The untyped `RealtimeChannel`, `LocaleChannel` and `DoorChannel` that served app builds from before the subscriptions are gone (`/v1/status` asks those builds to update). Use `GraphQLChannel`.
