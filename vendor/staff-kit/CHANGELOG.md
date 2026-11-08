# Changelog

StaffKit's Swift libraries (StaffKit, StaffKitCore, StaffKitServices, StaffKitUI, StaffOnboarding, ArbiterModels,
ArbiterUI, ArbiterEngine, ArbiterMac) release together under one version, in [VERSION](VERSION). Xcode Cloud tags each version
once its tests pass on `main` ([xcode-cloud/](xcode-cloud/README.md)).

## 1.0.0 (2026-11-03)

The first tagged release of StaffKit: the libraries as the staff apps (Focus, Velvet, Backstage, Arbiter) ship them
today, on the AudienceKit SDK at the audience-kit-sdk submodule's commit.

- `StaffKit` is now the umbrella (Rick, 2026-11-03): `import StaffKit` re-exports StaffKitCore, StaffKitServices,
  StaffKitUI, StaffOnboarding, ArbiterModels, ArbiterUI and the SDK's AudienceCore, AudienceKit and AudienceKitUI, so an
  app links the one StaffKit product. ArbiterEngine and ArbiterMac (macOS) stay separate.
- The module that was `StaffKit` (the staff API clients, feeds and models) is `StaffKitServices`. Apps that
  `import StaffKit` keep compiling; `@testable import StaffKit` becomes `@testable import StaffKitServices`.
