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

## Building

The member SDK isn't published to a Maven repository yet, so this builds it from a checkout as a composite build. It
looks at `audiencekit.dir` (a Gradle property or in `local.properties`), then `AUDIENCEKIT_DIR`, then the
`audience-kit-sdk` submodule at the repository root. Then, from the repository root, with JDK 17 or newer:

```sh
./gradlew build
```
