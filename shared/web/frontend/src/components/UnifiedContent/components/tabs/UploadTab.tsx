/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unified Content upload tab: dropping files, classification, recent uploads snippet.
 *
 * Invariants:
 * - Recent uploads use authenticated `ContentThumbnail` for previews.
 *
 * Related:
 * - UnifiedContentManager.tsx.
 */
import * as React from 'react';
import { useLayoutEffect, useRef } from 'react';
import {
	ArrowUpTrayIcon,
	InformationCircleIcon,
} from '@heroicons/react/24/outline';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useFriendsList } from '@/features/friends/hooks/useFriends';
import { SelectV2 } from '../../../ui/SelectV2';
import type { EditForm, Company, Project, Content } from '../../types';
import { getAvailableVisibilityOptions } from '../../utils/visibilityRules';
import { getFileIcon, formatBytes, formatDate } from '../../utils/contentUtils';
import { ContentThumbnail } from '../ContentThumbnail/ContentThumbnail';
import { ContentType } from '@/types/fileExchange';

function UploadProgressFill({
	progress,
	className,
}: {
	progress: number;
	className: string;
}) {
	const ref = useRef<HTMLDivElement>(null);
	useLayoutEffect(() => {
		const el = ref.current;
		if (!el) return;
		el.style.width = `${progress}%`;
	}, [progress]);
	return <div ref={ref} className={className} />;
}

interface UploadTabProps {
	editForm: EditForm;
	companies: Company[];
	projects: Project[];
	contents: Content[];
	uploadProgress: Record<string, number>;
	isDragging: boolean;
	fileInputRef: React.RefObject<HTMLInputElement | null>;
	onFormChange: (form: Partial<EditForm>) => void;
	onFileSelect: (files: FileList | null) => void;
	onDragOver: (e: React.DragEvent) => void;
	onDragLeave: (e: React.DragEvent) => void;
	onDrop: (e: React.DragEvent) => void;
	onWarning: (title: string, message: string) => void;
}

