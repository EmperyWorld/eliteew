/**
 * File Manager Tab Component
 *
 * File manager with folder-like navigation by types, companies, and projects
 */

import { motion } from 'framer-motion';
import * as React from 'react';
import { useMemo, useState } from 'react';
import {
	ArrowDownTrayIcon,
	ArrowUpTrayIcon,
	BriefcaseIcon,
	BuildingOffice2Icon,
	ChevronRightIcon,
	FolderIcon,
	FolderOpenIcon,
	HomeIcon,
	XMarkIcon,
} from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { ButtonV2 } from '../../../ui/ButtonV2';
import { SelectV2 } from '../../../ui/SelectV2';
import { WidgetLoadingSkeleton } from '../../../ui/WidgetStates';
import type { Company, Content, Project } from '../../types';
import {
	contentTypeLabels,
	formatBytes,
	formatDate,
	getFileIcon,
} from '../../utils/contentUtils';

interface FileManagerTabProps {
	contents: Content[];
	displayedContent: Content[];
	loading: boolean;
	companies: Company[];
	projects: Project[];
	selectedFolder: string | null;
	selectedCompany: string | null;
	selectedProject: string | null;
	contentByType: Record<string, Content[]>;
	contentByCompany: Record<string, Content[]>;
	contentByProject: Record<string, Content[]>;
	onFolderSelect: (folder: string | null) => void;
	onCompanySelect: (companyId: string | null) => void;
	onProjectSelect: (projectId: string | null) => void;
	onContentView: (content: Content) => void;
	onContentDownload: (id: string, name: string) => void;
	onNavigateToUpload: () => void;
}

