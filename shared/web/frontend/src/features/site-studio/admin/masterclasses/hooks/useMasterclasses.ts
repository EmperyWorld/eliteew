import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@services/api/client';
import type { MasterclassAdmin, MasterclassCategory } from '@typings/admin';

interface AdminMasterclassApiModel {
	id: string;
	title: string;
	slug: string;
	shortDescription: string;
	fullDescription: string | null;
	price: number;
	priceNote: string | null;
	duration: number;
	maxParticipants: number;
	image: string | null;
	category: MasterclassCategory;
	isActive: boolean;
	order: number | null;
	createdAt: string;
	updatedAt: string;
}

export const useMasterclasses = () => {
	const [masterclasses, setMasterclasses] = useState<MasterclassAdmin[]>([]);
	const [loading, setLoading] = useState(true);

	const fetchMasterclasses = useCallback(async () => {
		try {
			setLoading(true);
			const response = await apiClient.get('/admin/masterclasses');

			const mapped: MasterclassAdmin[] = (
				response.data as AdminMasterclassApiModel[]
			).map((item) => ({
				id: item.id,
				title: item.title,
				slug: item.slug,
				description: item.fullDescription ?? item.shortDescription,
				shortDescription: item.shortDescription,
				price: item.price,
				priceNote: item.priceNote ?? undefined,
				level: 'all',
				maxParticipants: item.maxParticipants,
				minParticipants: undefined,
				duration: item.duration,
				image: item.image ?? '',
				status: item.isActive ? 'active' : 'draft',
				category: item.category,
				order: item.order ?? 0,
				createdAt: item.createdAt,
				updatedAt: item.updatedAt,
			}));

			setMasterclasses(mapped);
		} catch (error) {
			console.error('Failed to load masterclasses', error);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchMasterclasses();
	}, [fetchMasterclasses]);

	const toggleStatus = async (id: string) => {
		const current = masterclasses.find((m) => m.id === id);
		if (!current) return;

		const nextStatus = current.status === 'active' ? 'draft' : 'active';
		const nextIsActive = nextStatus === 'active';

		setMasterclasses((prev) =>
			prev.map((m) => (m.id === id ? { ...m, status: nextStatus } : m))
		);

		try {
			await apiClient.patch(`/masterclasses/${id}`, { isActive: nextIsActive });
		} catch (error) {
			console.error('Failed to update masterclass status', error);
			setMasterclasses((prev) => prev.map((m) => (m.id === id ? current : m)));
		}
	};

	const [pendingDeleteMasterclassId, setPendingDeleteMasterclassId] = useState<
		string | null
	>(null);

	const requestDeleteMasterclass = useCallback((id: string) => {
		setPendingDeleteMasterclassId(id);
	}, []);

	const cancelDeleteMasterclass = useCallback(() => {
		setPendingDeleteMasterclassId(null);
	}, []);

	const executeDeleteMasterclass = useCallback(async () => {
		const id = pendingDeleteMasterclassId;
		if (!id) return;

		const previous = masterclasses;
		setMasterclasses((prev) => prev.filter((m) => m.id !== id));

		try {
			await apiClient.delete(`/masterclasses/${id}`);
		} catch (error) {
			console.error('Failed to delete masterclass', error);
			setMasterclasses(previous);
			throw error instanceof Error
				? error
				: new Error('Failed to delete masterclass');
		}
	}, [pendingDeleteMasterclassId, masterclasses]);

	return {
		masterclasses,
		loading,
		refresh: fetchMasterclasses,
		toggleStatus,
		pendingDeleteMasterclassId,
		requestDeleteMasterclass,
		executeDeleteMasterclass,
		cancelDeleteMasterclass,
	};
};
