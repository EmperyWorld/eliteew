/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Predictable back-stack rules for bottom tabs vs nested shell routes (UGS hub, friends, chat).
 *
 * Invariants:
 * - Bottom-tab switches use saveState/restoreState except UGS hub — nested UGS screens are not restored.
 * - `notifications` is a bottom tab (W4 U6); deeplink lands on that tab without a nested push.
 * - Deeplink/push intents may still stack nested routes after the tab is selected.
 * - Navigation helpers no-op until NavHost has called setGraph (biometric/login gate has no graph).
 *
 * Related:
 * - MainActivity.kt NavHost, MobileRouteRegistry.kt, MobileShellNavigation.kt
 */
package world.empery.mobile.shell

import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavHostController
import androidx.navigation.NavOptionsBuilder
import world.empery.mobile.FRIENDS_ACTION_CENTER_ROUTE
import world.empery.mobile.ShellNavigationIntent

object MobileBackStackPolicy {
    data class ShellNavigationPlan(
        val bottomTabRoute: String?,
        val nestedRoutes: List<String>,
    )

    /** True after authenticated TabHost NavHost has set its graph. */
    fun isNavGraphReady(navController: NavHostController): Boolean =
        try {
            navController.graph
            true
        } catch (_: IllegalStateException) {
            false
        }

    /** Resolves push/deeplink [ShellNavigationIntent] into bottom-tab + nested NavHost steps. */
    fun planShellNavigation(intent: ShellNavigationIntent): ShellNavigationPlan {
        val tab = intent.tabRoute.trim().lowercase()
        val bottom = MobileRouteRegistry.coerceBottomTabRoute(tab)
        val nested =
            buildList {
                if (bottom == null && MobileRouteRegistry.isKnownShellRoute(tab)) {
                    add(tab)
                }
                intent.nestedRoute?.trim()?.takeIf { it.isNotEmpty() }?.let { add(it) }
            }
        return ShellNavigationPlan(bottomTabRoute = bottom, nestedRoutes = nested)
    }

    fun applyShellNavigationIntent(
        navController: NavHostController,
        intent: ShellNavigationIntent,
    ) {
        if (!isNavGraphReady(navController)) return
        val plan = planShellNavigation(intent)
        plan.bottomTabRoute?.let { navigateBottomTab(navController, it) }
        plan.nestedRoutes.forEach { route -> navigateNested(navController, route) }
    }

    data class BackPressAction(
        val shouldPop: Boolean,
        val fallbackTabRoute: String = MobileRouteRegistry.defaultStartRoute,
    )

    /** UGS hub tab always opens at root composable — not the last nested generator/screen. */
    fun shouldRestoreBottomTabState(tabRoute: String): Boolean =
        MobileRouteRegistry.coerceBottomTabRoute(tabRoute) != RootTab.Ugs.route

    fun applyBottomTabNavigation(
        builder: NavOptionsBuilder,
        navController: NavHostController,
        restoreTabState: Boolean = true,
    ) {
        builder.popUpTo(navController.graph.findStartDestination().id) {
            saveState = true
        }
        builder.launchSingleTop = true
        builder.restoreState = restoreTabState
    }

    fun applyNestedPush(builder: NavOptionsBuilder) {
        builder.launchSingleTop = true
    }

    fun navigateBottomTab(
        navController: NavHostController,
        tabRoute: String,
    ) {
        if (!isNavGraphReady(navController)) return
        val route = MobileRouteRegistry.coerceBottomTabRoute(tabRoute) ?: return
        val restoreTabState = shouldRestoreBottomTabState(route)
        popUgsNestedRoutes(navController)
        navController.navigate(route) {
            applyBottomTabNavigation(
                builder = this,
                navController = navController,
                restoreTabState = restoreTabState,
            )
        }
    }

    /** EW hub actions: always land on UGS root first, then optional nested screen. */
    fun navigateEwHubAi(navController: NavHostController) {
        navigateBottomTab(navController, RootTab.Ugs.route)
    }

    fun navigateEwHubContentLibrary(navController: NavHostController) {
        navigateBottomTab(navController, RootTab.Ugs.route)
        navigateNested(navController, "ugs/content")
    }

    fun navigateNested(
        navController: NavHostController,
        nestedRoute: String,
    ) {
        if (nestedRoute.isBlank() || !isNavGraphReady(navController)) return
        navController.navigate(nestedRoute) {
            applyNestedPush(this)
        }
    }

    /** Pops nested UGS screens until UGS hub is current (or stack leaves UGS subtree). */
    internal fun popUgsNestedRoutes(navController: NavHostController) {
        if (!isNavGraphReady(navController)) return
        val hubRoute = RootTab.Ugs.route
        while (true) {
            val currentRoute = navController.currentBackStackEntry?.destination?.route ?: break
            if (currentRoute == hubRoute) break
            if (!currentRoute.startsWith("ugs")) break
            if (!navController.popBackStack()) break
        }
    }

    fun shouldHideBottomNavigationBar(
        currentRoute: String?,
        chatThreadOpen: Boolean,
    ): Boolean {
        if (currentRoute == null) return false
        if (currentRoute == RootTab.Chat.route && chatThreadOpen) return true
        if (currentRoute.startsWith("ugs/chat")) return true
        if (currentRoute in setOf(
                "ugs/songs",
                "ugs/images",
                "ugs/presentations",
                "ugs/desktop",
                "ugs/content",
                FRIENDS_ACTION_CENTER_ROUTE,
            )
        ) {
            return true
        }
        return false
    }

    fun onBackPressed(currentRoute: String?): BackPressAction {
        if (currentRoute == null) {
            return BackPressAction(shouldPop = false)
        }
        if (MobileRouteRegistry.isBottomTabRoute(currentRoute)) {
            return BackPressAction(shouldPop = false)
        }
        if (MobileRouteRegistry.isKnownShellRoute(currentRoute)) {
            return BackPressAction(shouldPop = true)
        }
        return BackPressAction(shouldPop = true)
    }
}
