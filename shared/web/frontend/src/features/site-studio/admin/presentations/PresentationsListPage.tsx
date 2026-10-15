import { Button } from '@components/atoms/Button';
import { Input } from '@components/atoms/Input';
import {
	useDeletePresentation,
	usePresentations,
} from '@services/api/presentations';
import * as React from 'react';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
	ArrowPathIcon,
	DocumentTextIcon,
	EyeIcon,
	MagnifyingGlassIcon,
	PencilSquareIcon,
	PlusIcon,
	PresentationChartBarIcon,
	SparklesIcon,
	TrashIcon,
	XMarkIcon,
} from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { AdminLink as Link } from '../components/AdminLink';
import { ConfirmDeleteModal } from '@/components/ui/modals/ConfirmDeleteModal';
import { toErrorText } from '@/utils/toErrorText';
import './presentation.css';

function PresentationCardStagger({
	index,
	children,
}: {
	index: number;
	children: React.ReactNode;
}) {
	const ref = useRef<HTMLDivElement>(null);
	useLayoutEffect(() => {
		const el = ref.current;
		if (!el) return;
		el.style.setProperty('--animation-delay', `${index * 50}ms`);
	}, [index]);
	return (
		<div
			ref={ref}
			className="p-6 rounded-2xl border bg-white dark:bg-slate-800 border-neutral-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow duration-200 motion-reduce:transition-none presentation-card-animation h-full flex flex-col min-h-0"
		>
			{children}
		</div>
	);
}

const PRESENTATION_LIST_SKELETON_KEYS = [
	'pl-sk-a',
	'pl-sk-b',
	'pl-sk-c',
	'pl-sk-d',
	'pl-sk-e',
	'pl-sk-f',
] as const;

