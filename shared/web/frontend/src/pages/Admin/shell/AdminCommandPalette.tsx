/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Keyboard command palette for unified admin (section jump + user lookup).
 *
 * Invariants:
 * - Opens on Ctrl+K / Meta+K when enabled; does not capture when typing in inputs.
 * - User search uses same directory API as Users hub (max 8 results).
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { adminApi } from '@/services/admin/api';
import { cn } from '@/utils/cn';
import { DESKTOP_SURFACE, DESKTOP_TYPOGRAPHY } from '../../Desktop/constants';
import { ADMIN_SHELL_SECTIONS, type AdminSectionId } from './adminShellConfig';
import { ADMIN_SHELL_CMD_INPUT } from './adminFormClasses';
import { resolveAdminSectionLabel } from './adminShellLabels';
import { useDebouncedValue } from '../users/useDebouncedValue';
import { primaryName } from '../users/adminUsersFormatters';

export type AdminCommandPaletteProps = {
	open: boolean;
	onClose: () => void;
	currentSection: AdminSectionId;
	onSectionChange: (id: AdminSectionId) => void;
	/** Open Users catalog with search prefilled and optional user card. */
	onOpenUser: (opts: { search: string; userId?: string }) => void;
};

export function AdminCommandPalette({
	open,
	onClose,
	currentSection,
	onSectionChange,
	onOpenUser,
}: AdminCommandPaletteProps): React.ReactElement | null {
	const { t } = useTranslation('desktopUi');
	const [query, setQuery] = React.useState('');
	const debouncedQ = useDebouncedValue(query.trim(), 300);
	const [userHits, setUserHits] = React.useState<
		Array<{
			id: string;
			username: string;
			email: string;
			full_name?: string | null;
		}>
	>([]);
	const [userBusy, setUserBusy] = React.useState(false);
	const inputRef = React.useRef<HTMLInputElement | null>(null);

	React.useEffect(() => {
		if (!open) {
			setQuery('');
			setUserHits([]);
			return;
		}
		inputRef.current?.focus();
	}, [open]);

	React.useEffect(() => {
		if (!open || debouncedQ.length < 2) {
			setUserHits([]);
			return;
		}
		let cancelled = false;
		setUserBusy(true);
		void adminApi
			.getUsersDirectory({ search: debouncedQ, page: 1, per_page: 8 })
			.then((data) => {
				if (!cancelled) setUserHits(data.users);
			})
			.catch(() => {
				if (!cancelled) setUserHits([]);
			})
			.finally(() => {
				if (!cancelled) setUserBusy(false);
			});
		return () => {
			cancelled = true;
		};
	}, [open, debouncedQ]);

	if (!open) return null;

	const sectionItems = ADMIN_SHELL_SECTIONS.filter(
		(s) => s.id !== currentSection
	);

	return (
		<div className="fixed inset-0 z-[100] flex items-start justify-center p-4 pt-[12vh]">
			<button
				type="button"
				className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
				aria-label={t('adminUsersHub.commandPalette.close')}
				onClick={onClose}
			/>
			<div
				role="dialog"
				aria-modal="true"
				aria-label={t('adminUsersHub.commandPalette.title')}
				className={cn(
					'relative z-10 w-full max-w-lg overflow-hidden',
					DESKTOP_SURFACE.radiusLg,
					'border border-white/15 bg-slate-900 shadow-2xl'
				)}
			>
				<div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
					<MagnifyingGlassIcon className="h-5 w-5 text-slate-400" aria-hidden />
					<input
						ref={inputRef}
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder={t('adminUsersHub.commandPalette.placeholder')}
						className={ADMIN_SHELL_CMD_INPUT}
					/>
					<button
						type="button"
						onClick={onClose}
						className="rounded p-1 text-slate-400 hover:bg-white/10"
						aria-label={t('adminUsersHub.commandPalette.close')}
					>
						<XMarkIcon className="h-5 w-5" />
					</button>
				</div>
				<div className="max-h-[min(50vh,24rem)] overflow-y-auto p-2">
					<p
						className={`px-2 py-1 ${DESKTOP_TYPOGRAPHY.caption} text-slate-500`}
					>
						{t('adminUsersHub.commandPalette.sections')}
					</p>
					<ul className="mb-2">
						{sectionItems.map((s) => (
							<li key={s.id}>
								<button
									type="button"
									className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-200 hover:bg-violet-500/15"
									onClick={() => {
										onSectionChange(s.id);
										onClose();
									}}
								>
									{resolveAdminSectionLabel(s.id, t)}
								</button>
							</li>
						))}
					</ul>
					{debouncedQ.length >= 2 ? (
						<>
							<p
								className={`px-2 py-1 ${DESKTOP_TYPOGRAPHY.caption} text-slate-500`}
							>
								{t('adminUsersHub.commandPalette.users')}
							</p>
							{userBusy ? (
								<p
									className={`px-3 py-2 ${DESKTOP_TYPOGRAPHY.meta} text-slate-400`}
								>
									{t('adminUsersHub.commandPalette.searching')}
								</p>
							) : userHits.length === 0 ? (
								<p
									className={`px-3 py-2 ${DESKTOP_TYPOGRAPHY.meta} text-slate-500`}
								>
									{t('adminUsersHub.commandPalette.noUsers')}
								</p>
							) : (
								<ul>
									{userHits.map((u) => (
										<li key={u.id}>
											<button
												type="button"
												className="w-full rounded-lg px-3 py-2 text-left hover:bg-white/5"
												onClick={() => {
													onOpenUser({
														search: u.email || u.username || u.id,
														userId: u.id,
													});
													onClose();
												}}
											>
												<div className="text-sm text-white">
													{primaryName(u)}
												</div>
												<div className="text-xs text-slate-500">{u.email}</div>
											</button>
										</li>
									))}
								</ul>
							)}
						</>
					) : null}
				</div>
			</div>
		</div>
	);
}
