import * as React from 'react';
import {
	ExclamationTriangleIcon,
	TrashIcon,
} from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import {
	DESKTOP_APP_STYLE_CONTRACT,
	DesktopAppButton,
	DesktopAppPanel,
	DesktopAppSurface,
} from '@/pages/Desktop/components/DesktopAppChrome';

interface SiteStudioDangerZoneProps {
	siteSlug: string;
	disabled?: boolean;
	onDelete: () => void;
}

export const SiteStudioDangerZone: React.FC<SiteStudioDangerZoneProps> = ({
	siteSlug,
	disabled,
	onDelete,
}) => {
	const { t } = useTranslation('siteStudio');

	return (
		<DesktopAppPanel className="space-y-4 p-4">
			<div className="space-y-2">
				<h2
					id="site-studio-danger-title"
					className={DESKTOP_APP_STYLE_CONTRACT.sectionLabel}
				>
					{t('danger.title')}
				</h2>
				<p className="text-sm leading-6 text-(--desktop-text-secondary)">
					{t('danger.intro', { slug: siteSlug })}
				</p>
			</div>

			<DesktopAppSurface
				variant="soft"
				padding="sm"
				className="border border-red-500/25 bg-red-500/10"
				aria-labelledby="site-studio-danger-card-title"
			>
				<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
					<div className="flex items-start gap-3">
						<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-500/15 text-red-200">
							<ExclamationTriangleIcon className="h-5 w-5" aria-hidden />
						</div>
						<div className="space-y-1">
							<div
								id="site-studio-danger-card-title"
								className="text-sm font-semibold text-red-50"
							>
								{t('danger.cardTitle')}
							</div>
							<p className="text-sm leading-6 text-red-100/85">
								{t('danger.cardBody')}
							</p>
						</div>
					</div>
					<DesktopAppButton
						type="button"
						variant="danger"
						disabled={disabled}
						onClick={onDelete}
						aria-describedby="site-studio-danger-title"
					>
						<TrashIcon className="h-4 w-4" aria-hidden />
						{t('danger.button')}
					</DesktopAppButton>
				</div>
			</DesktopAppSurface>
		</DesktopAppPanel>
	);
};

export default SiteStudioDangerZone;
