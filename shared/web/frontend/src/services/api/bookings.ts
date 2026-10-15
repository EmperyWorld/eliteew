import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Booking as AdminBooking } from '@typings/admin';
import { apiClient } from './client';

export type AdminBookingStatus = AdminBooking['status'];

type ApiBookingStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';

interface AdminBookingApiModel {
	id: string;
	userId?: string | null;
	consultationId?: string | null;
	masterclassId?: string | null;
	guestName?: string | null;
	guestEmail?: string | null;
	guestPhone?: string | null;
	date: string;
	time: string;
	participants: number;
	status: ApiBookingStatus;
	notes?: string | null;
	totalPrice: number;
	createdAt: string;
	updatedAt: string;
	user?: {
		id: string;
		name: string | null;
		email: string | null;
		phone: string | null;
	} | null;
	consultation?: {
		id: string;
		title: string;
	} | null;
	masterclass?: {
		id: string;
		title: string;
	} | null;
}

export interface AdminBookingWithSlotInfo extends AdminBooking {
	slotInfo: {
		title: string;
		type: 'consultation' | 'masterclass';
		date: string;
		time: string;
	};
	dateRaw: string;
}

function mapStatusFromApi(status: ApiBookingStatus): AdminBookingStatus {
	switch (status) {
		case 'PENDING':
			return 'pending';
		case 'CONFIRMED':
			return 'confirmed';
		case 'CANCELLED':
			return 'cancelled';
		case 'COMPLETED':
			return 'completed';
		default:
			return 'pending';
	}
}

function mapStatusToApi(status: AdminBookingStatus): ApiBookingStatus {
	switch (status) {
		case 'pending':
			return 'PENDING';
		case 'confirmed':
			return 'CONFIRMED';
		case 'cancelled':
			return 'CANCELLED';
		case 'completed':
			return 'COMPLETED';
		default:
			return 'PENDING';
	}
}

function mapApiBookingToAdmin(
	booking: AdminBookingApiModel
): AdminBookingWithSlotInfo {
	const clientStatus = mapStatusFromApi(booking.status);
	const isConsultation = Boolean(
		booking.consultationId || booking.consultation
	);

	const customerName = booking.user?.name ?? booking.guestName ?? 'Guest';
	const customerPhone = booking.user?.phone ?? booking.guestPhone ?? '';
	const customerEmail = booking.user?.email ?? booking.guestEmail ?? undefined;

	const slotTitle =
		booking.consultation?.title ?? booking.masterclass?.title ?? 'Untitled';
	const slotDate = new Date(booking.date).toLocaleDateString('ru-RU');
	const slotTime = booking.time;

	return {
		id: booking.id,
		slotId: booking.id,
		userId: booking.userId ?? undefined,
		customerName,
		customerPhone,
		customerEmail,
		participants: booking.participants,
		status: clientStatus,
		notes: booking.notes ?? undefined,
		createdAt: booking.createdAt,
		updatedAt: booking.updatedAt,
		dateRaw: booking.date,
		slotInfo: {
			title: slotTitle,
			type: isConsultation ? 'consultation' : 'masterclass',
			date: slotDate,
			time: slotTime,
		},
	};
}

export const useAdminBookings = () => {
	return useQuery({
		queryKey: ['admin', 'bookings'],
		queryFn: async () => {
			const { data } =
				await apiClient.get<AdminBookingApiModel[]>('/admin/bookings');
			return data.map(mapApiBookingToAdmin);
		},
		staleTime: 1000 * 60 * 2,
	});
};

export const useUpdateBookingStatus = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({
			id,
			status,
		}: {
			id: string;
			status: AdminBookingStatus;
		}) => {
			const apiStatus = mapStatusToApi(status);
			const { data } = await apiClient.patch<AdminBookingApiModel>(
				`/admin/bookings/${id}`,
				{
					status: apiStatus,
				}
			);
			return mapApiBookingToAdmin(data);
		},
		retry: 2,
		retryDelay: (attempt) => Math.min(700 * 2 ** attempt, 5000),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['admin', 'bookings'] });
		},
	});
};
