/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * GAF Chat REST repository: messages, attachments, local flags/drafts, video call join API.
 *
 * Invariants:
 * - Attachment disk cache lives under app files dir, cleared on logout.
 * - Parsed `.meta.json` fields tolerate null/blank from Gson or legacy cache files.
 *
 * Related:
 * - ChatFeature.kt, RealtimeChatBridge, GafChatApi
 */
package feature.chat

import android.content.Context
import android.net.Uri
import androidx.core.content.FileProvider
import com.google.gson.Gson
import com.google.gson.JsonElement
import java.io.File
import java.util.Locale
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody
import okio.BufferedSink
import okio.source
import retrofit2.HttpException
import world.empery.mobile.core.network.api.GafByUsernameBody
import world.empery.mobile.core.network.api.GafChatApi
import world.empery.mobile.core.network.api.GafChatMeDto
import world.empery.mobile.core.network.api.GafEditMessageBody
import world.empery.mobile.core.network.api.GafE2eeConsentStatusDto
import world.empery.mobile.core.network.api.GafMarkReadBody
import world.empery.mobile.core.network.api.GafMessageDto
import world.empery.mobile.core.network.api.GafSendMessageBody
import world.empery.mobile.core.network.api.GafUserSearchItemDto
import world.empery.mobile.core.network.api.UnifiedContentApi
import world.empery.mobile.core.network.api.GroupGafVideoCallCreateRequestDto
import world.empery.mobile.core.network.api.VideoCallJoinResponseDto
import world.empery.mobile.core.network.api.VideoCallsApi
import world.empery.mobile.core.storage.ChatEntity
import world.empery.mobile.core.storage.ChatMessageEntity
import world.empery.mobile.core.storage.MobileDatabase
import world.empery.mobile.core.storage.PendingSendEntity

private const val GAF_ATTACHMENT_CACHE_DIR = "gaf_attachment_cache"

private data class AttachmentDiskMeta(
    val mimeType: String? = null,
    val fileName: String? = null,
)

internal fun normalizeAttachmentDiskMeta(
    mimeType: String?,
    fileName: String?,
): Pair<String, String> {
    val mime = mimeType.orEmpty().ifBlank { "application/octet-stream" }
    val name = fileName.orEmpty().ifBlank { "attachment" }
    return mime to name
}

