# Keep Retrofit/Kotlin metadata for API parsing.
-keep class kotlinx.serialization.** { *; }
-keep class retrofit2.** { *; }

# org.json: socket.io-client may conflict with platform org.json on some OEM builds.
-keep class org.json.** { *; }
-keepclassmembers class org.json.** { *; }
-keep class io.socket.** { *; }
-keepclassmembers class io.socket.engineio.client.HandshakeData { *; }

# EWA companion WebView: SPA reads native OIDC bootstrap via @JavascriptInterface.
-keepclassmembers class feature.desktop.NativeOidcBootstrapBridge {
    @android.webkit.JavascriptInterface <methods>;
}
