import * as React from 'react';
import { useId } from 'react';
import {
	ArrowLeftIcon,
	CubeIcon,
	DocumentTextIcon,
	FolderOpenIcon,
	LinkIcon,
	SparklesIcon,
	TagIcon,
} from '@heroicons/react/24/outline';
import { Button } from '@components/atoms/Button';
import { Input } from '@components/atoms/Input';
import { Textarea } from '@components/atoms/Textarea';
import { PRODUCT_COLLECTION_COLORS } from '@/features/site-studio/shared/constants/productCollections';

interface ProductBasicInfoProps {
	isNew: boolean;
	name: string;
	slug: string;
	collection: string;
	category: string;
	description: string;
	collectionLabels: Record<string, string>;
	categoryLabels: Record<string, string>;
	fieldErrors?: Partial<Record<'name' | 'slug' | 'description', string>>;
	onBack: () => void;
	onChange: (field: string, value: unknown) => void;
	onGenerateSlug: () => void;
}

export const ProductBasicInfo: React.FC<ProductBasicInfoProps> = ({
	isNew,
	name,
	slug,
	collection,
	category,
	description,
	collectionLabels,
	categoryLabels,
	fieldErrors,
	onBack,
	onChange,
	onGenerateSlug,
}) => {
	const fieldId = useId();
	const descErrId = `${fieldId}-description-err`;
	const nameErrId = `${fieldId}-name-err`;
	const slugErrId = `${fieldId}-slug-err`;
	const gradientColor =
		PRODUCT_COLLECTION_COLORS[collection] || 'from-primary-500 to-primary-600';

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-center gap-4">
				<button
					type="button"
					onClick={onBack}
					className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-neutral-200 dark:border-slate-700 hover:bg-neutral-50 dark:hover:bg-slate-700 text-neutral-500 dark:text-slate-400 hover:text-neutral-700 dark:hover:text-white transition-[background-color,border-color,color,box-shadow] duration-200 shadow-sm"
					aria-label="Назад"
				>
					<ArrowLeftIcon width={20} height={20} />
				</button>
				<div className="flex-1">
					<div className="flex items-center gap-3">
						<div
							className={`p-2 bg-linear-to-br ${gradientColor} rounded-xl shadow-lg`}
						>
							<CubeIcon width={20} height={20} className="text-white" />
						</div>
						<div>
							<h1 className="text-2xl font-display font-bold text-neutral-900 dark:text-white flex items-center gap-2">
								{isNew ? 'Новый товар' : 'Редактирование'}
								{isNew && (
									<SparklesIcon
										width={18}
										height={18}
										className="text-amber-500"
									/>
								)}
							</h1>
							<p className="text-sm text-neutral-500 dark:text-slate-400">
								{isNew
									? 'Создание нового товара в каталоге'
									: name || 'Без названия'}
							</p>
						</div>
					</div>
				</div>
			</div>

			{/* Main Card */}
			<div className="bg-white dark:bg-slate-800 rounded-2xl border border-neutral-200 dark:border-slate-700 shadow-sm overflow-hidden">
				{/* Card Header */}
				<div className="px-6 py-4 border-b border-neutral-100 dark:border-slate-700 bg-neutral-50/50 dark:bg-slate-900/50">
					<h2 className="text-lg font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
						<DocumentTextIcon
							width={18}
							height={18}
							className="text-primary-500"
						/>
						Основная информация
					</h2>
					<p className="text-sm text-neutral-500 dark:text-slate-400 mt-0.5">
						Базовые данные о товаре
					</p>
				</div>

				{/* Card Content */}
				<div className="p-6 space-y-5">
					{/* Name field */}
					<div className="space-y-2">
						<label
							htmlFor={`${fieldId}-name`}
							className="flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-slate-300"
						>
							<DocumentTextIcon
								width={14}
								height={14}
								className="text-neutral-400 dark:text-slate-500"
							/>
							Название товара <span className="text-red-500">*</span>
						</label>
						<Input
							id={`${fieldId}-name`}
							value={name}
							onChange={(e) => onChange('name', e.target.value)}
							placeholder="Например: Амурский бархат"
							required
							onBlur={() => !slug && onGenerateSlug()}
							aria-label="Название товара"
							aria-invalid={Boolean(fieldErrors?.name)}
							aria-describedby={fieldErrors?.name ? nameErrId : undefined}
							className="dark:bg-slate-900 dark:border-slate-600 dark:text-white dark:placeholder-slate-500"
						/>
						{fieldErrors?.name && (
							<p
								id={nameErrId}
								className="text-sm text-red-600 dark:text-red-400"
							>
								{fieldErrors.name}
							</p>
						)}
					</div>

					{/* Slug field */}
					<div className="space-y-2">
						<label
							htmlFor={`${fieldId}-slug`}
							className="flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-slate-300"
						>
							<LinkIcon
								width={14}
								height={14}
								className="text-neutral-400 dark:text-slate-500"
							/>
							URL (slug)
						</label>
						<div className="flex gap-2">
							<div className="relative flex-1">
								<span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-slate-500 text-sm">
									/catalog/
								</span>
								<Input
									id={`${fieldId}-slug`}
									value={slug}
									onChange={(e) => onChange('slug', e.target.value)}
									placeholder="amurskij-barhat"
									className="pl-16 dark:bg-slate-900 dark:border-slate-600 dark:text-white dark:placeholder-slate-500"
									aria-label="URL товара"
									aria-invalid={Boolean(fieldErrors?.slug)}
									aria-describedby={fieldErrors?.slug ? slugErrId : undefined}
								/>
							</div>
							<Button
								type="button"
								variant="outline"
								onClick={onGenerateSlug}
								className="dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
							>
								Сгенерировать
							</Button>
						</div>
						{fieldErrors?.slug && (
							<p
								id={slugErrId}
								className="text-sm text-red-600 dark:text-red-400"
							>
								{fieldErrors.slug}
							</p>
						)}
					</div>

					{/* Collection & Category */}
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<div className="space-y-2">
							<label
								htmlFor={`${fieldId}-collection`}
								className="flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-slate-300"
							>
								<FolderOpenIcon
									width={14}
									height={14}
									className="text-neutral-400 dark:text-slate-500"
								/>
								Коллекция <span className="text-red-500">*</span>
							</label>
							<div className="relative">
								<select
									id={`${fieldId}-collection`}
									value={collection}
									onChange={(e) => onChange('collection', e.target.value)}
									className="w-full rounded-xl border border-neutral-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-3 text-sm text-neutral-700 dark:text-slate-300 transition focus:border-primary-300 dark:focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:focus:ring-primary-900 appearance-none"
									aria-label="Коллекция"
								>
									{Object.entries(collectionLabels).map(([value, label]) => (
										<option key={value} value={value}>
											{label}
										</option>
									))}
								</select>
								<div
									className={`absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-linear-to-br ${gradientColor}`}
								/>
							</div>
						</div>
						<div className="space-y-2">
							<label
								htmlFor={`${fieldId}-category`}
								className="flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-slate-300"
							>
								<TagIcon
									width={14}
									height={14}
									className="text-neutral-400 dark:text-slate-500"
								/>
								Категория <span className="text-red-500">*</span>
							</label>
							<select
								id={`${fieldId}-category`}
								value={category}
								onChange={(e) => onChange('category', e.target.value)}
								className="w-full rounded-xl border border-neutral-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-3 text-sm text-neutral-700 dark:text-slate-300 transition focus:border-primary-300 dark:focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:focus:ring-primary-900"
								aria-label="Категория"
							>
								{Object.entries(categoryLabels).map(([value, label]) => (
									<option key={value} value={value}>
										{label}
									</option>
								))}
							</select>
						</div>
					</div>

					{/* Description */}
					<div className="space-y-2">
						<label
							htmlFor={`${fieldId}-description`}
							className="flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-slate-300"
						>
							<DocumentTextIcon
								width={14}
								height={14}
								className="text-neutral-400 dark:text-slate-500"
							/>
							Описание <span className="text-red-500">*</span>
						</label>
						<Textarea
							id={`${fieldId}-description`}
							value={description}
							onChange={(e) => onChange('description', e.target.value)}
							placeholder="Расскажите о товаре, его особенностях и преимуществах..."
							rows={5}
							required
							aria-label="Описание товара"
							aria-invalid={Boolean(fieldErrors?.description)}
							aria-describedby={
								fieldErrors?.description ? descErrId : undefined
							}
							className="dark:bg-slate-900 dark:border-slate-600 dark:text-white dark:placeholder-slate-500 resize-none"
						/>
						{fieldErrors?.description && (
							<p
								id={descErrId}
								className="text-sm text-red-600 dark:text-red-400"
							>
								{fieldErrors.description}
							</p>
						)}
						<p className="text-xs text-neutral-400 dark:text-slate-500">
							{description.length}/1000 символов
						</p>
					</div>
				</div>
			</div>
		</div>
	);
};
