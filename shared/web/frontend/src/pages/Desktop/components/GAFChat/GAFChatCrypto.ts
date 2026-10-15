/* GAF Chat E2E crypto helpers (phase 2).
 *
 * ## Public surface (stable)
 * - `ensureIdentityKeyPair` — load or mint RSA-OAEP identity; PEM + JWK in localStorage
 * - `clearSessionKeyForChat` / `clearAllSessionKeys` / `clearIdentityAndSessionKeys`
 * - `prepareE2EMessageForSending` / `decryptE2EMessage`
 * - `PreparedE2EMessage`
 *
 * ## Performance (large payloads)
 * - Base64 helpers avoid stack blow-ups on huge buffers (`bufToBase64` chunks; `base64ToBuf`
 *   walks the decoded string linearly). Output size still scales with payload (binary + base64
 *   string copies in memory).
 * - `prepareE2EMessageForSending` / `decryptE2EMessage` use one-shot Web Crypto AES-GCM: the
 *   full plaintext and ciphertext live in memory at once, plus UTF-8 and base64 wire forms.
 *   Chat-sized messages are fine; multi‑MB paste/attachments should be handled outside this
 *   layer (chunk, cap, or omit E2E) to avoid main-thread jank and peak RAM.
 * - RSA-OAEP wrap/unwrap is fixed to the 32-byte AES key only; it does not scale with body size.
 *
 * ## Internals
 * - Identity: RSA-OAEP (private JWK client-only); SPKI PEM for public wire format
 * - Session: AES-GCM per chat; optional RSA wrap of session key for peer
 */

import { getMyPublicKey, uploadMyPublicKey } from './api/gafChatApi';

// ─── Storage keys ─────────────────────────────────────────────────────────────

const IDENTITY_PRIVATE_KEY_STORAGE_KEY = 'gaf_chat_e2e_identity_private_jwk';
const IDENTITY_PUBLIC_KEY_STORAGE_KEY = 'gaf_chat_e2e_identity_public_pem';
const UPLOADED_PUBLIC_FINGERPRINT_KEY =
	'gaf_chat_e2e_uploaded_public_fingerprint';
const SESSION_KEY_STORAGE_PREFIX = 'gaf_chat_e2e_session_key_';

// ─── Wire / algorithm labels (single source for logs + API payloads) ───────

const ALGORITHM_IDENTITY = 'rsa_oaep_sha256' as const;
const ALGORITHM_E2E_PAYLOAD = 'e2e_aes_gcm' as const;
const ENCRYPTION_VERSION = 'e2e_v1' as const;

const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder();

/** Prefix for user-facing / dev errors so VictoriaLogs and support can grep. */
const ERR_PREFIX = 'GAF Chat E2E:';

/** Tagged error with optional `cause` for the same message shape everywhere. */
function gafE2eError(detail: string, cause?: unknown): Error {
	const err = new Error(`${ERR_PREFIX} ${detail}`);
	if (cause !== undefined) {
		(err as Error & { cause?: unknown }).cause = cause;
	}
	return err;
}

function getSessionKeyStorageKey(chatId: string): string {
	return `${SESSION_KEY_STORAGE_PREFIX}${chatId}`;
}

// ─── Base64 / PEM ─────────────────────────────────────────────────────────────

/**
 * Binary → base64. Large buffers use chunked conversion so we do not hit call-stack limits
 * from `String.fromCharCode(...entireArray)` (same output as the naive form for small inputs).
 */
function bufToBase64(buf: ArrayBuffer): string {
	const bytes = new Uint8Array(buf);
	const chunkSize = 0x8000;
	if (bytes.length <= chunkSize) {
		return btoa(String.fromCharCode(...bytes));
	}
	let binary = '';
	for (let i = 0; i < bytes.length; i += chunkSize) {
		const slice = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
		binary += String.fromCharCode.apply(null, slice as unknown as number[]);
	}
	return btoa(binary);
}

