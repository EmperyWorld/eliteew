/**
 * Chat upload prep — delegates to shared [prepareMobileImageUploadWebp] in core:ui.
 */
package feature.chat

import android.content.Context
import world.empery.mobile.core.ui.ImageUploadDraft
import world.empery.mobile.core.ui.prepareMobileImageUploadWebp

data class PreparedGafUpload(
    val uri: android.net.Uri,
    val displayName: String,
    val mimeType: String,
    val sizeBytes: Long?,
    val tempFile: java.io.File?,
)

fun prepareGafChatImageUpload(
    context: Context,
    draft: ChatAttachmentDraft,
): PreparedGafUpload {
    val prepared =
        prepareMobileImageUploadWebp(
            context,
            ImageUploadDraft(
                displayName = draft.displayName,
                uri = draft.uri,
                mimeType = draft.mimeType,
                sizeBytes = draft.sizeBytes,
            ),
        )
    return PreparedGafUpload(
        uri = prepared.uri,
        displayName = prepared.displayName,
        mimeType = prepared.mimeType,
        sizeBytes = prepared.sizeBytes,
        tempFile = prepared.tempFile,
    )
}
