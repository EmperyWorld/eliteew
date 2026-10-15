import * as React from 'react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router';
import { normalizeUploadsPath } from '@/features/site-studio/shared/utils/imageUrl';
import { apiClient } from '@services/api/client';
import { uploadImage } from '@services/api/upload';
import { useToast } from '@components/atoms/Toast/Toast';
import type { ProductAdmin, ProductVariant } from '@typings/admin';
import { useAdminNavigate } from '../../AdminEmbeddedRouter';

interface ProductVariantApi {
	id: string;
	volume: string;
	price: number;
	oldPrice?: number | null;
	stock: number;
}

interface ProductApiModel {
	id: string;
	name: string;
	slug: string;
	description: string;
	shortDescription?: string | null;
	price: number;
	oldPrice?: number | null;
	volume?: string | null;
	collection: string;
	collectionDescription?: string | null;
	category: string;
	image?: string | null;
	images: string[];
	inStock: boolean;
	stockQuantity: number;
	isNew: boolean;
	isFeatured: boolean;
	variants?: ProductVariantApi[];
	createdAt: string;
	updatedAt: string;
}

const emptyVariant: Omit<ProductVariant, 'id'> = {
	volume: '',
	price: 0,
	originalPrice: undefined,
	sku: '',
	stock: 10,
};

const emptyProduct: Omit<ProductAdmin, 'id' | 'createdAt' | 'updatedAt'> = {
	name: '',
	slug: '',
	description: '',
	collection: 'starter',
	collectionDescription: '',
	category: 'accessories',
	variants: [],
	images: [],
	status: 'draft',
	inStock: true,
	stockQuantity: 0,
	isNew: false,
	isFeatured: false,
	order: 0,
};

