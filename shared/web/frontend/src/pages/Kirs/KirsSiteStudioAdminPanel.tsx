import { SiteStudioAdminShell } from '@/features/site-studio/desktop/SiteStudioAdminShell';
import {
	activateSiteStudioProxy,
	deactivateSiteStudioProxy,
	setSiteStudioKirsProxyScope,
} from '@/services/api/siteStudioProxy';
import { useAdminStore } from '@store/slices/adminSlice';
import * as React from 'react';

type Props = {
	projectId: string;
	/** Публичный URL витрины — чтобы `/uploads/*` в админке шли на storefront (img без Bearer). */
	publicSiteUrl?: string | null;
};

/**
 * Embedded olenti admin via EliteEW proxy; scope is per KIRS marketing project.
 */
export const KirsSiteStudioAdminPanel: React.FC<Props> = ({
	projectId,
	publicSiteUrl,
}) => {
	const logout = useAdminStore((s) => s.logout);

	React.useEffect(() => {
		setSiteStudioKirsProxyScope(projectId, publicSiteUrl);
		activateSiteStudioProxy();
		return () => {
			deactivateSiteStudioProxy();
			setSiteStudioKirsProxyScope(null);
			logout();
		};
	}, [projectId, publicSiteUrl, logout]);

	return (
		<div className="flex h-full min-h-[400px] min-w-0 flex-1 flex-col overflow-hidden">
			<SiteStudioAdminShell skipProxyLifecycle />
		</div>
	);
};

export default KirsSiteStudioAdminPanel;
