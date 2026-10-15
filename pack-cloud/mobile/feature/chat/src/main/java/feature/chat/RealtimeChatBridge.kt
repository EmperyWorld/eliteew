/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Socket.IO client for GAF chat realtime events with observable lifecycle state.
 *
 * Invariants:
 * - User callbacks invoked outside internal locks; errors redacted before delivery.
 *
 * Related:
 * - MainViewModel.connectRealtimeIfAllowed, SocketLifecycleState
 */
package feature.chat

import io.socket.client.IO
import io.socket.client.Socket
import world.empery.mobile.core.network.SocketLifecycleState
import org.json.JSONObject

/**
 * Socket.IO client for GAF chat real-time events.
 *
 * **Reconnection:** Engine uses exponential backoff between [RECONNECT_DELAY_MS] and
 * [RECONNECT_DELAY_MAX_MS] with [RECONNECT_RANDOMIZATION] jitter (see [IO.Options]). The max cap
 * keeps reconnect storms bounded during long outages. Initial engine handshake uses
 * [CONNECT_TIMEOUT_MS].
 *
 * **Threading:** Public methods are thread-safe. Socket callbacks may run on the client’s
 * worker threads; user lambdas are invoked **outside** internal locks—keep UI updates on the main
 * thread inside those lambdas if needed.
 *
 * **Lifecycle:** [release] is idempotent and must be called when the bridge is no longer needed so
 * listeners and callbacks are cleared (avoids retaining user code after teardown). [disconnect] is
 * idempotent and skips work after [release]. Event handlers no-op once [release] has started.
 *
 * **Errors:** [onConnectionError] receives throwables whose messages are redacted (Bearer/JWT-like
 * segments) so logs or toasts do not echo auth material from server payloads.
 */

/** Canonical Socket.IO event names and payload keys for GAF chat (contract tests). */
object GafChatSocketEvents {
    const val MESSAGE_NEW = "gaf_chat.message_new"
    const val MESSAGE_READ = "gaf_chat.message_read"
    const val MESSAGE_EDITED = "gaf_chat.message_edited"
    const val MESSAGE_DELETED = "gaf_chat.message_deleted"
    const val CHAT_CREATED = "gaf_chat.chat_created"
    const val E2EE_CONSENT_CHANGED = "gaf_chat.e2ee_consent_changed"
    const val VIDEO_CALL_INCOMING = "video_call.incoming"
    const val VIDEO_CALL_ACCEPTED = "video_call.accepted"
    const val VIDEO_CALL_ENDED = "video_call.ended"
}

object GafChatPayloadKeys {
    const val CHAT_ID = "chat_id"
    const val CHAT_ID_CAMEL = "chatId"
    const val MESSAGE_ID = "message_id"
    const val MESSAGE_ID_CAMEL = "messageId"
    const val ID = "id"
    const val BODY = "body"
    const val SENDER_ID = "sender_id"
    const val SENDER_ID_CAMEL = "senderId"
    const val CREATED_AT = "created_at"
    const val CREATED_AT_CAMEL = "createdAt"
    const val ATTACHMENT_CONTENT_ID = "attachment_content_id"
    const val ATTACHMENT_CONTENT_ID_CAMEL = "attachmentContentId"
    const val ATTACHMENT_NAME = "attachment_name"
    const val ATTACHMENT_NAME_CAMEL = "attachmentName"
    const val ATTACHMENT_MIME = "attachment_mime_type"
    const val ATTACHMENT_MIME_CAMEL = "attachmentMimeType"
    const val ATTACHMENT_SIZE = "attachment_size"
    const val REPLY_TO = "reply_to_message_id"
    const val REPLY_TO_CAMEL = "replyToMessageId"
    const val METADATA = "metadata"
    const val ALGORITHM = "algorithm"
    const val BODY_CIPHERTEXT = "body_ciphertext"
    const val NONCE = "nonce"
    const val E2EE_SESSION_KEY_ENVELOPE = "e2ee_session_key_envelope"
    const val E2EE_STATUS = "status"
    const val E2EE_SUSPEND_REASON = "suspend_reason"
    const val UP_TO_MESSAGE_ID = "up_to_message_id"
    const val UP_TO_MESSAGE_ID_CAMEL = "upToMessageId"
    const val CALL_ID = "call_id"
    const val CALL_ID_CAMEL = "callId"
}

