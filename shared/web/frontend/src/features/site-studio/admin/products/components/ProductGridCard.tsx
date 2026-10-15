import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import {
	CheckIcon,
	CubeIcon,
	DocumentDuplicateIcon,
	EllipsisVerticalIcon,
	EyeIcon,
	PencilSquareIcon,
	SparklesIcon,
	TrashIcon,
	XMarkIcon,
} from '@heroicons/react/24/outline';
import { AdminLink as Link } from '../../components/AdminLink';
import { getProductImage } from '@utils/productImages';
import { Checkbox } from '@components/atoms/Checkbox';
import type { Product } from '@typings/product';
import { PRODUCT_COLLECTION_CHIP_STYLES } from '@/features/site-studio/shared/constants/productCollections';

interface ProductGridCardProps {
	product: Product;
	collectionLabels: Record<string, string>;
	onDelete: (id: string, name: string) => void;
	onQuickToggleStock: (id: string, inStock: boolean) => void;
	onQuickView?: (product: Product) => void;
	onDuplicate?: (product: Product) => void;
	selected?: boolean;
	onSelect?: () => void;
}

const collectionColors = PRODUCT_COLLECTION_CHIP_STYLES;

export const ProductGridCard: React.FC<ProductGridCardProps> = ({
	product,
	collectionLabels,
	onDelete,
	onQuickToggleStock,
	onQuickView,
	onDuplicate,
	selected,
	onSelect,
}) => {
	const [showMenu, setShowMenu] = useState(false);
	const menuRef = useRef<HTMLDivElement>(null);

	// CheckIcon if product is new (created within last 7 days)
	const isNew =
		product.createdAt &&
		new Date(product.createdAt) >
			new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
				setShowMenu(false);
			}
		};
		document.addEventListener('mousedown', handleClickOutside);
		return () => document.removeEventListener('mousedown', handleClickOutside);
	}, []);

	const collectionColor = collectionColors[product.collection || ''] || {
		bg: 'bg-neutral-100',
		text: 'text-neutral-700',
		darkBg: 'dark:bg-neutral-800',
		darkText: 'dark:text-neutral-300',
	};

	const priceDisplay =
		product.variants && product.variants.length > 0
			? `${Math.min(...product.variants.map((v) => v.price)).toLocaleString('ru-RU')}—${Math.max(...product.variants.map((v) => v.price)).toLocaleString('ru-RU')}`
			: product.price.toLocaleString('ru-RU');

	const volumeDisplay =
		product.variants && product.variants.length > 0
			? product.variants.map((v) => v.volume).join(' / ')
			: product.volume || '';

	return (
		<div
			className={`
        group relative bg-white dark:bg-slate-800 rounded-2xl border transition-[box-shadow,border-color,ring-color] duration-300 motion-reduce:transition-none
        ${
					selected
						? 'border-primary-400 dark:border-primary-500 ring-2 ring-primary-100 dark:ring-primary-900/30 shadow-lg'
						: 'border-neutral-200 dark:border-slate-700 hover:border-primary-200 dark:hover:border-primary-700 hover:shadow-xl'
				}
      `}
		>
			{/* Selection checkbox */}
			<div className="absolute top-3 left-3 z-10">
				<div
					className={`
          transition-[opacity,transform] duration-200 motion-reduce:transition-none min-h-11 min-w-11 flex items-center justify-center -m-1 p-1 rounded-lg
          ${selected ? 'opacity-100 scale-100' : 'opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100'}
        `}
				>
					<Checkbox
						checked={selected}
						onChange={onSelect}
						aria-label={`Выбрать ${product.name}`}
						className="bg-white dark:bg-slate-800 rounded-lg shadow-md"
					/>
				</div>
			</div>

			{/* Badges */}
			<div className="absolute top-3 right-3 z-10 flex flex-col gap-2 items-end">
				{/* New badge */}
				{isNew && (
					<span className="px-2.5 py-1 bg-linear-to-r from-amber-400 to-orange-500 text-white text-xs font-bold rounded-full shadow-lg flex items-center gap-1">
						<SparklesIcon width={12} height={12} /> Новинка
					</span>
				)}

				{/* Stock badge */}
				<button
					type="button"
					onClick={() => onQuickToggleStock(product.id, !product.inStock)}
					className={`
            min-h-11 px-3 inline-flex items-center justify-center rounded-full text-xs font-semibold transition-[background-color,color,box-shadow] duration-200 shadow-sm
            ${
							product.inStock
								? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-400 dark:hover:bg-emerald-900'
								: 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/50 dark:text-red-400 dark:hover:bg-red-900'
						}
          `}
					title={
						product.inStock
							? 'Нажмите чтобы убрать из наличия'
							: 'Нажмите чтобы вернуть в наличие'
					}
				>
					{product.inStock ? (
						<span className="flex items-center gap-1">
							<CheckIcon width={12} height={12} /> В наличии
						</span>
					) : (
						<span className="flex items-center gap-1">
							<XMarkIcon width={12} height={12} /> Нет
						</span>
					)}
				</button>
			</div>

			{/* Image */}
			<Link to={`/admin/products/${product.id}`} className="block">
				<div className="aspect-square rounded-t-2xl overflow-hidden bg-neutral-100 dark:bg-slate-700 relative">
					{product.image ? (
						<img
							src={getProductImage(product.image, product.name)}
							alt={product.name}
							className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
						/>
					) : (
						<div className="w-full h-full flex flex-col items-center justify-center text-neutral-300 dark:text-slate-500">
							<CubeIcon width={48} height={48} strokeWidth={1} />
							<span className="text-xs mt-2">Нет фото</span>
						</div>
					)}

					{/* Hover overlay with quick actions */}
					<div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-4">
						<div className="flex gap-2 transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
							<Link
								to={`/admin/products/${product.id}`}
								className="min-h-11 min-w-11 inline-flex items-center justify-center p-2.5 bg-white/95 dark:bg-slate-800/95 rounded-xl text-primary-600 dark:text-primary-400 hover:bg-white hover:scale-110 transition-[transform,background-color,box-shadow] duration-200 motion-reduce:transition-none motion-reduce:hover:scale-100 shadow-lg backdrop-blur-sm"
								title="Редактировать"
							>
								<PencilSquareIcon width={18} height={18} />
							</Link>
							{onQuickView && (
								<button
									type="button"
									onClick={(e) => {
										e.preventDefault();
										onQuickView(product);
									}}
									className="min-h-11 min-w-11 inline-flex items-center justify-center p-2.5 bg-white/95 dark:bg-slate-800/95 rounded-xl text-blue-600 dark:text-blue-400 hover:bg-white hover:scale-110 transition-[transform,background-color,box-shadow] duration-200 motion-reduce:transition-none motion-reduce:hover:scale-100 shadow-lg backdrop-blur-sm"
									title="Быстрый просмотр"
								>
									<EyeIcon width={18} height={18} />
								</button>
							)}
							{onDuplicate && (
								<button
									type="button"
									onClick={(e) => {
										e.preventDefault();
										onDuplicate(product);
									}}
									className="min-h-11 min-w-11 inline-flex items-center justify-center p-2.5 bg-white/95 dark:bg-slate-800/95 rounded-xl text-amber-600 dark:text-amber-400 hover:bg-white hover:scale-110 transition-[transform,background-color,box-shadow] duration-200 motion-reduce:transition-none motion-reduce:hover:scale-100 shadow-lg backdrop-blur-sm"
									title="Дублировать"
								>
									<DocumentDuplicateIcon width={18} height={18} />
								</button>
							)}
							<button
								type="button"
								onClick={(e) => {
									e.preventDefault();
									onDelete(product.id, product.name);
								}}
								className="min-h-11 min-w-11 inline-flex items-center justify-center p-2.5 bg-white/95 dark:bg-slate-800/95 rounded-xl text-red-500 dark:text-red-400 hover:bg-white hover:scale-110 transition-[transform,background-color,box-shadow] duration-200 motion-reduce:transition-none motion-reduce:hover:scale-100 shadow-lg backdrop-blur-sm"
								title="Удалить"
							>
								<TrashIcon width={18} height={18} />
							</button>
						</div>
					</div>
				</div>
			</Link>

			{/* Content */}
			<div className="p-4 space-y-3">
				{/* Collection badge */}
				<div className="flex items-center justify-between">
					<span
						className={`
            px-2.5 py-1 rounded-full text-xs font-medium
            ${collectionColor.bg} ${collectionColor.text} ${collectionColor.darkBg} ${collectionColor.darkText}
          `}
					>
						{collectionLabels[product.collection || ''] ||
							product.collection ||
							'Без коллекции'}
					</span>
					{volumeDisplay && (
						<span className="text-xs text-neutral-500 dark:text-slate-400">
							{volumeDisplay}
						</span>
					)}
				</div>

				{/* Title */}
				<Link to={`/admin/products/${product.id}`}>
					<h3 className="font-semibold text-neutral-900 dark:text-white line-clamp-2 leading-tight hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
						{product.name}
					</h3>
				</Link>

				{/* Price and stats */}
				<div className="flex items-end justify-between pt-2 border-t border-neutral-100 dark:border-slate-700">
					<div>
						<p className="text-2xl font-display font-bold text-neutral-900 dark:text-white">
							{priceDisplay}
							<span className="text-base font-normal text-neutral-500 dark:text-slate-400">
								₽
							</span>
						</p>
					</div>

					{/* Quick stats */}
					<div className="flex items-center gap-3 text-xs text-neutral-500 dark:text-slate-400">
						{product.stockQuantity !== undefined && (
							<span className="flex items-center gap-1" title="Остаток">
								<CubeIcon width={12} height={12} />
								{product.stockQuantity}
							</span>
						)}
					</div>
				</div>
			</div>

			{/* More menu */}
			<div className="absolute bottom-4 right-4" ref={menuRef}>
				<button
					type="button"
					onClick={() => setShowMenu(!showMenu)}
					aria-label="Открыть меню действий"
					title="К действиям с товаром"
					className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg p-2 hover:bg-neutral-100 dark:hover:bg-slate-700 text-neutral-400 dark:text-slate-500 opacity-0 group-hover:opacity-100 transition-[opacity,background-color,color] duration-200"
				>
					<EllipsisVerticalIcon width={16} height={16} aria-hidden />
				</button>

				{showMenu && (
					<div className="absolute bottom-full right-0 mb-1 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-neutral-200 dark:border-slate-700 py-1 min-w-40 z-20 animate-in fade-in zoom-in-95 duration-150">
						<Link
							to={`/admin/products/${product.id}`}
							className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-700 dark:text-slate-300 hover:bg-neutral-50 dark:hover:bg-slate-700"
						>
							<PencilSquareIcon width={14} height={14} /> Редактировать
						</Link>
						{onQuickView && (
							<button
								type="button"
								className="w-full flex items-center gap-2 px-3 py-2 text-sm text-neutral-700 dark:text-slate-300 hover:bg-neutral-50 dark:hover:bg-slate-700"
								onClick={() => {
									onQuickView(product);
									setShowMenu(false);
								}}
							>
								<EyeIcon width={14} height={14} /> Быстрый просмотр
							</button>
						)}
						{onDuplicate && (
							<button
								type="button"
								className="w-full flex items-center gap-2 px-3 py-2 text-sm text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20"
								onClick={() => {
									onDuplicate(product);
									setShowMenu(false);
								}}
							>
								<DocumentDuplicateIcon width={14} height={14} /> Дублировать
							</button>
						)}
						<button
							type="button"
							className="w-full flex items-center gap-2 px-3 py-2 text-sm text-neutral-700 dark:text-slate-300 hover:bg-neutral-50 dark:hover:bg-slate-700"
							onClick={() => {
								navigator.clipboard.writeText(product.id);
								setShowMenu(false);
							}}
						>
							<CubeIcon width={14} height={14} /> Копировать ID
						</button>
						<hr className="my-1 border-neutral-100 dark:border-slate-700" />
						<button
							type="button"
							onClick={() => {
								onDelete(product.id, product.name);
								setShowMenu(false);
							}}
							className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
						>
							<TrashIcon width={14} height={14} /> Удалить
						</button>
					</div>
				)}
			</div>
		</div>
	);
};
