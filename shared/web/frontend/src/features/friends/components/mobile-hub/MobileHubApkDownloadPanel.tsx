/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Presents the signed APK download action and its stable public download page.
 *
 * Invariants:
 * - The download action is disabled when no APK is available.
 *
 * Related:
 * - useMobileAppHubController.ts
 */

import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_LUCIDE } from '@/pages/Desktop/constants';
import { SH_MOBILE_DOWNLOAD_PANEL_CLASS } from '../../social-hub/layout/socialHubLayoutTokens';
import type { MobileAppOverview } from '@/services/mobileAppApi';

type Props = {
	overview: MobileAppOverview | null;
	buildLabel: string;
	apkSizeLabel: string;
	downloading: boolean;
	onDownload: () => Promise<void>;
};

export function MobileHubApkDownloadPanel({
	overview,
	buildLabel,
	apkSizeLabel,
	downloading,
	onDownload,
}: Props): JSX.Element {
	const { t } = useTranslation('contentManager');
	return (
		<section className={SH_MOBILE_DOWNLOAD_PANEL_CLASS}>
			<p className="text-sm text-(--desktop-text-muted)">
				{t('friends.mobileApp.apkHint', {
					size: apkSizeLabel,
					version: buildLabel,
				})}
			</p>
			<div className="mt-3 flex flex-wrap gap-2">
				<DesktopAppButton
					type="button"
					variant="accent"
					className="gap-1.5"
					disabled={downloading || !overview?.apk_available}
					onClick={() => void onDownload()}
				>
					<ArrowDownTrayIcon
						className={DESKTOP_LUCIDE.sm}
						strokeWidth={DESKTOP_LUCIDE.stroke}
						aria-hidden
					/>
					{downloading
						? t('friends.mobileApp.downloading')
						: t('friends.mobileApp.download')}
				</DesktopAppButton>
			</div>
			{overview?.download_page_url ? (
				<p className="mt-3 break-all text-xs text-(--desktop-text-muted)">
					{t('friends.mobileApp.fixedLink')}:{' '}
					<a
						href={overview.download_page_url}
						className="text-(--desktop-accent) underline"
						target="_blank"
						rel="noreferrer"
					>
						{overview.download_page_url}
					</a>
				</p>
			) : null}
		</section>
	);
}