function base64ToBuf(b64: string): ArrayBuffer {
	const trimmed = b64.trim();
	if (trimmed.length === 0) {
		throw gafE2eError('base64 string is empty');
	}
	try {
		const bin = atob(trimmed);
		const len = bin.length;
		const out = new Uint8Array(len);
		for (let i = 0; i < len; i += 1) out[i] = bin.charCodeAt(i);
		return out.buffer;
	} catch (cause) {
		throw gafE2eError('base64 is invalid or corrupted', cause);
	}
}

function spkiToPem(spkiB64: string): string {
	const body = spkiB64.replace(/(.{64})/g, '$1\n');
	return `-----BEGIN PUBLIC KEY-----\n${body}\n-----END PUBLIC KEY-----`;
}

function pemToSpki(pem: string): ArrayBuffer {
	const body = pem
		.replace(/-----BEGIN PUBLIC KEY-----/g, '')
		.replace(/-----END PUBLIC KEY-----/g, '')
		.replace(/\s+/g, '');
	if (body.length === 0) {
		throw gafE2eError('PEM public key has empty body');
	}
	return base64ToBuf(body);
}

// ─── Identity (RSA-OAEP) ────────────────────────────────────────────────────

async function generateIdentityKeyPair(): Promise<CryptoKeyPair> {
	return crypto.subtle.generateKey(
		{
			name: 'RSA-OAEP',
			modulusLength: 2048,
			publicExponent: new Uint8Array([1, 0, 1]),
			hash: 'SHA-256',
		},
		true,
		['encrypt', 'decrypt']
	);
}

/**
 * Load or create RSA-OAEP identity keys; persists JWK + SPKI PEM in localStorage.
 *
 * @throws Error with message prefixed by `GAF Chat E2E:` if JSON/import/generation fails
 */
export async function ensureIdentityKeyPair(): Promise<{
	publicKeyPem: string;
	algorithm: string;
	privateKey: CryptoKey;
}> {
	const existingPem = localStorage.getItem(IDENTITY_PUBLIC_KEY_STORAGE_KEY);
	const existingPriv = localStorage.getItem(IDENTITY_PRIVATE_KEY_STORAGE_KEY);

	// Both must be present; a lone value is treated as incomplete and we mint a fresh pair.
	if (existingPem && existingPriv) {
		let jwk: JsonWebKey;
		try {
			jwk = JSON.parse(existingPriv) as JsonWebKey;
		} catch (cause) {
			throw gafE2eError(
				'identity private key stored value is invalid JSON',
				cause
			);
		}
		try {
			const privateKey = await crypto.subtle.importKey(
				'jwk',
				jwk,
				{ name: 'RSA-OAEP', hash: 'SHA-256' },
				true,
				['decrypt']
			);
			return {
				publicKeyPem: existingPem,
				algorithm: ALGORITHM_IDENTITY,
				privateKey,
			};
		} catch (cause) {
			throw gafE2eError(
				'identity private key import failed (corrupt JWK or algorithm mismatch)',
				cause
			);
		}
	}

	try {
		const keyPair = await generateIdentityKeyPair();
		const spki = await crypto.subtle.exportKey('spki', keyPair.publicKey);
		const spkiB64 = bufToBase64(spki);
		const pem = spkiToPem(spkiB64);

		const jwk = (await crypto.subtle.exportKey(
			'jwk',
			keyPair.privateKey
		)) as JsonWebKey;

		localStorage.setItem(IDENTITY_PUBLIC_KEY_STORAGE_KEY, pem);
		localStorage.setItem(IDENTITY_PRIVATE_KEY_STORAGE_KEY, JSON.stringify(jwk));

		return {
			publicKeyPem: pem,
			algorithm: ALGORITHM_IDENTITY,
			privateKey: keyPair.privateKey,
		};
	} catch (cause) {
		throw gafE2eError(
			'identity key pair generation or persistence failed',
			cause
		);
	}
}

