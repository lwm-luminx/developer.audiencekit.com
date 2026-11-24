# Changelog

StaffKit's Swift libraries (StaffKit, StaffKitCore, StaffKitServices, StaffKitUI, StaffOnboarding, ArbiterModels,
ArbiterUI, ArbiterEngine, ArbiterMac) release together under one version, in [VERSION](VERSION). Xcode Cloud tags each version
once its tests pass on `main` ([xcode-cloud/](xcode-cloud/README.md)).

## Unreleased

- Velvet: bingo and trivia on the venue's screens (Rick, 2026-11-21). Needs audience_kit_api #800.
  - New screen mode "Bingo and trivia" (`MarqueeScreenMode.games`) on Velvet Display (Mac displays and AirPlay) and
    Velvet TV: a running bingo game's board (B-I-N-G-O or 90-ball, the latest call huge, the few before it, what
    wins), else tonight's trivia round (round and question number, the question, lettered choices with the room's
    split, then the answer; fill in the blank writes the answer into the blank). Polls every 2 seconds.
  - Host controls: `StaffBingoHost` on Velvet's Tonight and Backstage's tonight's event: Start bingo (75/90-ball and
    what wins), Draw (the number big, to read out), Undo last, End game. Hidden on an API without bingo.
  - StaffKitServices `VenueGames.swift`: `venueGames`, `currentBingoGame`, `marqueeTrivia`, `startBingoGame`,
    `drawBingoNumber`, `undoBingoCall`, `endBingoGame`.

- Focus: Proposed changes and duplicates, as on the web console (Rick, 2026-11-19, "build out the proposed changes and
  duplicates features into focus"). Uses audience-kit-sdk 0.82.0 (`ProposedChanges`); audience_kit_api next already
  serves everything on the staff endpoint.
  - iOS: Overview › Review › Proposed changes (count of those waiting): To review and Decided, headshots to approve
    or remove, and each change in full (what it changes, the note, evidence, research, Instagram profile cards)
    with Approve, Use @handle, Other…, Ask the venue and Reject with a reason. Possible duplicates is on the
    Overview too, and now lists the pairs called "Not a duplicate" with Undo.
  - Android: Proposed and Duplicates chips beside People, Venues and Events, with the same decisions, merging a
    suggested pair (with Swap) and Undo.
  - `graphql/staff_schema.graphql` refreshed from audience_kit_api next.

- Soapbox App Store screenshots: a `SoapboxUITests` target (`SoapboxScreenshots`) that walks the listing's screens
  in the API's Soapbox demo (audience_kit_api `SoapboxDemo`), and `scripts/staff-app-screenshots.sh`, which runs a staff
  app's screenshot tests on the 6.9" iPhone and 13" iPad and saves the PNGs. Soapbox allows plain HTTP to 127.0.0.1
  only, for the local UI-test API, like Focus and Backstage.
- Soapbox: a publication's ads, rate sheet and media library, and the audience's admins' ad review (Rick,
  2026-11-17, "get the soapbox management of cards / ads / media into a build"). Needs audience_kit_api #698 and
  audience-kit-sdk 0.78.0 (`SoapboxAds`).
  - Sidebar "Ads and media": each publication's Ads (by status, with the rate sheet, an editor that previews the ad
    and checks it against the audience's rules as it's written, and weekly readers) and Media (add many pictures at
    once, describe them for screen readers, caption, credit, remove).
  - Articles and ads can take their picture from the media library (`SoapboxArticleChanges.heroMediaID`).
  - Admins: "Ads to review" (approve, turn down or take down with a note), which publishers' ads the audience
    reviews, and switching a publication's ads on.
  - `SoapboxClient` ads, media and review calls (StaffKitServices `SoapboxAdsClient.swift`).

- `arbiterctl judge PROMPTS.jsonl`: Arbiter judges the API's moderation test vectors (audience_kit_api #691,
  `bin/rails moderation:vectors:export`) on the decisions model, held to the harness's answer by a grammar, with the
  outcome's confidence read from the raw logits, and writes rows the API's `moderation:vectors:report ARBITER=` imports
  (apps/arbiter/ARBITERCTL.md). New `judge` control command, which an older app refuses.
