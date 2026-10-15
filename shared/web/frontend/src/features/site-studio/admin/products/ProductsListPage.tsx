import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ConfirmDeleteModal } from '@/components/ui/modals/ConfirmDeleteModal';
import { cn } from '@/utils/cn';
import { toErrorText } from '@/utils/toErrorText';
import { useAdminNavigate } from '../AdminEmbeddedRouter';
import { AdminLink as Link } from '../components/AdminLink';
import { Button } from '@components/atoms/Button';
import { Input } from '@components/atoms/Input';
import { Checkbox } from '@components/atoms/Checkbox';
import {
	useProducts,
	useDeleteProduct,
	useUpdateProduct,
	useCreateProduct,
	useProductsSummary,
	useBulkUpdateProductPrice,
} from '@services/api/products';
import type { Product } from '@typings/product';
import { ProductListItem } from './components/ProductListItem';
import { ProductGridCard } from './components/ProductGridCard';
import { BulkActionsBar } from './components/BulkActionsBar';
import { AdminPageHeader } from '../components/AdminPageHeader';
import { AdminSectionCard } from '../components/AdminSectionCard';
import { ProductSkeleton } from './components/ProductSkeleton';
import { QuickViewModal } from './components/QuickViewModal';
import { formatRubles } from '../utils/formatCurrency';
import {
	ArrowPathIcon,
	ArrowTrendingUpIcon,
	CubeIcon,
	ListBulletIcon,
	MagnifyingGlassIcon,
	PlusIcon,
	SparklesIcon,
	Squares2X2Icon,
	XMarkIcon,
} from '@heroicons/react/24/outline';

import { PRODUCT_COLLECTION_LABELS } from '@/features/site-studio/shared/constants/productCollections';

const collectionLabels = PRODUCT_COLLECTION_LABELS;

type SortField = 'name' | 'price' | 'createdAt' | 'stockQuantity';
type SortDirection = 'asc' | 'desc';
type ViewMode = 'grid' | 'list';

