// Типы для админ-панели

export interface AdminUser {
	id: string;
	email: string;
	role: 'admin' | 'editor';
}

export interface SiteSettings {
	id: string;
	contactPhone: string;
	contactEmail: string;
	contactAddress: string;
	workingHours: string;
	siteTitle?: string;
	siteDescription?: string;
	defaultTheme?: string;
	frontendUrl?: string;
	shopUrl?: string;
	updatedAt: string;
}

export interface ConsultationAdmin {
	id: string;
	title: string;
	slug: string;
	description: string;
	shortDescription: string;
	price: number;
	duration: number; // в минутах
	image: string;
	status: 'active' | 'draft' | 'archived';
	popular: boolean;
	order: number;
	createdAt: string;
	updatedAt: string;
}

export interface MasterclassAdmin {
	id: string;
	title: string;
	slug: string;
	description: string;
	shortDescription: string;
	price: number;
	priceNote?: string; // "с человека", "от", и т.д.
	level: 'beginner' | 'intermediate' | 'advanced' | 'all';
	maxParticipants: number;
	minParticipants?: number;
	duration: number; // в минутах
	image: string;
	status: 'active' | 'draft' | 'archived';
	category: MasterclassCategory;
	order: number;
	createdAt: string;
	updatedAt: string;
}

export type MasterclassCategory =
	| 'workshop' // Мастер-классы с созданием
	| 'tasting' // Дегустации
	| 'education' // Обучающие встречи
	| 'corporate' // Корпоративные
	| 'special'; // Особые форматы (свидание, девичник)

export interface ScheduleSlot {
	id: string;
	entityType: 'consultation' | 'masterclass' | 'task';
	entityId: string;
	title?: string;
	description?: string;
	priority?: 'low' | 'medium' | 'high';
	date: string; // ISO date
	startTime: string; // HH:mm
	endTime: string; // HH:mm
	maxParticipants: number;
	currentParticipants: number;
	status: 'available' | 'full' | 'cancelled' | 'pending' | 'done';
	price?: number; // Если отличается от базовой цены
}

export interface Booking {
	id: string;
	slotId: string;
	userId?: string;
	customerName: string;
	customerPhone: string;
	customerEmail?: string;
	participants: number;
	status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
	notes?: string;
	createdAt: string;
	updatedAt: string;
}

export interface ProductAdmin {
	id: string;
	name: string;
	slug: string;
	description: string;
	collection: string;
	collectionDescription?: string;
	category: 'perfumes' | 'ingredients' | 'accessories';
	variants: ProductVariant[];
	images: string[];
	status: 'available' | 'out_of_stock' | 'draft' | 'archived';
	inStock: boolean;
	stockQuantity: number;
	isNew: boolean;
	isFeatured: boolean;
	order: number;
	createdAt: string;
	updatedAt: string;
}

export interface ProductVariant {
	id: string;
	volume: string;
	price: number;
	originalPrice?: number;
	sku?: string;
	stock: number;
}

export interface GalleryImage {
	id: string;
	src: string;
	alt: string;
	category: 'diplomas' | 'certificates' | 'workshop' | 'products';
	order: number;
	createdAt: string;
}

// Dashboard stats
export interface DashboardStats {
	totalProducts: number;
	totalConsultations: number;
	totalMasterclasses: number;
	pendingBookings: number;
	upcomingEvents: number;
	recentBookings: Booking[];
}
