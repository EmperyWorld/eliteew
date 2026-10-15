/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shell-level tab error aggregation and snackbar surfacing for authenticated tabs.
 *
 * Invariants:
 * - First non-blank tab error wins; deduplicated against the last shown snackbar message.
 * - Display-only; tab ViewModels own error strings and clearing.
 *
 * Related:
 * - MainActivity.kt, MOBILE-ANDROID-ERROR-TAXONOMY.md
 */
package world.empery.mobile.shell

import androidx.compose.material3.SnackbarHostState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.MutableState

/** Returns the first non-blank tab error message, or null when all tabs are healthy. */
fun resolveFirstShellTabError(vararg errors: String?): String? =
    errors.firstOrNull { !it.isNullOrBlank() }

@Composable
fun MobileShellTabErrorSnackbarEffect(
    tabError: String?,
    snackbarHostState: SnackbarHostState,
    lastSnackbarMessage: MutableState<String?>,
) {
    LaunchedEffect(tabError) {
        val message = tabError ?: return@LaunchedEffect
        if (message != lastSnackbarMessage.value) {
            lastSnackbarMessage.value = message
            snackbarHostState.showSnackbar(message)
        }
    }
}
