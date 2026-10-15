import java.io.File
import java.util.Properties
import com.android.build.api.dsl.ApplicationProductFlavor

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.parcelize")
}

/** Machine-specific overrides (gitignored). Same keys as in gradle.properties / -P. */
val localMobileProps: Properties =
    Properties().apply {
        val lp = rootProject.file("local.properties")
        if (lp.exists()) {
            lp.inputStream().use { load(it) }
        }
    }

val hasGoogleServicesJson = file("google-services.json").exists()
if (hasGoogleServicesJson) {
    apply(plugin = "com.google.gms.google-services")
    apply(plugin = "com.google.firebase.crashlytics")
}

val tunnelBetaPrivateConfigPath =
    localMobileProps.getProperty("mobile.android.tunnelBeta.privateTunnelConfig")?.trim()
        ?.takeIf { it.isNotEmpty() }
        ?: rootProject.file("../docker/data/mobile-private-tunnel/peers/operator-android-1.conf").absolutePath
val tunnelBetaPrivateConfigFile = File(tunnelBetaPrivateConfigPath)
val generatedTunnelBetaPrivateTunnelAssetsDir =
    layout.buildDirectory.dir("generated/assets/mobilePrivateTunnel/tunnelBetaDebug")
val generateTunnelBetaPrivateTunnelAsset =
    tasks.register<Copy>("generateTunnelBetaPrivateTunnelAsset") {
        onlyIf { tunnelBetaPrivateConfigFile.isFile }
        from(tunnelBetaPrivateConfigFile)
        into(generatedTunnelBetaPrivateTunnelAssetsDir)
        rename { "mobile_private_tunnel_default.conf" }
    }

/** When `true`, release builds are signed with the debug keystore so CI can produce installable APKs without operator secrets. */
val mobileAndroidCi =
    (project.findProperty("mobile.android.ci") as String?)?.equals("true", ignoreCase = true) == true

/**
 * Release keystore credentials: env wins, then `local.properties` (gitignored).
 * See `pack-cloud/mobile/docs/SIGNING-PLAN.md`.
 */
fun mobileReleaseProp(envKey: String, localKey: String): String {
    val fromEnv = System.getenv(envKey)?.trim().orEmpty()
    if (fromEnv.isNotEmpty()) return fromEnv
    return localMobileProps.getProperty(localKey)?.trim().orEmpty()
}

val releaseStoreFilePath =
    mobileReleaseProp("MOBILE_RELEASE_STORE_FILE", "mobile.android.release.storeFile")
val releaseStorePassword =
    mobileReleaseProp("MOBILE_RELEASE_STORE_PASSWORD", "mobile.android.release.storePassword")
val releaseKeyAlias =
    mobileReleaseProp("MOBILE_RELEASE_KEY_ALIAS", "mobile.android.release.keyAlias")
val releaseKeyPassword =
    mobileReleaseProp("MOBILE_RELEASE_KEY_PASSWORD", "mobile.android.release.keyPassword")

val releaseStoreFileResolved: File? =
    releaseStoreFilePath.takeIf { it.isNotEmpty() }?.let { path ->
        val candidate = File(path)
        if (candidate.isAbsolute) candidate else rootProject.file(path)
    }

/** True only when store file exists on disk and all four credential fields are non-empty. */
val hasReleaseSigning: Boolean =
    releaseStoreFileResolved?.isFile == true &&
        releaseStorePassword.isNotEmpty() &&
        releaseKeyAlias.isNotEmpty() &&
        releaseKeyPassword.isNotEmpty()

/**
 * Trailing slash. Override order: `local.properties`, then `gradle.properties` / `-P`, then default.
 * All flavors default to HTTPS on the public app domain; use properties only for staging or lab hosts.
 */
fun mobileFlavorBaseUrl(flavor: String, defaultUrl: String): String {
    val key = "mobile.android.$flavor.baseUrl"
    val fromLocal = localMobileProps.getProperty(key)?.trim().orEmpty()
    val fromProject = (project.findProperty(key) as String?)?.trim().orEmpty()
    return when {
        fromLocal.isNotEmpty() -> fromLocal
        fromProject.isNotEmpty() -> fromProject
        else -> defaultUrl
    }
}

fun ssoLoginFromApiRoot(apiRoot: String): String =
    apiRoot.trimEnd('/') + "/auth/sso/login"