class ChatRepository(
    private val api: GafChatApi,
    private val videoCallsApi: VideoCallsApi,
    private val contentApi: UnifiedContentApi,
    private val appContext: Context,
    private val db: MobileDatabase,
    private val localSettingsStore: ChatLocalSettingsStore,
) {
    private val gson = Gson()
    private val e2eeCoordinator = GafChatE2eeCoordinator(appContext, api)

    private val emptyJsonBody: Map<String, String> = emptyMap()

    private fun encryptedPlaceholder(): String = appContext.getString(R.string.chat_e2ee_unsupported_message)

    /** Каталог на [Context.getFilesDir]: не в галерее и не доступен другим приложениям. */
    private fun attachmentCacheRoot(): File = File(appContext.filesDir, GAF_ATTACHMENT_CACHE_DIR)

    private fun sanitizePathSegment(id: String): String =
        id.replace(Regex("[^a-zA-Z0-9._-]"), "_").take(200).ifBlank { "id" }

    private fun attachmentPayloadFile(chatId: String, messageId: String): File =
        File(attachmentCacheRoot(), "${sanitizePathSegment(chatId)}/${sanitizePathSegment(messageId)}")

    private fun attachmentMetaFile(chatId: String, messageId: String): File =
        File(
            attachmentCacheRoot(),
            "${sanitizePathSegment(chatId)}/${sanitizePathSegment(messageId)}.meta.json",
        )

    private fun readCachedDownload(
        chatId: String,
        messageId: String,
    ): DownloadedChatAttachment? {
        val payload = attachmentPayloadFile(chatId, messageId)
        val metaFile = attachmentMetaFile(chatId, messageId)
        if (!payload.isFile || payload.length() == 0L || !metaFile.isFile) return null
        val meta =
            runCatching {
                gson.fromJson(metaFile.readText(), AttachmentDiskMeta::class.java)
            }.getOrNull() ?: return null
        val (mime, fileName) = normalizeAttachmentDiskMeta(meta.mimeType, meta.fileName)
        val fileUri = FileProvider.getUriForFile(
            appContext,
            "${appContext.packageName}.fileprovider",
            payload,
        )
        return DownloadedChatAttachment(
            uri = fileUri,
            mimeType = mime,
            fileName = fileName,
            absolutePath = payload.absolutePath,
        )
    }

    /**
     * Восстановить URI превью из локального кэша без сети при открытии чата.
     */
    fun attachmentPreviewUrisFromDiskCache(
        chatId: String,
        messages: List<ChatMessageUi>,
    ): Map<String, String> {
        val out = linkedMapOf<String, String>()
        for (msg in messages) {
            if (msg.isDeleted) continue
            if (msg.id.startsWith("pending-") || msg.id.startsWith("socket-")) continue
            if (msg.attachmentContentId.isNullOrBlank()) continue
            if (!isImageAttachmentForPreview(
                    msg.attachmentContentId,
                    msg.attachmentMimeType,
                    msg.attachmentName,
                )
            ) {
                continue
            }
            val dl = readCachedDownload(chatId, msg.id) ?: continue
            out[msg.id] = dl.absolutePath
        }
        return out
    }

    /** Очистка при выходе из аккаунта. */
    fun clearAttachmentDiskCache() {
        runCatching {
            attachmentCacheRoot().deleteRecursively()
        }
    }

    suspend fun createGafVideoCall(chatId: String): VideoCallJoinResponseDto =
        videoCallsApi.createGafVideoCall(chatId, emptyJsonBody)

    suspend fun createGafGroupVideoCall(
        chatId: String,
        additionalParticipantIds: List<String>,
    ): VideoCallJoinResponseDto =
        videoCallsApi.createGafGroupVideoCall(
            chatId,
            GroupGafVideoCallCreateRequestDto(additional_participant_ids = additionalParticipantIds),
        )

    suspend fun joinGafVideoCall(callId: String): VideoCallJoinResponseDto =
        videoCallsApi.joinVideoCall(callId, emptyJsonBody)

    suspend fun endGafVideoCall(callId: String) {
        videoCallsApi.endVideoCall(callId, emptyJsonBody)
    }

    suspend fun loadChatListFromCache(): List<ChatEntity> = db.chatDao().getAll()
    suspend fun loadMessageCache(chatId: String): List<ChatMessageUi> = db.chatMessageDao()
        .getByChat(chatId)
        .map { it.toUi() }

    fun rememberChatE2eeStatusFromSocket(chatId: String, status: String?) {
        e2eeCoordinator.rememberChatE2eeStatus(chatId, status)
    }

    suspend fun fetchE2eeConsentStatus(chatId: String): GafE2eeConsentStatusDto =
        api.getE2eeStatus(chatId)

    suspend fun proposeE2ee(chatId: String): GafE2eeConsentStatusDto {
        val result = api.proposeE2ee(chatId)
        e2eeCoordinator.rememberChatE2eeStatus(chatId, result.status)
        return result
    }

    suspend fun acceptE2ee(chatId: String): GafE2eeConsentStatusDto {
        val result = api.acceptE2ee(chatId)
        e2eeCoordinator.rememberChatE2eeStatus(
            chatId,
            if (result.status == "active" && result.ready) "active" else result.status,
        )
        return result
    }

    suspend fun declineE2ee(chatId: String): GafE2eeConsentStatusDto {
        val result = api.declineE2ee(chatId)
        e2eeCoordinator.rememberChatE2eeStatus(chatId, result.status)
        return result
    }

    suspend fun disableE2ee(chatId: String): GafE2eeConsentStatusDto {
        val result = api.disableE2ee(chatId)
        e2eeCoordinator.rememberChatE2eeStatus(chatId, "off")
        return result
    }

    suspend fun refreshChatList(): List<ChatEntity> {
        val liteItems = api.getChatsLite()
        val remote =
            liteItems.map {
                e2eeCoordinator.rememberChatE2eeStatus(it.chat_id, it.e2ee_status)
                ChatEntity(
                    chatId = it.chat_id,
                    unreadCount = it.unread_count ?: 0,
                    lastMessagePreview = it.last_message_preview,
                    partnerLastReadMessageId = it.partner_last_read_message_id,
                    partnerId = it.partner.id,
                    partnerName =
                        it.partner.full_name
                            ?: it.partner.username
                            ?: appContext.getString(R.string.chat_partner_unknown),
                    partnerAvatarUrl = it.partner.avatar_url,
                    isSystemAccount =
                        resolveChatPartnerIsSystemAccount(
                            isSystemAccount = it.partner.is_system_account,
                            username = it.partner.username,
                        ),
                    lastMessageAt = it.last_message_at,
                )
            }
        val existingPartnerMeta = localSettingsStore.loadPartnerMeta()
        val partnerMeta =
            liteItems.associate { item ->
                item.chat_id to
                    mergeGafChatListPartnerMeta(
                        existing = existingPartnerMeta[item.chat_id],
                        incoming = mapLitePartnerToListMeta(item.partner),
                    )
            }
        localSettingsStore.savePartnerMeta(partnerMeta)
        db.chatDao().upsertAll(remote)
        return remote
    }

    fun loadListPartnerMeta(): Map<String, GafChatListPartnerMeta> = localSettingsStore.loadPartnerMeta()

    suspend fun getCurrentUserId(): String? = runCatching<GafChatMeDto> {
        api.getMe()
    }.getOrNull()?.user_id

    suspend fun ensureGafE2eeWireIdentity(): Boolean = e2eeCoordinator.ensureWireIdentityReady()

    suspend fun loadMessages(chatId: String): List<ChatMessageUi> {
        val dtos = api.getMessages(chatId = chatId)
        return mapMessageDtos(chatId, dtos).sortedOldestFirstForChat()
    }

    suspend fun loadMessagesPage(
        chatId: String,
        limit: Int = 50,
        beforeMessageId: String? = null,
    ): List<ChatMessageUi> {
        val dtos =
            api.getMessages(
                chatId = chatId,
                limit = limit,
                beforeMessageId = beforeMessageId,
            )
        return mapMessageDtos(chatId, dtos)
    }

    private suspend fun mapMessageDtos(
        chatId: String,
        dtos: List<GafMessageDto>,
    ): List<ChatMessageUi> {
        val placeholder = encryptedPlaceholder()
        val myUserId = getCurrentUserId()
        val decryptedBodies =
            e2eeCoordinator.resolveEncryptedBodies(chatId, dtos, placeholder, myUserId)
        return dtos.mapNotNull { dto ->
            val isE2ee = dto.algorithm?.startsWith("e2e_") == true
            val body =
                if (isE2ee) {
                    decryptedBodies[dto.id] ?: placeholder
                } else {
                    dto.body.trim()
                }
            val hasAttachment =
                hasRenderableChatAttachment(
                    dto.attachment_content_id,
                    dto.attachment_mime_type,
                    dto.attachment_name,
                    dto.attachment_size,
                )
            val isDeleted = dto.deleted_for_sender == true || dto.deleted_for_recipient == true
            val hasMetadata = gafDtoHasVisibleMetadata(dto.metadata)
            if (body.isBlank() && !hasAttachment && !isDeleted && !hasMetadata) return@mapNotNull null
            dto.toUi(bodyOverride = body)
        }
    }

    suspend fun socketMessageToUi(
        chatId: String,
        payload: GafChatMessageNewPayload,
    ): ChatMessageUi {
        val placeholder = encryptedPlaceholder()
        val myUserId = getCurrentUserId()
        val isE2ee = payload.algorithm?.startsWith("e2e_") == true
        val body =
            if (isE2ee) {
                e2eeCoordinator.decryptSocketMessage(
                    chatId = chatId,
                    senderId = payload.senderId,
                    myUserId = myUserId,
                    algorithm = payload.algorithm,
                    bodyCiphertext = payload.bodyCiphertext,
                    nonce = payload.nonce,
                    encryptedPlaceholder = placeholder,
                    e2eeSessionKeyEnvelope = payload.e2eeSessionKeyEnvelope,
                )
            } else {
                payload.body
            }
        val resolvedMime = resolveChatAttachmentMimeType(payload.attachmentMimeType, payload.attachmentName)
        return ChatMessageUi(
            id = payload.messageId,
            senderId = payload.senderId,
            body = body,
            createdAt = payload.createdAt,
            attachmentContentId = sanitizeGafAttachmentContentId(payload.attachmentContentId),
            attachmentName = sanitizeGafOptionalString(payload.attachmentName),
            attachmentMimeType = resolvedMime,
            attachmentSize = payload.attachmentSize,
            replyToMessageId = payload.replyToMessageId,
            isE2ee = isE2ee,
            metadataJson = payload.metadataJson,
            systemPresentation = resolveGafMessageSystemPresentation(payload.metadataJson, body),
        )
    }

    suspend fun replaceMessageCache(chatId: String, messages: List<ChatMessageUi>) {
        val dao = db.chatMessageDao()
        dao.deleteByChat(chatId)
        val entities = messages.map { msg ->
            ChatMessageEntity(
                id = msg.id,
                chatId = chatId,
                senderId = msg.senderId,
                body = msg.body,
                createdAt = msg.createdAt,
                attachmentContentId = msg.attachmentContentId,
                attachmentName = msg.attachmentName,
                attachmentMimeType = msg.attachmentMimeType,
                attachmentSize = msg.attachmentSize,
                editedAt = msg.editedAt,
                replyToMessageId = msg.replyToMessageId,
                deletedForSender = msg.isDeleted,
                deletedForRecipient = false,
                metadataJson = msg.metadataJson,
            )
        }
        dao.upsertAll(entities)
    }

    suspend fun loadPendingSends(chatId: String): List<PendingSendEntity> = db.pendingSendDao().getByChat(chatId)

    suspend fun savePendingSend(entity: PendingSendEntity) {
        db.pendingSendDao().upsert(entity)
    }

    suspend fun deletePendingSend(id: String) {
        db.pendingSendDao().deleteById(id)
    }

    suspend fun deletePendingSendsByChat(chatId: String) {
        db.pendingSendDao().deleteByChat(chatId)
    }

    suspend fun sendMessage(
        chatId: String,
        message: String,
        attachmentContentId: String? = null,
        replyToMessageId: String? = null,
        partnerUserId: String? = null,
    ): ChatMessageUi {
        if (replyToMessageId != null && e2eeCoordinator.isChatE2eeActive(chatId)) {
            throw IllegalStateException(appContext.getString(R.string.chat_e2ee_reply_blocked))
        }
        val sent =
            if (e2eeCoordinator.isChatE2eeActive(chatId)) {
                val partnerId =
                    partnerUserId?.trim()?.ifBlank { null }
                        ?: db.chatDao().getAll().find { it.chatId == chatId }?.partnerId
                        ?: throw IllegalStateException("partner id required for E2EE send")
                val dto =
                    e2eeCoordinator.sendEncryptedMessage(
                        chatId = chatId,
                        plaintext = message,
                        partnerUserId = partnerId,
                        attachmentContentId = attachmentContentId,
                    )
                dto
            } else {
                api.sendMessage(
                    chatId,
                    GafSendMessageBody(
                        body = message.takeIf { it.isNotBlank() },
                        attachment_content_id = attachmentContentId,
                        reply_to_message_id = replyToMessageId,
                    ),
                )
            }
        val placeholder = encryptedPlaceholder()
        val myUserId = getCurrentUserId()
        val body =
            if (sent.algorithm?.startsWith("e2e_") == true) {
                e2eeCoordinator.resolveEncryptedBodies(
                    chatId,
                    listOf(sent),
                    placeholder,
                    myUserId,
                )[sent.id]
                    ?: message
            } else {
                sent.body.trim()
            }
        return sent.toUi(bodyOverride = body)
    }

    suspend fun editMessage(
        chatId: String,
        messageId: String,
        body: String,
    ): ChatMessageUi {
        return api.editMessage(
            chatId = chatId,
            messageId = messageId,
            body = GafEditMessageBody(body = body),
        ).toUi()
    }

    suspend fun deleteMessage(
        chatId: String,
        messageId: String,
        forMeOnly: Boolean = false,
    ) {
        api.deleteMessage(chatId = chatId, messageId = messageId, forMeOnly = forMeOnly)
    }

    suspend fun clearChatHistory(chatId: String) {
        api.clearChatHistory(chatId)
        db.chatMessageDao().deleteByChat(chatId)
        db.pendingSendDao().deleteByChat(chatId)
    }

    suspend fun archiveChat(chatId: String) {
        api.archiveChat(chatId)
    }

    suspend fun deleteChat(chatId: String) {
        api.deleteChat(chatId)
        db.chatMessageDao().deleteByChat(chatId)
        db.pendingSendDao().deleteByChat(chatId)
    }

    suspend fun searchUsers(query: String, limit: Int = 20): List<ChatUserSearchUi> {
        if (query.isBlank()) return emptyList()
        return api.searchUsers(query = query.trim(), limit = limit)
            .map { dto -> dto.toUi() }
    }

    suspend fun getOrCreateChatByUsername(username: String): String {
        return api.getOrCreateChatByUsername(
            GafByUsernameBody(username = username.trim()),
        ).chat_id
    }

    suspend fun uploadAttachment(attachment: ChatAttachmentDraft): UploadedChatAttachment {
        val prepared = prepareGafChatImageUpload(appContext, attachment)
        try {
            val uri = prepared.uri
            val contentResolver = appContext.contentResolver
            val contentLength =
                prepared.sizeBytes ?: runCatching {
                    contentResolver.openFileDescriptor(uri, "r")?.use { fd ->
                        fd.statSize.takeIf { it > 0 }
                    }
                }.getOrNull()
            val requestBody = ContentUriRequestBody(
                contentResolver = contentResolver,
                uri = uri,
                mimeType = prepared.mimeType,
                knownLength = contentLength,
                streamOpenError = appContext.getString(R.string.chat_upload_stream_failed),
            )
            val multipartPart = MultipartBody.Part.createFormData(
                "file",
                prepared.displayName,
                requestBody,
            )
            val created = contentApi.uploadContent(
                file = multipartPart,
                name = prepared.displayName,
                folderItemId = null,
            )
            return UploadedChatAttachment(
                contentId = created.id,
                fileName = created.name ?: prepared.displayName,
                mimeType = created.mime_type ?: prepared.mimeType,
                sizeBytes = prepared.sizeBytes ?: contentLength,
            )
        } finally {
            prepared.tempFile?.delete()
        }
    }

    suspend fun downloadAttachment(
        chatId: String,
        messageId: String,
        fileNameHint: String?,
        /**
         * POST accept-attachment разрешён только получателю (см. GafChatService.accept_attachment).
         * Для своих исходящих вложений повторный GET после accept даёт 400 «Только получатель…» и бесконечные попытки.
         */
        allowRecipientAcceptFallback: Boolean = true,
    ): DownloadedChatAttachment {
        readCachedDownload(chatId, messageId)?.let { return it }

        val body = try {
            api.downloadAttachment(chatId = chatId, messageId = messageId)
        } catch (err: Throwable) {
            // Retrofit HttpException.message часто "Bad Request", а не "HTTP 400" — иначе accept-attachment не вызывается.
            val httpCode = (err as? HttpException)?.code()
            val requiresAcceptFallback =
                httpCode != null && httpCode in setOf(400, 403, 409) ||
                    run {
                        val t = err.message.orEmpty()
                        t.contains("HTTP 400", ignoreCase = true) ||
                            t.contains("HTTP 403", ignoreCase = true) ||
                            t.contains("HTTP 409", ignoreCase = true)
                    }
            if (requiresAcceptFallback && allowRecipientAcceptFallback) {
                runCatching {
                    api.acceptAttachment(chatId = chatId, messageId = messageId)
                }
                api.downloadAttachment(chatId = chatId, messageId = messageId)
            } else {
                throw err
            }
        }
        val mimeType = body.contentType()?.toString() ?: "application/octet-stream"
        val extension = extensionForMimeType(mimeType)
        val baseName = sanitizeAttachmentName(fileNameHint)
        val resolvedName = if (baseName.contains('.') || extension.isBlank()) {
            baseName
        } else {
            "$baseName$extension"
        }
        val payloadFile = attachmentPayloadFile(chatId, messageId)
        val metaFile = attachmentMetaFile(chatId, messageId)
        payloadFile.parentFile?.mkdirs()
        val tmpFile = File(payloadFile.parentFile, "${sanitizePathSegment(messageId)}.download.tmp")
        runCatching { tmpFile.delete() }
        body.use { responseBody ->
            responseBody.byteStream().use { input ->
                tmpFile.outputStream().use { output ->
                    input.copyTo(output)
                }
            }
        }
        if (payloadFile.exists() && !payloadFile.delete()) {
            throw IllegalStateException(appContext.getString(R.string.chat_attachment_cache_replace_failed))
        }
        if (!tmpFile.renameTo(payloadFile)) {
            tmpFile.copyTo(payloadFile, overwrite = true)
        }
        runCatching { tmpFile.delete() }
        metaFile.writeText(gson.toJson(AttachmentDiskMeta(mimeType = mimeType, fileName = resolvedName)))
        val fileUri = FileProvider.getUriForFile(
            appContext,
            "${appContext.packageName}.fileprovider",
            payloadFile,
        )
        return DownloadedChatAttachment(
            uri = fileUri,
            mimeType = mimeType,
            fileName = resolvedName,
            absolutePath = payloadFile.absolutePath,
        )
    }


    /** Localized one-line summary inserted into chat after a GAF Meet session ends. */
    fun formatPostCallSummaryBody(partnerName: String?, durationSeconds: Long?): String {
        val partner = partnerName?.trim().orEmpty().ifBlank {
            appContext.getString(R.string.chat_partner_unknown)
        }
        val duration = durationSeconds?.takeIf { it > 0 }
        return if (duration != null) {
            val minutes = (duration + 59) / 60
            appContext.getString(R.string.chat_post_call_summary_with_duration, partner, minutes)
        } else {
            appContext.getString(R.string.chat_post_call_summary, partner)
        }
    }

    suspend fun markRead(chatId: String, upToMessageId: String?) {
        api.markRead(chatId, GafMarkReadBody(up_to_message_id = upToMessageId))
    }

    fun loadLocalFlags(): Map<String, ChatLocalFlags> = localSettingsStore.load()
    fun loadDrafts(): Map<String, String> = localSettingsStore.loadDrafts()
    fun saveDraft(chatId: String, draft: String) = localSettingsStore.saveDraft(chatId, draft)

    fun updateLocalFlags(
        chatId: String,
        update: (ChatLocalFlags) -> ChatLocalFlags,
    ): Map<String, ChatLocalFlags> {
        val current = localSettingsStore.load().toMutableMap()
        val next = update(current[chatId] ?: ChatLocalFlags())
        if (next == ChatLocalFlags()) {
            current.remove(chatId)
        } else {
            current[chatId] = next
        }
        localSettingsStore.save(current)
        return current
    }

    private fun GafMessageDto.toUi(bodyOverride: String? = null): ChatMessageUi {
        val isE2ee = algorithm?.startsWith("e2e_") == true
        val resolvedMime =
            attachment_mime_type?.takeIf { it.isNotBlank() }
                ?: inferImageMimeTypeFromFileName(attachment_name)
        val metadataJson = gafMessageMetadataToJsonString(metadata)
        val resolvedBody =
            bodyOverride ?: if (isE2ee) {
                encryptedPlaceholder()
            } else {
                body.trim()
            }
        return ChatMessageUi(
            id = id,
            senderId = sender_id,
            body = resolvedBody,
            createdAt = created_at,
            attachmentContentId = sanitizeGafAttachmentContentId(attachment_content_id),
            attachmentName = sanitizeGafOptionalString(attachment_name),
            attachmentMimeType = resolvedMime,
            attachmentSize = attachment_size,
            editedAt = edited_at,
            replyToMessageId = reply_to_message_id,
            isDeleted = deleted_for_sender == true || deleted_for_recipient == true,
            isPending = false,
            isE2ee = isE2ee,
            metadataJson = metadataJson,
            systemPresentation = resolveGafMessageSystemPresentation(metadataJson, resolvedBody),
        )
    }

    private fun ChatMessageEntity.toUi(): ChatMessageUi {
        val resolvedMime =
            attachmentMimeType?.takeIf { it.isNotBlank() }
                ?: inferImageMimeTypeFromFileName(attachmentName)
        return ChatMessageUi(
            id = id,
            senderId = senderId,
            body = body,
            createdAt = createdAt,
            attachmentContentId = attachmentContentId,
            attachmentName = attachmentName,
            attachmentMimeType = resolvedMime,
            attachmentSize = attachmentSize,
            editedAt = editedAt,
            replyToMessageId = replyToMessageId,
            isDeleted = deletedForSender || deletedForRecipient,
            metadataJson = metadataJson,
            systemPresentation = resolveGafMessageSystemPresentation(metadataJson, body),
        )
    }

    private fun GafUserSearchItemDto.toUi(): ChatUserSearchUi {
        val normalizedUsername = username?.trim().orEmpty()
        val display = display_name?.trim().orEmpty()
            .ifBlank { full_name?.trim().orEmpty() }
            .ifBlank { normalizedUsername }
            .ifBlank { appContext.getString(R.string.chat_partner_unknown) }
        return ChatUserSearchUi(
            id = id,
            username = normalizedUsername,
            displayName = display,
            avatarUrl = avatar_url,
        )
    }

    private fun sanitizeAttachmentName(name: String?): String {
        if (name.isNullOrBlank()) return "attachment"
        val cleaned = name.replace(Regex("[^A-Za-z0-9._-]"), "_")
        return cleaned.ifBlank { "attachment" }
    }

    private fun extensionForMimeType(mimeType: String): String {
        val subtype = mimeType.substringAfter('/', "").substringBefore(';').trim().lowercase(Locale.ROOT)
        if (subtype.isBlank()) return ""
        val safeSubtype = subtype.replace(Regex("[^a-z0-9._-]"), "")
        if (safeSubtype.isBlank()) return ""
        return ".$safeSubtype"
    }
}

private fun gafDtoHasVisibleMetadata(metadata: JsonElement?): Boolean {
    if (metadata == null || metadata.isJsonNull) return false
    if (metadata.isJsonObject) return metadata.asJsonObject.size() > 0
    if (metadata.isJsonArray) return metadata.asJsonArray.size() > 0
    return true
}

private class ContentUriRequestBody(
    private val contentResolver: android.content.ContentResolver,
    private val uri: Uri,
    private val mimeType: String,
    private val knownLength: Long?,
    private val streamOpenError: String,
) : RequestBody() {
    override fun contentType() = mimeType.toMediaTypeOrNull()

    override fun contentLength(): Long = knownLength ?: -1L

    override fun writeTo(sink: BufferedSink) {
        contentResolver.openInputStream(uri)?.use { input ->
            sink.writeAll(input.source())
        } ?: throw IllegalStateException(streamOpenError)
    }
}
