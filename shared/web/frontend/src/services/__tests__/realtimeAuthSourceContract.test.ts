/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Static contract lock: all prod realtime FE clients source JWT from authSession facade.
 *
 * Invariants:
 * - Socket.IO, Yjs WS, Live Voice, SSE must not read legacy emperyworld_* localStorage keys directly.
 *
 * Related:
 * - services/authSession.ts; scripts/eliteew/realtime-contract-integrity-probe.sh
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const frontendSrc = join(here, '..', '..');

const REALTIME_CLIENT_FILES = [
	'services/communication/EmperyworldSocketService.ts',
	'services/ewa/ewaDesktopOrchApi.ts',
	'components/UltimateDocEditor/hooks/useYjsCollaboration.ts',
	'components/LiveVoiceWidget/hooks/useLiveVoiceWebSocket.ts',
	'services/ewa/ewaCompanionChatStreamApi.ts',
	'services/ewa/ewaCompanionChatTaskRunsApi.ts',
] as const;

describe('realtime auth source contract', () => {
	for (const rel of REALTIME_CLIENT_FILES) {
		it(`${rel} uses authSession token facade`, () => {
			const source = readFileSync(join(frontendSrc, rel), 'utf8');
			const usesFacade =
				source.includes("from '../authSession'") ||
				source.includes("from '@/services/authSession'") ||
				source.includes('from "@/services/authSession"') ||
				source.includes("from '../../services/authSession'") ||
				source.includes("from '../../../services/authSession'") ||
				source.includes('getAuthHeader') ||
				source.includes('apiFetchWithAuth');
			expect(usesFacade).toBe(true);
			expect(source).not.toMatch(
				/localStorage\.getItem\(['"]emperyworld_access_token/
			);
		});
	}

	it('E3: companion task-events SSE uses apiFetchWithAuth (not raw fetch)', () => {
		const source = readFileSync(
			join(frontendSrc, 'services/ewa/ewaCompanionChatTaskRunsApi.ts'),
			'utf8'
		);
		expect(source).toContain('apiFetchWithAuth');
		expect(source).toMatch(
			/streamEwaCompanionTaskEvents[\s\S]*apiFetchWithAuth/
		);
		expect(source).toMatch(
			/streamEwaCompanionTaskRunEvents[\s\S]*apiFetchWithAuth/
		);
		expect(source).not.toMatch(
			/streamEwaCompanionTaskEvents[\s\S]*await fetch\(/
		);
		expect(source).not.toMatch(
			/streamEwaCompanionTaskRunEvents[\s\S]*await fetch\(/
		);
	});
});
