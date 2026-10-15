import * as React from 'react';
import { useState, useMemo, useCallback, useLayoutEffect, useRef } from 'react';
import {
	ArrowTrendingUpIcon,
	ChatBubbleLeftRightIcon,
	ClockIcon,
	CurrencyDollarIcon,
	ListBulletIcon,
	MagnifyingGlassIcon,
	PlusIcon,
	SparklesIcon,
	Squares2X2Icon,
} from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { AdminLink as Link } from '../components/AdminLink';
import { Card } from '@components/atoms/Card';
import { Button } from '@components/atoms/Button';
import { Input } from '@components/atoms/Input';
import { useConsultations } from './hooks/useConsultations';
import { ConsultationListCard } from './components/ConsultationListCard';
import { ConfirmDeleteModal } from '@/components/ui/modals/ConfirmDeleteModal';

const CONSULTATIONS_GRID_SKELETON_KEYS = [
	'cns-g-a',
	'cns-g-b',
	'cns-g-c',
	'cns-g-d',
] as const;
const CONSULTATIONS_LIST_SKELETON_KEYS = [
	'cns-l-a',
	'cns-l-b',
	'cns-l-c',
	'cns-l-d',
] as const;

function ConsultationsStaggerItem({
	index,
	className,
	children,
}: {
	index: number;
	className: string;
	children: React.ReactNode;
}) {
	const ref = useRef<HTMLDivElement>(null);
	useLayoutEffect(() => {
		const el = ref.current;
		if (!el) return;
		el.style.animationDelay = `${index * 50}ms`;
	}, [index]);
	return (
		<div ref={ref} className={className}>
			{children}
		</div>
	);
}

