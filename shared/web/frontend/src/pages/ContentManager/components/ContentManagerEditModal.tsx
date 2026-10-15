/**
 * Edit metadata modal for Content Manager (name, tags, visibility, folder, company/project).
 */
import type { UseQueryResult } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import type { Content as ContentItem } from '../../../components/UnifiedContent/types';
import { cn } from '../../../utils/cn';
import type { Friend } from '@/features/friends/types';
import {
	DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME,
	DesktopAppButton,
	DesktopAppInput,
	DesktopAppModalFrame,
	DesktopNativeSelect,
} from '../../Desktop/components/DesktopAppChrome';
import { DESKTOP_TYPOGRAPHY } from '../../Desktop/constants';
import { useEmbeddedPortaledModalZIndex } from '../../Desktop/context/DesktopWindowPortalStackContext';
import { resolveDesktopFolderDisplayName } from '../../Desktop/utils/desktopSystemFolderLabels';
import { CheckIcon, PencilSquareIcon } from '@heroicons/react/24/outline';

import { TenancyCompany, TenancyProject } from '../hooks/useTenancyOptions';

export type ContentManagerEditFormState = {
	name: string;
	description: string;
	tags: string;
	visibility: string;
	folder_item_id: string | null;
	company_id: string;
	project_id: string;
	friend_visibility: boolean;
	friend_shared_user_ids: string[];
};

export type ContentManagerEditFolderOption = {
	item_id: string;
	name: string;
	is_system?: boolean;
	/** Stable system folder key when present (display i18n; API name stays canonical). */
	system_key?: string | null;
};

export type ContentManagerEditModalProps = {
	item: ContentItem | null;
	embedded: boolean;
	editForm: ContentManagerEditFormState;
	setEditForm: React.Dispatch<
		React.SetStateAction<ContentManagerEditFormState>
	>;
	editNameError: string | null;
	setEditNameError: React.Dispatch<React.SetStateAction<string | null>>;
	onClose: () => void;
	onSave: () => void | Promise<void>;
	folders: ContentManagerEditFolderOption[];
	companies: TenancyCompany[];
	projects: TenancyProject[];
	loadingCompanies: boolean;
	loadingProjects: boolean;
	refreshProjects: (companyId: string | null) => void | Promise<void>;
	friendsForEditQuery: UseQueryResult<Friend[], Error>;
};

