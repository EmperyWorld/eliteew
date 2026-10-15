/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Overview tab for Desktop AI Chat admin hub (links + last refresh).
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { enUS, ru } from 'date-fns/locale';
import { DESKTOP_TYPOGRAPHY } from '../../Desktop/constants';
import { useDesktopAiChatAdmin } from './DesktopAiChatAdminContext';

type DesktopAiChatOverviewTabProps = {
	onOpenDefaults: () => void;
	onOpenMemoryCells: () => void;
	onOpenBlueprint: () => void;
	onOpenDiagnostics: () => void;
};

export function DesktopAiChatOverviewTab({
	onOpenDefaults,
	onOpenMemoryCells,
	onOpenBlueprint,
	onOpenDiagnostics,
}: DesktopAiChatOverviewTabProps): React.ReactElement {
	const { t, i18n } = useTranslation('desktopUi');
	const { lastLoadedAt, templates } = useDesktopAiChatAdmin();
	const locale = i18n.language.startsWith('ru') ? ru : enUS;
	const loadedLabel =
		lastLoadedAt != null
			? format(new Date(lastLoadedAt), 'PPpp', { locale })
			: t('adminAiChat.overview.notLoadedYet');

	return (
		<div className="space-y-4 max-w-3xl">
			<p className={`${DESKTOP_TYPOGRAPHY.body} text-white/75`}>
				{t('adminAiChat.overview.lead')}
			</p>
			<div className="rounded-lg border border-white/10 bg-black/25 px-4 py-3">
				<p className={`${DESKTOP_TYPOGRAPHY.caption} text-white/55`}>
					{t('adminAiChat.overview.lastRefresh')}
				</p>
				<p className={`${DESKTOP_TYPOGRAPHY.body} mt-1 text-white/90`}>
					{loadedLabel}
				</p>
				<p className={`${DESKTOP_TYPOGRAPHY.caption} mt-3 text-white/55`}>
					{t('adminAiChat.overview.templatesCount', {
						count: templates.length,
					})}
				</p>
			</div>
			<ul
				className={`${DESKTOP_TYPOGRAPHY.body} list-disc space-y-2 pl-5 text-white/80`}
			>
				<li>
					<button
						type="button"
						className="text-violet-300 underline-offset-2 hover:underline"
						onClick={onOpenDefaults}
					>
						{t('adminAiChat.overview.openDefaults')}
					</button>
				</li>
				<li>
					<button
						type="button"
						className="text-violet-300 underline-offset-2 hover:underline"
						onClick={onOpenMemoryCells}
					>
						{t('adminAiChat.overview.openMemoryCells')}
					</button>
				</li>
				<li>
					<button
						type="button"
						className="text-violet-300 underline-offset-2 hover:underline"
						onClick={onOpenBlueprint}
					>
						{t('adminAiChat.overview.openBlueprint')}
					</button>
				</li>
				<li>
					<button
						type="button"
						className="text-violet-300 underline-offset-2 hover:underline"
						onClick={onOpenDiagnostics}
					>
						{t('adminAiChat.overview.openDiagnostics')}
					</button>
				</li>
				<li>
					<a
						href="?section=kbsew&kbsewTab=agent-access"
						className="text-violet-300 underline-offset-2 hover:underline"
					>
						{t('adminAiChat.overview.kbsewLink')}
					</a>
				</li>
			</ul>
		</div>
	);
}
