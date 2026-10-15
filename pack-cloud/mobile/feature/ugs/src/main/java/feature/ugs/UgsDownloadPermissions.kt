/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Gate UGS downloads behind runtime storage/media permission prompts.
 *
 * Invariants:
 * - Pre-Android 10 blocks save when WRITE_EXTERNAL_STORAGE is missing.
 *
 * Related:
 * - UgsHubRepository, MobilePermissions.kt, MainActivity permission setup
 */
package feature.ugs

import android.content.Context
import android.os.Build
import world.empery.mobile.core.ui.MobilePermissions

fun requestStoragePermissionsIfNeeded(
    context: Context,
    requester: (() -> Unit)?,
): Boolean {
    val missingStorage = MobilePermissions.missingStoragePermissions(context)
    if (missingStorage.isNotEmpty()) {
        requester?.invoke()
    }
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q &&
        !MobilePermissions.canSaveToPublicDownloads(context)
    ) {
        if (missingStorage.isEmpty()) {
            requester?.invoke()
        }
        return false
    }
    return true
}