fun mobileFlavorKeycloakPublicUrl(flavor: String, defaultUrl: String): String {
    val key = "mobile.android.$flavor.keycloakPublicUrl"
    val fromLocal = localMobileProps.getProperty(key)?.trim().orEmpty()
    val fromProject = (project.findProperty(key) as String?)?.trim().orEmpty()
    return when {
        fromLocal.isNotEmpty() -> fromLocal
        fromProject.isNotEmpty() -> fromProject
        else -> defaultUrl
    }
}

fun keycloakAuthEndpoint(publicBase: String): String =
    publicBase.trimEnd('/') + "/realms/empery/protocol/openid-connect/auth"

fun keycloakTokenEndpoint(publicBase: String): String =
    publicBase.trimEnd('/') + "/realms/empery/protocol/openid-connect/token"

fun ApplicationProductFlavor.applyMobileSsoBuildConfig(
    base: String,
    redirectUri: String,
    keycloakPublic: String,
) {
    val sso = ssoLoginFromApiRoot(base)
    val authEndpoint = keycloakAuthEndpoint(keycloakPublic)
    val tokenEndpoint = keycloakTokenEndpoint(keycloakPublic)
    buildConfigField("String", "BASE_URL", "\"$base\"")
    buildConfigField("String", "KEYCLOAK_REDIRECT_URI", "\"$redirectUri\"")
    buildConfigField("String", "SSO_LOGIN_URL", "\"$sso\"")
    buildConfigField("String", "KEYCLOAK_CLIENT_ID", "\"empery-mobile\"")
    buildConfigField("String", "KEYCLOAK_AUTHORIZATION_ENDPOINT", "\"$authEndpoint\"")
    buildConfigField("String", "KEYCLOAK_TOKEN_ENDPOINT", "\"$tokenEndpoint\"")
    buildConfigField("String", "KEYCLOAK_PUBLIC_URL", "\"${keycloakPublic.trimEnd('/')}\"")
    resValue("string", "config_base_url", base)
    resValue("string", "config_keycloak_redirect_uri", redirectUri)
    resValue("string", "config_sso_login_url", sso)
    resValue("string", "config_keycloak_client_id", "empery-mobile")
    resValue("string", "config_keycloak_authorization_endpoint", authEndpoint)
    resValue("string", "config_keycloak_token_endpoint", tokenEndpoint)
    resValue("string", "config_keycloak_public_url", keycloakPublic.trimEnd('/'))
}

// socket.io-client may pull org.json:json — on device use platform org.json only (see proguard-rules.pro).
configurations.configureEach {
    exclude(group = "org.json", module = "json")
}

