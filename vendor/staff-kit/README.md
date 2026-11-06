# StaffKit

Private. The staff side of AudienceKit, for every platform, and the staff apps built on it. Everything here builds
on the public [AudienceKit SDK](https://github.com/lwm-luminx/audience-kit-sdk), the `audience-kit-sdk` submodule:
clone with `git clone --recurse-submodules`, or run `git submodule update --init` after cloning.

| Directory | What it is |
| --- | --- |
| [`swift/`](swift/README.md) | StaffKitCore, StaffKit, StaffKitUI, ArbiterUI (and the deprecated AudienceManagement* names). The manifest is `Package.swift` at the root. |
| [`core/`](core/README.md) | StaffCore, Kotlin Multiplatform (to come: generated from the staff schema) |
| [`android/`](android/README.md) | StaffKit for Android, `com.audiencekit:staffkit`. The Gradle build is the repository root and includes `audience-kit-sdk` |
| [`apps/`](apps) | Focus, Velvet and Backstage for iOS (`apps/Staff.xcodeproj`, and a project per app) and the staff apps for Android (`apps/staff_android`) |
| [`apps/arbiter/`](apps/arbiter/README.md) | Arbiter for iPad and Mac, one SwiftUI app: decides what the AI couldn't, and lists what it decided (`apps/arbiter/Arbiter.xcodeproj`) |
| [`graphql/`](graphql/staff_schema.graphql) | The API's staff GraphQL schema the documents are checked against |
| `audience-kit-sdk/` | The public SDK, pinned. Bump it after an SDK release: `git -C audience-kit-sdk pull origin main`, then commit the pin. |
| `scripts/build-binaries.sh` | Builds the Swift libraries as binary XCFrameworks and publishes them to the private `lwm-luminx/staff-kit-binaries` package, for apps outside this repository ([docs/BINARY_PACKAGE.md](docs/BINARY_PACKAGE.md)) |
| `ci_scripts/` | Xcode Cloud's post-clone script (`apps/ci_scripts` links to it, beside `Staff.xcodeproj`) |

```sh
swift build && swift test                      # StaffKit for Swift (Linux or macOS)
./gradlew build                                # StaffKit for Android
npm install && node apps/focus/Tests/validate-schema.mjs && node apps/staff_android/tests/validate-schema.mjs
```

The apps were moved here from the AudienceKit monorepo (lwm-luminx/audience-kit) as a snapshot; their earlier history
is there.

## License

[AudienceKit SDK License](LICENSE), © Love Wins Media, Inc.: use, change and build on StaffKit freely, with the
AudienceKit service Love Wins Media operates only. The same license as the [AudienceKit SDK](https://github.com/lwm-luminx/audience-kit-sdk/blob/main/LICENSE).
