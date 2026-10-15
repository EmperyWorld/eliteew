# Gson serializes Kotlin data classes by field names; R8 release obfuscation renames them (e.g. code → a).
# Merge into the app when minify is enabled.
-keep class world.empery.mobile.core.network.api.** { *; }
