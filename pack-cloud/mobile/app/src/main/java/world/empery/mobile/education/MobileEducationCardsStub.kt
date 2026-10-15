/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contextual education card registry (growth-005). Cards dismiss after key actions complete.
 *
 * Invariants:
 * - Card ids are stable strings persisted in MobileFeatureShellPreferences when dismissed.
 * - No blocking modal on cold start; cards are inline hints only.
 *
 * Related:
 * - MobileFeatureShellPreferences.kt, MOBILE-ANDROID-ONBOARDING-CHECKLIST.md
 */
package world.empery.mobile.education

import androidx.annotation.StringRes
import world.empery.mobile.R

enum class MobileEducationCardId {
    PROFILE_COMPLETE,
    NOTIFICATIONS_ENABLE,
    FIRST_FRIEND,
    FIRST_CHAT,
    FIRST_UGS_GENERATION,
}

data class MobileEducationCard(
    val id: MobileEducationCardId,
    @StringRes val titleRes: Int,
    @StringRes val bodyRes: Int,
    @StringRes val actionLabelRes: Int?,
)

object MobileEducationCards {
    val defaultCards: List<MobileEducationCard> =
        listOf(
            MobileEducationCard(
                id = MobileEducationCardId.PROFILE_COMPLETE,
                titleRes = R.string.education_profile_complete_title,
                bodyRes = R.string.education_profile_complete_body,
                actionLabelRes = R.string.education_profile_complete_action,
            ),
            MobileEducationCard(
                id = MobileEducationCardId.NOTIFICATIONS_ENABLE,
                titleRes = R.string.education_notifications_enable_title,
                bodyRes = R.string.education_notifications_enable_body,
                actionLabelRes = R.string.education_notifications_enable_action,
            ),
            MobileEducationCard(
                id = MobileEducationCardId.FIRST_FRIEND,
                titleRes = R.string.education_first_friend_title,
                bodyRes = R.string.education_first_friend_body,
                actionLabelRes = R.string.education_first_friend_action,
            ),
            MobileEducationCard(
                id = MobileEducationCardId.FIRST_CHAT,
                titleRes = R.string.education_first_chat_title,
                bodyRes = R.string.education_first_chat_body,
                actionLabelRes = R.string.education_first_chat_action,
            ),
            MobileEducationCard(
                id = MobileEducationCardId.FIRST_UGS_GENERATION,
                titleRes = R.string.education_first_ugs_generation_title,
                bodyRes = R.string.education_first_ugs_generation_body,
                actionLabelRes = R.string.education_first_ugs_generation_action,
            ),
        )

    fun visibleCards(
        dismissed: Set<MobileEducationCardId>,
        completed: Set<MobileEducationCardId> = emptySet(),
    ): List<MobileEducationCard> =
        defaultCards.filter { card -> card.id !in dismissed && card.id !in completed }
}
