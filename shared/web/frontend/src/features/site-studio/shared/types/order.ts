export type OrderStatus =
	| 'pending'
	| 'processing'
	| 'shipped'
	| 'delivered'
	| 'cancelled';

export interface OrderItem {
	productId: string;
	quantity: number;
	price: number;
	volume?: string;
}

export interface Order {
	id: string;
	userId: string;
	items: OrderItem[];
	total: number;
	status: OrderStatus;
	shippingAddress: {
		street: string;
		city: string;
		postalCode: string;
		country: string;
	};
	createdAt: Date;
	updatedAt: Date;
}