data class GafChatMessageNewPayload(
    val chatId: String,
    val messageId: String,
    val body: String,
    val senderId: String?,
    val createdAt: String?,
    val attachmentContentId: String?,
    val attachmentName: String?,
    val attachmentMimeType: String?,
    val attachmentSize: Long?,
    val replyToMessageId: String?,
    val usedSyntheticMessageId: Boolean,
    val metadataJson: String?,
    val algorithm: String? = null,
    val bodyCiphertext: String? = null,
    val nonce: String? = null,
    val e2eeSessionKeyEnvelope: String? = null,
)

/** Parse `gaf_chat.message_new` JSON; returns null when chat id or visible content is missing. */
fun parseGafChatMessageNewPayload(payload: JSONObject): GafChatMessageNewPayload? {
    val chatId =
        payload.optString(GafChatPayloadKeys.CHAT_ID)
            .ifBlank { payload.optString(GafChatPayloadKeys.CHAT_ID_CAMEL) }
    val rawMessageId =
        payload.optString(GafChatPayloadKeys.ID)
            .ifBlank { payload.optString(GafChatPayloadKeys.MESSAGE_ID) }
            .ifBlank { payload.optString(GafChatPayloadKeys.MESSAGE_ID_CAMEL) }
    val synthetic = rawMessageId.isBlank()
    val messageId = rawMessageId.ifBlank { "socket-${System.currentTimeMillis()}" }
    val body = payload.optString(GafChatPayloadKeys.BODY)
    val attachmentContentId =
        sanitizeGafAttachmentContentId(
            payload.optString(GafChatPayloadKeys.ATTACHMENT_CONTENT_ID)
                .ifBlank { payload.optString(GafChatPayloadKeys.ATTACHMENT_CONTENT_ID_CAMEL) },
        )
    val senderId =
        payload.optString(GafChatPayloadKeys.SENDER_ID)
            .ifBlank { payload.optString(GafChatPayloadKeys.SENDER_ID_CAMEL) }
            .ifBlank { null }
    val createdAt =
        payload.optString(GafChatPayloadKeys.CREATED_AT)
            .ifBlank { payload.optString(GafChatPayloadKeys.CREATED_AT_CAMEL) }
            .ifBlank { null }
    val attachmentName =
        sanitizeGafOptionalString(
            payload.optString(GafChatPayloadKeys.ATTACHMENT_NAME)
                .ifBlank { payload.optString(GafChatPayloadKeys.ATTACHMENT_NAME_CAMEL) },
        )
    val attachmentMime =
        sanitizeGafOptionalString(
            payload.optString(GafChatPayloadKeys.ATTACHMENT_MIME)
                .ifBlank { payload.optString(GafChatPayloadKeys.ATTACHMENT_MIME_CAMEL) },
        )
    val attachmentSize = payload.optLong(GafChatPayloadKeys.ATTACHMENT_SIZE).takeIf { it > 0 }
    val replyTo =
        payload.optString(GafChatPayloadKeys.REPLY_TO)
            .ifBlank { payload.optString(GafChatPayloadKeys.REPLY_TO_CAMEL) }
            .ifBlank { null }
    val metadataObj = payload.optJSONObject(GafChatPayloadKeys.METADATA)
    val algorithm = payload.optString(GafChatPayloadKeys.ALGORITHM).ifBlank { null }
    val bodyCiphertext = payload.optString(GafChatPayloadKeys.BODY_CIPHERTEXT).ifBlank { null }
    val nonce = payload.optString(GafChatPayloadKeys.NONCE).ifBlank { null }
    val e2eeSessionKeyEnvelope =
        payload.optString(GafChatPayloadKeys.E2EE_SESSION_KEY_ENVELOPE).ifBlank { null }
    val hasMetadata = metadataObj != null && metadataObj.length() > 0
    val isE2eePayload = algorithm?.startsWith("e2e_") == true && !bodyCiphertext.isNullOrBlank()
    if (
        chatId.isBlank() ||
        (
            body.isBlank() &&
                attachmentContentId.isNullOrBlank() &&
                !hasMetadata &&
                !isE2eePayload
        )
    ) {
        return null
    }
    val metadataJson =
        metadataObj?.toString()?.takeIf { it.isNotBlank() && it != "{}" }
    return GafChatMessageNewPayload(
        chatId = chatId,
        messageId = messageId,
        body = body,
        senderId = senderId,
        createdAt = createdAt,
        attachmentContentId = attachmentContentId,
        attachmentName = attachmentName,
        attachmentMimeType = attachmentMime,
        attachmentSize = attachmentSize,
        replyToMessageId = replyTo,
        usedSyntheticMessageId = synthetic,
        metadataJson = metadataJson,
        algorithm = algorithm,
        bodyCiphertext = bodyCiphertext,
        nonce = nonce,
        e2eeSessionKeyEnvelope = e2eeSessionKeyEnvelope,
    )
}

