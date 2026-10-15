/**
 * Tags tab: popular tags as shortcuts to Files list filtered by tag.
 */
import * as React from 'react';
import { TagIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { cn } from '../../../utils/cn';
import { DesktopAppButton } from '../../Desktop/components/DesktopAppChrome';

export interface ContentManagerTagsTabProps {
	tagsTabKey: number;
	shellContentPanelClass: string;
	popularTags: Array<{ tag: string; count: number }>;
	onTagSelect: (tag: string) => void;
}

export const ContentManagerTagsTab: React.FC<ContentManagerTagsTabProps> = ({
	tagsTabKey,
	shellContentPanelClass,
	popularTags,
	onTagSelect,
}) => {
	const { t } = useTranslation('contentManager');

	return (
		<div
			key={tagsTabKey}
			className={cn(shellContentPanelClass, 'mb-6 min-h-0 p-5')}
		>
			<h3 className="mb-4 flex items-center gap-2 text-sm font-medium text-(--desktop-text-secondary)">
				<TagIcon className="w-4 h-4 text-(--desktop-text-muted)" />
				{t('files.tags.popular')}
			</h3>
			<div className="flex flex-wrap gap-2">
				{popularTags.length > 0 ? (
					popularTags.map(({ tag, count }) => (
						<DesktopAppButton
							key={tag}
							onClick={() => onTagSelect(tag)}
							variant="neutral"
							className="gap-2 px-4 py-2 text-sm"
						>
							<span className="text-(--desktop-text-muted)">#</span>
							<span>{tag}</span>
							<span className="text-xs text-(--desktop-text-dim) tabular-nums">
								{count}
							</span>
						</DesktopAppButton>
					))
				) : (
					<p className="text-sm text-(--desktop-text-dim)">
						{t('files.tags.none')}
					</p>
				)}
			</div>
		</div>
	);
};