export const useProductEdit = () => {
	const { id } = useParams();
	const navigate = useAdminNavigate();
	const toast = useToast();
	const isNew = id === 'new';

	const [formData, setFormData] = useState(emptyProduct);
	const [isSaving, setIsSaving] = useState(false);
	const [isLoaded, setIsLoaded] = useState(false);
	const [fieldErrors, setFieldErrors] = useState<
		Partial<Record<'name' | 'slug' | 'description', string>>
	>({});

	const handleChange = useCallback(
		(field: keyof typeof formData, value: unknown) => {
			setFieldErrors((prev) => {
				if (field !== 'name' && field !== 'slug' && field !== 'description') {
					return prev;
				}
				const next = { ...prev };
				delete next[field];
				return next;
			});
			setFormData((prev) => ({ ...prev, [field]: value }));
		},
		[]
	);

	// Store toast in ref to avoid dependency issues
	const toastRef = useRef(toast);
	toastRef.current = toast;

	useEffect(() => {
		if (isNew || !id || isLoaded) {
			return;
		}

		let isMounted = true;

		apiClient
			.get(`/products/${id}`)
			.then((response) => {
				if (!isMounted) {
					return;
				}

				const data = response.data as ProductApiModel;

				const rawImages: string[] =
					data.images && data.images.length > 0
						? data.images
						: data.image
							? [data.image]
							: [];
				const images = rawImages
					.map((u) => normalizeUploadsPath(u))
					.filter(Boolean);

				let status: ProductAdmin['status'] = 'draft';
				if (data.inStock) {
					status = 'available';
				} else {
					status = 'out_of_stock';
				}

				const variants: ProductVariant[] =
					data.variants && data.variants.length > 0
						? data.variants.map((v) => ({
								id: v.id,
								volume: v.volume,
								price: v.price,
								originalPrice: v.oldPrice ?? undefined,
								sku: '',
								stock: v.stock,
							}))
						: [
								{
									id: data.id,
									volume: data.volume ?? '',
									price: data.price,
									originalPrice: data.oldPrice ?? undefined,
									sku: '',
									stock: data.stockQuantity,
								},
							];

				setFormData({
					name: data.name,
					slug: data.slug,
					description: data.description,
					collection: data.collection,
					collectionDescription: data.collectionDescription ?? '',
					category: data.category as ProductAdmin['category'],
					variants,
					images,
					status,
					inStock: data.inStock,
					stockQuantity: data.stockQuantity,
					isNew: data.isNew,
					isFeatured: data.isFeatured,
					order: 0,
				});
				setIsLoaded(true);
			})
			.catch((error) => {
				console.error('Failed to load product', error);
				toastRef.current.error('Не удалось загрузить товар');
			});

		return () => {
			isMounted = false;
		};
	}, [id, isNew, isLoaded]);

	// Auto-calculate total stock when variants change
	// Using useRef to avoid infinite loops - we only update when variants actually change
	const prevVariantsRef = useRef<string>('');

	useEffect(() => {
		if (formData.variants.length === 0) return;

		// Create a stable key for comparison
		const variantsKey = JSON.stringify(
			formData.variants.map((v) => ({ id: v.id, stock: v.stock }))
		);
		if (variantsKey === prevVariantsRef.current) return;
		prevVariantsRef.current = variantsKey;

		const totalStock = formData.variants.reduce(
			(sum, v) => sum + (v.stock || 0),
			0
		);

		// Batch state updates to prevent multiple re-renders
		setFormData((prev) => ({
			...prev,
			stockQuantity: totalStock,
			inStock: totalStock > 0,
		}));
	}, [formData.variants]);

	const generateSlug = () => {
		const slug = formData.name
			.toLowerCase()
			.replace(/[а-яё]/g, (char) => {
				const map: Record<string, string> = {
					а: 'a',
					б: 'b',
					в: 'v',
					г: 'g',
					д: 'd',
					е: 'e',
					ё: 'yo',
					ж: 'zh',
					з: 'z',
					и: 'i',
					й: 'y',
					к: 'k',
					л: 'l',
					м: 'm',
					н: 'n',
					о: 'o',
					п: 'p',
					р: 'r',
					с: 's',
					т: 't',
					у: 'u',
					ф: 'f',
					х: 'h',
					ц: 'ts',
					ч: 'ch',
					ш: 'sh',
					щ: 'sch',
					ъ: '',
					ы: 'y',
					ь: '',
					э: 'e',
					ю: 'yu',
					я: 'ya',
				};
				return map[char] || char;
			})
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '');
		handleChange('slug', slug);
	};

	const addVariant = () => {
		const newVariant: ProductVariant = {
			...emptyVariant,
			id: `new-${Date.now()}`,
		};
		handleChange('variants', [...formData.variants, newVariant]);
	};

	const updateVariant = (
		index: number,
		field: keyof ProductVariant,
		value: unknown
	) => {
		const updated = [...formData.variants];
		updated[index] = { ...updated[index], [field]: value };
		handleChange('variants', updated);
	};

	const removeVariant = (index: number) => {
		handleChange(
			'variants',
			formData.variants.filter((_, i) => i !== index)
		);
	};

	const validateBasicFields = (): boolean => {
		const next: Partial<Record<'name' | 'slug' | 'description', string>> = {};
		const name = formData.name.trim();
		if (!name) {
			next.name = 'Введите название товара';
		} else if (name.length > 200) {
			next.name = 'Название не длиннее 200 символов';
		}

		const desc = formData.description.trim();
		if (!desc) {
			next.description = 'Добавьте описание товара';
		} else if (desc.length > 1000) {
			next.description = 'Описание не длиннее 1000 символов';
		}

		const slugPart = formData.slug.trim();
		if (slugPart && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(slugPart)) {
			next.slug =
				'Slug: только латиница, цифры и дефисы (например amurskij-barhat)';
		}

		setFieldErrors(next);
		return Object.keys(next).length === 0;
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!validateBasicFields()) {
			toast.error('Проверьте обязательные поля карточки');
			return;
		}

		if (formData.variants.length === 0) {
			toast.error('Добавьте хотя бы один вариант товара (объём и цену)');
			return;
		}

		if (formData.variants.some((v) => !String(v.volume || '').trim())) {
			toast.error('У каждого варианта укажите объём (например 50 мл)');
			return;
		}

		if (formData.variants.some((v) => v.price <= 0)) {
			toast.error('Цена товара должна быть больше 0');
			return;
		}

		setIsSaving(true);

		try {
			const normalizedImages = formData.images
				.map((u) => normalizeUploadsPath(u))
				.filter(Boolean);

			const productData = {
				name: formData.name,
				slug:
					formData.slug ||
					formData.name.toLowerCase().replace(/[^a-zа-яё0-9]+/gi, '-'),
				description: formData.description,
				shortDescription: formData.description.substring(0, 100),
				collection: formData.collection,
				collectionDescription: formData.collectionDescription || null,
				category: formData.category,
				price: formData.variants[0]?.price || 0,
				volume: formData.variants[0]?.volume || '',
				inStock: formData.inStock,
				stockQuantity: formData.stockQuantity,
				isNew: formData.isNew,
				isFeatured: formData.isFeatured,
				image: normalizedImages[0] || null,
				images: normalizedImages,
				variants: formData.variants.map((v) => ({
					id: v.id.startsWith('new-') ? undefined : v.id,
					volume: v.volume,
					price: v.price,
					originalPrice: v.originalPrice,
					sku: v.sku,
					stock: v.stock,
				})),
			};

			if (isNew) {
				await apiClient.post('/products', productData);
				toast.success('Товар успешно создан');
			} else {
				await apiClient.patch(`/products/${id}`, productData);
				toast.success('Товар успешно обновлен');
			}

			navigate('/admin/products');
		} catch (error) {
			console.error('Failed to save product:', error);
			toast.error('Ошибка сохранения товара');
		} finally {
			setIsSaving(false);
		}
	};

	const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const files = Array.from(e.target.files || []);

		if (files.length === 0) {
			return;
		}

		try {
			const urls = await Promise.all(files.map((file) => uploadImage(file)));
			handleChange('images', [...formData.images, ...urls]);
		} catch (error) {
			console.error('Failed to upload images', error);
			toast.error('Ошибка загрузки изображений');
		} finally {
			e.target.value = '';
		}
	};

	// Loading state: true if editing existing product and not yet loaded
	const isLoading = !isNew && !isLoaded;

	return {
		isNew,
		formData,
		isSaving,
		isLoading,
		fieldErrors,
		handleChange,
		generateSlug,
		addVariant,
		updateVariant,
		removeVariant,
		handleSubmit,
		handleImageUpload,
		navigate,
	};
};