/** SHA-256 fingerprint of normalized SPKI PEM (wire identity upload dedupe). */
export async function publicPemFingerprint(pem: string): Promise<string> {
	const normalized = pem
		.replace(/-----BEGIN PUBLIC KEY-----/g, '')
		.replace(/-----END PUBLIC KEY-----/g, '')
		.replace(/\s/g, '');
	const hash = await crypto.subtle.digest(
		'SHA-256',
		TEXT_ENCODER.encode(normalized)
	);
	return Array.from(new Uint8Array(hash))
		.map((byte) => byte.toString(16).padStart(2, '0'))
		.join('');
}

/**
 * Upload wire identity when server has none or already matches this browser.
 * Does not overwrite another device's key on the server.
 */
export async function ensureGafWireIdentityReady(): Promise<boolean> {
	const { publicKeyPem, algorithm } = await ensureIdentityKeyPair();
	const localFingerprint = await publicPemFingerprint(publicKeyPem);
	let remote: Awaited<ReturnType<typeof getMyPublicKey>> | null = null;
	try {
		remote = await getMyPublicKey();
	} catch {
		remote = null;
	}
	const remotePem =
		remote?.has_key &&
		remote.algorithm === ALGORITHM_IDENTITY &&
		remote.public_key_pem
			? remote.public_key_pem
			: null;
	const remoteFingerprint = remotePem
		? await publicPemFingerprint(remotePem)
		: null;
	const needsUpload =
		!remotePem ||
		(remoteFingerprint === localFingerprint &&
			localStorage.getItem(UPLOADED_PUBLIC_FINGERPRINT_KEY) !==
				localFingerprint);
	if (!needsUpload) {
		return true;
	}
	if (remoteFingerprint && remoteFingerprint !== localFingerprint) {
		return false;
	}
	try {
		await uploadMyPublicKey({ public_key_pem: publicKeyPem, algorithm });
		localStorage.setItem(UPLOADED_PUBLIC_FINGERPRINT_KEY, localFingerprint);
		return true;
	} catch {
		return false;
	}
}

async function getIdentityPrivateKey(): Promise<CryptoKey | null> {
	const stored = localStorage.getItem(IDENTITY_PRIVATE_KEY_STORAGE_KEY);
	if (!stored) return null;
	try {
		const jwk = JSON.parse(stored) as JsonWebKey;
		return crypto.subtle.importKey(
			'jwk',
			jwk,
			{ name: 'RSA-OAEP', hash: 'SHA-256' },
			true,
			['decrypt']
		);
	} catch {
		// Corrupt storage or algorithm mismatch: same as "no key" for decrypt UX.
		return null;
	}
}

async function importRemotePublicKey(pem: string): Promise<CryptoKey> {
	const spkiBuf = pemToSpki(pem);
	try {
		return await crypto.subtle.importKey(
			'spki',
			spkiBuf,
			{ name: 'RSA-OAEP', hash: 'SHA-256' },
			true,
			['encrypt']
		);
	} catch (cause) {
		throw gafE2eError('peer public key import failed (RSA-OAEP SPKI)', cause);
	}
}

// ─── Session key (AES raw bytes) ──────────────────────────────────────────────

async function getOrCreateSessionKeyBytes(chatId: string): Promise<Uint8Array> {
	const keyStr = localStorage.getItem(getSessionKeyStorageKey(chatId));
	if (keyStr) {
		return new Uint8Array(base64ToBuf(keyStr));
	}
	const keyBytes = crypto.getRandomValues(new Uint8Array(32));
	localStorage.setItem(
		getSessionKeyStorageKey(chatId),
		bufToBase64(keyBytes.buffer)
	);
	return keyBytes;
}

