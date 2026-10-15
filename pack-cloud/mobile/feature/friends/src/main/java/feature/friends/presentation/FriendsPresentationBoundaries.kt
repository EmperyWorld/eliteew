/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Small app-owned boundaries required by the Friends presentation layer.
 *
 * Invariants:
 * - Boundaries expose no app container, Android Context, auth storage, or telemetry implementation.
 *
 * Related:
 * - FriendsTabViewModel.kt
 * - world.empery.mobile.di.AppContainer
 */
package feature.friends.presentation

fun interface FriendsSessionAccess {
    fun hasSession(): Boolean
}

fun interface FriendsErrorReporter {
    fun report(
        error: Throwable,
        context: String,
    )
}

interface FriendsUiPreferences {
    fun isSocialHubInboxExpanded(): Boolean

    fun setSocialHubInboxExpanded(expanded: Boolean)
}
