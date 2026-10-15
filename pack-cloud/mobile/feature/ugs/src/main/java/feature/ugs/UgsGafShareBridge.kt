/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * ugs-015: bridge UGS generated output to GAF Chat share/attachment intent payload.
 *
 * Invariants:
 * - Share payload contains content id and mime only; no auth tokens.
 *
 * Related:
 * - UgsHubRepository, ChatFeature attachment flow
 */
package feature.ugs

import android.content.Context
import android.content.Intent

data class UgsGafSharePayload(
    val contentId: String,
    val mimeType: String,
    val title: String,
    val localUri: String? = null,
)

internal fun buildUgsGafShareIntent(context: Context, payload: UgsGafSharePayload): Intent =
    Intent(Intent.ACTION_SEND).apply {
        type = payload.mimeType
        putExtra(Intent.EXTRA_SUBJECT, payload.title)
        putExtra(Intent.EXTRA_TEXT, payload.title)
        putExtra("empery.ugs.content_id", payload.contentId)
        payload.localUri?.let { putExtra(Intent.EXTRA_STREAM, android.net.Uri.parse(it)) }
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    }
