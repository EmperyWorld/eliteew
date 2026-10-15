/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Bounded OIDC bootstrap that can run in parallel with cold i18n and the React
 * application graph. Timeout never clears a persisted session.
 *
 * Invariants:
 * - Runtime profile is selected before `initKeycloak()`.
 * - A deadline returns a typed outcome; login/recovery owns the next step.
 * - Repeated calls join the same in-flight task.
 *
 * Related:
 * - `mainFullApp.ts`
 * - `documentation/platform/FRONTEND-BOOT-ORCHESTRATION.md`
 */

import { prepareOidcRuntimeProfile } from '@/entries/prepareOidcRuntimeProfile';
import { markBootPerformance } from '@/services/boot/bootPerformance';
import { initKeycloak } from '@/services/keycloak';
import { log } from '@/utils/logger';

export const AUTH_BOOTSTRAP_DEADLINE_MS = 12_000;

export type AuthBootstrapOutcome =
	| { status: 'authenticated' }
	| { status: 'unauthenticated' }
	| { status: 'timeout' }
	| { status: 'error'; error: Error };

let inflight: Promise<AuthBootstrapOutcome> | null = null;

function withDeadline<T>(
	task: Promise<T>,
	deadlineMs: number
): Promise<T | 'timeout'> {
	return new Promise((resolve, reject) => {
		const timer = window.setTimeout(() => {
			resolve('timeout');
		}, deadlineMs);
		task.then(
			(value) => {
				window.clearTimeout(timer);
				resolve(value);
			},
			(error: unknown) => {
				window.clearTimeout(timer);
				reject(error);
			}
		);
	});
}

async function runAuthBootstrapOnce(): Promise<AuthBootstrapOutcome> {
	markBootPerformance('auth-start');
	try {
		await prepareOidcRuntimeProfile();
		const authenticatedOrTimeout = await withDeadline(
			initKeycloak(),
			AUTH_BOOTSTRAP_DEADLINE_MS
		);
		if (authenticatedOrTimeout === 'timeout') {
			log.warn(
				'authBootstrap',
				'OIDC init exceeded deadline; mounting without blocking'
			);
			markBootPerformance('auth-settled');
			return { status: 'timeout' };
		}
		markBootPerformance('auth-settled');
		return authenticatedOrTimeout
			? { status: 'authenticated' }
			: { status: 'unauthenticated' };
	} catch (error) {
		const err = error instanceof Error ? error : new Error(String(error));
		log.error('authBootstrap', 'OIDC init failed', err);
		markBootPerformance('auth-settled');
		return { status: 'error', error: err };
	}
}

export function runAuthBootstrap(): Promise<AuthBootstrapOutcome> {
	if (inflight) {
		return inflight;
	}
	inflight = runAuthBootstrapOnce();
	return inflight;
}

export function resetAuthBootstrapForTests(): void {
	inflight = null;
}