async function getSessionKeyBytesIfExists(
	chatId: string
): Promise<Uint8Array | null> {
	const keyStr = localStorage.getItem(getSessionKeyStorageKey(chatId));
	if (!keyStr) return null;
	return new Uint8Array(base64ToBuf(keyStr));
}

async function importAesKeyFromBytes(bytes: Uint8Array): Promise<CryptoKey> {
	// use underlying ArrayBuffer to satisfy BufferSource typing across TS/lib.dom versions
	return crypto.subtle.importKey(
		'raw',
		bytes.buffer as ArrayBuffer,
		{ name: 'AES-GCM', length: 256 },
		true,
		['encrypt', 'decrypt']
	);
}

/** Remove persisted AES session key for one chat. */
export function clearSessionKeyForChat(chatId: string): void {
	localStorage.removeItem(getSessionKeyStorageKey(chatId));
}

/** Remove all persisted chat session keys (prefix scan). */
export function clearAllSessionKeys(): void {
	if (typeof window === 'undefined') return;
	const keysToRemove: string[] = [];
	for (let index = 0; index < localStorage.length; index += 1) {
		const key = localStorage.key(index);
		if (key?.startsWith(SESSION_KEY_STORAGE_PREFIX)) {
			keysToRemove.push(key);
		}
	}
	for (const key of keysToRemove) {
		localStorage.removeItem(key);
	}
}

/** Clear identity keypair, upload fingerprint, and every session key from localStorage. */
export function clearIdentityAndSessionKeys(): void {
	if (typeof window === 'undefined') return;
	localStorage.removeItem(IDENTITY_PRIVATE_KEY_STORAGE_KEY);
	localStorage.removeItem(IDENTITY_PUBLIC_KEY_STORAGE_KEY);
	localStorage.removeItem(UPLOADED_PUBLIC_FINGERPRINT_KEY);
	clearAllSessionKeys();
}

// ─── E2E message prepare / decrypt ────────────────────────────────────────────

/** Payload for sending an E2E-encrypted chat message (ciphertext + nonce + optional wrapped key). */
export interface PreparedE2EMessage {
	ciphertextB64: string;
	nonceB64: string;
	algorithm: string;
	encryptionVersion: string;
	sessionKeyForRecipientB64?: string;
	sessionKeyForSelfB64?: string;
}

type PrepareE2EOptions = {
	chatId: string;
	plaintext: string;
	partnerPublicKeyPem: string | null;
};

type DecryptE2EOptions = {
	chatId: string;
	ciphertextB64: string;
	nonceB64: string | null | undefined;
	/** Encrypted session key envelope from server (per-message or chat-level fallback). */
	encryptedSessionKeyForMeB64?: string | null;
	/** @deprecated Decrypt cascade ignores sender; kept for call-site compatibility. */
	fromPartner?: boolean;
};

/**
 * Encrypt plaintext with AES-GCM; optionally wrap session key for peer with RSA-OAEP.
 *
 * @remarks Peak memory is proportional to plaintext length (see file header "Performance (large payloads)").
 * @throws Error with `GAF Chat E2E:` prefix on crypto/import failures (re-throws same-prefix errors as-is)
 */
