/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Locks the stable transcript bundle hook import path after helper extraction.
 *
 * Invariants:
 * - The public hook remains a callable named export.
 *
 * Related:
 * - src/features/ewa/companionUx/useCompanionChatTranscriptBundle.tsx
 */

import { describe, expect, it } from 'vitest';

import { useCompanionChatTranscriptBundle } from '@/features/ewa/companionUx/useCompanionChatTranscriptBundle';

describe('useCompanionChatTranscriptBundle import chain', () => {
	it('keeps the stable hook export callable', () => {
		expect(useCompanionChatTranscriptBundle).toBeTypeOf('function');
	});
});
