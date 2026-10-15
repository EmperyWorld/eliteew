/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Observable Socket.IO connection lifecycle for profile diagnostics.
 *
 * Invariants:
 * - Values reflect client-side transport state only.
 *
 * Related:
 * - RealtimeChatBridge, MainViewModel, ProfileScreen
 */
package world.empery.mobile.core.network

enum class SocketLifecycleState {
    Disconnected,
    Connecting,
    Connected,
    Reconnecting,
    Error,
}
