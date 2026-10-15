import { Input } from '@components/atoms/Input';
import * as React from 'react';
import { useId, useMemo } from 'react';
import { DocumentTextIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';

interface BlockDef {
	key: string;
	name: string;
	maxLength?: number;
	hint?: string;
}

interface SectionImageDef {
	key: string;
	name: string;
	hint?: string;
}

interface ContentSectionProps {
	pageId: string;
	section: {
		id: string;
		blocks: BlockDef[];
		images: SectionImageDef[];
	};
	getBlockValue: (page: string, section: string, key: string) => string;
	onBlockChange: (
		page: string,
		section: string,
		key: string,
		value: string
	) => void;
}

/** Группы блоков по префиксу (item1_, item2_, step1_, value1_ и т.д.) для удобного отображения */
function groupBlocks(
	blocks: BlockDef[]
): { groupLabel: string | null; blocks: BlockDef[] }[] {
	const itemMatch = /^(item|step|value)(\d+)_/;
	const groups = new Map<string, { label: string; blocks: BlockDef[] }>();
	const standalone: BlockDef[] = [];
	const labels: Record<string, string> = {
		item: 'Элемент',
		step: 'Этап',
		value: 'Ценность',
	};

	for (const block of blocks) {
		const m = block.key.match(itemMatch);
		if (m) {
			const [, prefix, num] = m;
			const groupKey = `${prefix}-${num}`;
			if (!groups.has(groupKey)) {
				groups.set(groupKey, {
					label: `${labels[prefix] || 'Элемент'} ${num}`,
					blocks: [],
				});
			}
			groups.get(groupKey)?.blocks.push(block);
		} else {
			standalone.push(block);
		}
	}

	const result: { groupLabel: string | null; blocks: BlockDef[] }[] = [];
	if (standalone.length > 0) {
		result.push({ groupLabel: null, blocks: standalone });
	}
	const sortedGroupKeys = Array.from(groups.keys()).sort((a, b) => {
		const numA = parseInt(a.split('-')[1], 10);
		const numB = parseInt(b.split('-')[1], 10);
		return numA - numB;
	});
	for (const key of sortedGroupKeys) {
		const g = groups.get(key);
		if (g) {
			result.push({ groupLabel: g.label, blocks: g.blocks });
		}
	}
	return result;
}

function BlockField({
	pageId,
	sectionId,
	block,
	getBlockValue,
	onBlockChange,
}: {
	pageId: string;
	sectionId: string;
	block: BlockDef;
	getBlockValue: (page: string, section: string, key: string) => string;
	onBlockChange: (
		page: string,
		section: string,
		key: string,
		value: string
	) => void;
}) {
	const fieldId = useId();
	const value = getBlockValue(pageId, sectionId, block.key);
	const charCount = value.length;
	const isOverLimit = block.maxLength && charCount > block.maxLength;

	return (
		<div className="space-y-1.5">
			<div className="flex items-center justify-between">
				<label
					htmlFor={fieldId}
					className="text-sm font-medium text-neutral-700 dark:text-slate-300"
				>
					{block.name}
				</label>
				{block.maxLength && (
					<span
						className={`text-xs font-medium ${isOverLimit ? 'text-red-600 dark:text-red-400' : 'text-neutral-400 dark:text-slate-500'}`}
					>
						{charCount}/{block.maxLength}
					</span>
				)}
			</div>
			{block.hint && (
				<p className="text-xs text-neutral-500 dark:text-slate-400 italic">
					{block.hint}
				</p>
			)}
			{block.maxLength && block.maxLength > 150 ? (
				<textarea
					id={fieldId}
					value={value}
					onChange={(e) =>
						onBlockChange(pageId, sectionId, block.key, e.target.value)
					}
					className={`w-full px-3 py-2.5 border rounded-lg text-sm resize-none transition-[border-color,background-color,box-shadow] duration-200 ${
						isOverLimit
							? 'border-red-300 dark:border-red-700 bg-red-50/50 dark:bg-red-900/10'
							: 'border-neutral-200 dark:border-slate-600 bg-white dark:bg-slate-700'
					} text-neutral-900 dark:text-slate-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30`}
					rows={4}
					aria-label={block.name}
				/>
			) : (
				<Input
					id={fieldId}
					value={value}
					onChange={(e) =>
						onBlockChange(pageId, sectionId, block.key, e.target.value)
					}
					className={`text-sm ${
						isOverLimit
							? 'border-red-300 dark:border-red-700 bg-red-50/50 dark:bg-red-900/10'
							: 'border-neutral-200 dark:border-slate-600 bg-white dark:bg-slate-700'
					} text-neutral-900 dark:text-slate-100`}
					aria-label={block.name}
				/>
			)}
		</div>
	);
}

export const ContentSectionBlocks: React.FC<ContentSectionProps> = ({
	pageId,
	section,
	getBlockValue,
	onBlockChange,
}) => {
	const { t } = useTranslation('siteStudio');
	const grouped = useMemo(() => groupBlocks(section.blocks), [section.blocks]);

	if (section.blocks.length === 0) return null;

	return (
		<div className="space-y-5 min-w-0">
			<h4 className="text-sm font-semibold text-neutral-700 dark:text-slate-300 flex items-center gap-2">
				<DocumentTextIcon
					width={16}
					height={16}
					className="text-amber-500 shrink-0"
					aria-hidden
				/>
				{t('workspace.content.blocksHeading')}
			</h4>
			<div className="space-y-5">
				{grouped.map(({ groupLabel, blocks: groupBlocksList }, idx) => (
					<div
						key={groupLabel ?? `main-${idx}`}
						className={
							groupLabel
								? 'rounded-xl border border-neutral-200 dark:border-slate-600 bg-white dark:bg-slate-800 overflow-hidden'
								: ''
						}
					>
						{groupLabel && (
							<div className="px-4 py-2 bg-neutral-100 dark:bg-slate-700/50 border-b border-neutral-200 dark:border-slate-600 text-sm font-medium text-neutral-800 dark:text-slate-200">
								{groupLabel}
							</div>
						)}
						<div className={groupLabel ? 'p-4 space-y-4' : 'space-y-4'}>
							{groupLabel
								? groupBlocksList.map((block) => (
										<BlockField
											key={block.key}
											pageId={pageId}
											sectionId={section.id}
											block={block}
											getBlockValue={getBlockValue}
											onBlockChange={onBlockChange}
										/>
									))
								: groupBlocksList.map((block) => (
										<div
											key={block.key}
											className="p-4 rounded-xl border border-neutral-200 dark:border-slate-600 bg-white dark:bg-slate-800/80"
										>
											<BlockField
												pageId={pageId}
												sectionId={section.id}
												block={block}
												getBlockValue={getBlockValue}
												onBlockChange={onBlockChange}
											/>
										</div>
									))}
						</div>
					</div>
				))}
			</div>
		</div>
	);
};
