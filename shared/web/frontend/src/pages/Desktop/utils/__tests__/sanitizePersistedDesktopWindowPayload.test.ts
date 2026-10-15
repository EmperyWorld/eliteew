/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Regression: transient companion and Professional Worlds one-shot draft keys must not be written into
 * **`windows_snapshot`** persistence.
 *
 * Invariants:
 * - Shallow strip companion shell fields and `professionalWorldsCrossAppDraftKey`; remaining keys preserved.
 *
 * Related:
 * - `sanitizePersistedDesktopWindowPayload.ts`
 */
import { sanitizeWindowPayloadForShellPersistence } from '@/pages/Desktop/utils/sanitizePersistedDesktopWindowPayload';
import { describe, expect, it } from 'vitest';

describe('sanitizeWindowPayloadForShellPersistence', () => {
	it('removes companion excerpt but keeps document ids', () => {
		expect(
			sanitizeWindowPayloadForShellPersistence({
				documentId: 'doc-9',
				companionSurfaceExcerpt: 'secret body text',
			})
		).toEqual({ documentId: 'doc-9' });
	});

	it('removes companion listing plain but keeps unrelated keys', () => {
		expect(
			sanitizeWindowPayloadForShellPersistence({
				documentId: 'doc-9',
				companionListingPlain: '- a.pdf\n- b.doc',
			})
		).toEqual({ documentId: 'doc-9' });
	});

	it('removes companion selection plain but keeps unrelated keys', () => {
		expect(
			sanitizeWindowPayloadForShellPersistence({
				documentId: 'doc-9',
				companionSurfaceSelectionPlain: 'selected bit',
			})
		).toEqual({ documentId: 'doc-9' });
	});

	it('removes Professional Worlds cross-app draft key but keeps app target', () => {
		expect(
			sanitizeWindowPayloadForShellPersistence({
				targetChatId: 'chat-1',
				professionalWorldsCrossAppDraftKey:
					'eliteew.professionalWorlds.crossAppDraft.v1.gaf.abc',
			})
		).toEqual({ targetChatId: 'chat-1' });
	});

	it('returns the same reference when excerpt absent', () => {
		const p = { documentId: 'a' };
		expect(sanitizeWindowPayloadForShellPersistence(p)).toBe(p);
	});
});
