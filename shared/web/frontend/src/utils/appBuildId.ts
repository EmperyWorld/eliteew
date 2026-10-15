/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Runtime SPA deploy id for X-App-Build header and Socket.IO auth.app_build.
 *
 * Invariants:
 * - Production bundle reads deploy id via vite alias from `.build-artifacts/appBuildId.ts` at build time.
 * - Committed `src/generated/appBuildId.ts` is dev placeholder only; dev runtime returns `dev-local`.
 *
 * Related:
 * - vite-plugin-build-version.ts, api/services/client_build_service.py
 */
import { APP_BUILD_ID as GENERATED_BUILD_ID } from '../generated/appBuildId';

/** Deploy id baked into the bundle (prod) or dev placeholder. */
export function getAppBuildId(): string {
	if (!import.meta.env.PROD) {
		return 'dev-local';
	}
	return GENERATED_BUILD_ID;
}
