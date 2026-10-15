import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { API_ENDPOINTS } from '@constants/api';
import type { PaginatedResponse } from '@typings/api';
import type { Product } from '@typings/product';
import { apiClient } from './client';

type ProductQueryParams = {
	category?: string;
	collection?: string;
	search?: string;
	q?: string;
	minPrice?: number;
	maxPrice?: number;
	volume?: string;
	inStock?: string;
	isNew?: string;
	isFeatured?: string;
};

export const useProducts = (filters?: ProductQueryParams) => {
	return useQuery({
		queryKey: ['products', filters],
		queryFn: async () => {
			const { data } = await apiClient.get<PaginatedResponse<Product>>(
				API_ENDPOINTS.PRODUCTS,
				{
					params: filters,
				}
			);
			return data;
		},
		staleTime: 1000 * 60 * 2,
	});
};

export const useProduct = (id: string) => {
	return useQuery({
		queryKey: ['product', id],
		queryFn: async () => {
			const { data } = await apiClient.get<Product>(
				API_ENDPOINTS.PRODUCT_BY_ID(id)
			);
			return data;
		},
		enabled: !!id,
	});
};

export const useCreateProduct = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (product: Partial<Product>) => {
			const { data } = await apiClient.post<Product>(
				API_ENDPOINTS.PRODUCTS,
				product
			);
			return data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['products'] });
			queryClient.invalidateQueries({ queryKey: ['products-summary'] });
		},
	});
};

export const useUpdateProduct = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async ({
			id,
			...product
		}: Partial<Product> & { id: string }) => {
			const { data } = await apiClient.patch<Product>(
				API_ENDPOINTS.PRODUCT_BY_ID(id),
				product
			);
			return data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['products'] });
			queryClient.invalidateQueries({ queryKey: ['products-summary'] });
		},
	});
};

export const useDeleteProduct = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (id: string) => {
			await apiClient.delete(API_ENDPOINTS.PRODUCT_BY_ID(id));
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['products'] });
			queryClient.invalidateQueries({ queryKey: ['products-summary'] });
		},
	});
};

export type ProductsSummary = {
	totalProducts: number;
	inStockCount: number;
	outOfStockCount: number;
	totalValue: number;
};

export const useProductsSummary = () => {
	return useQuery({
		queryKey: ['products-summary'],
		queryFn: async () => {
			const { data } = await apiClient.get<ProductsSummary>(
				API_ENDPOINTS.PRODUCTS_SUMMARY
			);
			return data;
		},
		staleTime: 1000 * 60,
	});
};

export type BulkUpdateProductPriceResult = {
	updatedCount: number;
	products: Array<{ id: string; price: number }>;
};

export const useBulkUpdateProductPrice = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (body: { ids: string[]; percentage: number }) => {
			const { data } = await apiClient.post<BulkUpdateProductPriceResult>(
				API_ENDPOINTS.PRODUCTS_BULK_PRICE,
				body
			);
			return data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['products'] });
			queryClient.invalidateQueries({ queryKey: ['products-summary'] });
		},
	});
};
