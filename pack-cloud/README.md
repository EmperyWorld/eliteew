# Cloud entrance pack

This pack contains the [Android entrance](mobile/README.md) to the shared hosted product. Browser access, the shared SPA/API, identity and Meet remain separate platform components; this is not an independent backend implementation.

Source code lives under `pack-cloud/mobile/`, not the retired `MobileAndroid/` or `EliteEW/` aliases. [Pack layout and artifact matrix](../documentation/platform/ELITEEW-PACK-LAYOUT.md) define edition ownership. The cloud release excludes the organization Tauri Connection Agent; see [release navigation](release/README.md).

Start with [Android build/setup](mobile/README.md), the [Android handbook](../documentation/product/mobile/ANDROID-DEVELOPER-HANDBOOK.md) and [shared developer setup](../documentation/platform/DEVELOPER-SETUP.md). Build flavors, secrets and signing inputs must be read from the current Gradle configuration. A tree migration marked done in historical plans is not proof of a published or accepted release.