export const ProductsListPage: React.FC = () => {
	const { t } = useTranslation('siteStudio');
	const { t: tCms } = useTranslation('siteStudioCms');
	const navigate = useAdminNavigate();
	const { data: productsData, isLoading, refetch } = useProducts();
	const products = useMemo(
		() => productsData?.data ?? [],
		[productsData?.data]
	);
	const updateProduct = useUpdateProduct();
	const deleteProduct = useDeleteProduct();
	const createProduct = useCreateProduct();
	const { data: productsSummary } = useProductsSummary();
	const bulkUpdatePrice = useBulkUpdateProductPrice();

	const [searchQuery, setSearchQuery] = useState('');
	const [collectionFilter, setCollectionFilter] = useState<string>('all');
	const [stockFilter, setStockFilter] = useState<
		'all' | 'inStock' | 'outOfStock'
	>('all');
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editForm, setEditForm] = useState<{ price: number; inStock: boolean }>(
		{ price: 0, inStock: true }
	);
	const [viewMode, setViewMode] = useState<ViewMode>('grid');
	const [sortField, setSortField] = useState<SortField>('createdAt');
	const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

	// Selection state
	const [selectedIds, setSelectedIds] = useState<string[]>([]);

	// Quick View modal state
	const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(
		null
	);
	const [isQuickViewOpen, setIsQuickViewOpen] = useState(false);

	const [pendingDeleteProduct, setPendingDeleteProduct] = useState<{
		id: string;
		name: string;
	} | null>(null);
	const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);

	const handleQuickView = (product: Product) => {
		setQuickViewProduct(product);
		setIsQuickViewOpen(true);
	};

	const handleDuplicate = async (product: Product) => {
		try {
			const duplicateData = {
				name: `${product.name} (копия)`,
				description: product.description,
				price: product.price,
				collection: product.collection,
				volume: product.volume,
				image: product.image,
				inStock: product.inStock,
				variants: product.variants,
			};

			const result = await createProduct.mutateAsync(duplicateData);
			setIsQuickViewOpen(false);

			// Navigate to edit the new product
			if (result?.id) {
				navigate(`/admin/products/${result.id}`);
			} else {
				refetch();
			}
		} catch (error) {
			console.error('Failed to duplicate product:', error);
			toast.error(
				toErrorText(error) || t('adminCatalog.products.duplicateError')
			);
		}
	};

	// Filter and sort products
	const filteredProducts = products
		.filter((p: Product) => {
			const matchesSearch = p.name
				.toLowerCase()
				.includes(searchQuery.toLowerCase());
			const matchesCollection =
				collectionFilter === 'all' || p.collection === collectionFilter;
			const matchesStock =
				stockFilter === 'all' ||
				(stockFilter === 'inStock' && p.inStock) ||
				(stockFilter === 'outOfStock' && !p.inStock);
			return matchesSearch && matchesCollection && matchesStock;
		})
		.sort((a: Product, b: Product) => {
			let comparison = 0;
			switch (sortField) {
				case 'name':
					comparison = a.name.localeCompare(b.name);
					break;
				case 'price':
					comparison = a.price - b.price;
					break;
				case 'stockQuantity':
					comparison = (a.stockQuantity || 0) - (b.stockQuantity || 0);
					break;
				default:
					comparison =
						new Date(a.createdAt || 0).getTime() -
						new Date(b.createdAt || 0).getTime();
			}
			return sortDirection === 'asc' ? comparison : -comparison;
		});

	// Stats — server summary (full catalog), not client reduce over current page
	const totalProducts = productsSummary?.totalProducts ?? products.length;
	const inStockCount =
		productsSummary?.inStockCount ??
		products.filter((p: Product) => p.inStock).length;
	const outOfStockCount =
		productsSummary?.outOfStockCount ?? totalProducts - inStockCount;
	const totalValue =
		productsSummary?.totalValue ??
		products.reduce(
			(sum: number, p: Product) => sum + p.price * (p.stockQuantity || 1),
			0
		);

	const startEdit = (product: Product) => {
		setEditingId(product.id);
		setEditForm({ price: product.price, inStock: product.inStock });
	};

	const cancelEdit = () => {
		setEditingId(null);
		setEditForm({ price: 0, inStock: true });
	};

	const saveEdit = async (id: string) => {
		await updateProduct.mutateAsync({
			id,
			price: editForm.price,
			inStock: editForm.inStock,
		});
		setEditingId(null);
	};

	const requestDeleteProduct = (id: string, name: string) => {
		setPendingDeleteProduct({ id, name });
	};

	const cancelDeleteProduct = () => setPendingDeleteProduct(null);

	const executeDeleteProduct = async () => {
		if (!pendingDeleteProduct) return;
		const { id } = pendingDeleteProduct;
		try {
			await deleteProduct.mutateAsync(id);
		} catch (error) {
			console.error('Failed to delete product:', error);
			throw new Error(
				toErrorText(error) || t('adminCatalog.products.deleteError')
			);
		}
	};

	const handleQuickToggleStock = async (id: string, inStock: boolean) => {
		await updateProduct.mutateAsync({ id, inStock });
	};

	// Selection handlers
	const handleSelectAll = () => {
		if (selectedIds.length === filteredProducts.length) {
			setSelectedIds([]);
		} else {
			setSelectedIds(filteredProducts.map((p) => p.id));
		}
	};

	const handleSelect = (id: string) => {
		if (selectedIds.includes(id)) {
			setSelectedIds(selectedIds.filter((selectedId) => selectedId !== id));
		} else {
			setSelectedIds([...selectedIds, id]);
		}
	};

	// Bulk actions
	const requestBulkDelete = () => {
		if (selectedIds.length === 0) return;
		setShowBulkDeleteModal(true);
	};

	const cancelBulkDelete = () => setShowBulkDeleteModal(false);

	const executeBulkDelete = async () => {
		try {
			await Promise.all(selectedIds.map((id) => deleteProduct.mutateAsync(id)));
			setSelectedIds([]);
		} catch (error) {
			console.error('Failed to delete products:', error);
			throw new Error(
				toErrorText(error) || t('adminCatalog.products.bulkDeleteError')
			);
		}
	};

	const handleBulkUpdateStock = async (inStock: boolean) => {
		try {
			await Promise.all(
				selectedIds.map((id) => updateProduct.mutateAsync({ id, inStock }))
			);
			setSelectedIds([]);
		} catch (error) {
			console.error('Failed to update stock:', error);
			toast.error(
				toErrorText(error) || t('adminCatalog.products.bulkStockError')
			);
		}
	};

	const handleBulkUpdatePrice = async (percentage: number) => {
		if (percentage === 0 || selectedIds.length === 0) return;

		try {
			await bulkUpdatePrice.mutateAsync({
				ids: selectedIds,
				percentage,
			});
			setSelectedIds([]);
		} catch (error) {
			console.error('Failed to update prices:', error);
			toast.error(
				toErrorText(error) || t('adminCatalog.products.bulkPriceError')
			);
		}
	};

	// Calculate selected products value
	const selectedProductsValue = useMemo(() => {
		return selectedIds.reduce((sum, id) => {
			const product = products.find((p) => p.id === id);
			return sum + (product?.price || 0);
		}, 0);
	}, [selectedIds, products]);

	// Active filters count
	const activeFiltersCount = [
		collectionFilter !== 'all',
		stockFilter !== 'all',
		searchQuery.length > 0,
	].filter(Boolean).length;

	const clearFilters = () => {
		setSearchQuery('');
		setCollectionFilter('all');
		setStockFilter('all');
	};

	return (
		<div className="space-y-6">
			<AdminPageHeader
				eyebrow="Каталог"
				title="Товары"
				titleIcon={
					<CubeIcon
						className="text-primary-600 dark:text-primary-400"
						width={24}
						height={24}
					/>
				}
				titleExtra={
					!isLoading ? (
						<span className="text-lg font-normal text-neutral-400 dark:text-slate-500">
							({totalProducts})
						</span>
					) : null
				}
				description={
					<span className="inline-flex items-center gap-2">
						<SparklesIcon
							width={14}
							height={14}
							className="text-amber-500 shrink-0"
						/>
						Управление каталогом продукции
					</span>
				}
				actions={
					<>
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
							Обновить
						</Button>
						<Link to="/admin/products/new">
							<Button className="shadow-lg shadow-primary-500/20 hover:shadow-primary-500/30 transition-shadow">
								<PlusIcon width={18} height={18} className="mr-1" />
								Добавить товар
							</Button>
						</Link>
					</>
				}
			/>

			{/* Stats cards */}
			<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
				<div className="p-4 rounded-2xl border bg-linear-to-br from-primary-50 to-white dark:from-primary-900/40 dark:to-slate-800 border-primary-200/50 dark:border-primary-700/30 shadow-lg shadow-primary-500/5 dark:shadow-primary-900/20">
					<div className="flex items-center justify-between">
						<div>
							<p className="text-xs font-medium text-primary-600 dark:text-primary-400 uppercase tracking-wider">
								Всего товаров
							</p>
							<p className="text-2xl font-bold text-primary-900 dark:text-primary-100 mt-1">
								{totalProducts}
							</p>
						</div>
						<div className="p-2.5 bg-primary-100 dark:bg-primary-800/50 rounded-xl">
							<CubeIcon
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
								В наличии
							</p>
							<p className="text-2xl font-bold text-emerald-900 dark:text-emerald-100 mt-1">
								{inStockCount}
							</p>
						</div>
						<div className="p-2.5 bg-emerald-100 dark:bg-emerald-800/50 rounded-xl">
							<ArrowTrendingUpIcon
								width={20}
								height={20}
								className="text-emerald-600 dark:text-emerald-400"
							/>
						</div>
					</div>
				</div>

				<div className="p-4 rounded-2xl border bg-linear-to-br from-red-50 to-white dark:from-red-900/40 dark:to-slate-800 border-red-200/50 dark:border-red-700/30 shadow-lg shadow-red-500/5 dark:shadow-red-900/20">
					<div className="flex items-center justify-between">
						<div>
							<p className="text-xs font-medium text-red-600 dark:text-red-400 uppercase tracking-wider">
								Нет в наличии
							</p>
							<p className="text-2xl font-bold text-red-900 dark:text-red-100 mt-1">
								{outOfStockCount}
							</p>
						</div>
						<div className="p-2.5 bg-red-100 dark:bg-red-800/50 rounded-xl">
							<CubeIcon
								width={20}
								height={20}
								className="text-red-600 dark:text-red-400"
							/>
						</div>
					</div>
				</div>

				<div className="p-4 rounded-2xl border bg-linear-to-br from-amber-50 to-white dark:from-amber-900/40 dark:to-slate-800 border-amber-200/50 dark:border-amber-700/30 shadow-lg shadow-amber-500/5 dark:shadow-amber-900/20">
					<div className="flex items-center justify-between">
						<div>
							<p className="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wider">
								Стоимость
							</p>
							<p className="text-2xl font-bold text-amber-900 dark:text-amber-100 mt-1">
								{formatRubles(totalValue, 'compact')}
							</p>
						</div>
						<div className="p-2.5 bg-amber-100 dark:bg-amber-800/50 rounded-xl">
							<ArrowTrendingUpIcon
								width={20}
								height={20}
								className="text-amber-600 dark:text-amber-400"
							/>
						</div>
					</div>
				</div>
			</div>

			{/* MagnifyingGlassIcon and Filters */}
			<AdminSectionCard className="dark:bg-slate-800/90">
				<div className="flex flex-col lg:flex-row gap-4">
					{/* MagnifyingGlassIcon */}
					<div className="relative flex-1">
						<MagnifyingGlassIcon
							className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-slate-500"
							width={18}
							height={18}
						/>
						<Input
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							placeholder="Поиск по названию..."
							className="pl-10 dark:bg-slate-900 dark:border-slate-600 dark:text-white dark:placeholder-slate-500"
							aria-label={tCms('products.a11y.searchProducts')}
						/>
					</div>

					{/* Filters row */}
					<div className="flex flex-wrap items-center gap-2">
						{/* Collection filter */}
						<select
							value={collectionFilter}
							onChange={(e) => setCollectionFilter(e.target.value)}
							className="rounded-xl border border-neutral-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-neutral-700 dark:text-slate-300 focus:border-primary-300 dark:focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:focus:ring-primary-900"
							aria-label={tCms('products.a11y.filterCollection')}
						>
							<option value="all">Все коллекции</option>
							{Object.entries(collectionLabels).map(([value, label]) => (
								<option key={value} value={value}>
									{label}
								</option>
							))}
						</select>

						{/* Stock filter */}
						<select
							value={stockFilter}
							onChange={(e) =>
								setStockFilter(e.target.value as typeof stockFilter)
							}
							className="rounded-xl border border-neutral-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-neutral-700 dark:text-slate-300 focus:border-primary-300 dark:focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:focus:ring-primary-900"
							aria-label={tCms('products.a11y.filterStock')}
						>
							<option value="all">Все статусы</option>
							<option value="inStock">В наличии</option>
							<option value="outOfStock">Нет в наличии</option>
						</select>

						{/* Sort */}
						<select
							value={`${sortField}-${sortDirection}`}
							onChange={(e) => {
								const [field, dir] = e.target.value.split('-');
								setSortField(field as SortField);
								setSortDirection(dir as SortDirection);
							}}
							className="rounded-xl border border-neutral-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-neutral-700 dark:text-slate-300 focus:border-primary-300 dark:focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:focus:ring-primary-900"
							aria-label={tCms('products.a11y.sort')}
						>
							<option value="createdAt-desc">Сначала новые</option>
							<option value="createdAt-asc">Сначала старые</option>
							<option value="name-asc">По названию A-Я</option>
							<option value="name-desc">По названию Я-A</option>
							<option value="price-asc">Цена ↑</option>
							<option value="price-desc">Цена ↓</option>
						</select>

						{/* Clear filters */}
						{activeFiltersCount > 0 && (
							<button
								type="button"
								onClick={clearFilters}
								className="flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-xl transition-colors"
							>
								<XMarkIcon width={14} height={14} />
								<span className="hidden sm:inline">Сбросить</span>
								<span className="bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
									{activeFiltersCount}
								</span>
							</button>
						)}

						{/* Divider */}
						<div className="w-px h-8 bg-neutral-200 dark:bg-slate-700 hidden sm:block" />

						{/* View mode toggle */}
						<div className="flex items-center bg-neutral-100 dark:bg-slate-700 rounded-xl p-1">
							<button
								type="button"
								onClick={() => setViewMode('grid')}
								className={`p-2 rounded-lg transition-[color,background-color,box-shadow] duration-200 motion-reduce:transition-none ${
									viewMode === 'grid'
										? 'bg-white dark:bg-slate-600 text-primary-600 dark:text-primary-400 shadow-sm'
										: 'text-neutral-500 dark:text-slate-400 hover:text-neutral-700 dark:hover:text-slate-300'
								}`}
								aria-label={tCms('products.a11y.gridView')}
							>
								<Squares2X2Icon width={18} height={18} />
							</button>
							<button
								type="button"
								onClick={() => setViewMode('list')}
								className={`p-2 rounded-lg transition-[color,background-color,box-shadow] duration-200 motion-reduce:transition-none ${
									viewMode === 'list'
										? 'bg-white dark:bg-slate-600 text-primary-600 dark:text-primary-400 shadow-sm'
										: 'text-neutral-500 dark:text-slate-400 hover:text-neutral-700 dark:hover:text-slate-300'
								}`}
								aria-label={tCms('products.a11y.listView')}
							>
								<ListBulletIcon width={18} height={18} />
							</button>
						</div>
					</div>
				</div>

				{/* Selection info */}
				{selectedIds.length > 0 && (
					<div className="mt-4 pt-4 border-t border-neutral-100 dark:border-slate-700 flex items-center justify-between">
						<div className="flex items-center gap-3">
							<Checkbox
								checked={selectedIds.length === filteredProducts.length}
								onChange={handleSelectAll}
								aria-label={tCms('products.a11y.selectAll')}
							/>
							<span className="text-sm text-neutral-600 dark:text-slate-400">
								Выбрано:{' '}
								<strong className="text-neutral-900 dark:text-white">
									{selectedIds.length}
								</strong>{' '}
								из {filteredProducts.length}
							</span>
						</div>
						<button
							type="button"
							onClick={() => setSelectedIds([])}
							className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
						>
							Снять выделение
						</button>
					</div>
				)}
			</AdminSectionCard>

			{/* Products Grid/List */}
			{isLoading ? (
				<ProductSkeleton viewMode={viewMode} count={8} />
			) : viewMode === 'grid' ? (
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
					{filteredProducts.map((product: Product, index: number) => (
						<div
							key={product.id}
							className={cn(
								'animate-in fade-in slide-in-from-bottom-4 [animation-fill-mode:backwards]',
								`[animation-delay:${index * 50}ms]`
							)}
						>
							<ProductGridCard
								product={product}
								collectionLabels={collectionLabels}
								onDelete={requestDeleteProduct}
								onQuickToggleStock={handleQuickToggleStock}
								onQuickView={handleQuickView}
								onDuplicate={handleDuplicate}
								selected={selectedIds.includes(product.id)}
								onSelect={() => handleSelect(product.id)}
							/>
						</div>
					))}
				</div>
			) : (
				<div className="overflow-hidden pb-20 rounded-2xl border bg-white dark:bg-slate-800 border-neutral-200 dark:border-slate-700 shadow-sm">
					<div className="overflow-x-auto">
						<table className="w-full text-sm">
							<thead className="bg-neutral-50 dark:bg-slate-900 border-b border-neutral-200 dark:border-slate-700">
								<tr>
									<th className="pl-4 py-3 w-10">
										<Checkbox
											checked={
												filteredProducts.length > 0 &&
												selectedIds.length === filteredProducts.length
											}
											onChange={handleSelectAll}
											aria-label={tCms('products.a11y.selectAll')}
										/>
									</th>
									<th className="text-left px-4 py-3 font-medium text-neutral-600 dark:text-slate-400">
										Товар
									</th>
									<th className="text-left px-4 py-3 font-medium text-neutral-600 dark:text-slate-400 hidden sm:table-cell">
										Коллекция
									</th>
									<th className="text-left px-4 py-3 font-medium text-neutral-600 dark:text-slate-400">
										Объём
									</th>
									<th className="text-right px-4 py-3 font-medium text-neutral-600 dark:text-slate-400">
										Цена
									</th>
									<th className="text-right px-4 py-3 font-medium text-neutral-600 dark:text-slate-400 hidden md:table-cell">
										Статус
									</th>
									<th className="text-right px-4 py-3 font-medium text-neutral-600 dark:text-slate-400 w-32">
										Действия
									</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-neutral-100 dark:divide-slate-700">
								{filteredProducts.map((product: Product) => (
									<ProductListItem
										key={product.id}
										product={product}
										collectionLabels={collectionLabels}
										editingId={editingId}
										editForm={editForm}
										onStartEdit={startEdit}
										onCancelEdit={cancelEdit}
										onSaveEdit={saveEdit}
										onEditFormChange={setEditForm}
										onDelete={requestDeleteProduct}
										selected={selectedIds.includes(product.id)}
										onSelect={() => handleSelect(product.id)}
									/>
								))}
							</tbody>
						</table>
					</div>
				</div>
			)}

			<BulkActionsBar
				selectedCount={selectedIds.length}
				selectedValue={selectedProductsValue}
				onClearSelection={() => setSelectedIds([])}
				onDelete={requestBulkDelete}
				onUpdateStock={handleBulkUpdateStock}
				onUpdatePrice={handleBulkUpdatePrice}
			/>

			{!isLoading && filteredProducts.length === 0 && (
				<div className="p-16 text-center rounded-2xl border bg-white dark:bg-slate-800 border-neutral-200 dark:border-slate-700 shadow-sm">
					<div className="max-w-md mx-auto">
						<div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-linear-to-br from-primary-100 to-primary-50 dark:from-primary-900/30 dark:to-primary-800/20 flex items-center justify-center">
							<CubeIcon
								width={40}
								height={40}
								className="text-primary-500 dark:text-primary-400"
							/>
						</div>

						{activeFiltersCount > 0 ? (
							<>
								<h3 className="text-xl font-semibold text-neutral-900 dark:text-white mb-2">
									Ничего не найдено
								</h3>
								<p className="text-neutral-500 dark:text-slate-400 mb-6">
									По вашему запросу не найдено товаров. Попробуйте изменить
									фильтры.
								</p>
								<div className="flex items-center justify-center gap-3">
									<Button variant="outline" onClick={clearFilters}>
										<XMarkIcon width={16} height={16} className="mr-1" />
										Сбросить фильтры
									</Button>
									<Link to="/admin/products/new">
										<Button>
											<PlusIcon width={18} height={18} className="mr-1" />
											Добавить товар
										</Button>
									</Link>
								</div>
							</>
						) : (
							<>
								<h3 className="text-xl font-semibold text-neutral-900 dark:text-white mb-2">
									Каталог пуст
								</h3>
								<p className="text-neutral-500 dark:text-slate-400 mb-6">
									Добавьте первый товар, чтобы начать работу с каталогом
								</p>
								<Link to="/admin/products/new">
									<Button className="shadow-lg shadow-primary-500/20">
										<PlusIcon width={18} height={18} className="mr-1" />
										Добавить первый товар
									</Button>
								</Link>
							</>
						)}
					</div>
				</div>
			)}

			{/* Quick View Modal */}
			<QuickViewModal
				product={quickViewProduct}
				isOpen={isQuickViewOpen}
				onClose={() => setIsQuickViewOpen(false)}
				onDuplicate={handleDuplicate}
				collectionLabels={collectionLabels}
			/>

			<ConfirmDeleteModal
				isOpen={pendingDeleteProduct !== null}
				onClose={cancelDeleteProduct}
				onConfirm={executeDeleteProduct}
				title={t('adminCatalog.products.deleteProductModalTitle')}
				itemName={pendingDeleteProduct?.name}
				warningMessage={t('adminCatalog.products.deleteProductModalWarning')}
				confirmButtonLabel={t('adminCatalog.common.delete')}
				confirmButtonLoadingLabel={t('adminCatalog.common.deleteModalDeleting')}
				cancelButtonLabel={t('adminCatalog.common.cancel')}
			/>

			<ConfirmDeleteModal
				isOpen={showBulkDeleteModal}
				onClose={cancelBulkDelete}
				onConfirm={executeBulkDelete}
				title={t('adminCatalog.products.bulkDeleteModalTitle', {
					count: selectedIds.length,
				})}
				warningMessage={t('adminCatalog.products.bulkDeleteModalWarning')}
				confirmButtonLabel={t('adminCatalog.common.delete')}
				confirmButtonLoadingLabel={t('adminCatalog.common.deleteModalDeleting')}
				cancelButtonLabel={t('adminCatalog.common.cancel')}
			/>
		</div>
	);
};
