/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * React Query for `GET /desktop/install-profile` — enabled `app_component` set
 * for Start Menu / catalog defense-in-depth. FoFline uses `fofline-connected`.
 *
 * Invariants:
 * - Non-FoFline: while loading/error → null (no client filter).
 * - foflineNative: fail-closed to FoFline surface even before API (no cloud-full flash).
 *
 * Related:
 * - `services/desktopApi/installProfile.ts`
 * - `utils/desktopInstallProfileFilter.ts`
 * - `shell/foflineConnectedSurface.ts`
 * - documentation/product/desktop/DESKTOP-FOFLINE-EDITION.md §17.5
 */

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import authSession from '../../../services/authSession';
import { getOidcRuntimeProfile } from '../../../services/keycloakProfile';
import { getDesktopInstallProfile } from '../services/desktopApi';
import {
	FOFLINE_CONNECTED_APP_COMPONENTS,
	intersectFoflineConnectedSurface,
} from '../shell/foflineConnectedSurface';

export const DESKTOP_INSTALL_PROFILE_QUERY_KEY = [
	'desktop',
	'install-profile',
] as const;

export function useDesktopInstallProfileEnabledComponents(): ReadonlySet<string> | null {
	const { isAuthenticated } = useAuth();
	const hasAuthenticatedSession = isAuthenticated || Boolean(authSession.token);
	const foflineNative = getOidcRuntimeProfile() === 'foflineNative';

	const query = useQuery({
		queryKey: DESKTOP_INSTALL_PROFILE_QUERY_KEY,
		queryFn: getDesktopInstallProfile,
		enabled: hasAuthenticatedSession,
		staleTime: 5 * 60_000,
		gcTime: 30 * 60_000,
		refetchOnMount: false,
		refetchOnWindowFocus: false,
		retry: 1,
	});

	return useMemo(() => {
		if (foflineNative) {
			const api = query.data?.enabled_app_components;
			if (api?.length) {
				return intersectFoflineConnectedSurface(new Set(api));
			}
			return FOFLINE_CONNECTED_APP_COMPONENTS;
		}
		if (!query.data?.enabled_app_components) return null;
		return new Set(query.data.enabled_app_components);
	}, [foflineNative, query.data]);
}
