/**
 * BulkEditToolbar - Панель массового редактирования
 *
 * Функции:
 * - Массовое редактирование тегов
 * - Изменение видимости
 * - Изменение компании/проекта
 * - Удаление выбранных файлов
 */

import * as React from 'react';
import { useEffect, useState } from 'react';
import {
	ArchiveBoxIcon,
	BuildingOffice2Icon,
	CheckIcon,
	DocumentTextIcon,
	EyeIcon,
	PlusIcon,
	TagIcon,
	TrashIcon,
	XMarkIcon,
} from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { ConfirmDeleteModal } from '@/components/ui/modals/ConfirmDeleteModal';
import { cn } from '@/utils/cn';
import { ButtonV2 } from '../../../ui/ButtonV2';
import { InputV2 } from '../../../ui/InputV2';
import { apiClient } from '../../../../services/api';
import { log } from '../../../../utils/logger';
import { toErrorText } from '@/utils/toErrorText';

interface BulkEditToolbarProps {
	selectedIds: Set<string>;
	onClose: () => void;
	onUpdate: () => void;
	companies?: Array<{ id: string; name: string }>;
	projects?: Array<{ id: string; name: string; company_id: string }>;
	contents?: Array<{ id: string; name: string }>;
	onShowRename?: () => void;
}

