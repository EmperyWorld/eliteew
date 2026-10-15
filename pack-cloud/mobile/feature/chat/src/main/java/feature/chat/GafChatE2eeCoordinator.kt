/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Orchestrates GAF Chat E2EE: identity upload, session envelope fetch, decrypt batches, encrypted send.
 *
 * Invariants:
 * - Wire identity uses rsa_oaep_sha256 (separate from trusted-device p256-ecdh bind key).
 * - Session envelope is fetched at most once per chat per coordinator instance batch.
 *
 * Related:
 * - ChatRepository.kt, GafChatE2eeCrypto.kt, documentation/product/GAF-CHAT-BACKEND.md
 */
package feature.chat

import android.content.Context
import world.empery.mobile.core.network.api.GafMessageDto
import world.empery.mobile.core.network.api.GafPublicKeyUploadBody
import world.empery.mobile.core.network.api.GafSendMessageBody
import world.empery.mobile.core.network.api.GafChatApi

internal class GafChatE2eeCoordinator(
    context: Context,
    private val api: GafChatApi,
) {
    private val keyStore = GafChatE2eeKeyStore(context.applicationContext)
    private val chatE2eeStatus = java.util.concurrent.ConcurrentHashMap<String, String>()

    suspend fun ensureWireIdentityReady(): Boolean {
        val keyPair = keyStore.loadIdentityKeyPair() ?: GafChatE2eeCrypto.generateIdentityKeyPair().also {
            keyStore.saveIdentityKeyPair(it)
        }
        val localPem = GafChatE2eeCrypto.publicKeyToPem(keyPair.public)
        val localFingerprint = GafChatE2eeCrypto.publicPemFingerprint(localPem)
        val remote =
            runCatching { api.getMyPublicKey() }.getOrNull()
        val remotePem = remote?.public_key_pem?.trim()?.ifBlank { null }
        val needsUpload =
            remote == null ||
                !remote.has_key ||
                remote.algorithm != GafChatE2eeAlgorithms.IDENTITY ||
                remotePem == null ||
                (
                    GafChatE2eeCrypto.publicPemFingerprint(remotePem) == localFingerprint &&
                        keyStore.uploadedPublicFingerprint() != localFingerprint
                )
        if (!needsUpload) return true
        return runCatching {
            api.uploadPublicKey(
                GafPublicKeyUploadBody(
                    public_key_pem = localPem,
                    algorithm = GafChatE2eeAlgorithms.IDENTITY,
                ),
            )
            keyStore.markUploadedPublicFingerprint(localPem)
            true
        }.getOrDefault(false)
    }

    fun rememberChatE2eeStatus(chatId: String, status: String?) {
        chatE2eeStatus[chatId] = status?.trim()?.ifBlank { null } ?: "off"
    }

    suspend fun isChatE2eeActive(chatId: String): Boolean {
        val status = runCatching { api.getE2eeStatus(chatId) }.getOrNull()
        if (status != null) {
            val active = status.status == "active" && status.ready
            rememberChatE2eeStatus(chatId, if (active) "active" else "off")
            return active
        }
        return chatE2eeStatus[chatId] == "active"
    }

    suspend fun resolveEncryptedBody(
        chatId: String,
        dto: GafMessageDto,
        encryptedPlaceholder: String,
        globalSessionEnvelopeB64: String?,
        myUserId: String?,
    ): String {
        val ciphertext = dto.body_ciphertext?.trim().orEmpty()
        if (ciphertext.isEmpty()) return encryptedPlaceholder
        val envelope =
            dto.e2ee_session_key_envelope?.trim()?.ifBlank { null }
                ?: globalSessionEnvelopeB64
        val decrypted =
            GafChatE2eeCrypto.decryptMessage(
                ciphertextB64 = ciphertext,
                nonceB64 = dto.nonce,
                sessionKeyBytes = keyStore.sessionKeyBytes(chatId),
                encryptedSessionKeyForMeB64 = envelope,
                identityPrivateKey = keyStore.identityPrivateKey(),
                onSessionKeyStored = { keyStore.saveSessionKeyBytes(chatId, it) },
            )
        return decrypted ?: encryptedPlaceholder
    }

    suspend fun resolveEncryptedBodies(
        chatId: String,
        messages: List<GafMessageDto>,
        encryptedPlaceholder: String,
        myUserId: String?,
    ): Map<String, String> {
        val encrypted =
            messages.filter {
                it.algorithm?.startsWith("e2e_") == true && !it.body_ciphertext.isNullOrBlank()
            }
        if (encrypted.isEmpty()) return emptyMap()
        ensureWireIdentityReady()
        val envelope =
            runCatching { api.getSessionKeyEnvelope(chatId)?.encrypted_key_payload }.getOrNull()
        return encrypted.associate { dto ->
            dto.id to resolveEncryptedBody(chatId, dto, encryptedPlaceholder, envelope, myUserId)
        }
    }

    suspend fun sendEncryptedMessage(
        chatId: String,
        plaintext: String,
        partnerUserId: String,
        attachmentContentId: String? = null,
    ): GafMessageDto {
        ensureWireIdentityReady()
        val keyPair =
            keyStore.loadIdentityKeyPair()
                ?: GafChatE2eeCrypto.generateIdentityKeyPair().also {
                    keyStore.saveIdentityKeyPair(it)
                }
        val ownPem = GafChatE2eeCrypto.publicKeyToPem(keyPair.public)
        val serverOwnKey =
            runCatching { api.getMyPublicKey() }.getOrNull()
                ?.takeIf {
                    it.has_key &&
                        it.algorithm == GafChatE2eeAlgorithms.IDENTITY &&
                        !it.public_key_pem.isNullOrBlank()
                }?.public_key_pem
        val selfWrapPem = serverOwnKey ?: ownPem
        val sessionKey = keyStore.getOrCreateSessionKeyBytes(chatId)
        val partnerKey =
            runCatching { api.getUserPublicKey(partnerUserId) }.getOrNull()
        val partnerPem =
            partnerKey
                ?.takeIf {
                    it.has_key &&
                        it.algorithm == GafChatE2eeAlgorithms.IDENTITY &&
                        !it.public_key_pem.isNullOrBlank()
                }?.public_key_pem
        val prepared =
            GafChatE2eeCrypto.prepareMessage(
                plaintext = plaintext,
                sessionKeyBytes = sessionKey,
                partnerPublicKeyPem = partnerPem,
                ownPublicKeyPem = selfWrapPem,
            )
        return api.sendMessage(
            chatId,
            GafSendMessageBody(
                e2e_ciphertext = prepared.ciphertextB64,
                e2e_nonce = prepared.nonceB64,
                e2e_algorithm = prepared.algorithm,
                e2e_encryption_version = prepared.encryptionVersion,
                e2e_session_key_for_recipient = prepared.sessionKeyForRecipientB64,
                e2e_session_key_for_self = prepared.sessionKeyForSelfB64,
                attachment_content_id = attachmentContentId?.trim()?.ifBlank { null },
            ),
        )
    }

    suspend fun decryptSocketMessage(
        chatId: String,
        senderId: String?,
        myUserId: String?,
        algorithm: String?,
        bodyCiphertext: String?,
        nonce: String?,
        encryptedPlaceholder: String,
        e2eeSessionKeyEnvelope: String? = null,
    ): String {
        if (algorithm?.startsWith("e2e_") != true || bodyCiphertext.isNullOrBlank()) {
            return encryptedPlaceholder
        }
        ensureWireIdentityReady()
        val envelope =
            runCatching { api.getSessionKeyEnvelope(chatId)?.encrypted_key_payload }.getOrNull()
        val dto =
            GafMessageDto(
                id = "socket",
                sender_id = senderId.orEmpty(),
                body_ciphertext = bodyCiphertext,
                nonce = nonce,
                algorithm = algorithm,
                e2ee_session_key_envelope = e2eeSessionKeyEnvelope,
            )
        return resolveEncryptedBody(chatId, dto, encryptedPlaceholder, envelope, myUserId)
    }
}
