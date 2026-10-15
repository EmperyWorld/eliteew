export const API_ENDPOINTS = {
	PRODUCTS: '/products',
	PRODUCT_BY_ID: (id: string) => `/products/${id}`,
	PRODUCTS_BULK_PRICE: '/products/bulk-price',
	PRODUCTS_SUMMARY: '/products/summary',
	ADMIN_ORDERS_SUMMARY: '/admin/orders/summary',
	CONSULTATIONS: '/consultations',
	CONSULTATION_BY_ID: (id: string) => `/consultations/${id}`,
	MASTERCLASSES: '/masterclasses',
	MASTERCLASS_BY_ID: (id: string) => `/masterclasses/${id}`,
	CART: '/cart',
	ORDERS: '/orders',
	ORDER_BY_ID: (id: string) => `/orders/${id}`,
	MY_ORDERS: '/orders/my',
	AUTH_LOGIN: '/auth/login',
	AUTH_REGISTER: '/auth/register',
	AUTH_LOGOUT: '/auth/logout',
	AUTH_ME: '/auth/me',
	BOOKINGS: '/bookings',
	BOOKING_BY_ID: (id: string) => `/bookings/${id}`,
	MY_BOOKINGS: '/bookings/my',
	BOOKING_CANCEL: (id: string) => `/bookings/${id}/cancel`,
	FAVORITES: '/favorites',
	FAVORITE_BY_PRODUCT: (productId: string) => `/favorites/${productId}`,
	FAVORITE_CHECK: (productId: string) => `/favorites/check/${productId}`,
} as const;

export const API_TIMEOUT = 10000;
export const API_RETRY_ATTEMPTS = 3;