- Arbiter reviews Glam's fast lane (api doc/GLAM_FAST_LANE.md, audience_kit_api #628). When an audience turns the
  fast lane on (`glamFastLane` in Arbiter's settings), the backend hosts its rooms: Glam on the Mac proposes nothing
  (the guard and rules still check each message), and each `glam.output` on the feed is reviewed with
  `reviewGlamOutput` (`GlamReviewPolicy`, ArbiterModels): what acts on nobody is confirmed; a flagged removal is
  confirmed or overturned by the moderation rules, and escalated when they can't say; a cooldown becomes at most a
  removal; a block always goes to a person. Verdicts are sent in live mode and only logged in shadow and approve. The
  feed asks for the outputs only while the fast lane is on, so an older API is unaffected.
- Safety alerts: a "Misusing alerts, ask to block" way to close one in Velvet on iOS and Android (Rick, 2026-11-14:
  "lets find a path where the staff resolutions can flag a user to be blocked from the community"). It closes the
  alert with the `MISUSE` outcome, which puts it in front of the audience's team with a "Block from community"
  decision; nobody is blocked until the team decides. Needs the audience_kit_api security hardening PR; an older
  API refuses the outcome.
- Removed: the deprecated AudienceManagementCore, AudienceManagementKit and AudienceManagementUI products, which only
  re-exported StaffKitCore, StaffKit and StaffKitUI. Import those instead. Nothing in the staff apps or Hot Mess used them.
- Flagged messages in Velvet (Rick, 2026-11-14: the simple version of the admins' message flag and decision screens).
  `VenueManagementClient.flaggedMessages(venueID:)` and `reviewFlaggedMessage(id:action:minutes:text:)`
  (StaffKitServices) send the AudienceKit SDK's shared `FlaggedMessages` GraphQL (SDK 0.61.0) on the staff endpoint.
  Velvet's Tonight shows a "Flagged messages" card (iOS and Android) when anything waits: the message, why, the host's
  suggestion, one tap to Dismiss, Remove, Warn or Cooldown, and Escalate and Ban (which asks first) under More.
  Needs audience_kit_api #544.

- Soapbox (the API's doc/SOAPBOX.md): `SoapboxClient` (StaffKitServices) runs a publication from the staff endpoint
  (its articles from draft to published, the op-ed inbox, scheduled publishing with a locale push, its settings) and,
  for the audience's admins, the review queue and trust. `SoapboxPushRules` refuses a push that asks for money before it
  is sent, as the API does. `SoapboxUI` is the new Soapbox app's SwiftUI (apps/soapbox). The audience-kit-sdk pin moves
  to its main (0.50.0), and graphql/ to the API's next schemas.
- `StaffApp` (StaffKitCore) lists the staff apps with their App Store pages, and `MoreStaffAppsMenu` (StaffKitUI) is a
  "More AudienceKit apps" menu of the other apps. Focus (Settings), Velvet (account menu, not on venue devices) and
  Backstage (account menu) show it, in place of an App Store bundle, which Apple allows only for paid or subscription apps.

## 1.0.0 (2026-11-03)

The first tagged release of StaffKit: the libraries as the staff apps (Focus, Velvet, Backstage, Arbiter) ship them
today, on the AudienceKit SDK at the audience-kit-sdk submodule's commit.

- `StaffKit` is now the umbrella (Rick, 2026-11-03): `import StaffKit` re-exports StaffKitCore, StaffKitServices,
  StaffKitUI, StaffOnboarding, ArbiterModels, ArbiterUI and the SDK's AudienceCore, AudienceKit and AudienceKitUI, so an
  app links the one StaffKit product. ArbiterEngine and ArbiterMac (macOS) stay separate.
- The module that was `StaffKit` (the staff API clients, feeds and models) is `StaffKitServices`. Apps that
  `import StaffKit` keep compiling; `@testable import StaffKit` becomes `@testable import StaffKitServices`.
