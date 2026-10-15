/**
 * Primary tab strip for Content Manager Pro (files, versions, shared, …).
 */
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import type { DesktopWindowStyle } from '../../../types/profile';
import { cn } from '../../../utils/cn';
import {
	DESKTOP_APP_STYLE_CONTRACT,
	DesktopAppButton,
} from '../../Desktop/components/DesktopAppChrome';
import { getDesktopShellToolbarClusterClassName } from '../../Desktop/utils/desktopVisualSystem';
import type { ContentManagerTab } from '../contentManagerTypes';
import {
	ArrowTopRightOnSquareIcon,
	ChartBarSquareIcon,
	ChatBubbleLeftRightIcon,
	CircleStackIcon,
	ClockIcon,
	ExclamationTriangleIcon,
	FolderIcon,
	TagIcon,
} from '@heroicons/react/24/outline';

export interface ContentManagerTabStripProps {
	activeTab: ContentManagerTab;
	setActiveTab: React.Dispatch<React.SetStateAction<ContentManagerTab>>;
	embedded: boolean;
	embeddedTabIconClass: string;
	shellFrame: DesktopWindowStyle;
	/** Вертикальная колонка (левая панель контент-менеджера в desktop-окне). */
	orientation?: 'horizontal' | 'vertical';
	/** Узкая левая колонка: вкладки в один ряд, только иконки (подписи в `sr-only`). */
	railIconRow?: boolean;
}

const TAB_DEFS: ReadonlyArray<{
	id: ContentManagerTab;
	icon: (embeddedIconClass: string) => React.ReactNode;
}> = [
	{ id: 'files', icon: (c) => <FolderIcon className={c} /> },
	{ id: 'versions', icon: (c) => <ClockIcon className={c} /> },
	{ id: 'shared', icon: (c) => <ArrowTopRightOnSquareIcon className={c} /> },
	{
		id: 'comments',
		icon: (c) => <ChatBubbleLeftRightIcon className={c} />,
	},
	{ id: 'duplicates', icon: (c) => <CircleStackIcon className={c} /> },
	{
		id: 'brokenFiles',
		icon: (c) => <ExclamationTriangleIcon className={c} />,
	},
	{ id: 'stats', icon: (c) => <ChartBarSquareIcon className={c} /> },
	{ id: 'tags', icon: (c) => <TagIcon className={c} /> },
];

export const ContentManagerTabStrip: React.FC<ContentManagerTabStripProps> = ({
	activeTab,
	setActiveTab,
	embedded,
	embeddedTabIconClass,
	shellFrame,
	orientation = 'horizontal',
	railIconRow = false,
}) => {
	const { t } = useTranslation('contentManager');
	const vertical = orientation === 'vertical' && !railIconRow;

	return (
		<div
			className={cn(
				embedded && !vertical && !railIconRow ? 'min-w-0' : 'min-w-0 w-full',
				vertical
					? 'flex w-full min-w-0 flex-col gap-1'
					: 'flex min-w-0 flex-wrap items-center gap-1'
			)}
		>
			<div
				role="tablist"
				data-cm-guide="tabs"
				aria-label={t('files.appTitle')}
				className={cn(
					'min-w-0 p-1',
					railIconRow
						? cn(
								'flex max-w-full flex-nowrap gap-0.5 overflow-x-auto overflow-y-hidden rounded-(--desktop-radius)',
								getDesktopShellToolbarClusterClassName(shellFrame)
							)
						: embedded
							? getDesktopShellToolbarClusterClassName(shellFrame)
							: DESKTOP_APP_STYLE_CONTRACT.softCard,
					!railIconRow &&
						(vertical
							? 'flex w-full flex-col gap-0.5 rounded-(--desktop-radius)'
							: embedded
								? 'flex max-w-full flex-wrap gap-0.5 rounded-(--desktop-radius)'
								: 'flex flex-wrap rounded-(--desktop-radius)')
				)}
			>
				{TAB_DEFS.map((tab) => (
					<DesktopAppButton
						key={tab.id}
						type="button"
						role="tab"
						aria-selected={activeTab === tab.id}
						id={`content-manager-tab-${tab.id}`}
						onClick={() => setActiveTab(tab.id)}
						variant={activeTab === tab.id ? 'accent' : 'ghost'}
						size={railIconRow ? 'icon' : 'sm'}
						title={t(`tabs.${tab.id}`)}
						className={cn(
							'font-medium',
							railIconRow
								? 'h-8 w-8 shrink-0'
								: vertical
									? 'w-full justify-start gap-2 px-3 py-2 text-xs'
									: embedded
										? 'gap-0 px-1.5 py-1'
										: 'gap-2 px-3 py-2 text-sm'
						)}
					>
						{tab.icon(embeddedTabIconClass)}
						<span
							className={
								railIconRow || (embedded && !vertical) ? 'sr-only' : undefined
							}
						>
							{t(`tabs.${tab.id}`)}
						</span>
					</DesktopAppButton>
				))}
			</div>
		</div>
	);
};
