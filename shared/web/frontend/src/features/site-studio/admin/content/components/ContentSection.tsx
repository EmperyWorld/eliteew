import * as React from 'react';
import {
	ChevronDownIcon,
	ChevronRightIcon,
	DocumentTextIcon,
	InformationCircleIcon,
	PhotoIcon,
} from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { ContentSectionBlocks } from './ContentSectionBlocks';
import { ContentSectionImages } from './ContentSectionImages';

interface BlockDef {
	key: string;
	name: string;
	maxLength?: number;
	hint?: string;
}

interface ImageDef {
	key: string;
	name: string;
	hint?: string;
}

interface SectionDef {
	id: string;
	name: string;
	blocks: BlockDef[];
	images: ImageDef[];
}

interface ContentSectionProps {
	pageId: string;
	section: SectionDef;
	isExpanded: boolean;
	onToggle: () => void;
	getBlockValue: (page: string, section: string, key: string) => string;
	onBlockChange: (
		page: string,
		section: string,
		key: string,
		value: string
	) => void;
	uploading: string | null;
	uploadProgress: Record<string, number>;
	getImageUrl: (page: string, section: string, key: string) => string;
	onImageUpload: (
		page: string,
		section: string,
		key: string,
		file: File
	) => void;
	onImageDelete: (page: string, section: string, key: string) => void;
	whereOnSite?: string;
}

export const ContentSection: React.FC<ContentSectionProps> = ({
	pageId,
	section,
	isExpanded,
	onToggle,
	getBlockValue,
	onBlockChange,
	uploading,
	uploadProgress,
	getImageUrl,
	onImageUpload,
	onImageDelete,
	whereOnSite,
}) => {
	const { t } = useTranslation('siteStudio');
	const isEmptySection =
		section.blocks.length === 0 && section.images.length === 0;

	return (
		<div className="border-0 min-w-0">
			{/* Section Header */}
			<button
				type="button"
				onClick={onToggle}
				className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-5 py-4 hover:bg-neutral-50 dark:hover:bg-slate-800/80 transition-colors motion-reduce:transition-none group text-left min-w-0"
				aria-expanded={isExpanded}
				aria-label={`${section.name}`}
			>
				<div className="flex items-start sm:items-center gap-3 min-w-0">
					<div className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/30 group-hover:bg-amber-200 dark:group-hover:bg-amber-900/50 transition-colors motion-reduce:transition-none shrink-0">
						{isExpanded ? (
							<ChevronDownIcon
								width={16}
								height={16}
								className="text-amber-600 dark:text-amber-400"
								aria-hidden
							/>
						) : (
							<ChevronRightIcon
								width={16}
								height={16}
								className="text-amber-600 dark:text-amber-400"
								aria-hidden
							/>
						)}
					</div>
					<div className="min-w-0">
						<span className="font-semibold text-neutral-900 dark:text-white block">
							{section.name}
						</span>
						{whereOnSite && (
							<span className="text-xs text-neutral-500 dark:text-slate-400 block mt-0.5 sm:mt-1">
								{t('workspace.content.whereOnSitePrefix')} {whereOnSite}
							</span>
						)}
					</div>
				</div>
				<div className="flex items-center gap-2 shrink-0 pl-9 sm:pl-0 flex-wrap">
					{section.blocks.length > 0 && (
						<span className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-medium">
							<DocumentTextIcon width={12} height={12} aria-hidden />
							{t('workspace.content.blockCountBadge', {
								count: section.blocks.length,
							})}
						</span>
					)}
					{section.images.length > 0 && (
						<span className="flex items-center gap-1.5 px-2.5 py-1 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 rounded-lg text-xs font-medium">
							<PhotoIcon width={12} height={12} aria-hidden />
							{t('workspace.content.imageCountBadge', {
								count: section.images.length,
							})}
						</span>
					)}
					{isEmptySection && (
						<span className="flex items-center gap-1.5 px-2.5 py-1 bg-neutral-100 dark:bg-slate-700/80 text-neutral-600 dark:text-slate-400 rounded-lg text-xs font-medium">
							<InformationCircleIcon width={12} height={12} aria-hidden />
							{t('workspace.content.sectionEmptyTitle')}
						</span>
					)}
				</div>
			</button>

			{/* Section Content */}
			{isExpanded && (
				<div className="px-5 pb-5 pt-2 space-y-6 bg-neutral-50/50 dark:bg-slate-900/30 border-t border-neutral-200 dark:border-slate-700 motion-reduce:transition-none">
					{isEmptySection ? (
						<div
							className="rounded-xl border border-dashed border-neutral-300 dark:border-slate-600 bg-white/60 dark:bg-slate-800/40 px-4 py-8 text-center"
							role="status"
						>
							<InformationCircleIcon
								className="w-10 h-10 mx-auto mb-3 text-neutral-400 dark:text-slate-500"
								aria-hidden
							/>
							<p className="text-sm font-medium text-neutral-800 dark:text-slate-200">
								{t('workspace.content.sectionEmptyTitle')}
							</p>
							<p className="text-xs text-neutral-500 dark:text-slate-400 mt-2 max-w-md mx-auto leading-relaxed">
								{t('workspace.content.sectionEmptyHint')}
							</p>
						</div>
					) : (
						<>
							<ContentSectionBlocks
								pageId={pageId}
								section={section}
								getBlockValue={getBlockValue}
								onBlockChange={onBlockChange}
							/>
							<ContentSectionImages
								pageId={pageId}
								section={section}
								uploading={uploading}
								uploadProgress={uploadProgress}
								getImageUrl={getImageUrl}
								onImageUpload={onImageUpload}
								onImageDelete={onImageDelete}
							/>
						</>
					)}
				</div>
			)}
		</div>
	);
};