export const BulkEditToolbar: React.FC<BulkEditToolbarProps> = ({
	selectedIds,
	onClose,
	onUpdate,
	companies = [],
	projects = [],
	onShowRename,
}) => {
	const { t } = useTranslation('contentManager');
	const [activeTab, setActiveTab] = useState<
		'tags' | 'visibility' | 'company' | null
	>(null);
	const [tags, setTags] = useState<string[]>([]);
	const [newTag, setNewTag] = useState('');
	const [visibility, setVisibility] = useState<
		'private' | 'public' | 'shared' | 'friends'
	>('private');
	const [selectedCompany, setSelectedCompany] = useState<string>('');
	const [selectedProject, setSelectedProject] = useState<string>('');
	const [loading, setLoading] = useState(false);
	const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);

	const selectedCount = selectedIds.size;

	useEffect(() => {
		const onKeyDown = (e: KeyboardEvent): void => {
			if (e.key !== 'Escape' || e.defaultPrevented) {
				return;
			}
			if (loading) {
				return;
			}
			const target = e.target;
			if (
				target instanceof HTMLElement &&
				target.closest('input, textarea, select, [contenteditable="true"]')
			) {
				return;
			}
			e.preventDefault();
			onClose();
		};
		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	}, [loading, onClose]);

	// Добавить тег
	const handleAddTag = (): void => {
		if (newTag.trim() && !tags.includes(newTag.trim())) {
			setTags([...tags, newTag.trim()]);
			setNewTag('');
		}
	};

	// Удалить тег
	const handleRemoveTag = (tagToRemove: string): void => {
		setTags(tags.filter((t) => t !== tagToRemove));
	};

	// Применить массовое редактирование
	const handleApply = async (): Promise<void> => {
		if (selectedIds.size === 0) {
			return;
		}

		setLoading(true);
		try {
			interface BulkUpdates {
				tags?: string[];
				visibility?: 'private' | 'public' | 'shared' | 'friends';
				company_id?: string;
				project_id?: string;
			}
			const updates: BulkUpdates = {};

			// Теги
			if (activeTab === 'tags' && tags.length > 0) {
				updates.tags = tags;
			}

			// Видимость
			if (activeTab === 'visibility') {
				updates.visibility = visibility;
			}

			// Компания
			if (activeTab === 'company' && selectedCompany) {
				updates.company_id = selectedCompany;
			}

			// Проект
			if (activeTab === 'company' && selectedProject) {
				updates.project_id = selectedProject;
			}

			// Применяем изменения ко всем выбранным файлам
			const promises = Array.from(selectedIds).map((id) =>
				apiClient.patch(`/api/v1/content/${id}`, updates)
			);

			await Promise.all(promises);

			onUpdate();
			onClose();
		} catch (error: unknown) {
			const errorObj =
				error instanceof Error ? error : new Error(String(error));
			log.error('BulkEditToolbar', 'Bulk update failed', errorObj);
			toast.error(toErrorText(error));
		} finally {
			setLoading(false);
		}
	};

	// Пакетное скачивание
	const handleBatchDownload = async (): Promise<void> => {
		if (selectedIds.size === 0) {
			return;
		}

		setLoading(true);
		try {
			const response = await apiClient.post(
				'/api/v1/content/batch-download',
				{
					content_ids: Array.from(selectedIds),
					archive_name: `content_batch_${new Date().toISOString().split('T')[0]}.zip`,
				},
				{
					responseType: 'blob',
				}
			);

			// Создаем ссылку для скачивания
			const url = window.URL.createObjectURL(new Blob([response.data]));
			const link = document.createElement('a');
			link.href = url;
			link.setAttribute(
				'download',
				`content_batch_${new Date().toISOString().split('T')[0]}.zip`
			);
			document.body.appendChild(link);
			link.click();
			link.remove();
			window.URL.revokeObjectURL(url);

			onClose();
		} catch (error: unknown) {
			const errorObj =
				error instanceof Error ? error : new Error(String(error));
			log.error('BulkEditToolbar', 'Batch download failed', errorObj);
			toast.error(toErrorText(error));
		} finally {
			setLoading(false);
		}
	};

	// Массовое удаление (после подтверждения в модалке)
	const executeBulkDelete = async (): Promise<void> => {
		if (selectedIds.size === 0) {
			return;
		}

		setLoading(true);
		try {
			const promises = Array.from(selectedIds).map((id) =>
				apiClient.delete(`/api/v1/content/${id}`)
			);

			await Promise.all(promises);

			setShowBulkDeleteModal(false);
			onUpdate();
			onClose();
		} catch (error: unknown) {
			const errorObj =
				error instanceof Error ? error : new Error(String(error));
			log.error('BulkEditToolbar', 'Bulk delete failed', errorObj);
			toast.error(toErrorText(error));
		} finally {
			setLoading(false);
		}
	};

	const tabBtnClass = (active: boolean) =>
		cn(
			'rounded-lg px-4 py-2 text-sm font-medium transition-[background-color,border-color,color,opacity] duration-200 motion-reduce:transition-none',
			active
				? 'border border-purple-500/50 bg-purple-500/30 text-purple-400'
				: 'text-gray-400 hover:bg-white/5 hover:text-white'
		);

	return (
		<>
			<AnimatePresence>
				<motion.div
					initial={{ opacity: 0, y: -20 }}
					animate={{ opacity: 1, y: 0 }}
					exit={{ opacity: 0, y: -20 }}
					className="fixed bottom-6 left-1/2 z-50 w-full max-w-4xl -translate-x-1/2 px-4 pb-[env(safe-area-inset-bottom,0px)]"
				>
					<div
						className="relative overflow-hidden rounded-xl border border-white/30 bg-linear-to-br from-slate-950 via-slate-950 to-slate-900 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.85),0_0_0_1px_rgba(255,255,255,0.08),0_-12px_40px_-18px_rgba(168,85,247,0.12)] ring-2 ring-white/20 ring-offset-2 ring-offset-black/40 backdrop-blur-xl backdrop-saturate-150 contain-[layout] before:pointer-events-none before:absolute before:inset-x-4 before:top-0 before:h-px before:rounded-full before:bg-linear-to-r before:from-transparent before:via-purple-400/35 before:to-transparent"
						role="toolbar"
						aria-label="Массовое редактирование контента"
					>
						{/* Header */}
						<div className="px-6 py-4 border-b border-white/15 bg-black/25 flex items-center justify-between gap-3">
							<div className="flex items-center gap-3 min-w-0">
								<div className="w-10 h-10 shrink-0 bg-purple-500/35 rounded-lg flex items-center justify-center border border-purple-400/25">
									<CheckIcon className="w-5 h-5 text-purple-300" />
								</div>
								<div className="min-w-0 flex-1">
									<div className="flex flex-wrap items-center gap-2 gap-y-1">
										<h3 className="font-semibold text-white">
											Массовое редактирование
										</h3>
										<span
											className="inline-flex min-w-9 items-center justify-center rounded-full border-2 border-purple-300/45 bg-purple-500/35 px-3 py-0.5 text-lg font-extrabold tabular-nums tracking-tight text-white shadow-md shadow-purple-950/60"
											aria-live="polite"
											aria-atomic="true"
										>
											{selectedCount}
										</span>
									</div>
									<p className="mt-0.5 text-xs text-gray-300">
										Выбрано{' '}
										<strong className="text-base font-extrabold tabular-nums text-white">
											{selectedCount}
										</strong>{' '}
										{selectedCount === 1
											? 'файл'
											: selectedCount < 5
												? 'файла'
												: 'файлов'}
										<span className="text-gray-500"> · </span>
										<span className="text-gray-400">Esc — снять выделение</span>
									</p>
								</div>
							</div>
							<button
								type="button"
								onClick={onClose}
								className="shrink-0 p-2 hover:bg-white/10 rounded-lg transition-colors focus:outline-hidden focus:ring-2 focus:ring-purple-500/50"
								aria-label="Закрыть и снять выделение"
							>
								<XMarkIcon className="w-5 h-5 text-gray-400" />
							</button>
						</div>

						{/* Tabs */}
						<div className="px-6 py-3 border-b border-white/10 flex items-center gap-2">
							<button
								type="button"
								onClick={() =>
									setActiveTab(activeTab === 'tags' ? null : 'tags')
								}
								className={tabBtnClass(activeTab === 'tags')}
							>
								<TagIcon className="w-4 h-4 inline mr-2" />
								Теги
							</button>
							<button
								type="button"
								onClick={() =>
									setActiveTab(activeTab === 'visibility' ? null : 'visibility')
								}
								className={tabBtnClass(activeTab === 'visibility')}
							>
								<EyeIcon className="w-4 h-4 inline mr-2" />
								Видимость
							</button>
							<button
								type="button"
								onClick={() =>
									setActiveTab(activeTab === 'company' ? null : 'company')
								}
								className={tabBtnClass(activeTab === 'company')}
							>
								<BuildingOffice2Icon className="w-4 h-4 inline mr-2" />
								Компания/Проект
							</button>
							{onShowRename && (
								<button
									type="button"
									onClick={onShowRename}
									className="rounded-lg px-4 py-2 text-sm font-medium text-gray-400 transition-[background-color,color,opacity] duration-200 motion-reduce:transition-none hover:bg-white/5 hover:text-white"
								>
									<DocumentTextIcon className="w-4 h-4 inline mr-2" />
									Переименовать
								</button>
							)}
						</div>

						{/* Content */}
						<div className="p-6">
							<AnimatePresence mode="wait">
								{activeTab === 'tags' && (
									<motion.div
										initial={{ opacity: 0, y: 10 }}
										animate={{ opacity: 1, y: 0 }}
										exit={{ opacity: 0, y: -10 }}
										className="space-y-4"
									>
										<div className="flex items-center gap-2">
											<InputV2
												placeholder="Добавить тег..."
												value={newTag}
												onChange={(e) => setNewTag(e.target.value)}
												onKeyDown={(e) => {
													if (e.key === 'Enter') {
														handleAddTag();
													}
												}}
												className="flex-1"
											/>
											<ButtonV2
												variant="secondary"
												size="md"
												onClick={handleAddTag}
												iconLeft={<PlusIcon className="w-4 h-4" />}
											>
												Добавить
											</ButtonV2>
										</div>

										{tags.length > 0 && (
											<div className="flex flex-wrap gap-2">
												{tags.map((tag) => (
													<span
														key={tag}
														className="px-3 py-1.5 bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-lg text-sm flex items-center gap-2"
													>
														{tag}
														<button
															type="button"
															onClick={() => handleRemoveTag(tag)}
															className="hover:text-red-400 transition-colors"
															aria-label={`Удалить тег ${tag}`}
															title={`Удалить тег ${tag}`}
														>
															<XMarkIcon className="w-3 h-3" />
														</button>
													</span>
												))}
											</div>
										)}

										<p className="text-xs text-gray-400">
											Теги будут применены ко всем выбранным файлам
										</p>
									</motion.div>
								)}

								{activeTab === 'visibility' && (
									<motion.div
										initial={{ opacity: 0, y: 10 }}
										animate={{ opacity: 1, y: 0 }}
										exit={{ opacity: 0, y: -10 }}
										className="space-y-4"
									>
										<div className="space-y-2">
											<label className="flex cursor-pointer items-center gap-3 rounded-lg border border-white/10 p-3 transition-colors duration-150 motion-reduce:transition-none hover:bg-white/5">
												<input
													type="radio"
													name="visibility"
													value="private"
													checked={visibility === 'private'}
													onChange={(e) => {
														const value = e.target.value;
														if (
															value === 'private' ||
															value === 'public' ||
															value === 'shared' ||
															value === 'friends'
														) {
															setVisibility(value);
														}
													}}
													className="w-4 h-4 text-purple-500"
												/>
												<div>
													<div className="text-white font-medium">
														Приватный
													</div>
													<div className="text-xs text-gray-400">
														Только вы можете видеть
													</div>
												</div>
											</label>
											<label className="flex cursor-pointer items-center gap-3 rounded-lg border border-white/10 p-3 transition-colors duration-150 motion-reduce:transition-none hover:bg-white/5">
												<input
													type="radio"
													name="visibility"
													value="friends"
													checked={visibility === 'friends'}
													onChange={(e) => {
														const value = e.target.value;
														if (
															value === 'private' ||
															value === 'public' ||
															value === 'shared' ||
															value === 'friends'
														) {
															setVisibility(value);
														}
													}}
													className="w-4 h-4 text-purple-500"
												/>
												<div>
													<div className="text-white font-medium">Друзья</div>
													<div className="text-xs text-gray-400">
														Видно только вашим друзьям
													</div>
												</div>
											</label>
											<label className="flex cursor-pointer items-center gap-3 rounded-lg border border-white/10 p-3 transition-colors duration-150 motion-reduce:transition-none hover:bg-white/5">
												<input
													type="radio"
													name="visibility"
													value="shared"
													checked={visibility === 'shared'}
													onChange={(e) => {
														const value = e.target.value;
														if (
															value === 'private' ||
															value === 'public' ||
															value === 'shared' ||
															value === 'friends'
														) {
															setVisibility(value);
														}
													}}
													className="w-4 h-4 text-purple-500"
												/>
												<div>
													<div className="text-white font-medium">Общий</div>
													<div className="text-xs text-gray-400">
														Доступен по ссылке
													</div>
												</div>
											</label>
										</div>
									</motion.div>
								)}

								{activeTab === 'company' && (
									<motion.div
										initial={{ opacity: 0, y: 10 }}
										animate={{ opacity: 1, y: 0 }}
										exit={{ opacity: 0, y: -10 }}
										className="space-y-4"
									>
										<div>
											<label
												htmlFor="uc-bulk-edit-company"
												className="block text-sm font-medium text-gray-300 mb-2"
											>
												Компания
											</label>
											<select
												id="uc-bulk-edit-company"
												value={selectedCompany}
												onChange={(e) => {
													setSelectedCompany(e.target.value);
													setSelectedProject(''); // Сброс проекта при смене компании
												}}
												className="w-full px-4 py-2 bg-black/40 border border-white/10 rounded-lg text-white focus:border-purple-500 focus:outline-none"
												aria-label="Выбор компании"
												title="Выберите компанию"
											>
												<option value="">Не выбрано</option>
												{companies.map((company) => (
													<option key={company.id} value={company.id}>
														{company.name}
													</option>
												))}
											</select>
										</div>

										<div>
											<label
												htmlFor="uc-bulk-edit-project"
												className="block text-sm font-medium text-gray-300 mb-2"
											>
												Проект
											</label>
											<select
												id="uc-bulk-edit-project"
												value={selectedProject}
												onChange={(e) => setSelectedProject(e.target.value)}
												className="w-full px-4 py-2 bg-black/40 border border-white/10 rounded-lg text-white focus:border-purple-500 focus:outline-none"
												disabled={!selectedCompany}
												aria-label="Выбор проекта"
												title="Выберите проект"
											>
												<option value="">Не выбрано</option>
												{projects
													.filter(
														(p) =>
															!selectedCompany ||
															p.company_id === selectedCompany
													)
													.map((project) => (
														<option key={project.id} value={project.id}>
															{project.name}
														</option>
													))}
											</select>
										</div>
									</motion.div>
								)}

								{!activeTab && (
									<motion.div
										initial={{ opacity: 0 }}
										animate={{ opacity: 1 }}
										exit={{ opacity: 0 }}
										className="text-center py-8 text-gray-400"
									>
										Выберите действие для массового редактирования
									</motion.div>
								)}
							</AnimatePresence>
						</div>

						{/* Actions — safe left, danger separated, primary controls end-aligned */}
						<div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/15 bg-black/20 px-6 py-4">
							<div className="flex min-w-0 flex-wrap items-center gap-3 sm:gap-4">
								<ButtonV2
									variant="gradient"
									size="md"
									onClick={handleBatchDownload}
									disabled={loading || selectedIds.size === 0}
									iconLeft={<ArchiveBoxIcon className="w-4 h-4" />}
								>
									Скачать ZIP (
									<span className="tabular-nums">{selectedCount}</span>)
								</ButtonV2>
								<div
									className="hidden h-10 w-px shrink-0 bg-linear-to-b from-transparent via-white/20 to-transparent sm:block"
									aria-hidden
								/>
								<fieldset className="m-0 min-w-0 rounded-xl border border-red-500/50 bg-red-950/50 p-2 shadow-inner shadow-red-950/50 ring-1 ring-red-400/20 sm:ml-0 sm:border-l-2 sm:border-l-red-500/60 sm:pl-3">
									<legend className="sr-only">Опасные действия</legend>
									<span className="px-1 text-[10px] font-bold uppercase tracking-wider text-red-200/95">
										Опасная зона
									</span>
									<ButtonV2
										variant="danger"
										size="md"
										onClick={() => setShowBulkDeleteModal(true)}
										disabled={loading || selectedIds.size === 0}
										iconLeft={<TrashIcon className="w-4 h-4" />}
										className="mt-1 border-red-400/50 shadow-lg shadow-red-950/55"
									>
										Удалить (
										<span className="tabular-nums">{selectedCount}</span>)
									</ButtonV2>
								</fieldset>
							</div>

							<div className="ml-auto flex shrink-0 items-center gap-3">
								<ButtonV2
									variant="ghost"
									size="md"
									onClick={onClose}
									disabled={loading}
								>
									Отмена
								</ButtonV2>
								<ButtonV2
									variant="gradient"
									size="md"
									onClick={handleApply}
									disabled={loading || !activeTab || selectedIds.size === 0}
									iconLeft={<CheckIcon className="w-4 h-4" />}
								>
									{loading ? 'Применение...' : 'Применить'}
								</ButtonV2>
							</div>
						</div>
					</div>
				</motion.div>
			</AnimatePresence>

			<ConfirmDeleteModal
				isOpen={showBulkDeleteModal}
				onClose={() => setShowBulkDeleteModal(false)}
				onConfirm={executeBulkDelete}
				closeAfterConfirm={false}
				title={t('bulkEdit.deleteModalTitle')}
				warningMessage={t('bulkEdit.deleteModalWarning', {
					count: selectedCount,
				})}
				cancelButtonLabel={t('bulkEdit.deleteModalCancel')}
				confirmButtonLabel={t('bulkEdit.deleteModalConfirm')}
				confirmButtonLoadingLabel={t('bulkEdit.deleteModalDeleting')}
			/>
		</>
	);
};

export default BulkEditToolbar;
