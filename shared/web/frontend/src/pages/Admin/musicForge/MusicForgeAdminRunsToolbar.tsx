/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Search and facet filters for admin Songs runs list.
 */

import * as React from 'react';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { AdminButton, AdminField } from '../ui';
import { adminUiMetaClass } from './musicForgeConfigEditorShared';

export type MusicForgeAdminRunsToolbarFilters = {
	q: string;
	modeKey: string;
	modelLane: string;
};

export type MusicForgeAdminRunsToolbarProps = {
	filters: MusicForgeAdminRunsToolbarFilters;
	onChange: (next: MusicForgeAdminRunsToolbarFilters) => void;
	onClear: () => void;
	disabled?: boolean;
};

export function MusicForgeAdminRunsToolbar({
	filters,
	onChange,
	onClear,
	disabled = false,
}: MusicForgeAdminRunsToolbarProps): React.ReactElement {
	const { t } = useTranslation('desktopUi');
	const searchId = useId();
	const modeId = useId();
	const laneId = useId();
	const hasActiveFilters = Boolean(
		filters.q.trim() || filters.modeKey.trim() || filters.modelLane.trim()
	);

	return (
		<div className="space-y-3 rounded-[var(--admin-ui-radius)] border border-[var(--admin-ui-border)] bg-[var(--admin-ui-surface)] p-3">
			<div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
				<div className="block">
					<label htmlFor={searchId} className={adminUiMetaClass}>
						{t('adminMusicForge.songsSearchLabel')}
					</label>
					<div className="relative mt-1">
						<MagnifyingGlassIcon
							className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--admin-ui-fg-dim)]"
							aria-hidden
						/>
						<AdminField
							id={searchId}
							type="search"
							value={filters.q}
							disabled={disabled}
							placeholder={t('adminMusicForge.songsSearchPlaceholder')}
							className="pl-9"
							onChange={(event) =>
								onChange({ ...filters, q: event.target.value })
							}
						/>
					</div>
				</div>
				<div className="block">
					<label htmlFor={modeId} className={adminUiMetaClass}>
						{t('adminMusicForge.songsModeFilter')}
					</label>
					<AdminField
						id={modeId}
						className="mt-1"
						value={filters.modeKey}
						disabled={disabled}
						placeholder={t('adminMusicForge.songsModePlaceholder')}
						onChange={(event) =>
							onChange({ ...filters, modeKey: event.target.value })
						}
					/>
				</div>
				<div className="block">
					<label htmlFor={laneId} className={adminUiMetaClass}>
						{t('adminMusicForge.songsLaneFilter')}
					</label>
					<AdminField
						id={laneId}
						className="mt-1"
						value={filters.modelLane}
						disabled={disabled}
						placeholder={t('adminMusicForge.songsLanePlaceholder')}
						onChange={(event) =>
							onChange({ ...filters, modelLane: event.target.value })
						}
					/>
				</div>
			</div>
			{hasActiveFilters ? (
				<div className="flex justify-end">
					<AdminButton
						variant="ghost"
						className="py-1 text-xs"
						disabled={disabled}
						onClick={onClear}
					>
						<XMarkIcon className="h-4 w-4" />
						{t('adminMusicForge.songsClearFilters')}
					</AdminButton>
				</div>
			) : null}
		</div>
	);
}