export const FileManagerTab: React.FC<FileManagerTabProps> = ({
	contents,
	displayedContent,
	loading,
	companies,
	projects,
	selectedFolder,
	selectedCompany,
	selectedProject,
	contentByType,
	contentByCompany,
	contentByProject,
	onFolderSelect,
	onCompanySelect,
	onProjectSelect,
	onContentView,
	onContentDownload,
	onNavigateToUpload,
}) => {
	const { t } = useTranslation('contentManager');
	const [folderView, setFolderView] = useState<
		'types' | 'companies' | 'projects'
	>('types');

	// Breadcrumbs
	const breadcrumbItems = useMemo(() => {
		const items: Array<{
			crumbKey: string;
			label: string;
			onClick?: () => void;
			icon: React.ReactNode;
		}> = [
			{
				crumbKey: 'fm-root',
				label: t('fileManagerTab.breadcrumb.root'),
				onClick: () => {
					onFolderSelect(null);
					onCompanySelect(null);
					onProjectSelect(null);
				},
				icon: <HomeIcon className="w-4 h-4" />,
			},
		];

		if (selectedCompany && Array.isArray(companies)) {
			const company = companies.find((c) => c.id === selectedCompany);
			if (company) {
				items.push({
					crumbKey: `fm-company-${selectedCompany}`,
					label: company.name,
					onClick: () => {
						onCompanySelect(null);
						onProjectSelect(null);
					},
					icon: <BuildingOffice2Icon className="w-4 h-4" />,
				});
			}
		}

		if (selectedProject && Array.isArray(projects)) {
			const project = projects.find((p) => p.id === selectedProject);
			if (project) {
				items.push({
					crumbKey: `fm-project-${selectedProject}`,
					label: project.name,
					onClick: () => onProjectSelect(null),
					icon: <BriefcaseIcon className="w-4 h-4" />,
				});
			}
		}

		if (selectedFolder) {
			items.push({
				crumbKey: `fm-folder-${selectedFolder}`,
				label: contentTypeLabels[selectedFolder] || selectedFolder,
				icon: getFileIcon(selectedFolder),
			});
		}

		return items;
	}, [
		selectedCompany,
		selectedProject,
		selectedFolder,
		companies,
		projects,
		onFolderSelect,
		onCompanySelect,
		onProjectSelect,
		t,
	]);

	return (
		<div className="space-y-4">
			{/* Breadcrumbs Navigation */}
			{breadcrumbItems.length > 1 && (
				<motion.nav
					initial={{ opacity: 0, y: -10 }}
					animate={{ opacity: 1, y: 0 }}
					className="flex items-center gap-2 text-sm bg-white/5 backdrop-blur-xl rounded-lg p-3 border border-white/10"
					aria-label={t('fileManagerTab.aria.breadcrumb')}
				>
					<ol className="flex items-center gap-2 flex-wrap">
						{breadcrumbItems.map((item, index) => {
							const isLast = index === breadcrumbItems.length - 1;

							return (
								<li key={item.crumbKey} className="flex items-center gap-2">
									{item.icon && (
										<span className="text-white/60">{item.icon}</span>
									)}

									{isLast ? (
										<span className="text-white font-semibold">
											{item.label}
										</span>
									) : (
										<button
											type="button"
											onClick={item.onClick}
											disabled={!item.onClick}
											className={`text-white/60 hover:text-white transition-colors flex items-center gap-1 ${
												item.onClick ? 'cursor-pointer' : 'cursor-default'
											}`}
										>
											{item.label}
										</button>
									)}

									{!isLast && (
										<ChevronRightIcon className="w-4 h-4 text-white/40" />
									)}
								</li>
							);
						})}
					</ol>
				</motion.nav>
			)}

			{/* View Mode Selector */}
			<div className="flex gap-2 bg-white/5 backdrop-blur-xl rounded-lg p-2 border border-white/10">
				<ButtonV2
					variant={folderView === 'types' ? 'secondary' : 'ghost'}
					size="sm"
					onClick={() => setFolderView('types')}
					iconLeft={<FolderIcon className="w-4 h-4" />}
				>
					{t('fileManagerTab.viewMode.byTypes')}
				</ButtonV2>
				<ButtonV2
					variant={folderView === 'companies' ? 'secondary' : 'ghost'}
					size="sm"
					onClick={() => setFolderView('companies')}
					iconLeft={<BuildingOffice2Icon className="w-4 h-4" />}
				>
					{t('fileManagerTab.viewMode.byCompanies')}
				</ButtonV2>
				<ButtonV2
					variant={folderView === 'projects' ? 'secondary' : 'ghost'}
					size="sm"
					onClick={() => setFolderView('projects')}
					iconLeft={<BriefcaseIcon className="w-4 h-4" />}
				>
					{t('fileManagerTab.viewMode.byProjects')}
				</ButtonV2>
			</div>

			{/* Classification Filters */}
			<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
				<div>
					<SelectV2
						label={t('fileManagerTab.filters.company')}
						options={[
							{ value: '', label: t('fileManagerTab.filters.companyAll') },
							...(Array.isArray(companies)
								? companies.map((c) => ({ value: c.id, label: c.name }))
								: []),
						]}
						value={selectedCompany || ''}
						onChange={(value) => {
							onCompanySelect((value as string) || null);
							onProjectSelect(null);
						}}
						placeholder={t('fileManagerTab.filters.companyPlaceholder')}
					/>
				</div>
				<div>
					<SelectV2
						label={t('fileManagerTab.filters.project')}
						options={[
							{ value: '', label: t('fileManagerTab.filters.projectAll') },
							...(Array.isArray(projects)
								? projects
										.filter(
											(p) =>
												!selectedCompany || p.company_id === selectedCompany
										)
										.map((p) => ({ value: p.id, label: p.name }))
								: []),
						]}
						value={selectedProject || ''}
						onChange={(value) => onProjectSelect((value as string) || null)}
						disabled={!selectedCompany}
						placeholder={t('fileManagerTab.filters.projectPlaceholder')}
					/>
				</div>
				<div className="flex items-end">
					<ButtonV2
						variant="ghost"
						size="md"
						onClick={() => {
							onCompanySelect(null);
							onProjectSelect(null);
							onFolderSelect(null);
						}}
						iconLeft={<XMarkIcon className="w-4 h-4" />}
					>
						{t('fileManagerTab.resetFilters')}
					</ButtonV2>
				</div>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
				{/* FolderIcon Tree */}
				<div className="lg:col-span-1 bg-white/5 backdrop-blur-xl rounded-lg p-4 border border-white/10">
					<h3 className="text-white font-semibold mb-3 flex items-center gap-2">
						{folderView === 'types' && <FolderIcon className="w-5 h-5" />}
						{folderView === 'companies' && (
							<BuildingOffice2Icon className="w-5 h-5" />
						)}
						{folderView === 'projects' && <BriefcaseIcon className="w-5 h-5" />}
						{folderView === 'types' && t('fileManagerTab.sidebar.contentTypes')}
						{folderView === 'companies' &&
							t('fileManagerTab.sidebar.companies')}
						{folderView === 'projects' && t('fileManagerTab.sidebar.projects')}
					</h3>
					<div className="space-y-1 max-h-[600px] overflow-y-auto">
						<motion.button
							type="button"
							onClick={() => {
								onFolderSelect(null);
								onCompanySelect(null);
								onProjectSelect(null);
							}}
							className={`w-full text-left px-3 py-2 rounded-lg flex items-center gap-2 transition-colors ${
								selectedFolder === null && !selectedCompany && !selectedProject
									? 'bg-purple-500/30 text-white'
									: 'text-gray-400 hover:bg-white/10 hover:text-white'
							}`}
							whileTap={{ scale: 0.98 }}
						>
							<FolderOpenIcon className="w-4 h-4" />
							{t('fileManagerTab.allFiles', {
								count: Array.isArray(contents) ? contents.length : 0,
							})}
						</motion.button>

						{/* Types View */}
						{folderView === 'types' &&
							contentByType &&
							typeof contentByType === 'object' &&
							Object.entries(contentByType).map(([type, items]) => (
								<motion.button
									type="button"
									key={type}
									onClick={() => {
										onFolderSelect(type);
										onCompanySelect(null);
										onProjectSelect(null);
									}}
									className={`w-full text-left px-3 py-2 rounded-lg flex items-center gap-2 transition-colors ${
										selectedFolder === type &&
										!selectedCompany &&
										!selectedProject
											? 'bg-purple-500/30 text-white'
											: 'text-gray-400 hover:bg-white/10 hover:text-white'
									}`}
									whileTap={{ scale: 0.98 }}
								>
									{getFileIcon(type)}
									<span className="flex-1 truncate">
										{contentTypeLabels[type] || type}
									</span>
									<span className="text-xs opacity-70">({items.length})</span>
								</motion.button>
							))}

						{/* Companies View */}
						{folderView === 'companies' &&
							Array.isArray(companies) &&
							companies.map((company) => {
								const companyFiles = contentByCompany[company.id] || [];
								return (
									<motion.button
										type="button"
										key={company.id}
										onClick={() => {
											onCompanySelect(company.id);
											onProjectSelect(null);
											onFolderSelect(null);
										}}
										className={`w-full text-left px-3 py-2 rounded-lg flex items-center gap-2 transition-colors ${
											selectedCompany === company.id && !selectedProject
												? 'bg-purple-500/30 text-white'
												: 'text-gray-400 hover:bg-white/10 hover:text-white'
										}`}
										whileTap={{ scale: 0.98 }}
									>
										<BuildingOffice2Icon className="w-4 h-4" />
										<span className="flex-1 truncate">{company.name}</span>
										<span className="text-xs opacity-70">
											({companyFiles.length})
										</span>
									</motion.button>
								);
							})}

						{/* Projects View */}
						{folderView === 'projects' &&
							Array.isArray(projects) &&
							projects.map((project) => {
								const projectFiles = contentByProject[project.id] || [];
								const projectCompany = Array.isArray(companies)
									? companies.find((c) => c.id === project.company_id)
									: null;
								return (
									<motion.button
										type="button"
										key={project.id}
										onClick={() => {
											onProjectSelect(project.id);
											onCompanySelect(project.company_id);
											onFolderSelect(null);
										}}
										className={`w-full text-left px-3 py-2 rounded-lg flex items-center gap-2 transition-colors ${
											selectedProject === project.id
												? 'bg-purple-500/30 text-white'
												: 'text-gray-400 hover:bg-white/10 hover:text-white'
										}`}
										whileTap={{ scale: 0.98 }}
									>
										<BriefcaseIcon className="w-4 h-4" />
										<div className="flex-1 min-w-0">
											<div className="truncate">{project.name}</div>
											{projectCompany && (
												<div className="text-xs opacity-60 truncate">
													{projectCompany.name}
												</div>
											)}
										</div>
										<span className="text-xs opacity-70">
											({projectFiles.length})
										</span>
									</motion.button>
								);
							})}
					</div>
				</div>

				{/* File List */}
				<div className="lg:col-span-3">
					{loading ? (
						<WidgetLoadingSkeleton type="list" />
					) : !Array.isArray(displayedContent) ||
						displayedContent.length === 0 ? (
						<motion.div
							initial={{ opacity: 0, scale: 0.95 }}
							animate={{ opacity: 1, scale: 1 }}
							className="bg-white/5 backdrop-blur-xl rounded-xl p-12 border border-white/10"
						>
							<div className="text-center max-w-md mx-auto">
								<motion.div
									initial={{ scale: 0, rotate: -180 }}
									animate={{ scale: 1, rotate: 0 }}
									transition={{ delay: 0.1, type: 'spring' }}
									className="inline-flex p-4 bg-linear-to-br from-purple-500/20 to-pink-500/20 rounded-full mb-4 border border-purple-500/30"
								>
									<FolderIcon className="w-12 h-12 text-purple-400" />
								</motion.div>

								<h3 className="text-2xl font-bold text-white mb-2">
									{selectedFolder
										? t('fileManagerTab.empty.folderTitle', {
												name:
													contentTypeLabels[selectedFolder] || selectedFolder,
											})
										: t('fileManagerTab.empty.noFilesTitle')}
								</h3>

								<p className="text-gray-400 mb-6">
									{selectedFolder
										? t('fileManagerTab.empty.folderHint', {
												type:
													contentTypeLabels[selectedFolder] || selectedFolder,
											})
										: selectedCompany || selectedProject
											? t('fileManagerTab.empty.noCompanyProject')
											: t('fileManagerTab.empty.defaultHint')}
								</p>

								<div className="flex flex-col sm:flex-row gap-3 justify-center">
									<ButtonV2
										variant="gradient"
										size="md"
										onClick={onNavigateToUpload}
										iconLeft={<ArrowUpTrayIcon className="w-4 h-4" />}
									>
										{t('fileManagerTab.uploadFiles')}
									</ButtonV2>
									{(selectedFolder || selectedCompany || selectedProject) && (
										<ButtonV2
											variant="ghost"
											size="md"
											onClick={() => {
												onFolderSelect(null);
												onCompanySelect(null);
												onProjectSelect(null);
											}}
											iconLeft={<XMarkIcon className="w-4 h-4" />}
										>
											{t('fileManagerTab.resetFilters')}
										</ButtonV2>
									)}
								</div>
							</div>
						</motion.div>
					) : (
						<div className="space-y-2">
							{displayedContent.map((content) => (
								<motion.div
									key={content.id}
									className="cursor-pointer rounded-lg border border-white/20 bg-white/10 p-4 backdrop-blur-xl transition-[background-color,border-color,box-shadow] hover:border-purple-500/50 hover:bg-white/12 hover:shadow-[0_10px_28px_rgba(15,23,42,0.22)]"
									onClick={() => onContentView(content)}
								>
									<div className="flex items-center gap-4">
										<div className="text-purple-400">
											{getFileIcon(content.content_type)}
										</div>
										<div className="flex-1">
											<h4 className="text-white font-medium">{content.name}</h4>
											<div className="flex gap-4 text-sm text-gray-400 mt-1">
												<span>{formatBytes(content.file_size || 0)}</span>
												<span>{formatDate(content.created_at)}</span>
												{content.company_id && Array.isArray(companies) && (
													<span className="flex items-center gap-1">
														<BuildingOffice2Icon className="w-3 h-3" />
														{companies.find((c) => c.id === content.company_id)
															?.name || t('fileManagerTab.fallbackCompany')}
													</span>
												)}
												{content.project_id && Array.isArray(projects) && (
													<span className="flex items-center gap-1">
														<BriefcaseIcon className="w-3 h-3" />
														{projects.find((p) => p.id === content.project_id)
															?.name || t('fileManagerTab.fallbackProject')}
													</span>
												)}
											</div>
										</div>
										<div className="flex gap-2">
											<motion.button
												type="button"
												onClick={(e) => {
													e.stopPropagation();
													onContentDownload(content.id, content.name);
												}}
												className="rounded-lg bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
												whileTap={{ scale: 0.9 }}
											>
												<ArrowDownTrayIcon className="w-4 h-4" />
											</motion.button>
										</div>
									</div>
								</motion.div>
							))}
						</div>
					)}
				</div>
			</div>
		</div>
	);
};
