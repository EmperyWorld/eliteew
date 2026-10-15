// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Registry of MobileAndroid embedded SPA routes (EWA companion, Handbook, Social Hub).
// Invariants:
// - spaHash must match frontend PageType hash route and setupMobileEmbeddedOidcProfile.
// Related:
// - EmperyMobileEmbeddedSpaWebViewActivity.kt, EwaCompanionWebViewLauncher.kt, HandbookWebViewLauncher.kt
// ---
package feature.desktop

data class MobileEmbeddedSpaSpec(
    val spaHash: String,
    val uaMarker: String,
    val logTag: String,
    val titleRes: Int,
    val errorTitleRes: Int,
    val errorBodyRes: Int,
    /** When false, native toolbar shows only Close (SPA owns section chrome). */
    val showNativeTitle: Boolean = true,
)

object MobileEmbeddedSpaSpecs {
    val ewaCompanion =
        MobileEmbeddedSpaSpec(
            spaHash = "mobile-ewa-companion",
            uaMarker = "EmperyMobileEwaWebView",
            logTag = "EmperyMobileEwaWV",
            titleRes = R.string.desktop_ewa_entry_title,
            errorTitleRes = R.string.desktop_ewa_webview_error_title,
            errorBodyRes = R.string.desktop_ewa_webview_error_body,
            showNativeTitle = false,
        )

    val handbook =
        MobileEmbeddedSpaSpec(
            spaHash = "mobile-handbook",
            uaMarker = "EmperyMobileHandbookWebView",
            logTag = "EmperyMobileHandbookWV",
            titleRes = R.string.desktop_handbook_entry_title,
            errorTitleRes = R.string.desktop_handbook_webview_error_title,
            errorBodyRes = R.string.desktop_handbook_webview_error_body,
            showNativeTitle = false,
        )

    val socialHub =
        MobileEmbeddedSpaSpec(
            spaHash = "mobile-social-hub",
            uaMarker = "EmperyMobileSocialHubWebView",
            logTag = "EmperyMobileSocialHubWV",
            titleRes = R.string.desktop_social_hub_entry_title,
            errorTitleRes = R.string.desktop_social_hub_webview_error_title,
            errorBodyRes = R.string.desktop_social_hub_webview_error_body,
            showNativeTitle = false,
        )

    val feedbackHub =
        MobileEmbeddedSpaSpec(
            spaHash = "mobile-feedback-hub",
            uaMarker = "EmperyMobileFeedbackHubWebView",
            logTag = "EmperyMobileFeedbackHubWV",
            titleRes = R.string.desktop_feedback_hub_entry_title,
            errorTitleRes = R.string.desktop_feedback_hub_webview_error_title,
            errorBodyRes = R.string.desktop_feedback_hub_webview_error_body,
            showNativeTitle = false,
        )

    val notifications =
        MobileEmbeddedSpaSpec(
            spaHash = "mobile-notifications",
            uaMarker = "EmperyMobileNotificationsWebView",
            logTag = "EmperyMobileNotificationsWV",
            titleRes = R.string.desktop_notifications_entry_title,
            errorTitleRes = R.string.desktop_notifications_webview_error_title,
            errorBodyRes = R.string.desktop_notifications_webview_error_body,
            showNativeTitle = false,
        )

    val contentManager =
        MobileEmbeddedSpaSpec(
            spaHash = "mobile-content-manager",
            uaMarker = "EmperyMobileContentManagerWebView",
            logTag = "EmperyMobileContentManagerWV",
            titleRes = R.string.desktop_content_manager_entry_title,
            errorTitleRes = R.string.desktop_content_manager_webview_error_title,
            errorBodyRes = R.string.desktop_content_manager_webview_error_body,
            showNativeTitle = false,
        )

    val ewDesk =
        MobileEmbeddedSpaSpec(
            spaHash = "mobile-ewdesk",
            uaMarker = "EmperyMobileEwDeskWebView",
            logTag = "EmperyMobileEwDeskWV",
            titleRes = R.string.desktop_ewdesk_entry_title,
            errorTitleRes = R.string.desktop_ewdesk_webview_error_title,
            errorBodyRes = R.string.desktop_ewdesk_webview_error_body,
            showNativeTitle = false,
        )

    val professionalWorlds =
        MobileEmbeddedSpaSpec(
            spaHash = "mobile-professional-worlds",
            uaMarker = "EmperyMobileProfessionalWorldsWebView",
            logTag = "EmperyMobileProfessionalWorldsWV",
            titleRes = R.string.desktop_professional_worlds_entry_title,
            errorTitleRes = R.string.desktop_professional_worlds_webview_error_title,
            errorBodyRes = R.string.desktop_professional_worlds_webview_error_body,
            showNativeTitle = false,
        )

    val appStore =
        MobileEmbeddedSpaSpec(
            spaHash = "mobile-app-store",
            uaMarker = "EmperyMobileAppStoreWebView",
            logTag = "EmperyMobileAppStoreWV",
            titleRes = R.string.desktop_app_store_entry_title,
            errorTitleRes = R.string.desktop_app_store_webview_error_title,
            errorBodyRes = R.string.desktop_app_store_webview_error_body,
            showNativeTitle = false,
        )

    val desktopSettings =
        MobileEmbeddedSpaSpec(
            spaHash = "mobile-desktop-settings",
            uaMarker = "EmperyMobileDesktopSettingsWebView",
            logTag = "EmperyMobileDesktopSettingsWV",
            titleRes = R.string.desktop_settings_entry_title,
            errorTitleRes = R.string.desktop_settings_webview_error_title,
            errorBodyRes = R.string.desktop_settings_webview_error_body,
            showNativeTitle = false,
        )

    private val byHash: Map<String, MobileEmbeddedSpaSpec> =
        listOf(ewaCompanion, handbook, socialHub, feedbackHub, notifications, contentManager, ewDesk, professionalWorlds, appStore, desktopSettings).associateBy { it.spaHash }

    fun resolve(spaHash: String): MobileEmbeddedSpaSpec? = byHash[spaHash.trim()]
}
