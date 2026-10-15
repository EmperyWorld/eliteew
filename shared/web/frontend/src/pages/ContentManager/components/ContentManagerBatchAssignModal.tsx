/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T <keysray70@gmail.com>
 * ---
 *
 * Purpose:
 * Batch assign selected Content Manager files to a company and project.
 *
 * Invariants:
 * - Apply stays disabled until both company and project are selected.
 * - Closing is blocked while the mutation is in flight.
 *
 * Related:
 * - `ContentManagerPro.tsx`
 */
import { AnimatePresence, motion } from 'framer-motion';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../../utils/cn';
import {
	DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME,
	DesktopAppButton,
	DesktopAppModalFrame,
	DesktopNativeSelect,
} from '../../Desktop/components/DesktopAppChrome';
import { DESKTOP_TYPOGRAPHY } from '../../Desktop/constants';
import {
	ArrowPathIcon,
	CheckIcon,
	LinkIcon,
} from '@heroicons/react/24/outline';

import type {
	TenancyCompany,
	TenancyProject,
} from '../hooks/useTenancyOptions';

export type ContentManagerBatchAssignModalProps = {
	open: boolean;
	embedded: boolean;
	loading: boolean;
	assignCompanyId: string;
	assignProjectId: string;
	onCompanyChange: (companyId: string) => void;
	onProjectChange: (projectId: string) => void;
	onClose: () => void;
	onApply: () => void | Promise<void>;
	companies: TenancyCompany[];
	projects: TenancyProject[];
	loadingCompanies: boolean;
	loadingProjects: boolean;
};

export function ContentManagerBatchAssignModal({
	open,
	embedded,
	loading,
	assignCompanyId,
	assignProjectId,
	onCompanyChange,
	onProjectChange,
	onClose,
	onApply,
	companies,
	projects,
	loadingCompanies,
	loadingProjects,
}: ContentManagerBatchAssignModalProps): React.ReactElement {
	const { t } = useTranslation('contentManager');
	const canApply = Boolean(assignCompanyId && assignProjectId) && !loading;
	const helperText = !assignCompanyId
		? t('pro.batchAssign.pickCompanyFirst')
		: !assignProjectId
			? t('pro.batchAssign.pickProjectFirst')
			: t('pro.batchAssign.ready');

	const requestClose = React.useCallback(() => {
		if (!loading) onClose();
	}, [loading, onClose]);

	return (
		<AnimatePresence>
			{open && (
				<motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					className={
						embedded
							? 'absolute inset-0 z-60 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4'
							: 'fixed inset-0 z-60 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4'
					}
					onClick={requestClose}
				>
					<motion.div
						initial={{ scale: 0.95 }}
						animate={{ scale: 1 }}
						exit={{ scale: 0.95 }}
						className="w-full max-w-md"
						onClick={(e) => e.stopPropagation()}
					>
						<DesktopAppModalFrame
							title={
								<span className="flex items-center gap-2">
									<LinkIcon className="h-4 w-4 text-(--desktop-text-muted)" />
									{t('pro.batchAssign.title')}
								</span>
							}
							onClose={requestClose}
							className="max-h-[min(80vh,28rem)] flex flex-col"
						>
							<div className="flex min-h-0 flex-1 flex-col overflow-hidden">
								<div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
									<p className={cn(DESKTOP_TYPOGRAPHY.meta)}>
										{t('pro.batchAssign.description')}
									</p>
									<div>
										<label
											htmlFor="cm-batch-company"
											className={cn(
												DESKTOP_TYPOGRAPHY.meta,
												'mb-1.5 block font-medium'
											)}
										>
											{t('files.filters.company')}
										</label>
										<DesktopNativeSelect
											id="cm-batch-company"
											value={assignCompanyId}
											onChange={(e) => onCompanyChange(e.target.value)}
											disabled={loading || loadingCompanies}
										>
											<option
												value=""
												className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
											>
												{t('pro.batchAssign.pickCompany')}
											</option>
											{companies.map((c) => (
												<option
													key={c.id}
													value={c.id}
													className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
												>
													{c.name}
												</option>
											))}
										</DesktopNativeSelect>
									</div>
									<div>
										<label
											htmlFor="cm-batch-project"
											className={cn(
												DESKTOP_TYPOGRAPHY.meta,
												'mb-1.5 block font-medium'
											)}
										>
											{t('files.filters.project')}
										</label>
										<DesktopNativeSelect
											id="cm-batch-project"
											value={assignProjectId}
											onChange={(e) => onProjectChange(e.target.value)}
											disabled={loading || !assignCompanyId || loadingProjects}
										>
											<option
												value=""
												className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
											>
												{assignCompanyId
													? t('pro.batchAssign.pickProject')
													: t('files.filters.projectNeedCompany')}
											</option>
											{projects
												.filter(
													(p) =>
														!assignCompanyId || p.company_id === assignCompanyId
												)
												.map((p) => (
													<option
														key={p.id}
														value={p.id}
														className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
													>
														{p.name}
													</option>
												))}
										</DesktopNativeSelect>
									</div>
									<p
										className={cn(
											DESKTOP_TYPOGRAPHY.meta,
											assignCompanyId && assignProjectId
												? 'text-(--desktop-text-secondary)'
												: 'text-amber-200/90'
										)}
										role="status"
										aria-live="polite"
									>
										{helperText}
									</p>
								</div>
								<div className="flex shrink-0 justify-end gap-2 border-t border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/25 px-4 py-4">
									<DesktopAppButton
										type="button"
										onClick={onClose}
										variant="neutral"
										disabled={loading}
									>
										{t('pro.batchAssign.cancel')}
									</DesktopAppButton>
									<DesktopAppButton
										type="button"
										onClick={() => void onApply()}
										variant="accent"
										disabled={!canApply}
									>
										{loading ? (
											<ArrowPathIcon className="h-4 w-4 animate-spin" />
										) : (
											<CheckIcon className="h-4 w-4" />
										)}
										{t('pro.batchAssign.apply')}
									</DesktopAppButton>
								</div>
							</div>
						</DesktopAppModalFrame>
					</motion.div>
				</motion.div>
			)}
		</AnimatePresence>
	);
}
