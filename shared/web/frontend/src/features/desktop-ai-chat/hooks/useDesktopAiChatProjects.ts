/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Project binding menu and RAG toggle state for Desktop AI Chat settings rail.
 *
 * Invariants:
 * - applyProjectBinding clears project_id when pid is empty string.
 *
 * Related:
 * - components/DesktopAiChatSettingsRail.tsx, api/desktopChatClient.ts
 */
import type { TFunction } from 'i18next';
import * as React from 'react';
import {
	listAccessibleProjects,
	patchDesktopAiChat,
	type DesktopAiChatItem,
	type DesktopAiProjectRow,
} from '../api/desktopChatClient';

export type UseDesktopAiChatProjectsParams = {
	activeId: string | null;
	chats: DesktopAiChatItem[];
	setChats: React.Dispatch<React.SetStateAction<DesktopAiChatItem[]>>;
	featureEnabled: boolean;
	t: TFunction<'desktopAiChat'>;
};

export function useDesktopAiChatProjects({
	activeId,
	chats,
	setChats,
	featureEnabled,
}: UseDesktopAiChatProjectsParams) {
	const [useProjectRag, setUseProjectRag] = React.useState(false);
	const [projectId, setProjectId] = React.useState('');
	const [projects, setProjects] = React.useState<DesktopAiProjectRow[]>([]);
	const [projectMenuOpen, setProjectMenuOpen] = React.useState(false);
	const [projectQuery, setProjectQuery] = React.useState('');
	const projectMenuRef = React.useRef<HTMLDivElement>(null);
	const projectSearchInputRef = React.useRef<HTMLInputElement>(null);

	const filteredProjects = React.useMemo(() => {
		const q = projectQuery.trim().toLowerCase();
		if (!q) {
			return projects;
		}
		return projects.filter(
			(p) =>
				p.name.toLowerCase().includes(q) ||
				p.id.toLowerCase().includes(q) ||
				p.company_id.toLowerCase().includes(q)
		);
	}, [projects, projectQuery]);

	const selectedProjectName = React.useMemo(() => {
		const pid = projectId.trim();
		if (!pid) {
			return null;
		}
		return projects.find((p) => p.id === pid)?.name ?? null;
	}, [projectId, projects]);

	const applyProjectBinding = React.useCallback(
		async (overrideProjectId?: string) => {
			if (!activeId) {
				return;
			}
			const raw =
				overrideProjectId !== undefined ? overrideProjectId : projectId;
			const pid = raw.trim();
			if (overrideProjectId !== undefined) {
				setProjectId(pid);
			}
			const c = await patchDesktopAiChat(activeId, {
				project_id: pid ? pid : null,
				use_project_rag: useProjectRag && !!pid,
			});
			setChats((prev) => prev.map((x) => (x.id === c.id ? c : x)));
		},
		[activeId, projectId, useProjectRag, setChats]
	);

	React.useEffect(() => {
		if (!activeId) {
			return;
		}
		const ch = chats.find((c) => c.id === activeId);
		if (ch) {
			setUseProjectRag(ch.use_project_rag);
			setProjectId(ch.project_id ?? '');
		}
	}, [activeId, chats]);

	React.useEffect(() => {
		if (!featureEnabled) {
			return;
		}
		let cancelled = false;
		void (async () => {
			try {
				const rows = await listAccessibleProjects(100);
				if (!cancelled) {
					setProjects(rows);
				}
			} catch {
				if (!cancelled) {
					setProjects([]);
				}
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [featureEnabled]);

	React.useEffect(() => {
		if (!projectMenuOpen) {
			return;
		}
		const id = window.requestAnimationFrame(() => {
			projectSearchInputRef.current?.focus();
		});
		return () => window.cancelAnimationFrame(id);
	}, [projectMenuOpen]);

	React.useEffect(() => {
		if (!projectMenuOpen) {
			return;
		}
		const onDoc = (e: MouseEvent) => {
			const el = projectMenuRef.current;
			if (el && !el.contains(e.target as Node)) {
				setProjectMenuOpen(false);
			}
		};
		document.addEventListener('mousedown', onDoc);
		return () => document.removeEventListener('mousedown', onDoc);
	}, [projectMenuOpen]);

	return {
		useProjectRag,
		setUseProjectRag,
		projectId,
		setProjectId,
		projects,
		projectMenuOpen,
		setProjectMenuOpen,
		projectQuery,
		setProjectQuery,
		projectMenuRef,
		projectSearchInputRef,
		filteredProjects,
		selectedProjectName,
		applyProjectBinding,
	};
}
