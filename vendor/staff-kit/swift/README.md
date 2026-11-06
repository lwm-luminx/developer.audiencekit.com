# StaffKit: the AudienceKit management SDK (Swift)

The private, staff-side modules behind Focus, Velvet and Backstage. They build
on the public AudienceKit SDK (AudienceCore, AudienceKit, AudienceKitUI), the
`audience-kit-sdk` submodule, which the root `Package.swift` adds as a local
package dependency. Build and test from the repository root with `swift build` and
`swift test`.

## Management kits

The package uses seven framework modules:

| Framework | Responsibilities | Dependencies |
| --- | --- | --- |
| AudienceCore | `AudienceSession`, credentials, authentication, HTTP/GraphQL transport, configuration and shared primitives | Foundation |
| AudienceKit | Audience-facing discovery, people, venues, events, cover and admission services | AudienceCore |
| AudienceKitUI | Generated design tokens and common SwiftUI components such as `AudienceAvatar` | AudienceCore, AudienceKit |
| StaffKitCore | `AudienceManagementSession`, platform Facebook sign-in, audience selection and scoped device sessions; `StaffCable`, the one Action Cable socket that carries the GraphQL subscriptions (`GraphQLChannel`) | AudienceCore |
| StaffKitUI | The staff apps' palette, signature, welcome screen, rich chat messages (prompts included, and `PromptAnswerLabel` for answers), `EventChatPromptsView` and list components; the iPad pieces: `staffSidebarAdaptable()`, `StaffSidebarHeader`, `akReadableWidth()` and `StaffShortcut` (⌘1–⌘9, ⌘F, ⌘↩) | AudienceKitUI, StaffKit |
| StaffKit | `VenueManagementClient`, `TalentManagementClient` and `AudienceChatClient` (admins: every venue and locale room, posting as staff, pinning, removing, clearing, kicking and banning), listing edits, events, series, chat moderation, cover and device management; `doorFeed`, the door live (the `door` subscription); `chatFeed`, a venue's or locale's room live (`venueChat`, `localeChat`); `EventChatPromptsClient`, an event's chat prompts (`Event.chat`, `setEventChatPrompts`); `DecisionQueueClient`, the audience's decision queue (`decisions`, `decideEvaluation`, `decisionQueue`) | StaffKitCore |
| ArbiterUI | All of Arbiter's SwiftUI for iPadOS 17+ and macOS 14+ (`apps/arbiter` builds it for both): `ArbiterRoot`, `ArbiterAccount`, `ArbiterSettingsView`, `ArbiterWorkspace`, `DecisionDetailView`, `DecisionRow`, `ArbiterQueueModel` over a `DecisionSource`, `ArbiterSampleSource` | StaffKitUI, StaffKit, AudienceKitUI |
| ArbiterMac | The Mac app's own sections on ArbiterEngine: `ArbiterMacEngine`, `ArbiterMacSidebar`, `ArbiterMacWindows`, `GlamObserver`, `ArbiterMacSettings` (macOS 14+) | ArbiterUI, ArbiterEngine, StaffKit |

Management clients take `session: AudienceManagementSession`. They authenticate using the platform Facebook app, then select an authorized audience; the server remains authoritative for all permissions. The staff apps share one sign-in: give the session a `StaffCredentialStore` and `StaffKeychain.audienceStore(for:)`, and the credential (the token JSON the API issues; nothing decodes the JWT) and the chosen audience live in the `group.com.audiencekit.shared` keychain access group under one service per environment (`com.audiencekit.staff.next`, `com.audiencekit.staff.production`), so Focus, Velvet and Backstage sign in, switch audience and sign out together. `restoreAudience()` opens the remembered audience without swapping the server session again. A venue device's session (a redeemed device code) is bound to one device and stays in the app's own keychain item; `StaffCredentialStore` routes it there and never shares it. Apps call `restoreAudience()` again when they return to the foreground to pick up a sibling's change. Audience-facing services extend `AudienceSession`; `AudienceKitClient` remains its source-compatible alias.

Velvet and Backstage import the management modules. HotMess imports AudienceKit and AudienceKitUI. Focus, the audience administration app, uses the same management modules. The modules were called AudienceManagementCore, AudienceManagementKit and AudienceManagementUI until StaffKit; products under those names still re-export StaffKitCore, StaffKit and StaffKitUI for one release, and FocusKit, VelvetKit and BackstageKit are gone.

The native test client and distribution instructions live in `apps/velvet/README.md`.

Focus, Velvet, and Backstage share Facebook app `1612226510640564`, with separate
iOS bundle IDs. Register `com.audiencekit.Focus`, `com.audiencekit.Velvet`, and
`com.audiencekit.Backstage` under that app's iOS platform. Velvet and Backstage have native clients; Focus is being implemented separately. App Store Connect registration and distribution remain app-specific.

Use `ASWebAuthenticationSession` with callback `fb1612226510640564://authorize`.
Apple routes the authentication callback only to the calling session, even when
multiple apps register the same scheme. Each `FacebookOAuth` instance generates
its own state and rejects callbacks from other sessions. The resulting session
is shared through `StaffCredentialStore`. Pass the exact same redirect URI during code exchange.
Meta's dashboard says URL scheme suffixes are unavailable from iOS 16, so these
iOS 17+ management clients do not use them. Do not substitute an ordinary browser
launch or native Facebook app switch for the authentication session without
reviewing callback routing.

Reference: https://developer.apple.com/documentation/authenticationservices/aswebauthenticationsession
