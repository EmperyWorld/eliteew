/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * FAQ list CRUD state and mutations for assistant admin section.
 *
 * Invariants:
 * - — (нет)
 *
 * Related:
 * - pages/Admin/assistant/AssistantFaqPanel.tsx
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
	adminCreateAssistantFaq,
	adminDeleteAssistantFaq,
	adminListAssistantFaq,
	adminUpdateAssistantFaq,
	type AssistantFaqEntry,
} from '../../Desktop/services/productDesktopApi';
import { filterFaqEntries } from '../../Desktop/utils/assistantFaqSearch';

export function useAssistantFaqAdmin() {
	const { t } = useTranslation('desktopUi', { keyPrefix: 'assistantAdmin' });
	const qc = useQueryClient();

	const [q, setQ] = React.useState('');
	const [a, setA] = React.useState('');
	const [sortOrder, setSortOrder] = React.useState(0);
	const [editing, setEditing] = React.useState<AssistantFaqEntry | null>(null);
	const [faqListSearch, setFaqListSearch] = React.useState('');

	const listQuery = useQuery({
		queryKey: ['admin', 'assistant', 'faq'],
		queryFn: adminListAssistantFaq,
	});

	const createMut = useMutation({
		mutationFn: () =>
			adminCreateAssistantFaq({
				question: q.trim(),
				answer: a.trim(),
				sort_order: sortOrder,
			}),
		onSuccess: async () => {
			setQ('');
			setA('');
			setSortOrder(0);
			toast.success(t('toastFaqAdded'));
			await qc.invalidateQueries({ queryKey: ['admin', 'assistant'] });
		},
		onError: (e: unknown) =>
			toast.error(e instanceof Error ? e.message : String(e)),
	});

	const updateMut = useMutation({
		mutationFn: (p: { id: string; patch: Partial<AssistantFaqEntry> }) =>
			adminUpdateAssistantFaq(p.id, p.patch),
		onSuccess: async () => {
			setEditing(null);
			toast.success(t('toastFaqSaved'));
			await qc.invalidateQueries({ queryKey: ['admin', 'assistant'] });
		},
		onError: (e: unknown) =>
			toast.error(e instanceof Error ? e.message : String(e)),
	});

	const delMut = useMutation({
		mutationFn: (id: string) => adminDeleteAssistantFaq(id),
		onSuccess: async () => {
			toast.success(t('toastFaqDeleted'));
			await qc.invalidateQueries({ queryKey: ['admin', 'assistant'] });
		},
		onError: (e: unknown) =>
			toast.error(e instanceof Error ? e.message : String(e)),
	});

	const items = listQuery.data ?? [];
	const filteredFaqItems = React.useMemo(
		() => filterFaqEntries(items, faqListSearch),
		[items, faqListSearch]
	);

	return {
		items,
		filteredFaqItems,
		faqListSearch,
		setFaqListSearch,
		q,
		setQ,
		a,
		setA,
		sortOrder,
		setSortOrder,
		editing,
		setEditing,
		isLoading: listQuery.isLoading,
		createFaq: () => createMut.mutate(),
		updateFaq: updateMut.mutate,
		deleteFaq: delMut.mutate,
		isCreatePending: createMut.isPending,
		isUpdatePending: updateMut.isPending,
		isDeletePending: delMut.isPending,
	};
}
