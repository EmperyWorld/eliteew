/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Read/write lightweight feature shell state (feed filters, saved posts, education cards, focus targets, handoff drafts).
 *
 * Invariants:
 * - No secrets or tokens; only UI navigation and local bookmark state.
 *
 * Related:
 * - MobileShellPreferences, FeedTabViewModel, FriendsTabViewModel, DesktopHubTabViewModel
 */
package world.empery.mobile.shell

import android.content.Context

object MobileFeatureShellPreferences {
    private const val PREFS = "empery_mobile_feature_shell"
    private const val KEY_FEED_TOPIC = "feed_topic_filter"
    private const val KEY_FEED_SAVED_IDS = "feed_saved_post_ids"
    private const val KEY_FEED_LAST_OK_MS = "feed_last_success_ms"
    private const val KEY_EDUCATION_DISMISSED_IDS = "education_dismissed_ids"
    private const val KEY_FRIENDS_INBOX_EXPANDED = "friends_inbox_expanded"
    private const val KEY_FRIENDS_FOCUS_REQUEST = "friends_focus_request_id"
    private const val KEY_FRIENDS_FOCUS_FRIEND = "friends_focus_friend_id"
    private const val KEY_UGS_HISTORY_TYPE = "ugs_history_type_filter"
    private const val KEY_UGS_HISTORY_STATUS = "ugs_history_status_filter"
    private const val KEY_DESKTOP_HANDOFF_DRAFT = "desktop_handoff_draft"
    private const val KEY_DESKTOP_HANDOFF_EXPIRES = "desktop_handoff_expires_ms"
    private const val KEY_OTA_CHANGELOG_SEEN = "ota_changelog_seen_version"

    private fun prefs(context: Context) =
        context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun getFeedTopicFilter(context: Context): String? =
        prefs(context).getString(KEY_FEED_TOPIC, null)?.trim()?.takeIf { it.isNotEmpty() }

    fun setFeedTopicFilter(context: Context, topic: String?) {
        val editor = prefs(context).edit()
        if (topic.isNullOrBlank()) editor.remove(KEY_FEED_TOPIC) else editor.putString(KEY_FEED_TOPIC, topic)
        editor.apply()
    }

    fun getSavedFeedPostIds(context: Context): Set<String> =
        prefs(context).getStringSet(KEY_FEED_SAVED_IDS, emptySet())?.filter { it.isNotBlank() }?.toSet() ?: emptySet()

    fun setSavedFeedPostIds(context: Context, ids: Set<String>) {
        prefs(context).edit().putStringSet(KEY_FEED_SAVED_IDS, ids.filter { it.isNotBlank() }.toSet()).apply()
    }

    fun toggleSavedFeedPost(context: Context, postId: String): Set<String> {
        val id = postId.trim()
        val next = getSavedFeedPostIds(context).toMutableSet()
        if (!next.add(id)) next.remove(id)
        setSavedFeedPostIds(context, next)
        return next
    }

    fun getFeedLastSuccessEpochMs(context: Context): Long =
        prefs(context).getLong(KEY_FEED_LAST_OK_MS, 0L)

    fun setFeedLastSuccessEpochMs(context: Context, epochMs: Long) {
        prefs(context).edit().putLong(KEY_FEED_LAST_OK_MS, epochMs).apply()
    }

    fun getDismissedEducationCardIds(context: Context): Set<String> =
        prefs(context).getStringSet(KEY_EDUCATION_DISMISSED_IDS, emptySet())?.filter { it.isNotBlank() }?.toSet()
            ?: emptySet()

    fun dismissEducationCard(context: Context, id: String): Set<String> {
        val next = getDismissedEducationCardIds(context).toMutableSet()
        next += id
        prefs(context).edit().putStringSet(KEY_EDUCATION_DISMISSED_IDS, next).apply()
        return next
    }

    fun isFriendsInboxExpanded(context: Context): Boolean =
        prefs(context).getBoolean(KEY_FRIENDS_INBOX_EXPANDED, true)

    fun setFriendsInboxExpanded(context: Context, expanded: Boolean) {
        prefs(context).edit().putBoolean(KEY_FRIENDS_INBOX_EXPANDED, expanded).apply()
    }

    fun getFriendsFocusRequestId(context: Context): String? =
        prefs(context).getString(KEY_FRIENDS_FOCUS_REQUEST, null)

    fun setFriendsFocusRequestId(context: Context, id: String?) {
        val editor = prefs(context).edit()
        if (id.isNullOrBlank()) editor.remove(KEY_FRIENDS_FOCUS_REQUEST) else editor.putString(KEY_FRIENDS_FOCUS_REQUEST, id)
        editor.apply()
    }

    fun getFriendsFocusFriendId(context: Context): String? =
        prefs(context).getString(KEY_FRIENDS_FOCUS_FRIEND, null)

    fun setFriendsFocusFriendId(context: Context, id: String?) {
        val editor = prefs(context).edit()
        if (id.isNullOrBlank()) editor.remove(KEY_FRIENDS_FOCUS_FRIEND) else editor.putString(KEY_FRIENDS_FOCUS_FRIEND, id)
        editor.apply()
    }

