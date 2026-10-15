/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Cold-restart the mobile app process after connection-mode or trusted-device changes.
 *
 * Invariants:
 * - Clears the activity task stack before relaunching the launcher intent.
 * - Callers that mutated SharedPreferences must use commit() before invoking restart —
 *   exitProcess will drop pending apply() writes and can restart-loop clear/unbind.
 *
 * Related:
 * - ProfileTabViewModel, MobileConnectionModeStore
 */
package world.empery.mobile

import android.content.Context
import android.content.Intent
import android.util.Log
import kotlin.system.exitProcess

object MobileAppRestart {
    private const val TAG = "MobileAppRestart"

    fun restart(context: Context) {
        val appContext = context.applicationContext
        val launchIntent =
            appContext.packageManager.getLaunchIntentForPackage(appContext.packageName)
                ?: return
        launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
        Log.i(TAG, "cold restart: launching then exitProcess")
        appContext.startActivity(launchIntent)
        exitProcess(0)
    }
}