export const UploadTab: React.FC<UploadTabProps> = ({
	editForm,
	companies,
	projects,
	contents,
	uploadProgress,
	isDragging,
	fileInputRef,
	onFormChange,
	onFileSelect,
	onDragOver,
	onDragLeave,
	onDrop,
	onWarning,
}) => {
	const { t } = useTranslation('contentManager');
	const hasCompany = !!editForm.company_id;
	const hasProject = !!editForm.project_id;
	const friendPickEnabled =
		editForm.visibility === 'shared' &&
		!hasCompany &&
		!hasProject &&
		editForm.friend_visibility;
	const friendsQuery = useFriendsList({ enabled: friendPickEnabled });
	const friendIds = editForm.friend_shared_user_ids ?? [];
	const visibilityOptions = getAvailableVisibilityOptions(
		hasCompany,
		hasProject
	);

	return (
		<div className="min-w-0 max-w-full space-y-6">
			{/* Classification Form */}
			<div className="rounded-lg border border-white/20 bg-white/10 p-4 backdrop-blur-xl">
				<h3 className="mb-4 font-semibold text-white">
					{t('uploadTab.classificationTitle')}
				</h3>
				<div className="grid grid-cols-1 gap-4 md:grid-cols-3">
					<div>
						<span className="mb-2 block text-sm text-gray-400">
							{t('uploadTab.company')}
						</span>
						<SelectV2
							options={[
								{ value: '', label: t('uploadTab.companyNone') },
								...(Array.isArray(companies)
									? companies.map((c) => ({ value: c.id, label: c.name }))
									: []),
							]}
							value={editForm.company_id || ''}
							onChange={(value) => {
								const newCompanyId = (value as string) || null;
								onFormChange({ company_id: newCompanyId });
								if (!newCompanyId) {
									onFormChange({ project_id: null });
								}
							}}
							placeholder={t('uploadTab.companyPlaceholder')}
						/>
					</div>
					<div>
						<span className="mb-2 block text-sm text-gray-400">
							{t('uploadTab.project')}
						</span>
						<SelectV2
							options={[
								{ value: '', label: t('uploadTab.projectNone') },
								...(Array.isArray(projects)
									? projects
											.filter(
												(p) =>
													!editForm.company_id ||
													p.company_id === editForm.company_id
											)
											.map((p) => ({ value: p.id, label: p.name }))
									: []),
							]}
							value={editForm.project_id || ''}
							onChange={(value) =>
								onFormChange({ project_id: (value as string) || null })
							}
							disabled={!editForm.company_id}
							placeholder={t('uploadTab.projectPlaceholder')}
							helperText={
								editForm.company_id
									? undefined
									: t('uploadTab.projectNeedCompany')
							}
						/>
					</div>
					<div>
						<span className="mb-2 block text-sm text-gray-400">
							{t('uploadTab.visibility')}
						</span>
						<SelectV2
							options={visibilityOptions.map((opt) => ({
								value: opt.value,
								label: opt.label,
								disabled: opt.disabled,
							}))}
							value={editForm.visibility}
							onChange={(value) => {
								const newVisibility = value as string;
								if (newVisibility === 'public' && !hasProject) {
									onWarning(
										t('uploadTab.warningPublicTitle'),
										t('uploadTab.warningPublicBody')
									);
									return;
								}
								if (newVisibility === 'shared' && (hasCompany || hasProject)) {
									onWarning(
										t('uploadTab.warningSharedTitle'),
										t('uploadTab.warningSharedBody')
									);
									return;
								}
								onFormChange({
									visibility: newVisibility,
									friend_visibility:
										newVisibility === 'shared'
											? editForm.friend_visibility
											: false,
									friend_shared_user_ids:
										newVisibility === 'shared'
											? editForm.friend_shared_user_ids
											: [],
								});
							}}
							placeholder={t('uploadTab.visibilityPlaceholder')}
							helperText={
								visibilityOptions.find(
									(opt) => opt.value === editForm.visibility
								)?.hint
							}
						/>
					</div>
				</div>

				{editForm.visibility === 'shared' &&
					!editForm.company_id &&
					!editForm.project_id && (
						<div className="mt-4 flex items-start gap-2 rounded-lg border border-blue-500/20 bg-blue-500/10 p-3">
							<input
								type="checkbox"
								id="friend_visibility"
								checked={editForm.friend_visibility}
								onChange={(e) => {
									const checked = e.target.checked;
									onFormChange({
										friend_visibility: checked,
										friend_shared_user_ids: checked
											? editForm.friend_shared_user_ids
											: [],
									});
								}}
								className="mt-0.5 h-4 w-4 rounded border-white/20 bg-white/10 text-purple-500 focus:ring-purple-500"
							/>
							<div className="min-w-0 flex-1">
								<label
									htmlFor="friend_visibility"
									className="cursor-pointer text-sm font-medium text-gray-300"
								>
									{t('uploadTab.friendAccess')}
								</label>
								<p className="mt-1 text-xs text-gray-400">
									{t('uploadTab.friendAccessDesc')}
								</p>
								{friendPickEnabled && (
									<div className="mt-3 max-h-40 space-y-2 overflow-y-auto rounded-md border border-white/10 bg-black/20 p-2">
										<p className="text-[11px] text-gray-400">
											{t('uploadTab.friendPickHint')}
										</p>
										{friendsQuery.isLoading ? (
											<p className="text-xs text-gray-500">
												{t('uploadTab.friendPickLoading')}
											</p>
										) : (
											(friendsQuery.data ?? []).map((f) => {
												const label =
													f.full_name?.trim() || f.username?.trim() || f.id;
												const checked = friendIds.includes(f.id);
												return (
													<label
														key={f.id}
														className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-xs text-gray-300 hover:bg-white/5"
													>
														<input
															type="checkbox"
															className="h-3.5 w-3.5 rounded border-white/20 bg-white/10"
															checked={checked}
															onChange={() => {
																const next = new Set(friendIds);
																if (next.has(f.id)) {
																	next.delete(f.id);
																} else {
																	next.add(f.id);
																}
																onFormChange({
																	friend_shared_user_ids: Array.from(next),
																});
															}}
														/>
														<span className="truncate">{label}</span>
													</label>
												);
											})
										)}
									</div>
								)}
							</div>
						</div>
					)}

				<div className="mt-4 rounded-lg border border-white/10 bg-white/5 p-3">
					<div className="flex items-start gap-2">
						<InformationCircleIcon
							className="mt-0.5 h-4 w-4 shrink-0 text-purple-400"
							aria-hidden
						/>
						<div className="space-y-1 text-xs text-gray-400">
							<p>
								<strong className="text-white">
									{t('files.filters.visibilityPrivate')}:
								</strong>{' '}
								{t('uploadTab.visibilityHelpPrivate')}
							</p>
							<p>
								<strong className="text-white">
									{t('files.filters.visibilityShared')}:
								</strong>{' '}
								{t('uploadTab.visibilityHelpShared')}
							</p>
							<p>
								<strong className="text-white">
									{t('pro.visibility.public')}:
								</strong>{' '}
								{t('uploadTab.visibilityHelpPublic')}
							</p>
						</div>
					</div>
				</div>
			</div>

			<motion.div
				role="region"
				aria-label={t('uploadTab.dropRegionAria')}
				onDragOver={onDragOver}
				onDragLeave={onDragLeave}
				onDrop={onDrop}
				className={`rounded-xl border-2 border-dashed p-10 text-center backdrop-blur-xl transition-[border-color,background-color,box-shadow] duration-200 motion-reduce:transition-none sm:p-12 ${
					isDragging
						? 'border-purple-500 bg-linear-to-br from-purple-500/10 to-pink-500/10 shadow-lg shadow-purple-500/40'
						: 'border-white/20 bg-white/10 hover:border-white/40 hover:bg-white/15'
				}`}
				transition={{ duration: 0.2 }}
			>
				<ArrowUpTrayIcon
					className="mx-auto mb-4 h-16 w-16 text-gray-400"
					aria-hidden
				/>
				<h3 className="mb-2 text-xl font-semibold text-white">
					{t('uploadTab.dropTitle')}
				</h3>
				<p className="mb-2 text-gray-400">{t('uploadTab.dropSubtitle')}</p>
				<p className="mb-4 text-xs text-gray-500" id="upload-tab-keyboard-hint">
					{t('uploadTab.dropKeyboardHint')}
				</p>
				<input
					ref={fileInputRef}
					type="file"
					multiple
					onChange={(e) => onFileSelect(e.target.files)}
					className="hidden"
					aria-label={t('uploadTab.chooseFilesAria')}
				/>
				<motion.button
					type="button"
					onClick={() => fileInputRef.current?.click()}
					className="rounded-lg bg-linear-to-r from-purple-500 to-pink-500 px-6 py-3 text-white shadow-lg shadow-purple-500/40 transition-colors hover:from-purple-600 hover:to-pink-600 min-h-11 min-w-11"
					whileTap={{ scale: 0.95 }}
					aria-label={t('uploadTab.chooseFilesAria')}
					aria-describedby="upload-tab-keyboard-hint"
				>
					{t('uploadTab.chooseFiles')}
				</motion.button>
			</motion.div>

			{Object.keys(uploadProgress).length > 0 && (
				<div className="space-y-3">
					<h3 className="text-lg font-semibold text-white">
						{t('uploadTab.progressTitle')}
					</h3>
					{Object.entries(uploadProgress).map(([filename, progress]) => (
						<motion.div
							key={filename}
							className="rounded-lg border border-white/20 bg-white/10 p-4 shadow-xl shadow-purple-500/20 backdrop-blur-xl"
							initial={{ opacity: 0, y: 10 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.3 }}
							role="status"
							aria-label={filename}
							aria-valuenow={progress}
							aria-valuemin={0}
							aria-valuemax={100}
						>
							<div className="mb-2 flex items-center justify-between">
								<span className="text-sm text-white">{filename}</span>
								<span className="text-sm text-gray-400">{progress}%</span>
							</div>
							<div className="h-2 w-full rounded-full bg-gray-700">
								<UploadProgressFill
									progress={progress}
									className="h-2 rounded-full bg-linear-to-r from-purple-500 to-pink-500 shadow-lg shadow-purple-500/40 transition-[width] duration-300 ease-out motion-reduce:transition-none"
								/>
							</div>
						</motion.div>
					))}
				</div>
			)}

			<div className="min-w-0">
				<h3 className="mb-4 text-lg font-semibold text-white">
					{t('uploadTab.recentTitle')}
				</h3>
				<div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
					{Array.isArray(contents) &&
						contents.slice(0, 6).map((content) => (
							<motion.div
								key={content.id}
								className="rounded-lg border border-white/20 bg-white/10 p-4 shadow-xl shadow-purple-500/20 backdrop-blur-xl transition-[background-color,border-color,box-shadow] hover:border-white/30 hover:bg-white/12 hover:shadow-[0_10px_28px_rgba(15,23,42,0.22)]"
								transition={{ duration: 0.2 }}
							>
								<div className="flex items-start gap-3">
									<div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-sm border border-white/20 bg-white/10 backdrop-blur-xl">
										{content.content_type === ContentType.AUDIO ? (
											<span className="flex h-full w-full items-center justify-center">
												{getFileIcon(content.content_type)}
											</span>
										) : (
											<ContentThumbnail contentId={content.id} alt="" />
										)}
									</div>
									<div className="min-w-0 flex-1">
										<h4 className="truncate text-sm font-medium text-white">
											{content.name}
										</h4>
										<p className="text-xs text-gray-400">
											{formatBytes(content.file_size)}
										</p>
										<p className="text-xs text-gray-500">
											{formatDate(content.created_at)}
										</p>
									</div>
								</div>
							</motion.div>
						))}
				</div>
			</div>
		</div>
	);
};