android {
    namespace = "world.empery.mobile"
    compileSdk = 35

    defaultConfig {
        applicationId = "world.empery.mobile"
        minSdk = 28
        targetSdk = 35
        versionCode = 210
        versionName = "0.2.200"
        manifestPlaceholders["appAuthRedirectScheme"] = "world.empery.mobile"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    sourceSets.maybeCreate("tunnelBeta").apply {
        assets.srcDir(generatedTunnelBetaPrivateTunnelAssetsDir)
    }

    composeOptions {
        kotlinCompilerExtensionVersion = "1.5.14"
    }

    signingConfigs {
        // Only create when keystore + passwords are available; otherwise leave release unsigned
        // (no signingConfig override below) or use debug under mobileAndroidCi.
        if (hasReleaseSigning) {
            create("release") {
                storeFile = releaseStoreFileResolved
                storePassword = releaseStorePassword
                keyAlias = releaseKeyAlias
                keyPassword = releaseKeyPassword
            }
        }
    }

    flavorDimensions += "env"
    productFlavors {
        create("stage") {
            dimension = "env"
            applicationIdSuffix = ".stage"
            versionNameSuffix = "-stage"
            val base = mobileFlavorBaseUrl(
                "stage",
                "https://app-staging.eliteew.ru/api/v1/",
            )
            val keycloakPublic = mobileFlavorKeycloakPublicUrl("stage", "https://auth.eliteew.ru")
            applyMobileSsoBuildConfig(
                base = base,
                redirectUri = "world.empery.mobile.stage:/oauth2redirect",
                keycloakPublic = keycloakPublic,
            )
            manifestPlaceholders["appAuthRedirectScheme"] = "world.empery.mobile.stage"
        }
        create("prod") {
            dimension = "env"
            val base = mobileFlavorBaseUrl("prod", "https://app.eliteew.ru/api/v1/")
            val keycloakPublic = mobileFlavorKeycloakPublicUrl("prod", "https://auth.eliteew.ru")
            applyMobileSsoBuildConfig(
                base = base,
                redirectUri = "world.empery.mobile:/oauth2redirect",
                keycloakPublic = keycloakPublic,
            )
            manifestPlaceholders["appAuthRedirectScheme"] = "world.empery.mobile"
        }
        create("tunnelBeta") {
            dimension = "env"
            applicationIdSuffix = ".tunnelbeta"
            versionNameSuffix = "-tunnel-beta"
            resValue("string", "app_name", "Empery Mobile (Tunnel Beta)")
            val base = mobileFlavorBaseUrl("tunnelBeta", "https://app.eliteew.ru/api/v1/")
            val keycloakPublic = mobileFlavorKeycloakPublicUrl("tunnelBeta", "https://auth.eliteew.ru")
            applyMobileSsoBuildConfig(
                base = base,
                redirectUri = "world.empery.mobile.tunnelbeta:/oauth2redirect",
                keycloakPublic = keycloakPublic,
            )
            manifestPlaceholders["appAuthRedirectScheme"] = "world.empery.mobile.tunnelbeta"
        }
    }

    buildTypes {
        debug {
            isMinifyEnabled = false
        }
        release {
            isMinifyEnabled = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
            // Precedence: CI debug signing → release keystore when configured → no override
            // (AGP leaves the APK unsigned until credentials exist; see SIGNING-PLAN.md).
            when {
                mobileAndroidCi -> signingConfig = signingConfigs.getByName("debug")
                hasReleaseSigning -> signingConfig = signingConfigs.getByName("release")
            }
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }

    testOptions {
        unitTests {
            isIncludeAndroidResources = true
        }
    }

    packaging {
        jniLibs {
            pickFirsts += listOf("**/libc++_shared.so")
        }
    }
}

tasks.matching {
    it.name == "mergeTunnelBetaDebugAssets" ||
        (it.name.contains("TunnelBetaDebug") && it.name.contains("lint", ignoreCase = true))
}.configureEach {
    dependsOn(generateTunnelBetaPrivateTunnelAsset)
}

dependencies {
    implementation(project(":core:network"))
    implementation(project(":core:auth"))
    implementation(project(":core:storage"))
    implementation(project(":core:ui"))
    implementation(project(":core:media"))
    implementation(project(":feature:feed"))
    implementation(project(":feature:notifications"))
    implementation(project(":feature:profile"))
    implementation(project(":feature:chat"))
    implementation(project(":feature:friends"))
    implementation(project(":feature:desktop"))
    implementation(project(":feature:ugs"))

    implementation(platform("androidx.compose:compose-bom:2024.09.01"))
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.core:core-splashscreen:1.0.1")
    implementation("androidx.media3:media3-session:1.4.1")
    implementation("androidx.media:media:1.7.0")
    implementation("androidx.browser:browser:1.8.0")
    implementation("androidx.activity:activity-compose:1.9.2")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material:material")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("com.google.android.material:material:1.12.0")
    implementation("com.squareup.retrofit2:retrofit:2.11.0")
    implementation("androidx.navigation:navigation-compose:2.8.0")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.5")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.5")
    implementation("androidx.lifecycle:lifecycle-viewmodel-ktx:2.8.5")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.5")
    implementation("androidx.lifecycle:lifecycle-process:2.8.5")
    implementation("androidx.profileinstaller:profileinstaller:1.4.1")
    implementation("androidx.security:security-crypto:1.1.0-alpha06")
    implementation("androidx.biometric:biometric:1.1.0")
    implementation("io.coil-kt:coil-compose:2.7.0")
    implementation("com.airbnb.android:lottie-compose:6.7.1")
    implementation("com.wireguard.android:tunnel:1.0.20260102")

    implementation("androidx.work:work-runtime-ktx:2.9.1")
    implementation("androidx.localbroadcastmanager:localbroadcastmanager:1.1.0")
    implementation("com.google.firebase:firebase-messaging-ktx:24.0.1")
    implementation("com.google.firebase:firebase-analytics-ktx:22.1.2")
    implementation("com.google.firebase:firebase-crashlytics-ktx:19.0.3")

    debugImplementation("androidx.compose.ui:ui-tooling")

    testImplementation("junit:junit:4.13.2")
    testImplementation("org.robolectric:robolectric:4.13")
    testImplementation("androidx.test:core:1.6.1")

    androidTestImplementation("androidx.test.ext:junit:1.2.1")
    androidTestImplementation("androidx.test:runner:1.6.2")
    androidTestImplementation(platform("androidx.compose:compose-bom:2024.09.01"))
    androidTestImplementation("androidx.compose.ui:ui-test-junit4")
    debugImplementation("androidx.compose.ui:ui-test-manifest")
}

