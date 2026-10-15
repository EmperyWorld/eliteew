/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Central gate for posting local/FCM-driven notifications (global toggle, category, quiet hours).
 *
 * Invariants:
 * - Calls category always allowed during quiet hours (incoming video calls).
 *
 * Related:
 * - NotificationHelper, MobileNotificationPreferences, MobileFirebaseMessagingService
 */
package world.empery.mobile.push

import android.content.Context
import feature.notifications.MobileNotificationPreferences
import feature.notifications.NotificationPreferenceCategory
import feature.notifications.NotificationPreferencesSnapshot

object NotificationDeliveryGate {
    fun shouldDeliver(
        context: Context,
        category: NotificationPreferenceCategory,
        snapshot: NotificationPreferencesSnapshot = MobileNotificationPreferences.read(context),
    ): Boolean {
        val globalPrefs = context.getSharedPreferences("empery_mobile_ui", Context.MODE_PRIVATE)
        if (!globalPrefs.getBoolean("notifications_enabled", true)) {
            return false
        }
        if (!snapshot.isCategoryEnabled(category)) {
            return false
        }
        if (category != NotificationPreferenceCategory.CHAT && snapshot.isQuietNow()) {
            return false
        }
        return true
    }

    fun shouldDeliverCall(
        context: Context,
        snapshot: NotificationPreferencesSnapshot = MobileNotificationPreferences.read(context),
    ): Boolean {
        val globalPrefs = context.getSharedPreferences("empery_mobile_ui", Context.MODE_PRIVATE)
        if (!globalPrefs.getBoolean("notifications_enabled", true)) {
            return false
        }
        return snapshot.isCategoryEnabled(NotificationPreferenceCategory.CHAT)
    }
}