export async function prepareE2EMessageForSending(
	options: PrepareE2EOptions
): Promise<PreparedE2EMessage> {
	const { chatId, plaintext, partnerPublicKeyPem } = options;

	try {
		const sessionKeyBytes = await getOrCreateSessionKeyBytes(chatId);
		const aesKey = await importAesKeyFromBytes(sessionKeyBytes);
		// Web Crypto AES-GCM: 12-byte IV is standard for TLS-style nonces.
		const nonce = crypto.getRandomValues(new Uint8Array(12));
		const ciphertext = await crypto.subtle.encrypt(
			{ name: 'AES-GCM', iv: nonce },
			aesKey,
			TEXT_ENCODER.encode(plaintext)
		);

		let sessionKeyForRecipientB64: string | undefined;
		if (partnerPublicKeyPem) {
			const remotePub = await importRemotePublicKey(partnerPublicKeyPem);
			// Wrap 32-byte AES key with peer's RSA-OAEP (SHA-256); no label (default).
			const encryptedKey = await crypto.subtle.encrypt(
				{ name: 'RSA-OAEP' },
				remotePub,
				sessionKeyBytes.buffer as ArrayBuffer
			);
			sessionKeyForRecipientB64 = bufToBase64(encryptedKey);
		}

		const { publicKeyPem } = await ensureIdentityKeyPair();
		let selfWrapPem = publicKeyPem;
		try {
			const serverOwn = await getMyPublicKey();
			if (
				serverOwn?.has_key &&
				serverOwn.algorithm === ALGORITHM_IDENTITY &&
				serverOwn.public_key_pem
			) {
				selfWrapPem = serverOwn.public_key_pem;
			}
		} catch {
			// Keep local PEM when server key is unavailable.
		}
		const ownPub = await importRemotePublicKey(selfWrapPem);
		const selfEncrypted = await crypto.subtle.encrypt(
			{ name: 'RSA-OAEP' },
			ownPub,
			sessionKeyBytes.buffer as ArrayBuffer
		);
		const sessionKeyForSelfB64 = bufToBase64(selfEncrypted);

		return {
			ciphertextB64: bufToBase64(ciphertext),
			nonceB64: bufToBase64(nonce.buffer),
			algorithm: ALGORITHM_E2E_PAYLOAD,
			encryptionVersion: ENCRYPTION_VERSION,
			sessionKeyForRecipientB64,
			sessionKeyForSelfB64,
		};
	} catch (cause) {
		if (cause instanceof Error && cause.message.startsWith(ERR_PREFIX)) {
			throw cause;
		}
		throw gafE2eError('outgoing E2E message preparation failed', cause);
	}
}

/**
 * Decrypt E2E payload; returns `[encrypted]` when key/nonce missing or decrypt fails (UX contract).
 *
 * @remarks Peak memory scales with base64 ciphertext length (decode + decrypt + UTF-8 string); see file header.
 * Does not throw for missing session key/nonce or failed decrypt — callers always get a display string.
 */
export async function decryptE2EMessage(
	options: DecryptE2EOptions
): Promise<string> {
	const { chatId, ciphertextB64, nonceB64, encryptedSessionKeyForMeB64 } =
		options;

	if (!nonceB64) {
		return '[encrypted]';
	}

	const tryDecrypt = async (
		sessionKeyBytes: Uint8Array
	): Promise<string | null> => {
		try {
			const aesKey = await importAesKeyFromBytes(sessionKeyBytes);
			const nonce = new Uint8Array(base64ToBuf(nonceB64));
			const cipherBuf = base64ToBuf(ciphertextB64);
			const plainBuf = await crypto.subtle.decrypt(
				{ name: 'AES-GCM', iv: nonce },
				aesKey,
				cipherBuf
			);
			return TEXT_DECODER.decode(plainBuf);
		} catch {
			return null;
		}
	};

	const localKey = await getSessionKeyBytesIfExists(chatId);
	if (localKey) {
		const plain = await tryDecrypt(localKey);
		if (plain) {
			return plain;
		}
	}

	if (encryptedSessionKeyForMeB64) {
		const priv = await getIdentityPrivateKey();
		if (priv) {
			try {
				const encBuf = base64ToBuf(encryptedSessionKeyForMeB64.trim());
				const raw = await crypto.subtle.decrypt(
					{ name: 'RSA-OAEP' },
					priv,
					encBuf
				);
				const sessionKeyBytes = new Uint8Array(raw);
				const plain = await tryDecrypt(sessionKeyBytes);
				if (plain) {
					return plain;
				}
			} catch {
				// Fall through to placeholder.
			}
		}
	}

	return '[encrypted]';
}
