import * as React from 'react';
import { useState, useCallback, useMemo } from 'react';
import {
	AcademicCapIcon,
	ArrowPathIcon,
	MagnifyingGlassIcon,
	PlusIcon,
	SparklesIcon,
} from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { AdminLink as Link } from '../components/AdminLink';
import { Card } from '@components/atoms/Card';
import { Button } from '@components/atoms/Button';
import { Input } from '@components/atoms/Input';
import type { MasterclassCategory } from '@typings/admin';
import { useMasterclasses } from './hooks/useMasterclasses';
import { MasterclassListCard } from './components/MasterclassListCard';
import { ConfirmDeleteModal } from '@/components/ui/modals/ConfirmDeleteModal';

const categoryLabels: Record<MasterclassCategory, string> = {
	workshop: 'Мастер-класс',
	tasting: 'Дегустация',
	education: 'Обучение',
	corporate: 'Корпоратив',
	special: 'Особый формат',
};

const categoryColors: Record<MasterclassCategory, string> = {
	workshop: 'bg-blue-100 text-blue-700 border-blue-200',
	tasting: 'bg-amber-100 text-amber-700 border-amber-200',
	education: 'bg-emerald-100 text-emerald-700 border-emerald-200',
	corporate: 'bg-purple-100 text-purple-700 border-purple-200',
	special: 'bg-pink-100 text-pink-700 border-pink-200',
};