export function ContentManagerEditModal({
	item,
	embedded,
	editForm,
	setEditForm,
	editNameError,
	setEditNameError,
	onClose,
	onSave,
	folders,
	companies,
	projects,
	loadingCompanies,
	loadingProjects,
	refreshProjects,
	friendsForEditQuery,
}: ContentManagerEditModalProps): React.ReactElement {
	const { t } = useTranslation('contentManager');
	const { t: tDesktopUi } = useTranslation('desktopUi');
	const embeddedModalZ = useEmbeddedPortaledModalZIndex();

	return (
		<AnimatePresence>
			{item && (
				<motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					className={
						embedded
							? 'absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4'
							: 'fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4'
					}
					style={{ zIndex: embeddedModalZ.backdrop }}
					onClick={onClose}
				>
					<motion.div
						initial={{ scale: 0.95 }}
						animate={{ scale: 1 }}
						exit={{ scale: 0.95 }}
						className="w-full max-w-lg"
						style={{ zIndex: embeddedModalZ.content }}
						onClick={(e) => e.stopPropagation()}
					>
						<DesktopAppModalFrame
							title={
								<span className="flex items-center gap-2">
									<PencilSquareIcon className="h-4 w-4 text-(--desktop-text-muted)" />
									{t('pro.edit.title')}
								</span>
							}
							onClose={onClose}
							className="max-h-[min(80vh,36rem)] flex flex-col"
						>
							<div className="flex min-h-0 flex-1 flex-col overflow-hidden">
								<div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
									<div>
										<label
											htmlFor="cm-edit-name"
											className={cn(
												DESKTOP_TYPOGRAPHY.meta,
												'mb-1.5 block font-medium'
											)}
										>
											{t('pro.edit.name')}
										</label>
										<DesktopAppInput
											id="cm-edit-name"
											type="text"
											value={editForm.name}
											onChange={(e) => {
												setEditForm((f) => ({
													...f,
													name: e.target.value,
												}));
												setEditNameError(null);
											}}
											placeholder={t('pro.edit.namePlaceholder')}
											aria-invalid={!!editNameError}
											aria-describedby={
												editNameError ? 'edit-name-error' : undefined
											}
											className={
												editNameError
													? 'border-red-500/40 focus:ring-red-500/20'
													: undefined
											}
										/>
										{editNameError && (
											<p
												id="edit-name-error"
												className="mt-1 text-xs text-red-400"
												role="alert"
											>
												{editNameError}
											</p>
										)}
									</div>
									<div>
										<label
											htmlFor="cm-edit-description"
											className={cn(
												DESKTOP_TYPOGRAPHY.meta,
												'mb-1.5 block font-medium'
											)}
										>
											{t('pro.edit.description')}
										</label>
										<textarea
											id="cm-edit-description"
											value={editForm.description}
											onChange={(e) =>
												setEditForm((f) => ({
													...f,
													description: e.target.value,
												}))
											}
											rows={2}
											placeholder={t('pro.edit.descriptionPlaceholder')}
											className="w-full resize-none rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-panel) px-3 py-2.5 text-sm text-(--desktop-text-primary) placeholder:text-(--desktop-text-dim) focus:outline-none focus:ring-2 focus:ring-[rgb(var(--desktop-accent-rgb))]/30"
										/>
									</div>
									<div>
										<label
											htmlFor="cm-edit-tags"
											className={cn(
												DESKTOP_TYPOGRAPHY.meta,
												'mb-1.5 block font-medium'
											)}
										>
											{t('pro.edit.tags')}
										</label>
										<DesktopAppInput
											id="cm-edit-tags"
											type="text"
											value={editForm.tags}
											onChange={(e) =>
												setEditForm((f) => ({ ...f, tags: e.target.value }))
											}
											placeholder={t('pro.edit.tagsPlaceholder')}
										/>
									</div>
									<div>
										<label
											htmlFor="cm-edit-visibility"
											className={cn(
												DESKTOP_TYPOGRAPHY.meta,
												'mb-1.5 block font-medium'
											)}
										>
											{t('pro.edit.visibility')}
										</label>
										<DesktopNativeSelect
											id="cm-edit-visibility"
											value={editForm.visibility}
											onChange={(e) => {
												const v = e.target.value;
												setEditForm((f) => ({
													...f,
													visibility: v,
													friend_visibility:
														v === 'shared' ? f.friend_visibility : false,
													friend_shared_user_ids:
														v === 'private' ? [] : f.friend_shared_user_ids,
												}));
											}}
											title={t('pro.edit.visibilityTitle')}
											aria-label={t('pro.edit.visibilityAria')}
										>
											<option
												value="private"
												className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
											>
												{t('pro.edit.optPrivate')}
											</option>
											<option
												value="friends"
												className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
											>
												{t('pro.edit.optFriends')}
											</option>
											<option
												value="shared"
												className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
											>
												{t('pro.edit.optShared')}
											</option>
										</DesktopNativeSelect>
									</div>
									{!editForm.company_id.trim() &&
										!editForm.project_id.trim() &&
										editForm.visibility === 'friends' && (
											<div className="space-y-2 rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/40 p-3">
												<p
													className={cn(
														DESKTOP_TYPOGRAPHY.meta,
														'font-medium text-(--desktop-text-primary)'
													)}
												>
													{t('pro.edit.friendPickTitle')}
												</p>
												<p className="text-[11px] text-(--desktop-text-muted)">
													{t('pro.edit.friendPickHintFriends')}
												</p>
												<div className="max-h-36 space-y-1 overflow-y-auto rounded-md border border-(--desktop-border-subtle)/70 bg-(--desktop-surface-elevated)/40 p-2">
													{friendsForEditQuery.isLoading ? (
														<p className="text-xs text-(--desktop-text-dim)">
															…
														</p>
													) : (
														(friendsForEditQuery.data ?? []).map((f) => {
															const label =
																f.full_name?.trim() ||
																f.username?.trim() ||
																f.id;
															const checked =
																editForm.friend_shared_user_ids.includes(f.id);
															return (
																<label
																	key={f.id}
																	className="flex cursor-pointer items-center gap-2 text-xs text-(--desktop-text-secondary)"
																>
																	<input
																		type="checkbox"
																		className="rounded border-(--desktop-border-subtle)"
																		checked={checked}
																		onChange={() => {
																			setEditForm((prev) => {
																				const next = new Set(
																					prev.friend_shared_user_ids
																				);
																				if (next.has(f.id)) {
																					next.delete(f.id);
																				} else {
																					next.add(f.id);
																				}
																				return {
																					...prev,
																					friend_shared_user_ids:
																						Array.from(next),
																				};
																			});
																		}}
																	/>
																	<span className="truncate">{label}</span>
																</label>
															);
														})
													)}
												</div>
											</div>
										)}
									{editForm.visibility === 'shared' &&
										!editForm.company_id.trim() &&
										!editForm.project_id.trim() && (
											<div className="space-y-2 rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/40 p-3">
												<label className="flex cursor-pointer items-start gap-2">
													<input
														type="checkbox"
														className="mt-0.5 rounded border-(--desktop-border-subtle)"
														checked={editForm.friend_visibility}
														onChange={(e) =>
															setEditForm((f) => ({
																...f,
																friend_visibility: e.target.checked,
																friend_shared_user_ids: e.target.checked
																	? f.friend_shared_user_ids
																	: [],
															}))
														}
													/>
													<span className="text-xs text-(--desktop-text-secondary)">
														{t('pro.edit.friendVisibility')}
													</span>
												</label>
												{editForm.friend_visibility && (
													<div>
														<p
															className={cn(
																DESKTOP_TYPOGRAPHY.meta,
																'mb-1.5 font-medium'
															)}
														>
															{t('pro.edit.friendPickTitle')}
														</p>
														<p className="mb-2 text-[11px] text-(--desktop-text-muted)">
															{t('pro.edit.friendPickHint')}
														</p>
														<div className="max-h-36 space-y-1 overflow-y-auto rounded-md border border-(--desktop-border-subtle)/70 bg-(--desktop-surface-elevated)/40 p-2">
															{friendsForEditQuery.isLoading ? (
																<p className="text-xs text-(--desktop-text-dim)">
																	…
																</p>
															) : (
																(friendsForEditQuery.data ?? []).map((f) => {
																	const label =
																		f.full_name?.trim() ||
																		f.username?.trim() ||
																		f.id;
																	const checked =
																		editForm.friend_shared_user_ids.includes(
																			f.id
																		);
																	return (
																		<label
																			key={f.id}
																			className="flex cursor-pointer items-center gap-2 text-xs text-(--desktop-text-secondary)"
																		>
																			<input
																				type="checkbox"
																				className="rounded border-(--desktop-border-subtle)"
																				checked={checked}
																				onChange={() => {
																					setEditForm((prev) => {
																						const next = new Set(
																							prev.friend_shared_user_ids
																						);
																						if (next.has(f.id)) {
																							next.delete(f.id);
																						} else {
																							next.add(f.id);
																						}
																						return {
																							...prev,
																							friend_shared_user_ids:
																								Array.from(next),
																						};
																					});
																				}}
																			/>
																			<span className="truncate">{label}</span>
																		</label>
																	);
																})
															)}
														</div>
													</div>
												)}
											</div>
										)}
									<div>
										<label
											htmlFor="cm-edit-folder"
											className={cn(
												DESKTOP_TYPOGRAPHY.meta,
												'mb-1.5 block font-medium'
											)}
										>
											{t('pro.edit.folderDesktop')}
										</label>
										<DesktopNativeSelect
											id="cm-edit-folder"
											value={editForm.folder_item_id ?? ''}
											onChange={(e) => {
												const v = e.target.value;
												setEditForm((f) => ({
													...f,
													folder_item_id: v === '' ? null : v,
												}));
											}}
											title={t('pro.edit.folderTitle')}
											aria-label={t('pro.edit.folderAria')}
										>
											<option
												value=""
												className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
											>
												{t('pro.edit.folderNone')}
											</option>
											{folders.map((f) => (
												<option
													key={f.item_id}
													value={f.item_id}
													className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
												>
													{resolveDesktopFolderDisplayName(f, tDesktopUi)}
												</option>
											))}
										</DesktopNativeSelect>
									</div>
									<p className={cn(DESKTOP_TYPOGRAPHY.meta, 'leading-5')}>
										{t('pro.edit.tenancyHint')}
									</p>
									<div>
										<label
											htmlFor="cm-edit-company"
											className={cn(
												DESKTOP_TYPOGRAPHY.meta,
												'mb-1.5 block font-medium'
											)}
										>
											{t('pro.edit.company')}
										</label>
										<DesktopNativeSelect
											id="cm-edit-company"
											value={editForm.company_id}
											onChange={(e) => {
												const v = e.target.value;
												setEditForm((f) => ({
													...f,
													company_id: v,
													project_id: '',
												}));
												void refreshProjects(v || null);
											}}
											aria-label={t('pro.edit.company')}
											disabled={loadingCompanies}
										>
											<option
												value=""
												className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
											>
												{t('pro.edit.companyNone')}
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
											htmlFor="cm-edit-project"
											className={cn(
												DESKTOP_TYPOGRAPHY.meta,
												'mb-1.5 block font-medium'
											)}
										>
											{t('pro.edit.project')}
										</label>
										<DesktopNativeSelect
											id="cm-edit-project"
											value={editForm.project_id}
											onChange={(e) =>
												setEditForm((f) => ({
													...f,
													project_id: e.target.value,
												}))
											}
											aria-label={t('pro.edit.project')}
											disabled={!editForm.company_id || loadingProjects}
										>
											<option
												value=""
												className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
											>
												{editForm.company_id
													? t('pro.edit.projectNone')
													: t('files.filters.projectNeedCompany')}
											</option>
											{projects
												.filter(
													(p) =>
														!editForm.company_id ||
														p.company_id === editForm.company_id
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
								</div>
								<div className="flex shrink-0 justify-end gap-2 border-t border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/25 px-4 py-4">
									<DesktopAppButton
										type="button"
										onClick={onClose}
										variant="neutral"
									>
										{t('pro.edit.cancel')}
									</DesktopAppButton>
									<DesktopAppButton
										type="button"
										onClick={() => void onSave()}
										variant="accent"
									>
										<CheckIcon className="h-4 w-4" />
										{t('pro.edit.save')}
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
