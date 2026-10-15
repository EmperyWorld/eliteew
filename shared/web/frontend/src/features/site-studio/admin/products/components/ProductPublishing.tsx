import * as React from 'react';
import { useId } from 'react';
import {
	ArrowDownTrayIcon,
	ArrowPathIcon,
	ArrowsUpDownIcon,
	CheckIcon,
	CubeIcon,
	GlobeAltIcon,
	SparklesIcon,
	StarIcon,
	XMarkIcon,
} from '@heroicons/react/24/outline';
import { Button } from '@components/atoms/Button';
import { Input } from '@components/atoms/Input';

interface ProductPublishingProps {
	inStock: boolean;
	stockQuantity: number;
	isNew: boolean;
	isFeatured: boolean;
	order: number;
	isSaving: boolean;
	hasVariants: boolean;
	onChange: (field: string, value: unknown) => void;
	onCancel: () => void;
}

export const ProductPublishing: React.FC<ProductPublishingProps> = ({
	inStock,
	stockQuantity,
	isNew,
	isFeatured,
	order,
	isSaving,
	hasVariants,
	onChange,
	onCancel,
}) => {
	const fieldId = useId();
	return (
		<div className="space-y-6">
			{/* Publishing Card */}
			<div className="bg-white dark:bg-slate-800 rounded-2xl border border-neutral-200 dark:border-slate-700 shadow-sm overflow-hidden sticky top-6">
				{/* Header */}
				<div className="px-5 py-4 border-b border-neutral-100 dark:border-slate-700 bg-gradient-to-r from-primary-50 to-emerald-50 dark:from-primary-900/20 dark:to-emerald-900/20">
					<h2 className="text-lg font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
						<GlobeAltIcon width={18} height={18} className="text-primary-500" />
						Публикация
					</h2>
				</div>

				{/* Content */}
				<div className="p-5 space-y-5">
					{/* Stock Toggle */}
					<div className="flex items-center justify-between p-3 bg-neutral-50 dark:bg-slate-900/50 rounded-xl">
						<div className="flex items-center gap-3">
							<div
								className={`p-2 rounded-lg ${inStock ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}
							>
								<CubeIcon
									width={18}
									height={18}
									className={
										inStock
											? 'text-emerald-600 dark:text-emerald-400'
											: 'text-red-600 dark:text-red-400'
									}
								/>
							</div>
							<div>
								<span className="text-sm font-medium text-neutral-900 dark:text-white">
									В наличии
								</span>
								<p className="text-xs text-neutral-500 dark:text-slate-400">
									{inStock ? 'Товар доступен' : 'Товар недоступен'}
								</p>
							</div>
						</div>
						<button
							type="button"
							onClick={() => onChange('inStock', !inStock)}
							className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors shadow-inner ${
								inStock ? 'bg-emerald-500' : 'bg-neutral-300 dark:bg-slate-600'
							}`}
							aria-label="Переключить наличие"
						>
							<span
								className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform ${
									inStock ? 'translate-x-6' : 'translate-x-1'
								}`}
							>
								{inStock && (
									<CheckIcon
										width={12}
										height={12}
										className="absolute top-1 left-1 text-emerald-500"
									/>
								)}
							</span>
						</button>
					</div>

					{/* Stock Quantity */}
					<div className="space-y-2">
						<label
							htmlFor={`${fieldId}-stock`}
							className="flex items-center justify-between"
						>
							<span className="text-sm font-medium text-neutral-700 dark:text-slate-300">
								Общий остаток
							</span>
							{hasVariants && (
								<span className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full">
									Авто
								</span>
							)}
						</label>
						<Input
							id={`${fieldId}-stock`}
							type="number"
							value={stockQuantity}
							onChange={(e) =>
								onChange('stockQuantity', parseInt(e.target.value, 10) || 0)
							}
							min={0}
							disabled={hasVariants}
							aria-label="Общий остаток"
							className={`dark:bg-slate-900 dark:border-slate-600 dark:text-white ${hasVariants ? 'opacity-60' : ''}`}
						/>
						{hasVariants && (
							<p className="text-xs text-neutral-400 dark:text-slate-500">
								Сумма остатков из вариантов
							</p>
						)}
					</div>

					{/* Divider */}
					<div className="border-t border-neutral-100 dark:border-slate-700" />

					{/* Badges Section */}
					<div className="space-y-3">
						<p className="text-sm font-medium text-neutral-700 dark:text-slate-300">
							Метки товара
						</p>

						{/* New badge */}
						<label className="flex items-center gap-3 p-3 bg-neutral-50 dark:bg-slate-900/50 rounded-xl cursor-pointer hover:bg-amber-50 dark:hover:bg-amber-900/10 transition-colors group">
							<div
								className={`p-2 rounded-lg transition-colors ${isNew ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-neutral-200 dark:bg-slate-700 group-hover:bg-amber-100 dark:group-hover:bg-amber-900/30'}`}
							>
								<SparklesIcon
									width={16}
									height={16}
									className={
										isNew
											? 'text-amber-600 dark:text-amber-400'
											: 'text-neutral-400 dark:text-slate-500 group-hover:text-amber-500'
									}
								/>
							</div>
							<div className="flex-1">
								<span className="text-sm font-medium text-neutral-900 dark:text-white">
									Новинка
								</span>
								<p className="text-xs text-neutral-500 dark:text-slate-400">
									Отображать бейдж "Новинка"
								</p>
							</div>
							<input
								type="checkbox"
								checked={isNew}
								onChange={(e) => onChange('isNew', e.target.checked)}
								className="w-5 h-5 rounded border-neutral-300 dark:border-slate-600 text-amber-500 focus:ring-amber-500 dark:bg-slate-800"
							/>
						</label>

						{/* Featured badge */}
						<label className="flex items-center gap-3 p-3 bg-neutral-50 dark:bg-slate-900/50 rounded-xl cursor-pointer hover:bg-primary-50 dark:hover:bg-primary-900/10 transition-colors group">
							<div
								className={`p-2 rounded-lg transition-colors ${isFeatured ? 'bg-primary-100 dark:bg-primary-900/30' : 'bg-neutral-200 dark:bg-slate-700 group-hover:bg-primary-100 dark:group-hover:bg-primary-900/30'}`}
							>
								<StarIcon
									width={16}
									height={16}
									className={
										isFeatured
											? 'text-primary-600 dark:text-primary-400'
											: 'text-neutral-400 dark:text-slate-500 group-hover:text-primary-500'
									}
								/>
							</div>
							<div className="flex-1">
								<span className="text-sm font-medium text-neutral-900 dark:text-white">
									На главной
								</span>
								<p className="text-xs text-neutral-500 dark:text-slate-400">
									Показать на главной странице
								</p>
							</div>
							<input
								type="checkbox"
								checked={isFeatured}
								onChange={(e) => onChange('isFeatured', e.target.checked)}
								className="w-5 h-5 rounded border-neutral-300 dark:border-slate-600 text-primary-600 focus:ring-primary-500 dark:bg-slate-800"
							/>
						</label>
					</div>

					{/* Divider */}
					<div className="border-t border-neutral-100 dark:border-slate-700" />

					{/* Actions */}
					<div className="space-y-3">
						<Button
							type="submit"
							fullWidth
							disabled={isSaving}
							className="shadow-lg shadow-primary-500/20"
						>
							{isSaving ? (
								<ArrowPathIcon
									width={18}
									height={18}
									className="mr-2 animate-spin"
								/>
							) : (
								<ArrowDownTrayIcon width={18} height={18} className="mr-2" />
							)}
							{isSaving ? 'Сохранение...' : 'Сохранить товар'}
						</Button>
						<Button
							type="button"
							variant="outline"
							fullWidth
							onClick={onCancel}
							className="dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
						>
							<XMarkIcon width={18} height={18} className="mr-2" />
							Отмена
						</Button>
					</div>
				</div>
			</div>

			{/* Sorting Card */}
			<div className="bg-white dark:bg-slate-800 rounded-2xl border border-neutral-200 dark:border-slate-700 shadow-sm overflow-hidden">
				<div className="px-5 py-4 border-b border-neutral-100 dark:border-slate-700 bg-neutral-50/50 dark:bg-slate-900/50">
					<h2 className="text-lg font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
						<ArrowsUpDownIcon
							width={18}
							height={18}
							className="text-neutral-500 dark:text-slate-400"
						/>
						Сортировка
					</h2>
				</div>

				<div className="p-5 space-y-3">
					<label
						htmlFor={`${fieldId}-order`}
						className="block text-sm font-medium text-neutral-700 dark:text-slate-300"
					>
						Порядок отображения
					</label>
					<Input
						id={`${fieldId}-order`}
						type="number"
						value={order}
						onChange={(e) =>
							onChange('order', parseInt(e.target.value, 10) || 0)
						}
						min={0}
						aria-label="Порядок сортировки"
						className="dark:bg-slate-900 dark:border-slate-600 dark:text-white"
					/>
					<p className="text-xs text-neutral-400 dark:text-slate-500">
						Меньшее число = выше в списке. 0 = по умолчанию.
					</p>
				</div>
			</div>
		</div>
	);
};
