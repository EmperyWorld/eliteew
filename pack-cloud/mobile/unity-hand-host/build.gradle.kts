plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "world.empery.mobile.unity.host"
    compileSdk = 35

    defaultConfig {
        minSdk = 32
        consumerProguardFiles("consumer-rules.pro")
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    composeOptions {
        kotlinCompilerExtensionVersion = "1.5.14"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }

    defaultConfig {
        buildConfigField("String", "BASE_URL", "\"https://app.eliteew.ru/api/v1/\"")
        buildConfigField("String", "KEYCLOAK_REDIRECT_URI", "\"world.empery.mobile:/oauth2redirect\"")
        buildConfigField("String", "SSO_LOGIN_URL", "\"https://app.eliteew.ru/api/v1/auth/sso/login\"")
        buildConfigField("String", "KEYCLOAK_CLIENT_ID", "\"empery-mobile\"")
        buildConfigField(
            "String",
            "KEYCLOAK_AUTHORIZATION_ENDPOINT",
            "\"https://auth.eliteew.ru/realms/empery/protocol/openid-connect/auth\"",
        )
        buildConfigField(
            "String",
            "KEYCLOAK_TOKEN_ENDPOINT",
            "\"https://auth.eliteew.ru/realms/empery/protocol/openid-connect/token\"",
        )
        buildConfigField("String", "KEYCLOAK_PUBLIC_URL", "\"https://auth.eliteew.ru\"")
    }
}

dependencies {
    implementation(platform("androidx.compose:compose-bom:2024.06.00"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.ui:ui-viewbinding")
    implementation("androidx.activity:activity-compose:1.9.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.3")
}
