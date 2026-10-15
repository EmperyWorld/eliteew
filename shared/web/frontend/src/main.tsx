/**
 * ------------------------------------------------------------------------------
 *  EliteEW · Empery World · https://eliteew.ru
 *  Author: po&T <keysray70@gmail.com>
 * ------------------------------------------------------------------------------
 *
 * Purpose:
 * SPA entry router: follower tabs load minimal shell before fonts/App; leader loads full app.
 *
 * Invariants:
 * - Synchronous imports stay dependency-free (no React, auth, API, i18n, or Desktop).
 *
 * Related:
 * - `tabBootstrap.ts`, `followerMain.tsx`, `mainFullApp.ts`
 * - `services/boot/bootstrapReloadLedger.ts`
 */

import {
	markBootstrapFollowerDocument,
	resolveTabBootstrapRole,
} from './tabBootstrap';
import { bootstrapReloadLedgerFromUrl } from './services/boot/bootstrapReloadLedger';
import { markBootPerformance } from './services/boot/bootPerformance';

markBootPerformance('entry-start');
bootstrapReloadLedgerFromUrl();

void (async () => {
	const role = resolveTabBootstrapRole();
	markBootPerformance('tab-role-resolved');
	if (role === 'follower') {
		markBootstrapFollowerDocument();
		await import('./followerMain');
		return;
	}
	await import('./mainFullApp');
})();