export const ConsultationsListPage: React.FC = () => {
	const { t } = useTranslation('siteStudio');
	const {
		consultations,
		loading,
		toggleStatus,
		pendingDeleteConsultationId,
		requestDeleteConsultation,
		executeDeleteConsultation,
		cancelDeleteConsultation,
	} = useConsultations();

	const pendingDeleteTitle = useMemo(() => {
		if (!pendingDeleteConsultationId) return undefined;
		return consultations.find((c) => c.id === pendingDeleteConsultationId)
			?.title;
	}, [pendingDeleteConsultationId, consultations]);
	const [searchQuery, setSearchQuery] = useState('');
	const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
	const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'draft'>(
		'all'
	);
	const [popularFilter, setPopularFilter] = useState<boolean | 'all'>('all');

	const stats = useMemo(() => {
		const total = consultations.length;
		const active = consultations.filter((c) => c.status === 'active').length;
		const draft = consultations.filter((c) => c.status === 'draft').length;
		const popular = consultations.filter((c) => c.popular).length;
		const totalValue = consultations.reduce((sum, c) => sum + c.price, 0);
		return { total, active, draft, popular, totalValue };
	}, [consultations]);

	const clearListFilters = useCallback(() => {
		setSearchQuery('');
		setStatusFilter('all');
		setPopularFilter('all');
	}, []);

	const filteredConsultations = useMemo(() => {
		return consultations.filter((c) => {
			const matchesSearch =
				c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
				c.shortDescription.toLowerCase().includes(searchQuery.toLowerCase());
			const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
			const matchesPopular =
				popularFilter === 'all' ||
				(popularFilter === true && c.popular) ||
				(popularFilter === false && !c.popular);
			return matchesSearch && matchesStatus && matchesPopular;
		});
	}, [consultations, searchQuery, statusFilter, popularFilter]);

	if (loading && consultations.length === 0) {
		return (
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
				{CONSULTATIONS_GRID_SKELETON_KEYS.map((k) => (
					<div
						key={k}
						className="p-4 rounded-2xl border border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-800 animate-pulse"
					>
						<div className="h-4 w-24 bg-neutral-200 dark:bg-slate-700 rounded mb-2" />
						<div className="h-8 w-16 bg-neutral-200 dark:bg-slate-700 rounded" />
					</div>
				))}
			</div>
		);
	}

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
				<div>
					<h1 className="text-3xl font-display font-semibold text-neutral-900 dark:text-white flex items-center gap-3">
						<div className="p-2 bg-linear-to-br from-purple-100 to-purple-200 dark:from-purple-900/30 dark:to-purple-800/20 rounded-xl">
							<ChatBubbleLeftRightIcon
								className="text-purple-600 dark:text-purple-400"
								width={24}
								height={24}
							/>
						</div>
						{t('adminCatalog.consultations.title')}
						<SparklesIcon width={16} height={16} className="text-amber-400" />
					</h1>
					<p className="text-neutral-500 dark:text-slate-400 mt-1">
						{t('adminCatalog.consultations.subtitle')}
					</p>
				</div>
				<Link to="/admin/consultations/new">
					<Button className="shadow-lg shadow-primary-500/20 hover:shadow-primary-500/30 transition-shadow">
						<PlusIcon width={18} height={18} className="mr-2" />
						{t('adminCatalog.consultations.add')}
					</Button>
				</Link>
			</div>

			{/* Stats */}
			<div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
				<div className="p-4 rounded-2xl border border-neutral-200 dark:border-slate-700 bg-linear-to-br from-neutral-50 to-white dark:from-slate-800/50 dark:to-slate-800/30 shadow-sm">
					<div className="flex items-center justify-between">
						<div>
							<p className="text-xs uppercase tracking-wider text-neutral-500 dark:text-slate-400">
								{t('adminCatalog.consultations.statTotal')}
							</p>
							<p className="text-2xl font-bold text-neutral-900 dark:text-white mt-1">
								{stats.total}
							</p>
						</div>
						<div className="p-2 bg-neutral-100 dark:bg-slate-700 rounded-lg">
							<ChatBubbleLeftRightIcon
								width={18}
								height={18}
								className="text-neutral-500 dark:text-slate-300"
							/>
						</div>
					</div>
				</div>
				<div className="p-4 rounded-2xl border border-emerald-200/60 dark:border-emerald-700/40 bg-linear-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/10 shadow-sm">
					<div className="flex items-center justify-between">
						<div>
							<p className="text-xs uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
								{t('adminCatalog.consultations.statActive')}
							</p>
							<p className="text-2xl font-bold text-emerald-700 dark:text-emerald-200 mt-1">
								{stats.active}
							</p>
						</div>
						<div className="p-2 bg-emerald-100 dark:bg-emerald-900/40 rounded-lg">
							<ArrowTrendingUpIcon
								width={18}
								height={18}
								className="text-emerald-700 dark:text-emerald-200"
							/>
						</div>
					</div>
				</div>
				<div className="p-4 rounded-2xl border border-amber-200/60 dark:border-amber-700/40 bg-linear-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/10 shadow-sm">
					<div className="flex items-center justify-between">
						<div>
							<p className="text-xs uppercase tracking-wider text-amber-700 dark:text-amber-300">
								{t('adminCatalog.consultations.statDrafts')}
							</p>
							<p className="text-2xl font-bold text-amber-700 dark:text-amber-200 mt-1">
								{stats.draft}
							</p>
						</div>
						<div className="p-2 bg-amber-100 dark:bg-amber-900/40 rounded-lg">
							<ClockIcon
								width={18}
								height={18}
								className="text-amber-700 dark:text-amber-200"
							/>
						</div>
					</div>
				</div>
				<div className="p-4 rounded-2xl border border-purple-200/60 dark:border-purple-700/40 bg-linear-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/10 shadow-sm">
					<div className="flex items-center justify-between">
						<div>
							<p className="text-xs uppercase tracking-wider text-purple-700 dark:text-purple-300">
								{t('adminCatalog.consultations.statPopular')}
							</p>
							<p className="text-2xl font-bold text-purple-700 dark:text-purple-200 mt-1">
								{stats.popular}
							</p>
						</div>
						<div className="p-2 bg-purple-100 dark:bg-purple-900/40 rounded-lg">
							<SparklesIcon
								width={18}
								height={18}
								className="text-purple-700 dark:text-purple-200"
							/>
						</div>
					</div>
				</div>
				<div className="p-4 rounded-2xl border border-primary-200/60 dark:border-primary-700/40 bg-linear-to-br from-primary-50 to-blue-50 dark:from-primary-900/20 dark:to-blue-900/10 shadow-sm">
					<div className="flex items-center justify-between">
						<div>
							<p className="text-xs uppercase tracking-wider text-primary-700 dark:text-primary-300">
								{t('adminCatalog.consultations.statValue')}
							</p>
							<p className="text-2xl font-bold text-primary-700 dark:text-primary-200 mt-1">
								{(stats.totalValue / 1000).toFixed(0)}K₽
							</p>
						</div>
						<div className="p-2 bg-primary-100 dark:bg-primary-900/40 rounded-lg">
							<CurrencyDollarIcon
								width={18}
								height={18}
								className="text-primary-700 dark:text-primary-200"
							/>
						</div>
					</div>
				</div>
			</div>

			{/* MagnifyingGlassIcon & Filters */}
			<div className="p-4 rounded-2xl border border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
				<div className="flex flex-col lg:flex-row gap-3">
					<div className="relative flex-1">
						<MagnifyingGlassIcon
							className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-slate-500"
							width={18}
							height={18}
						/>
						<Input
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							placeholder={t('adminCatalog.consultations.searchPlaceholder')}
							className="pl-11 bg-neutral-50 dark:bg-slate-700/50 border-neutral-200 dark:border-slate-600 focus:bg-white dark:focus:bg-slate-700 text-neutral-900 dark:text-slate-100 placeholder:text-neutral-400 dark:placeholder:text-slate-500"
							aria-label={t('adminCatalog.consultations.searchAria')}
						/>
					</div>
					<div className="flex items-center gap-2 flex-wrap">
						{/* Status Filter Chips */}
						<div className="flex gap-2">
							{[
								{ key: 'all', label: t('adminCatalog.common.all') },
								{
									key: 'active',
									label: t('adminCatalog.consultations.filterActive'),
								},
								{
									key: 'draft',
									label: t('adminCatalog.consultations.filterDrafts'),
								},
							].map((chip) => (
								<button
									type="button"
									key={chip.key}
									onClick={() =>
										setStatusFilter(chip.key as 'all' | 'active' | 'draft')
									}
									className={`px-3 py-1.5 text-xs rounded-full border transition-[color,background-color,border-color,transform,box-shadow] duration-200 motion-reduce:transition-none ${
										statusFilter === chip.key
											? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-200 border-primary-200 dark:border-primary-700 shadow-sm scale-105'
											: 'bg-neutral-100 dark:bg-slate-700 text-neutral-600 dark:text-slate-300 border-transparent hover:border-neutral-200 dark:hover:border-slate-600 hover:scale-105'
									}`}
								>
									{chip.label}
								</button>
							))}
						</div>

						{/* Popular Filter */}
						<button
							type="button"
							onClick={() =>
								setPopularFilter(popularFilter === true ? 'all' : true)
							}
							className={`px-3 py-1.5 text-xs rounded-full border transition-[color,background-color,border-color,transform,box-shadow] duration-200 motion-reduce:transition-none ${
								popularFilter === true
									? 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-200 border-purple-200 dark:border-purple-700 shadow-sm scale-105'
									: 'bg-neutral-100 dark:bg-slate-700 text-neutral-600 dark:text-slate-300 border-transparent hover:border-neutral-200 dark:hover:border-slate-600 hover:scale-105'
							}`}
						>
							<SparklesIcon width={12} height={12} className="inline mr-1" />
							{t('adminCatalog.consultations.filterPopular')}
						</button>

						{/* View Mode Toggle */}
						<div className="flex items-center bg-neutral-100 dark:bg-slate-700 rounded-lg p-1 ml-auto">
							<button
								type="button"
								onClick={() => setViewMode('list')}
								className={`p-2 rounded-md transition-[color,background-color,box-shadow] duration-200 motion-reduce:transition-none ${
									viewMode === 'list'
										? 'bg-white dark:bg-slate-800 shadow-sm text-neutral-900 dark:text-white'
										: 'text-neutral-500 dark:text-slate-400 hover:text-neutral-700 dark:hover:text-slate-200'
								}`}
								aria-label={t('adminCatalog.common.listView')}
							>
								<ListBulletIcon width={16} height={16} />
							</button>
							<button
								type="button"
								onClick={() => setViewMode('grid')}
								className={`p-2 rounded-md transition-[color,background-color,box-shadow] duration-200 motion-reduce:transition-none ${
									viewMode === 'grid'
										? 'bg-white dark:bg-slate-800 shadow-sm text-neutral-900 dark:text-white'
										: 'text-neutral-500 dark:text-slate-400 hover:text-neutral-700 dark:hover:text-slate-200'
								}`}
								aria-label={t('adminCatalog.common.gridView')}
							>
								<Squares2X2Icon width={16} height={16} />
							</button>
						</div>
					</div>
				</div>
			</div>

			{/* Consultations ListBulletIcon */}
			{loading && consultations.length > 0 ? (
				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					{CONSULTATIONS_LIST_SKELETON_KEYS.map((k) => (
						<div
							key={k}
							className="p-6 rounded-2xl border border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-800 animate-pulse"
						>
							<div className="flex gap-4">
								<div className="w-24 h-24 bg-neutral-200 dark:bg-slate-700 rounded-xl" />
								<div className="flex-1 space-y-2">
									<div className="h-4 w-3/4 bg-neutral-200 dark:bg-slate-700 rounded" />
									<div className="h-3 w-full bg-neutral-200 dark:bg-slate-700 rounded" />
									<div className="h-3 w-2/3 bg-neutral-200 dark:bg-slate-700 rounded" />
								</div>
							</div>
						</div>
					))}
				</div>
			) : (
				<div
					className={
						viewMode === 'grid'
							? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-stretch'
							: 'space-y-4'
					}
				>
					{filteredConsultations.map((consultation, index) => (
						<ConsultationsStaggerItem
							key={consultation.id}
							index={index}
							className={`animate-in fade-in slide-in-from-bottom-4 ${viewMode === 'grid' ? 'h-full min-h-0' : ''}`}
						>
							<ConsultationListCard
								consultation={consultation}
								onToggleStatus={toggleStatus}
								onDelete={requestDeleteConsultation}
								viewMode={viewMode}
								className={viewMode === 'grid' ? 'h-full' : undefined}
							/>
						</ConsultationsStaggerItem>
					))}
				</div>
			)}

			{/* Empty State */}
			{!loading && filteredConsultations.length === 0 && (
				<Card className="p-12 text-center">
					<div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
						<ChatBubbleLeftRightIcon
							width={32}
							height={32}
							className="text-purple-400 dark:text-purple-500"
						/>
					</div>
					<h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-2">
						{searchQuery || statusFilter !== 'all' || popularFilter !== 'all'
							? t('adminCatalog.consultations.emptyFiltered')
							: t('adminCatalog.consultations.emptyNone')}
					</h3>
					<p className="text-neutral-500 dark:text-slate-400 mb-4">
						{searchQuery || statusFilter !== 'all' || popularFilter !== 'all'
							? t('adminCatalog.consultations.emptyFilteredHint')
							: t('adminCatalog.consultations.emptyNoneHint')}
					</p>
					<div className="flex flex-wrap items-center justify-center gap-3">
						{searchQuery ||
						statusFilter !== 'all' ||
						popularFilter !== 'all' ? (
							<>
								<Button
									type="button"
									variant="outline"
									onClick={clearListFilters}
								>
									{t('adminCatalog.consultations.emptyCtaFilters')}
								</Button>
								<Link to="/admin/consultations/new">
									<Button>
										<PlusIcon width={18} height={18} className="mr-2" />
										{t('adminCatalog.consultations.add')}
									</Button>
								</Link>
							</>
						) : (
							<Link to="/admin/consultations/new">
								<Button>
									<PlusIcon width={18} height={18} className="mr-2" />
									{t('adminCatalog.consultations.add')}
								</Button>
							</Link>
						)}
					</div>
				</Card>
			)}

			<ConfirmDeleteModal
				isOpen={pendingDeleteConsultationId !== null}
				onClose={cancelDeleteConsultation}
				onConfirm={executeDeleteConsultation}
				title={t('adminCatalog.consultations.deleteModalTitle')}
				itemName={pendingDeleteTitle}
				warningMessage={t('adminCatalog.consultations.deleteModalWarning')}
				confirmButtonLabel={t('adminCatalog.common.delete')}
				confirmButtonLoadingLabel={t('adminCatalog.common.deleteModalDeleting')}
				cancelButtonLabel={t('adminCatalog.common.cancel')}
			/>
		</div>
	);
};
