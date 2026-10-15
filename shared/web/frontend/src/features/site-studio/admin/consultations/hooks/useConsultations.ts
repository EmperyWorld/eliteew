import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@services/api/client';
import type { ConsultationAdmin } from '@typings/admin';

interface AdminConsultationApiModel {
	id: string;
	title: string;
	slug: string;
	shortDescription: string | null;
	fullDescription: string | null;
	price: number;
	duration: number;
	image: string | null;
	isPopular: boolean | null;
	isActive: boolean;
	order: number | null;
	createdAt: string;
	updatedAt: string;
}

export const useConsultations = () => {
	const [consultations, setConsultations] = useState<ConsultationAdmin[]>([]);
	const [loading, setLoading] = useState(true);

	const fetchConsultations = useCallback(async () => {
		try {
			setLoading(true);
			const response = await apiClient.get('/admin/consultations');

			const mapped: ConsultationAdmin[] = (
				response.data as AdminConsultationApiModel[]
			).map((item) => ({
				id: item.id,
				title: item.title,
				slug: item.slug,
				description: item.fullDescription ?? item.shortDescription ?? '',
				shortDescription: item.shortDescription ?? '',
				price: item.price,
				duration: item.duration,
				image: item.image ?? '',
				status: item.isActive ? 'active' : 'draft',
				popular: Boolean(item.isPopular),
				order: item.order ?? 0,
				createdAt: item.createdAt,
				updatedAt: item.updatedAt,
			}));

			setConsultations(mapped);
		} catch (error) {
			console.error('Failed to load consultations', error);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchConsultations();
	}, [fetchConsultations]);

	const toggleStatus = async (id: string) => {
		const current = consultations.find((c) => c.id === id);
		if (!current) return;

		const nextStatus = current.status === 'active' ? 'draft' : 'active';
		const nextIsActive = nextStatus === 'active';

		// Optimistic update
		setConsultations((prev) =>
			prev.map((c) => (c.id === id ? { ...c, status: nextStatus } : c))
		);

		try {
			await apiClient.patch(`/consultations/${id}`, { isActive: nextIsActive });
		} catch (error) {
			console.error('Failed to update consultation status', error);
			// Revert on error
			setConsultations((prev) => prev.map((c) => (c.id === id ? current : c)));
		}
	};

	const [pendingDeleteConsultationId, setPendingDeleteConsultationId] =
		useState<string | null>(null);

	const requestDeleteConsultation = useCallback((id: string) => {
		setPendingDeleteConsultationId(id);
	}, []);

	const cancelDeleteConsultation = useCallback(() => {
		setPendingDeleteConsultationId(null);
	}, []);

	const executeDeleteConsultation = useCallback(async () => {
		const id = pendingDeleteConsultationId;
		if (!id) return;

		const previous = consultations;
		setConsultations((prev) => prev.filter((c) => c.id !== id));

		try {
			await apiClient.delete(`/consultations/${id}`);
		} catch (error) {
			console.error('Failed to delete consultation', error);
			setConsultations(previous);
			throw error instanceof Error
				? error
				: new Error('Failed to delete consultation');
		}
	}, [pendingDeleteConsultationId, consultations]);

	return {
		consultations,
		loading,
		refresh: fetchConsultations,
		toggleStatus,
		pendingDeleteConsultationId,
		requestDeleteConsultation,
		executeDeleteConsultation,
		cancelDeleteConsultation,
	};
};