fun gafChatMessageNewPayloadToUi(payload: GafChatMessageNewPayload): ChatMessageUi {
    val resolvedMime = resolveChatAttachmentMimeType(payload.attachmentMimeType, payload.attachmentName)
    return ChatMessageUi(
        id = payload.messageId,
        senderId = payload.senderId,
        body = payload.body,
        createdAt = payload.createdAt,
        attachmentContentId = payload.attachmentContentId,
        attachmentName = payload.attachmentName,
        attachmentMimeType = resolvedMime,
        attachmentSize = payload.attachmentSize,
        replyToMessageId = payload.replyToMessageId,
        isPending = false,
        metadataJson = payload.metadataJson,
        systemPresentation = resolveGafMessageSystemPresentation(payload.metadataJson, payload.body),
    )
}

class RealtimeChatBridge(
    socketBaseUrl: String,
    bearerToken: String,
) {
    private val sync = Any()
    private var released = false

    private var listenersAttached = false
    private var onMessageNewCallback: ((JSONObject) -> Unit)? = null
    private var onMessageReadCallback: ((JSONObject) -> Unit)? = null
    private var onMessageEditedCallback: ((JSONObject) -> Unit)? = null
    private var onMessageDeletedCallback: ((JSONObject) -> Unit)? = null
    private var onChatCreatedCallback: ((JSONObject) -> Unit)? = null
    private var onE2eeConsentChangedCallback: ((JSONObject) -> Unit)? = null
    private var onConnectionErrorCallback: ((Throwable) -> Unit)? = null
    private var onDisconnectCallback: ((String?) -> Unit)? = null
    private var onLifecycleStateChanged: ((SocketLifecycleState) -> Unit)? = null
    @Volatile
    private var lifecycleState: SocketLifecycleState = SocketLifecycleState.Disconnected

    fun currentLifecycleState(): SocketLifecycleState = synchronized(sync) { lifecycleState }

    private fun emitLifecycle(next: SocketLifecycleState) {
        val listener =
            synchronized(sync) {
                if (released) return
                lifecycleState = next
                onLifecycleStateChanged
            }
        listener?.invoke(next)
    }

    private var onNotificationCallback: ((JSONObject) -> Unit)? = null
    private var onVideoCallIncomingCallback: ((JSONObject) -> Unit)? = null
    private var onVideoCallAcceptedCallback: ((JSONObject) -> Unit)? = null
    private var onVideoCallEndedCallback: ((JSONObject) -> Unit)? = null

    private val socket: Socket = IO.socket(
        socketBaseUrl,
        IO.Options.builder()
            .setAuth(mapOf("token" to bearerToken))
            .setReconnection(true)
            .setReconnectionAttempts(Int.MAX_VALUE)
            .setReconnectionDelay(RECONNECT_DELAY_MS)
            .setReconnectionDelayMax(RECONNECT_DELAY_MAX_MS)
            .setRandomizationFactor(RECONNECT_RANDOMIZATION)
            .setTimeout(CONNECT_TIMEOUT_MS)
            .build(),
    )

    fun connect(
        onMessageNew: (JSONObject) -> Unit,
        onMessageRead: (JSONObject) -> Unit,
        onMessageEdited: (JSONObject) -> Unit,
        onMessageDeleted: (JSONObject) -> Unit,
        onChatCreated: (JSONObject) -> Unit,
        onE2eeConsentChanged: ((JSONObject) -> Unit)? = null,
        onNotification: ((JSONObject) -> Unit)? = null,
        onConnectionError: ((Throwable) -> Unit)? = null,
        onDisconnect: ((String?) -> Unit)? = null,
        onVideoCallIncoming: ((JSONObject) -> Unit)? = null,
        onVideoCallAccepted: ((JSONObject) -> Unit)? = null,
        onVideoCallEnded: ((JSONObject) -> Unit)? = null,
        onLifecycleStateChanged: ((SocketLifecycleState) -> Unit)? = null,
    ) {
        val shouldConnect: Boolean
        synchronized(sync) {
            if (released) return
            onMessageNewCallback = onMessageNew
            onMessageReadCallback = onMessageRead
            onMessageEditedCallback = onMessageEdited
            onMessageDeletedCallback = onMessageDeleted
            onChatCreatedCallback = onChatCreated
            onE2eeConsentChangedCallback = onE2eeConsentChanged
            onNotificationCallback = onNotification
            onVideoCallIncomingCallback = onVideoCallIncoming
            onVideoCallAcceptedCallback = onVideoCallAccepted
            onVideoCallEndedCallback = onVideoCallEnded
            onConnectionErrorCallback = onConnectionError
            onDisconnectCallback = onDisconnect
            this.onLifecycleStateChanged = onLifecycleStateChanged
            if (!listenersAttached) {
                registerListenersOnce()
                listenersAttached = true
            }
            shouldConnect = !socket.connected()
        }
        if (shouldConnect) {
            emitLifecycle(SocketLifecycleState.Connecting)
        }
        if (shouldConnect) {
            synchronized(sync) {
                if (released) return
            }
            socket.connect()
        }
    }

    /**
     * Idempotent: safe after [release] (no-op). Repeated calls do not throw.
     */
    fun disconnect() {
        synchronized(sync) {
            if (released) return
        }
        socket.disconnect()
        emitLifecycle(SocketLifecycleState.Disconnected)
    }

    /**
     * Idempotent: safe to call multiple times. Drops all callbacks and removes Socket.IO listeners
     * so they cannot retain the consumer after teardown.
     */
    fun release() {
        val teardown: Boolean
        synchronized(sync) {
            if (released) return
            released = true
            teardown = true
            listenersAttached = false
            clearCallbacksLocked()
        }
        if (teardown) {
            emitLifecycle(SocketLifecycleState.Disconnected)
            socket.io().reconnection(false)
            socket.disconnect()
            socket.off()
        }
    }

    private fun clearCallbacksLocked() {
        onMessageNewCallback = null
        onMessageReadCallback = null
        onMessageEditedCallback = null
        onMessageDeletedCallback = null
        onChatCreatedCallback = null
        onE2eeConsentChangedCallback = null
        onNotificationCallback = null
        onVideoCallIncomingCallback = null
        onVideoCallAcceptedCallback = null
        onVideoCallEndedCallback = null
        onConnectionErrorCallback = null
        onDisconnectCallback = null
        onLifecycleStateChanged = null
        lifecycleState = SocketLifecycleState.Disconnected
    }

    private fun registerListenersOnce() {
        socket.on(Socket.EVENT_CONNECT) {
            synchronized(sync) { if (released) return@on }
            emitLifecycle(SocketLifecycleState.Connected)
        }
        socket.on("reconnect_attempt") {
            synchronized(sync) { if (released) return@on }
            emitLifecycle(SocketLifecycleState.Reconnecting)
        }

        socket.on(GafChatSocketEvents.MESSAGE_NEW) { args ->
            synchronized(sync) {
                if (released) return@on
            }
            val payload = args.firstOrNull() as? JSONObject ?: return@on
            val cb = synchronized(sync) { onMessageNewCallback }
            cb?.invoke(payload)
        }
        socket.on(GafChatSocketEvents.MESSAGE_READ) { args ->
            synchronized(sync) {
                if (released) return@on
            }
            val payload = args.firstOrNull() as? JSONObject ?: return@on
            val cb = synchronized(sync) { onMessageReadCallback }
            cb?.invoke(payload)
        }
        socket.on(GafChatSocketEvents.MESSAGE_EDITED) { args ->
            synchronized(sync) {
                if (released) return@on
            }
            val payload = args.firstOrNull() as? JSONObject ?: return@on
            val cb = synchronized(sync) { onMessageEditedCallback }
            cb?.invoke(payload)
        }
        socket.on(GafChatSocketEvents.MESSAGE_DELETED) { args ->
            synchronized(sync) {
                if (released) return@on
            }
            val payload = args.firstOrNull() as? JSONObject ?: return@on
            val cb = synchronized(sync) { onMessageDeletedCallback }
            cb?.invoke(payload)
        }
        socket.on(GafChatSocketEvents.CHAT_CREATED) { args ->
            synchronized(sync) {
                if (released) return@on
            }
            val payload = args.firstOrNull() as? JSONObject ?: return@on
            val cb = synchronized(sync) { onChatCreatedCallback }
            cb?.invoke(payload)
        }
        socket.on(GafChatSocketEvents.E2EE_CONSENT_CHANGED) { args ->
            synchronized(sync) {
                if (released) return@on
            }
            val payload = args.firstOrNull() as? JSONObject ?: return@on
            val cb = synchronized(sync) { onE2eeConsentChangedCallback }
            cb?.invoke(payload)
        }
        socket.on("notification") { args ->
            synchronized(sync) {
                if (released) return@on
            }
            val payload = args.firstOrNull() as? JSONObject ?: return@on
            val cb = synchronized(sync) { onNotificationCallback }
            cb?.invoke(payload)
        }
        socket.on(GafChatSocketEvents.VIDEO_CALL_INCOMING) { args ->
            synchronized(sync) {
                if (released) return@on
            }
            val payload = args.firstOrNull() as? JSONObject ?: return@on
            val cb = synchronized(sync) { onVideoCallIncomingCallback }
            cb?.invoke(payload)
        }
        socket.on(GafChatSocketEvents.VIDEO_CALL_ACCEPTED) { args ->
            synchronized(sync) {
                if (released) return@on
            }
            val payload = args.firstOrNull() as? JSONObject ?: return@on
            val cb = synchronized(sync) { onVideoCallAcceptedCallback }
            cb?.invoke(payload)
        }
        socket.on(GafChatSocketEvents.VIDEO_CALL_ENDED) { args ->
            synchronized(sync) {
                if (released) return@on
            }
            val payload = args.firstOrNull() as? JSONObject ?: return@on
            val cb = synchronized(sync) { onVideoCallEndedCallback }
            cb?.invoke(payload)
        }
        socket.on(Socket.EVENT_CONNECT_ERROR) { args ->
            synchronized(sync) {
                if (released) return@on
            }
            val err = extractThrowable(args)?.let { sanitizeErrorForConsumer(it) } ?: return@on
            emitLifecycle(SocketLifecycleState.Error)
            val cb = synchronized(sync) { onConnectionErrorCallback }
            cb?.invoke(err)
        }
        // Not on [Socket] in socket.io-client 2.1.1 (see Manager.EVENT_RECONNECT_ERROR); name matches engine.
        socket.on("reconnect_error") { args ->
            synchronized(sync) {
                if (released) return@on
            }
            val err = extractThrowable(args)?.let { sanitizeErrorForConsumer(it) } ?: return@on
            val cb = synchronized(sync) { onConnectionErrorCallback }
            cb?.invoke(err)
        }
        socket.on(Socket.EVENT_DISCONNECT) { args ->
            synchronized(sync) {
                if (released) return@on
            }
            val reason = args.firstOrNull()?.toString()?.let { redactSecrets(it) }
            emitLifecycle(SocketLifecycleState.Disconnected)
            val cb = synchronized(sync) { onDisconnectCallback }
            cb?.invoke(reason)
        }
    }

    private companion object {
        /** First reconnect after drop; subsequent attempts grow exponentially up to max. */
        const val RECONNECT_DELAY_MS = 2_000L

        /** Upper bound so clients back off during sustained outages instead of fixed short intervals. */
        const val RECONNECT_DELAY_MAX_MS = 60_000L

        const val RECONNECT_RANDOMIZATION = 0.5

        /** Engine.IO opening handshake timeout (ms). */
        const val CONNECT_TIMEOUT_MS = 20_000L

        private val JWT_LIKE = Regex("[A-Za-z0-9-_]{10,}\\.[A-Za-z0-9-_]{10,}\\.[A-Za-z0-9-_]{10,}")
        private val BEARER = Regex("(?i)(Bearer\\s+)\\S+")

        /**
         * Removes substrings that often carry access tokens so [Throwable] messages and string
         * errors passed to consumers are safe to log or display.
         */
        fun redactSecrets(message: String): String {
            val noBearer = BEARER.replace(message) { m -> m.groupValues[1] + "<redacted>" }
            return JWT_LIKE.replace(noBearer, "<redacted>")
        }

        /**
         * If the combined description differs after redaction, returns a new exception **without**
         * chaining the original, so stack traces from callers that print the full causal chain do
         * not re-expose token-bearing messages.
         */
        fun sanitizeErrorForConsumer(t: Throwable): Throwable {
            val combined = buildString {
                append(t.javaClass.simpleName)
                val m = t.message
                if (!m.isNullOrBlank()) {
                    append(": ").append(m)
                }
            }
            val redacted = redactSecrets(combined)
            return if (redacted == combined) t else Exception(redacted)
        }

        fun extractThrowable(args: Array<out Any>): Throwable? {
            val first = args.firstOrNull() ?: return null
            return if (first is Throwable) {
                first
            } else {
                Exception(redactSecrets(first.toString()))
            }
        }
    }
}
