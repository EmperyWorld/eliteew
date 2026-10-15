/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Decrypt E2EE message bodies for the active GAF thread into a plaintext map.
 *
 * Invariants:
 * - Cancels in-flight decrypt when chat or raw message set changes.
 *
 * Related:
 * - GAFChatApp.tsx · GAFChatCrypto.ts
 */
import { useEffect, useMemo, useState } from 'react';
import { getSessionKeyEnvelope } from '../api/gafChatApi';
import { decryptE2EMessage } from '../GAFChatCrypto';
import type { GAFMessageItem } from '../types';

export function useGafChatE2eePlaintext(
	selectedChatId: string | null,
	rawMessages: GAFMessageItem[]
) {
	const [e2eePlaintextByMessageId, setE2eePlaintextByMessageId] = useState<
		Record<string, string>
	>({});

	useEffect(() => {
		let cancelled = false;
		if (!selectedChatId) {
			setE2eePlaintextByMessageId({});
			return () => {
				cancelled = true;
			};
		}
		const encrypted = rawMessages.filter(
			(m) =>
				String(m.algorithm || '').startsWith('e2e_') &&
				Boolean(m.body_ciphertext)
		);
		if (encrypted.length === 0) {
			setE2eePlaintextByMessageId({});
			return () => {
				cancelled = true;
			};
		}
		const decryptMessages = async () => {
			let envelope: Awaited<ReturnType<typeof getSessionKeyEnvelope>> | null =
				null;
			try {
				envelope = await getSessionKeyEnvelope(selectedChatId);
			} catch {
				envelope = null;
			}
			const pairs = await Promise.all(
				encrypted.map(async (m) => [
					m.id,
					await decryptE2EMessage({
						chatId: selectedChatId,
						ciphertextB64: m.body_ciphertext || '',
						nonceB64: m.nonce,
						encryptedSessionKeyForMeB64:
							m.e2ee_session_key_envelope ??
							envelope?.encrypted_key_payload ??
							null,
					}),
				])
			);
			if (!cancelled) {
				setE2eePlaintextByMessageId(Object.fromEntries(pairs));
			}
		};
		void decryptMessages();
		return () => {
			cancelled = true;
		};
	}, [rawMessages, selectedChatId]);

	const messages = useMemo(
		() =>
			rawMessages.map((m) => {
				const decrypted = e2eePlaintextByMessageId[m.id];
				return decrypted ? { ...m, body: decrypted } : m;
			}),
		[rawMessages, e2eePlaintextByMessageId]
	);

	return { messages, setE2eePlaintextByMessageId };
}
