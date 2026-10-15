/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T <keysray70@gmail.com>
 * ---
 *
 * Purpose:
 * Guard the EWA companion persona catalog: stable ids/order, normalization, and linkage to persisted window payload.
 *
 * Invariants:
 * - Catalog mirrors `documentation/product/ewa/EWA-PERSONA-FAMILY-ROADMAP.md` wire ids.
 * - Selecting a persona feeds optional `metadata.companion.seed_persona_id` on turn POST when running under `EwaDesktopApp` (`ewaDesktopOrchApi`).
 *
 * Related:
 * - documentation/product/ewa/EWA-PERSONA-FAMILY-ROADMAP.md
 */

import type { WindowInitialPayload } from '@/pages/Desktop/types/desktop.types';
import { buildDesktopOrchestrationSignalEnvelope } from '@/services/ewa/ewaDesktopOrchApi';
import { describe, expect, it } from 'vitest';
import {
	DEFAULT_EWA_PERSONA_ID,
	EWA_PERSONA_CATALOG,
	EWA_PERSONA_IDS,
	getEwaPersonaById,
	isEwaPersonaId,
	normalizeEwaPersonaId,
} from '../ewaPersonaCatalog';

describe('ewaPersonaCatalog', () => {
	it('declares canonical ids aligned with roadmap order', () => {
		expect(EWA_PERSONA_IDS.join('|')).toBe(
			'parent|mela|zera|kora|tala|feni|arlika|arlika_v2'
		);
		expect(EWA_PERSONA_CATALOG.map((p) => p.id)).toEqual([...EWA_PERSONA_IDS]);
	});

	it('looks up personas and validates ids', () => {
		expect(getEwaPersonaById('feni').id).toBe('feni');
		expect(isEwaPersonaId('arlika')).toBe(true);
		expect(normalizeEwaPersonaId(' mela ')).toBe('mela');
		expect(normalizeEwaPersonaId(' arlika ')).toBe('arlika');
		expect(normalizeEwaPersonaId('bad')).toBeNull();
		expect(DEFAULT_EWA_PERSONA_ID).toBe('parent');
	});

	it('documents optional WindowInitialPayload field for persisted choice', () => {
		type Keys = keyof WindowInitialPayload & string;
		const _check: Keys = 'ewaDesktopPersonaId';
		expect(_check).toBe('ewaDesktopPersonaId');
	});

	it('default turn envelope still matches historical shape (no companion metadata)', () => {
		const envelope = buildDesktopOrchestrationSignalEnvelope({
			correlationId: 'c-test',
			sessionId: 's-test',
			observation: { observation_kind: 'user_cancelled', reason: 'x' },
		});
		expect(envelope.payload).toEqual({
			kind: 'ewa_desktop_orchestration_v1',
			session_id: 's-test',
			observation: { observation_kind: 'user_cancelled', reason: 'x' },
		});
	});
});