export const MasterclassesListPage: React.FC = () => {
	const { t } = useTranslation('siteStudio');
	const {
		masterclasses,
		loading,
		toggleStatus,
		pendingDeleteMasterclassId,
		requestDeleteMasterclass,
		executeDeleteMasterclass,
		cancelDeleteMasterclass,
	} = useMasterclasses();

	const pendingDeleteTitle = useMemo(() => {
		if (!pendingDeleteMasterclassId) return undefined;
		return masterclasses.find((m) => m.id === pendingDeleteMasterclassId)
			?.title;
	}, [pendingDeleteMasterclassId, masterclasses]);
	const [searchQuery, setSearchQuery] = useState('');
	const [categoryFilter, setCategoryFilter] = useState<
		MasterclassCategory | 'all'
	>('all');

	const filteredMasterclasses = masterclasses.filter((m) => {
		const matchesSearch = m.title
			.toLowerCase()
			.includes(searchQuery.toLowerCase());
		const matchesCategory =
			categoryFilter === 'all' || m.category === categoryFilter;
		return matchesSearch && matchesCategory;
	});

	const activeCount = masterclasses.filter((m) => m.status === 'active').length;

	const clearCategoryFilter = useCallback(() => {
		setCategoryFilter('all');
		setSearchQuery('');
	}, []);

	if (loading && masterclasses.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center h-64 gap-3">
				<ArrowPathIcon className="w-10 h-10 animate-spin text-primary-500" />
				<p className="text-neutral-500 text-sm">
					{t('adminCatalog.masterclasses.loading')}
				</p>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
				<div>
					<h1 className="text-3xl font-display font-semibold text-neutral-900 dark:text-white flex items-center gap-3">
						<div className="p-2 bg-blue-100 dark:bg-blue-900/40 rounded-xl">
							<AcademicCapIcon
								className="text-blue-600 dark:text-blue-300"
								width={24}
								height={24}
							/>
						</div>
						{t('adminCatalog.masterclasses.title')}
					</h1>
					<p className="text-neutral-500 dark:text-slate-400 mt-1">
						{t('adminCatalog.masterclasses.subtitle', {
							total: masterclasses.length,
							active: activeCount,
						})}
					</p>
				</div>
				<Link to="/admin/masterclasses/new">
					<Button className="shadow-lg shadow-primary-500/20 hover:shadow-primary-500/30 transition-shadow">
						<PlusIcon width={18} height={18} className="mr-2" />
						{t('adminCatalog.masterclasses.create')}
					</Button>
				</Link>
			</div>

			{/* MagnifyingGlassIcon & Filters */}
			<Card className="p-4 border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-800">
				<div className="flex flex-col sm:flex-row gap-4">
					<div className="relative flex-1">
						<MagnifyingGlassIcon
							className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400"
							width={18}
							height={18}
						/>
						<Input
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							placeholder={t('adminCatalog.masterclasses.searchPlaceholder')}
							className="pl-11 bg-neutral-50 dark:bg-slate-800 border-neutral-200 dark:border-slate-600 focus:bg-white dark:focus:bg-slate-800 dark:text-slate-100"
							aria-label={t('adminCatalog.masterclasses.searchAria')}
						/>
					</div>
					<div className="flex flex-wrap gap-2">
						<button
							type="button"
							onClick={() => setCategoryFilter('all')}
							className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-150 motion-reduce:transition-none ${
								categoryFilter === 'all'
									? 'bg-neutral-900 text-white shadow-sm'
									: 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
							}`}
						>
							{t('adminCatalog.common.all')}
						</button>
						{Object.entries(categoryLabels).map(([value, label]) => (
							<button
								key={value}
								type="button"
								onClick={() => setCategoryFilter(value as MasterclassCategory)}
								className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-150 motion-reduce:transition-none border ${
									categoryFilter === value
										? categoryColors[value as MasterclassCategory]
										: 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-300'
								}`}
							>
								{label}
							</button>
						))}
					</div>
				</div>
			</Card>

			{/* Masterclasses List */}
			{loading ? (
				<div className="min-h-[120px] space-y-4" aria-busy="true" />
			) : (
				<div className="space-y-4">
					{filteredMasterclasses.map((masterclass) => (
						<MasterclassListCard
							key={masterclass.id}
							masterclass={masterclass}
							categoryLabels={categoryLabels}
							onToggleStatus={toggleStatus}
							onDelete={requestDeleteMasterclass}
						/>
					))}
				</div>
			)}

			{/* Empty State */}
			{!loading && filteredMasterclasses.length === 0 && (
				<Card className="p-12 text-center border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-800">
					<div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
						<SparklesIcon
							width={32}
							height={32}
							className="text-blue-400 dark:text-blue-300"
						/>
					</div>
					<h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-2">
						{searchQuery || categoryFilter !== 'all'
							? t('adminCatalog.masterclasses.emptyFiltered')
							: t('adminCatalog.masterclasses.emptyNone')}
					</h3>
					<p className="text-neutral-500 dark:text-slate-400 mb-4">
						{searchQuery
							? t('adminCatalog.masterclasses.emptySearch', {
									query: searchQuery,
								})
							: categoryFilter !== 'all'
								? t('adminCatalog.masterclasses.emptyCategory', {
										category:
											categoryLabels[categoryFilter as MasterclassCategory],
									})
								: t('adminCatalog.masterclasses.emptyNoneHint')}
					</p>
					<div className="flex flex-wrap items-center justify-center gap-3">
						{(searchQuery || categoryFilter !== 'all') && (
							<Button
								type="button"
								variant="outline"
								onClick={clearCategoryFilter}
							>
								{t('adminCatalog.masterclasses.emptyCtaFilters')}
							</Button>
						)}
						<Link to="/admin/masterclasses/new">
							<Button>
								<PlusIcon width={18} height={18} className="mr-2" />
								{t('adminCatalog.masterclasses.create')}
							</Button>
						</Link>
					</div>
				</Card>
			)}

			<ConfirmDeleteModal
				isOpen={pendingDeleteMasterclassId !== null}
				onClose={cancelDeleteMasterclass}
				onConfirm={executeDeleteMasterclass}
				title={t('adminCatalog.masterclasses.deleteModalTitle')}
				itemName={pendingDeleteTitle}
				warningMessage={t('adminCatalog.masterclasses.deleteModalWarning')}
				confirmButtonLabel={t('adminCatalog.common.delete')}
				confirmButtonLoadingLabel={t('adminCatalog.common.deleteModalDeleting')}
				cancelButtonLabel={t('adminCatalog.common.cancel')}
			/>
		</div>
	);
};
