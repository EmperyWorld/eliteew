/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Toolbar search field for filtering CalendarApp events in the visible range.
 *
 * Related:
 * - CalendarApp.tsx
 */

import type { ReactElement, RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import {
	DesktopAppButton,
	DesktopAppInput,
} from '@/pages/Desktop/components/DesktopAppChrome';

export type CalendarAppSearchFieldProps = {
	value: string;
	inputRef: RefObject<HTMLInputElement | null>;
	onChange: (value: string) => void;
};

export function CalendarAppSearchField({
	value,
	inputRef,
	onChange,
}: CalendarAppSearchFieldProps): ReactElement {
	const { t } = useTranslation('desktopUi', { keyPrefix: 'calendarApp' });

	return (
		<div className="flex min-w-[12rem] flex-1 items-center gap-2 sm:max-w-xs">
			<DesktopAppInput
				ref={inputRef}
				type="search"
				value={value}
				placeholder={t('searchPlaceholder')}
				aria-label={t('searchLabel')}
				onChange={(event) => onChange(event.target.value)}
			/>
			{value ? (
				<DesktopAppButton
					type="button"
					size="sm"
					variant="ghost"
					onClick={() => onChange('')}
				>
					{t('searchClear')}
				</DesktopAppButton>
			) : null}
		</div>
	);
}
