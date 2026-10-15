/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure helpers for PremiumSplashScreen: video / Lottie asset names and mode resolution.
 *
 * Invariants:
 * - Never blocks SecureTokenStore / AppContainer; splash is UI-only after Application.onCreate.
 * - Video wins over Lottie when the raw splash MP4 is packaged.
 * - Once-per-version overlay policy lives in [PremiumSplashGate] (not here).
 *
 * Related:
 * - PremiumSplashScreen.kt, PremiumSplashGate.kt, MainActivity installSplashScreen, res/raw/start_app_mobile.mp4
 */
package world.empery.mobile.ui

/** Default Lottie asset under `app/src/main/assets/` (optional). */
const val PREMIUM_SPLASH_LOTTIE_ASSET = "premium_splash.json"

/** Packaged startup video under `app/src/main/res/raw/` (~5s preloader). */
const val PREMIUM_SPLASH_VIDEO_RAW_NAME = "start_app_mobile"

enum class PremiumSplashMode {
    /** Full-bleed raw MP4 preloader with fade-out. */
    Video,

    /** Play Lottie composition from assets. */
    Lottie,

    /** Brand mark / static surface when media is missing or unloadable. */
    StaticFallback,
}

/**
 * Resolve splash presentation mode (compose-free for unit tests).
 * Priority: video → Lottie → static.
 */
fun resolvePremiumSplashMode(
    videoExists: Boolean,
    lottieExists: Boolean = false,
): PremiumSplashMode =
    when {
        videoExists -> PremiumSplashMode.Video
        lottieExists -> PremiumSplashMode.Lottie
        else -> PremiumSplashMode.StaticFallback
    }

/** Playback rate for the packaged intro MP4 (framed card, not full-bleed). */
const val PREMIUM_SPLASH_VIDEO_SPEED: Float = 3f

/**
 * Hard ceiling so a stuck decoder cannot block the shell forever.
 * Source clip is ~5.0s; at [PREMIUM_SPLASH_VIDEO_SPEED] wall-clock is ~1.7s + fade.
 */
const val PREMIUM_SPLASH_VIDEO_MAX_MS: Long = 2_200L

/** Fade-out duration after playback ends (or max timeout). */
const val PREMIUM_SPLASH_FADE_OUT_MS: Long = 400L
