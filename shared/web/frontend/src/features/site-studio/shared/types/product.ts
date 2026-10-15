export type ProductCategory = 'perfumes' | 'ingredients' | 'accessories';
export type ProductCollection =
	| 'starter'
	| 'signature'
	| 'primorye'
	| 'wardrobe'
	| 'rituals'
	| 'exclusive';
export type ProductStatus = 'available' | 'out-of-stock' | 'coming-soon';

export interface ProductVariantFromAPI {
	id: string;
	volume: string;
	price: number;
	oldPrice?: number;
	stock: number;
}

export interface Product {
	id: string;
	name: string;
	description: string;
	category: ProductCategory;
	// status: ProductStatus // Legacy, replaced by inStock
	inStock: boolean;
	stockQuantity: number;
	price: number;
	originalPrice?: number;
	image: string;
	images?: string[];
	volume?: string;
	collection?: ProductCollection;
	collectionDescription?: string;
	rating?: {
		average: number;
		count: number;
	};
	discount?: number;
	isNew?: boolean;
	variants?: ProductVariantFromAPI[];
	createdAt: Date;
	updatedAt: Date;

	// Computed property for compatibility
	status?: ProductStatus;
}

export interface ProductVariant {
	id: string;
	volume: string;
	price: number;
	originalPrice?: number;
	status: ProductStatus;
}

export interface ProductGroup {
	id: string;
	name: string;
	description: string;
	category: ProductCategory;
	collection?: ProductCollection;
	collectionDescription?: string;
	image: string;
	images?: string[];
	variants: ProductVariant[];
	minPrice: number;
	maxPrice: number;
	rating?: {
		average: number;
		count: number;
	};
	isNew?: boolean;
	createdAt: Date;
	updatedAt: Date;
}
