pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
plugins {
    id("org.gradle.toolchains.foojay-resolver-convention") version "0.10.0"
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
        maven { url = uri("https://jitpack.io") }
    }
}

rootProject.name = "MobileAndroid"

include(
    ":app",
    ":benchmark",
    ":core:network",
    ":core:auth",
    ":core:storage",
    ":core:ui",
    ":core:media",
    ":feature:feed",
    ":feature:notifications",
    ":feature:profile",
    ":feature:chat",
    ":feature:friends",
    ":feature:desktop",
    ":feature:ugs",
    ":unity-hand-host",
)
