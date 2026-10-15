/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Wave 6 regression lock — principal-change cache reset reuses logout §3.4 subset
 * without HTTP abort / socket kill / authSessionLock; AuthContext wires the compare.
 *
 * Invariants:
 * - `executePrincipalChangeCacheReset` clears RQ and the same cascade pieces as logout.
 * - AuthContext.tsx source contains principal compare + reset call.
 *
 * Related:
 * - documentation/product/FRONTEND_BROWSER_CACHE_MODEL.md §3.4, §8, §10
 * - src/services/auth/authSessionCoordinator.ts
 * - src/contexts/AuthContext.tsx
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryStorage } from '@/test/memoryStorage';
import { queryClient, resetQueryClient } from '@/providers/QueryProvider';
import { PROFILE_ME_QUERY_KEY } from '@/services/profileService';
import {
	clearFeSessionApiCaches,
	getConditionalJsonEtag,
	updateConditionalJsonCache,
} from '@/services/api/conditionalJsonGet';
import { clearDesktopShellStateCache } from '@/pages/Desktop/services/desktopApi';
import { useCompanionOperationsStore } from '@/features/ewa/companionOperations/companionOperationsStore';
import type { EwaCompanionTaskRun } from '@/services/ewa/ewaCompanionChatApi';
import { executePrincipalChangeCacheReset } from '@/services/auth/authSessionCoordinator';

const PRINCIPAL_A = 'user-a-sub';

const authContextSourcePath = join(
	dirname(fileURLToPath(import.meta.url)),
	'../../../contexts/AuthContext.tsx'
);

describe('executePrincipalChangeCacheReset — Wave 6', () => {
	beforeEach(() => {
		vi.stubGlobal('localStorage', createMemoryStorage());
		vi.stubGlobal('sessionStorage', createMemoryStorage());
		clearDesktopShellStateCache();
		clearFeSessionApiCaches();
		resetQueryClient();
		useCompanionOperationsStore.getState().reset();
	});

	afterEach(() => {
		clearDesktopShellStateCache();
		clearFeSessionApiCaches();
		resetQueryClient();
		useCompanionOperationsStore.getState().reset();
		vi.unstubAllGlobals();
	});

	it('clears React Query and logout cache subset for previous principal', () => {
		queryClient.setQueryData(PROFILE_ME_QUERY_KEY, { id: PRINCIPAL_A });
		localStorage.setItem(
			`eliteew.companion.pinnedTools.v1:${PRINCIPAL_A}`,
			'["tool-a"]'
		);
		localStorage.setItem('gaf_chat_e2e_identity_private_jwk', 'secret-jwk');
		useCompanionOperationsStore.getState().mergeIncomingRuns([
			{
				id: 'run-ghost',
				principal_id: PRINCIPAL_A,
				status: 'running',
				intent_kind: 'action_workflow',
				run_revision: 1,
			} as EwaCompanionTaskRun,
		]);
		updateConditionalJsonCache(
			'friends:overview',
			{ total: 1 },
			'"friends-etag"'
		);
		expect(getConditionalJsonEtag('friends:overview')).toBe('"friends-etag"');
		expect(useCompanionOperationsStore.getState().operationRuns.length).toBe(1);

		executePrincipalChangeCacheReset({ principalId: PRINCIPAL_A });

		expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
		expect(
			localStorage.getItem(`eliteew.companion.pinnedTools.v1:${PRINCIPAL_A}`)
		).toBeNull();
		expect(
			localStorage.getItem('gaf_chat_e2e_identity_private_jwk')
		).toBeNull();
		expect(useCompanionOperationsStore.getState().operationRuns).toEqual([]);
		expect(getConditionalJsonEtag('friends:overview')).toBeNull();
	});

	it('AuthContext.tsx wires principal compare and executePrincipalChangeCacheReset', () => {
		const source = readFileSync(authContextSourcePath, 'utf8');
		expect(source).toContain('executePrincipalChangeCacheReset');
		expect(source).toMatch(/previousPrincipalId\s*!==\s*nextPrincipalId/);
	});
});