    fun getUgsHistoryTypeFilter(context: Context): String? =
        prefs(context).getString(KEY_UGS_HISTORY_TYPE, null)

    fun setUgsHistoryTypeFilter(context: Context, type: String?) {
        val editor = prefs(context).edit()
        if (type.isNullOrBlank()) editor.remove(KEY_UGS_HISTORY_TYPE) else editor.putString(KEY_UGS_HISTORY_TYPE, type)
        editor.apply()
    }

    fun getUgsHistoryStatusFilter(context: Context): String? =
        prefs(context).getString(KEY_UGS_HISTORY_STATUS, null)

    fun setUgsHistoryStatusFilter(context: Context, status: String?) {
        val editor = prefs(context).edit()
        if (status.isNullOrBlank()) editor.remove(KEY_UGS_HISTORY_STATUS) else editor.putString(KEY_UGS_HISTORY_STATUS, status)
        editor.apply()
    }

    fun getDesktopHandoffDraft(context: Context): String? =
        prefs(context).getString(KEY_DESKTOP_HANDOFF_DRAFT, null)

    fun getDesktopHandoffExpiresMs(context: Context): Long =
        prefs(context).getLong(KEY_DESKTOP_HANDOFF_EXPIRES, 0L)

    fun saveDesktopHandoffDraft(context: Context, draft: String, expiresEpochMs: Long) {
        prefs(context).edit()
            .putString(KEY_DESKTOP_HANDOFF_DRAFT, draft.trim())
            .putLong(KEY_DESKTOP_HANDOFF_EXPIRES, expiresEpochMs)
            .apply()
    }

    fun clearDesktopHandoffDraft(context: Context) {
        prefs(context).edit().remove(KEY_DESKTOP_HANDOFF_DRAFT).remove(KEY_DESKTOP_HANDOFF_EXPIRES).apply()
    }

    fun isDesktopHandoffActive(context: Context, nowEpochMs: Long = System.currentTimeMillis()): Boolean {
        val draft = getDesktopHandoffDraft(context)?.trim().orEmpty()
        if (draft.isEmpty()) return false
        val expires = getDesktopHandoffExpiresMs(context)
        return expires <= 0L || nowEpochMs < expires
    }

    fun getOtaChangelogSeenVersion(context: Context): String? =
        prefs(context).getString(KEY_OTA_CHANGELOG_SEEN, null)

    fun setOtaChangelogSeenVersion(context: Context, version: String) {
        prefs(context).edit().putString(KEY_OTA_CHANGELOG_SEEN, version.trim()).apply()
    }
    private const val KEY_A11Y_FONT_STRESS = "a11y_font_stress_enabled"
    private const val KEY_I18N_PSEUDO_LOCALE = "i18n_pseudo_locale_debug"
    private const val KEY_PERF_STRICT_MODE = "perf_strict_mode_debug"
    private const val KEY_ANALYTICS_ENABLED = "analytics_enabled"
    private const val KEY_RUNTIME_DIAG_EXPANDED = "runtime_diag_expanded"

    fun isA11yFontStressEnabled(context: Context): Boolean =
        prefs(context).getBoolean(KEY_A11Y_FONT_STRESS, false)

    fun setA11yFontStressEnabled(context: Context, enabled: Boolean) {
        prefs(context).edit().putBoolean(KEY_A11Y_FONT_STRESS, enabled).apply()
    }

    fun isI18nPseudoLocaleDebug(context: Context): Boolean =
        prefs(context).getBoolean(KEY_I18N_PSEUDO_LOCALE, false)

    fun setI18nPseudoLocaleDebug(context: Context, enabled: Boolean) {
        prefs(context).edit().putBoolean(KEY_I18N_PSEUDO_LOCALE, enabled).apply()
    }

    fun isStrictModeDebugEnabled(context: Context): Boolean =
        prefs(context).getBoolean(KEY_PERF_STRICT_MODE, true)

    fun setStrictModeDebugEnabled(context: Context, enabled: Boolean) {
        prefs(context).edit().putBoolean(KEY_PERF_STRICT_MODE, enabled).apply()
    }

    fun isAnalyticsEnabled(context: Context): Boolean =
        prefs(context).getBoolean(KEY_ANALYTICS_ENABLED, true)

    fun setAnalyticsEnabled(context: Context, enabled: Boolean) {
        prefs(context).edit().putBoolean(KEY_ANALYTICS_ENABLED, enabled).apply()
    }

    fun isRuntimeDiagnosticsExpanded(context: Context): Boolean =
        prefs(context).getBoolean(KEY_RUNTIME_DIAG_EXPANDED, false)

    fun setRuntimeDiagnosticsExpanded(context: Context, expanded: Boolean) {
        prefs(context).edit().putBoolean(KEY_RUNTIME_DIAG_EXPANDED, expanded).apply()
    }

}