export const PresentationsListPage: React.FC = () => {
	const { t } = useTranslation('siteStudio');
	const [searchQuery, setSearchQuery] = useState('');
	const [statusFilter, setStatusFilter] = useState<
		'all' | 'published' | 'draft'
	>('all');
	const { data: presentationsData, isLoading, refetch } = usePresentations();
	const deletePresentation = useDeletePresentation();

	const [pendingDelete, setPendingDelete] = useState<{
		id: string;
		title: string;
	} | null>(null);

	const presentations = useMemo(
		() => presentationsData?.data ?? [],
		[presentationsData?.data]
	);

	const stats = useMemo(() => {
		const total = presentations.length;
		const published = presentations.filter((p) => p.isPublished).length;
		const draft = total - published;
		return { total, published, draft };
	}, [presentations]);

	const filteredPresentations = useMemo(() => {
		return presentations.filter((p) => {
			const matchesSearch =
				p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
				p.slug.toLowerCase().includes(searchQuery.toLowerCase());
			const matchesStatus =
				statusFilter === 'all' ||
				(statusFilter === 'published' && p.isPublished) ||
				(statusFilter === 'draft' && !p.isPublished);
			return matchesSearch && matchesStatus;
		});
	}, [presentations, searchQuery, statusFilter]);

	const requestDeletePresentation = (id: string, title: string) => {
		setPendingDelete({ id, title });
	};

	const cancelDeletePresentation = () => setPendingDelete(null);

	const executeDeletePresentation = async () => {
		if (!pendingDelete) return;
		const { id } = pendingDelete;
		try {
			await deletePresentation.mutateAsync(id);
		} catch (error) {
			console.error('Failed to delete presentation:', error);
			throw new Error(
				toErrorText(error) || t('adminCatalog.presentations.deleteFailed')
			);
		}
	};

	const activeFiltersCount = [
		statusFilter !== 'all',
		searchQuery.length > 0,
	].filter(Boolean).length;

	const clearFilters = () => {
		setSearchQuery('');
		setStatusFilter('all');
	};

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
				<div>
					<h1 className="text-3xl font-display font-semibold text-neutral-900 dark:text-white flex items-center gap-3">
						<div className="p-2 bg-linear-to-br from-blue-100 to-blue-200 dark:from-blue-900/30 dark:to-blue-800/20 rounded-xl">
							<PresentationChartBarIcon
								className="text-blue-600 dark:text-blue-400"
								width={24}
								height={24}
							/>
						</div>
						{t('adminCatalog.presentations.title')}
						{!isLoading && (
							<span className="text-lg font-normal text-neutral-400 dark:text-slate-500">
								({stats.total})
							</span>
						)}
					</h1>
					<p className="text-neutral-500 dark:text-slate-400 mt-1 flex items-center gap-2">
						<SparklesIcon width={14} height={14} className="text-amber-500" />
						{t('adminCatalog.presentations.subtitle')}
					</p>
				</div>
				<div className="flex items-center gap-2">
					<Button
						variant="ghost"
						size="sm"
						onClick={() => refetch()}
						className="dark:text-slate-300"
						disabled={isLoading}
					>
						<ArrowPathIcon
							width={16}
							height={16}
							className={`mr-1 ${isLoading ? 'animate-spin' : ''}`}
						/>
						{t('adminCatalog.presentations.refresh')}
					</Button>
					<Link to="/admin/presentations/new">
						<Button className="shadow-lg shadow-primary-500/20 hover:shadow-primary-500/30 transition-shadow">
							<PlusIcon width={18} height={18} className="mr-1" />
							{t('adminCatalog.presentations.create')}
						</Button>
					</Link>
				</div>
			</div>

			{/* Stats */}
			<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
				<div className="p-4 rounded-2xl border bg-linear-to-br from-primary-50 to-white dark:from-primary-900/40 dark:to-slate-800 border-primary-200/50 dark:border-primary-700/30 shadow-lg shadow-primary-500/5 dark:shadow-primary-900/20">
					<div className="flex items-center justify-between">
						<div>
							<p className="text-xs font-medium text-primary-600 dark:text-primary-400 uppercase tracking-wider">
								{t('adminCatalog.presentations.statTotal')}
							</p>
							<p className="text-2xl font-bold text-primary-900 dark:text-primary-100 mt-1">
								{stats.total}
							</p>
						</div>
						<div className="p-2.5 bg-primary-100 dark:bg-primary-800/50 rounded-xl">
							<PresentationChartBarIcon
								width={20}
								height={20}
								className="text-primary-600 dark:text-primary-400"
							/>
						</div>
					</div>
				</div>

				<div className="p-4 rounded-2xl border bg-linear-to-br from-emerald-50 to-white dark:from-emerald-900/40 dark:to-slate-800 border-emerald-200/50 dark:border-emerald-700/30 shadow-lg shadow-emerald-500/5 dark:shadow-emerald-900/20">
					<div className="flex items-center justify-between">
						<div>
							<p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
								{t('adminCatalog.presentations.statPublished')}
							</p>
							<p className="text-2xl font-bold text-emerald-900 dark:text-emerald-100 mt-1">
								{stats.published}
							</p>
						</div>
						<div className="p-2.5 bg-emerald-100 dark:bg-emerald-800/50 rounded-xl">
							<EyeIcon
								width={20}
								height={20}
								className="text-emerald-600 dark:text-emerald-400"
							/>
						</div>
					</div>
				</div>

				<div className="p-4 rounded-2xl border bg-linear-to-br from-amber-50 to-white dark:from-amber-900/40 dark:to-slate-800 border-amber-200/50 dark:border-amber-700/30 shadow-lg shadow-amber-500/5 dark:shadow-amber-900/20">
					<div className="flex items-center justify-between">
						<div>
							<p className="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wider">
								{t('adminCatalog.presentations.statDrafts')}
							</p>
							<p className="text-2xl font-bold text-amber-900 dark:text-amber-100 mt-1">
								{stats.draft}
							</p>
						</div>
						<div className="p-2.5 bg-amber-100 dark:bg-amber-800/50 rounded-xl">
							<DocumentTextIcon
								width={20}
								height={20}
								className="text-amber-600 dark:text-amber-400"
							/>
						</div>
					</div>
				</div>
			</div>

			{/* MagnifyingGlassIcon and Filters */}
			<div className="p-4 rounded-2xl border bg-white dark:bg-slate-800 border-neutral-200 dark:border-slate-700 shadow-sm">
				<div className="flex flex-col lg:flex-row gap-4">
					<div className="relative flex-1">
						<MagnifyingGlassIcon
							className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-slate-500"
							width={18}
							height={18}
						/>
						<Input
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							placeholder={t('adminCatalog.presentations.searchPlaceholder')}
							className="pl-10 dark:bg-slate-900 dark:border-slate-600 dark:text-white dark:placeholder-slate-500"
						/>
					</div>

					<div className="flex flex-wrap items-center gap-2">
						<select
							value={statusFilter}
							onChange={(e) =>
								setStatusFilter(e.target.value as typeof statusFilter)
							}
							aria-label={t('adminCatalog.presentations.filterStatusAria')}
							className="rounded-xl border border-neutral-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-neutral-700 dark:text-slate-300 focus:border-primary-300 dark:focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:focus:ring-primary-900"
						>
							<option value="all">
								{t('adminCatalog.presentations.filterAll')}
							</option>
							<option value="published">
								{t('adminCatalog.presentations.filterPublished')}
							</option>
							<option value="draft">
								{t('adminCatalog.presentations.filterDrafts')}
							</option>
						</select>

						{activeFiltersCount > 0 && (
							<button
								type="button"
								onClick={clearFilters}
								className="flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-xl transition-colors"
							>
								<XMarkIcon width={14} height={14} />
								<span className="hidden sm:inline">
									{t('adminCatalog.common.clearFilters')}
								</span>
								<span className="bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
									{activeFiltersCount}
								</span>
							</button>
						)}
					</div>
				</div>
			</div>

			{/* Presentations List */}
			{isLoading && presentations.length === 0 ? (
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
					{PRESENTATION_LIST_SKELETON_KEYS.map((skKey) => (
						<div
							key={skKey}
							className="p-4 rounded-2xl border border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-800 animate-pulse"
						>
							<div className="h-4 w-3/4 bg-neutral-200 dark:bg-slate-700 rounded mb-2" />
							<div className="h-3 w-1/2 bg-neutral-200 dark:bg-slate-700 rounded" />
						</div>
					))}
				</div>
			) : (
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-stretch">
					{filteredPresentations.map((presentation, index: number) => (
						<PresentationCardStagger key={presentation.id} index={index}>
							<div className="flex items-start justify-between mb-4 gap-2">
								<div className="flex-1 min-w-0">
									<Link
										to={`/admin/presentations/${presentation.id}`}
										className="text-lg font-semibold text-neutral-900 dark:text-white mb-1 block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 line-clamp-2"
									>
										{presentation.title}
									</Link>
									<p className="text-sm text-neutral-500 dark:text-slate-400">
										{t('adminCatalog.presentations.slideCount', {
											count: presentation.slides.length,
										})}
									</p>
								</div>
								<span
									className={`shrink-0 px-2 py-1 text-xs font-semibold rounded-lg border ${
										presentation.isPublished
											? 'border-emerald-400/90 dark:border-emerald-600/80 bg-emerald-200 dark:bg-emerald-900/45 text-emerald-950 dark:text-emerald-100'
											: 'border-amber-500/80 dark:border-amber-600/80 bg-amber-200 dark:bg-amber-900/45 text-amber-950 dark:text-amber-100'
									}`}
								>
									{presentation.isPublished
										? t('adminCatalog.common.statusPublished')
										: t('adminCatalog.common.statusDraft')}
								</span>
							</div>

							<div className="flex items-center gap-2 mb-4">
								<span className="text-xs px-2 py-1 rounded-lg border border-neutral-200 dark:border-slate-600 bg-neutral-100 dark:bg-slate-700/80 text-neutral-800 dark:text-slate-200 font-medium">
									{presentation.format === 'classic'
										? t('adminCatalog.presentations.formatClassic')
										: presentation.format === 'modern'
											? t('adminCatalog.presentations.formatModern')
											: presentation.format === 'ollenti'
												? t('adminCatalog.presentations.formatOllenti')
												: presentation.format === 'ollenti2'
													? t('adminCatalog.presentations.formatOllenti2')
													: t('adminCatalog.presentations.formatMinimal')}
								</span>
							</div>

							<div className="mt-auto flex items-center gap-2 pt-4 border-t border-neutral-100 dark:border-slate-700">
								<Link
									to={`/admin/presentations/${presentation.id}`}
									className="flex-1"
								>
									<Button variant="outline" size="sm" className="w-full">
										<PencilSquareIcon width={14} height={14} className="mr-1" />
										{t('adminCatalog.common.edit')}
									</Button>
								</Link>
								<Link
									to={`/presentations/${presentation.slug}`}
									target="_blank"
								>
									<Button variant="ghost" size="sm">
										<EyeIcon width={14} height={14} />
									</Button>
								</Link>
								<Button
									variant="ghost"
									size="sm"
									onClick={() =>
										requestDeletePresentation(
											presentation.id,
											presentation.title
										)
									}
									className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
								>
									<TrashIcon width={14} height={14} />
								</Button>
							</div>
						</PresentationCardStagger>
					))}
				</div>
			)}

			{!isLoading && filteredPresentations.length === 0 && (
				<div className="p-16 text-center rounded-2xl border bg-white dark:bg-slate-800 border-neutral-200 dark:border-slate-700 shadow-sm">
					<div className="max-w-md mx-auto">
						<div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-linear-to-br from-primary-100 to-primary-50 dark:from-primary-900/30 dark:to-primary-800/20 flex items-center justify-center">
							<PresentationChartBarIcon
								width={40}
								height={40}
								className="text-primary-500 dark:text-primary-400"
							/>
						</div>

						{activeFiltersCount > 0 ? (
							<>
								<h3 className="text-xl font-semibold text-neutral-900 dark:text-white mb-2">
									{t('adminCatalog.presentations.emptyFilteredTitle')}
								</h3>
								<p className="text-neutral-500 dark:text-slate-400 mb-6">
									{t('adminCatalog.presentations.emptyFilteredHint')}
								</p>
								<Button variant="outline" onClick={clearFilters}>
									<XMarkIcon width={16} height={16} className="mr-1" />
									{t('adminCatalog.common.clearFilters')}
								</Button>
							</>
						) : (
							<>
								<h3 className="text-xl font-semibold text-neutral-900 dark:text-white mb-2">
									{t('adminCatalog.presentations.emptyNoneTitle')}
								</h3>
								<p className="text-neutral-500 dark:text-slate-400 mb-6">
									{t('adminCatalog.presentations.emptyNoneHint')}
								</p>
								<Link to="/admin/presentations/new">
									<Button className="shadow-lg shadow-primary-500/20">
										<PlusIcon width={18} height={18} className="mr-1" />
										{t('adminCatalog.presentations.create')}
									</Button>
								</Link>
							</>
						)}
					</div>
				</div>
			)}

			<ConfirmDeleteModal
				isOpen={pendingDelete !== null}
				onClose={cancelDeletePresentation}
				onConfirm={executeDeletePresentation}
				title={t('adminCatalog.presentations.deleteModalTitle')}
				itemName={pendingDelete?.title}
				warningMessage={t('adminCatalog.presentations.deleteModalWarning')}
				confirmButtonLabel={t('adminCatalog.common.delete')}
				confirmButtonLoadingLabel={t('adminCatalog.common.deleteModalDeleting')}
				cancelButtonLabel={t('adminCatalog.common.cancel')}
			/>
		</div>
	);
};
