/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Coordinates post-OTA session refresh with UI: tab loads await reconcile without blocking Application.onCreate.
 *
 * Invariants:
 * - When no upgrade reconcile is scheduled, [awaitIfScheduled] returns immediately.
 * - [onUpgradeReconcileFinished] always runs after [onUpgradeReconcileScheduled] (including timeout/cancel paths).
 *
 * Related:
 * - MobileAppUpgradeCoordinator, MainViewModel, MainActivity
 */
package world.empery.mobile.upgrade

import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.withTimeout

object MobileUpgradeSessionGate {
    private val lock = Any()

    @Volatile
    private var reconcilePending = false

    private var reconcileDone: CompletableDeferred<Unit>? = null

    fun onUpgradeReconcileScheduled() {
        synchronized(lock) {
            reconcilePending = true
            if (reconcileDone == null || reconcileDone?.isCompleted == true) {
                reconcileDone = CompletableDeferred()
            }
        }
    }

    fun onUpgradeReconcileFinished() {
        synchronized(lock) {
            reconcilePending = false
            reconcileDone?.complete(Unit)
            reconcileDone = null
        }
    }

    /** No-op when no post-upgrade reconcile is in flight. */
    suspend fun awaitIfScheduled(timeoutMs: Long = 15_000L) {
        val deferred =
            synchronized(lock) {
                if (!reconcilePending) return
                reconcileDone
            } ?: return
        try {
            withTimeout(timeoutMs) {
                deferred.await()
            }
        } catch (_: TimeoutCancellationException) {
            onUpgradeReconcileFinished()
        }
    }
}
