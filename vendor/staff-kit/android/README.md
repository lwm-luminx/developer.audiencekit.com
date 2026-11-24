# StaffKit for Android

The staff SDK for Android: the AudienceKit calls staff make that members don't. For now that's working a venue's
door: the venues a person can work, a night's counts, and scanning passes. It adds them to the member SDK's
`AudienceKitClient` ([audience-kit-sdk](https://github.com/lwm-luminx/audience-kit-sdk)) as
extension functions, sent to the audience's staff endpoint (`staffql`):

```kotlin
import com.audiencekit.staff.doorVenues
import com.audiencekit.staff.scanAdmission
import com.audiencekit.staff.venueDoor

val venues = client.doorVenues()                      // venues whose door this person can work
val tonight = client.venueDoor(venues.first().id)?.door
val result = client.scanAdmission(venueId, code)      // ScanOutcome.ADMIT, RE_ENTRY, or why not
```

Arbiter's decision queue is here too (`Decisions.kt`), the Android side of Swift's `DecisionQueueClient`:

```kotlin
val waiting = client.decisions(open = true)              // what needs a person, unsure first
client.decideEvaluation(id, "reject", note = "Wrong bar") // a rejected suggestion needs a note
val status = client.decisionQueueStatus()                // the server's counts and worker devices
cable.subscribe(audienceId, DecisionQueries.decisionQueue, endpoint = GraphQLEndpoint.STAFF)
    .decisionQueueEvents()                               // Added, Decided, Waiting, Resubscribed, …
    .collect { state = state.applying(it) }              // DecisionQueueState keeps the lists current
```

Soapbox's newsroom is here too (`Soapbox.kt`), the Android side of Swift's `SoapboxClient`:

```kotlin
val mine = client.mySoapboxPublications()                          // the publications they run
val drafts = client.soapboxArticles(id, statuses = listOf(SoapboxArticleStatus.DRAFT))
val draft = client.createSoapboxArticle(id, SoapboxArticleChanges(title = "Pride on the Hill"))
client.setSoapboxArticleStatus(draft.id, SoapboxArticleAction.PUBLISH,
    push = SoapboxPush(listOf(localeId), SoapboxPushPurpose.EVENT), article = draft) // never asks for money
```

## Building

The member SDK isn't published to a Maven repository yet, so this builds it from a checkout as a composite build. It
looks at `audiencekit.dir` (a Gradle property or in `local.properties`), then `AUDIENCEKIT_DIR`, then the
`audience-kit-sdk` submodule at the repository root. Then, from the repository root, with JDK 17 or newer:

```sh
./gradlew build
```
