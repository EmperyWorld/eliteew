/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Optional Content Studio document picker for Site Studio auto-fill context.
 *
 * Invariants:
 * - Selection only passes the document id to auto-fill; document content remains loaded by backend contracts.
 * - User-visible labels come from the `siteStudio` i18n namespace.
 *
 * Related:
 * - ./ImperorGPanel.tsx
 * - components/UnifiedContent/picker/useUnifiedContentPickerQuery.ts
 */
import { unifiedContentDisplayLabel } from '@/components/UnifiedContent/utils/contentDisplayLabel';
import { useUnifiedContentPickerQuery } from '@/components/UnifiedContent/picker/useUnifiedContentPickerQuery';
import * as React from 'react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowPathIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import {
	DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME,
	DesktopNativeSelect,
} from '@/pages/Desktop/components/DesktopAppChrome';

interface ContentStudioPickerProps {
	value: string | null;
	onChange: (documentId: string | null) => void;
	disabled?: boolean;
}

export const ContentStudioPicker: React.FC<ContentStudioPickerProps> = ({
	value,
	onChange,
	disabled,
}) => {
	const { t } = useTranslation('siteStudio');
	const listParams = useMemo(
		() => ({
			content_type: 'document',
			limit: 30,
			sort_field: 'updated_at',
			sort_order: 'desc' as const,
		}),
		[]
	);

	const query = useUnifiedContentPickerQuery({
		enabled: true,
		listParams,
		staleTimeMs: 60_000,
	});

	const items = query.data?.items ?? [];
	const loading = query.isPending || query.isFetching;

	return (
		<div className="flex flex-col gap-1">
			<label
				htmlFor="content-studio-doc-select"
				className="flex items-center gap-1.5 text-xs font-medium text-(--desktop-text-secondary)"
			>
				<DocumentTextIcon className="h-3.5 w-3.5" />
				{t('autofill.contentStudioDocument')}
			</label>
			<div className="relative">
				<DesktopNativeSelect
					id="content-studio-doc-select"
					className="text-xs"
					value={value || ''}
					onChange={(e) => onChange(e.target.value || null)}
					disabled={disabled || loading}
				>
					<option value="" className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}>
						{t('autofill.contentStudioNotSelected')}
					</option>
					{items.map((item) => (
						<option
							key={item.id}
							value={item.id}
							className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
						>
							{unifiedContentDisplayLabel(item)}
						</option>
					))}
				</DesktopNativeSelect>
				{loading && (
					<div className="pointer-events-none absolute right-9 top-1/2 -translate-y-1/2">
						<ArrowPathIcon className="h-3.5 w-3.5 animate-spin text-(--desktop-text-tertiary)" />
					</div>
				)}
			</div>
			{items.length === 0 && query.isSuccess && !loading && (
				<p className="text-[10px] text-(--desktop-text-tertiary)">
					{t('autofill.contentStudioEmpty')}
				</p>
			)}
		</div>
	);
};
