/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Legacy wrapper — search settings moved to Search Admin hub (`search/SearchSettingsTab`).
 *
 * Related:
 * - `pages/Admin/search/SearchAdminSection.tsx`
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { AdminSectionPanel } from './shell/AdminSectionPanel';
import { SearchSettingsTab } from './search/SearchSettingsTab';

/** @deprecated Use SearchAdminSection in sidebar «Web search». */
export function DesktopSearchConfigSection(): React.ReactElement {
	const { t } = useTranslation('desktopUi');
	return (
		<AdminSectionPanel
			spacing="none"
			title={t('adminSearchConfig.title')}
			titleId="admin-desktop-search-config-title"
			description={t('adminSearchConfig.description')}
		>
			<SearchSettingsTab />
		</AdminSectionPanel>
	);
}
