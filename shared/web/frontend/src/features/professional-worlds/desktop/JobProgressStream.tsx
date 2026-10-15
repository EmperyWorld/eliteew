/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared runtime progress timeline for long Professional Worlds jobs such as AI, object intake and media work.
 *
 * Invariants:
 * - SSE keep-alives are represented as non-terminal events and never imply successful completion.
 * - Terminal error/done state is derived from explicit event types, not from a quiet stream.
 *
 * Related:
 * - types.ts
 * - ProfessionalWorldsApp.tsx
 */

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import {
	DesktopAppButton,
	DesktopAppEmptyState,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { PROFESSIONAL_WORLDS_NS } from '@/i18n/namespaces';

import { ProfessionalWorldsWorkspacePanel } from './layout';
import { pwJobProgressEventSurfaceClass } from './layout/professionalWorldsLayoutTokens';

export type JobProgressEventType =
	| 'done'
	| 'error'
	| 'keep-alive'
	| 'progress'
	| 'result'
	| 'started'
	| 'warning'
	| (string & {});

export interface JobProgressEvent {
	id?: string;
	type: JobProgressEventType;
	message?: string;
	percent?: number;
	data?: Record<string, unknown>;
	at?: string;
}

type ParsedSseBlock = {
	id?: string;
	eventType: string;
	dataText: string;
	isComment: boolean;
};

function clampPercent(percent: number | undefined): number | null {
	if (percent == null || !Number.isFinite(percent)) {
		return null;
	}
	return Math.max(0, Math.min(100, Math.round(percent)));
}

function eventKey(event: JobProgressEvent): string {
	return [
		event.id,
		event.type,
		event.at,
		event.message,
		JSON.stringify(event.data ?? {}),
	]
		.filter(Boolean)
		.join(':');
}

function humanizeEventType(value: string): string {
	return value.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function parseSseBlock(block: string): ParsedSseBlock {
	const lines = block.split(/\r?\n/);
	const dataLines: string[] = [];
	let id: string | undefined;
	let eventType = 'message';
	let isComment = false;

	for (const line of lines) {
		if (!line) {
			continue;
		}
		if (line.startsWith(':')) {
			isComment = true;
			continue;
		}
		const separatorIndex = line.indexOf(':');
		const field = separatorIndex === -1 ? line : line.slice(0, separatorIndex);
		const rawValue =
			separatorIndex === -1 ? '' : line.slice(separatorIndex + 1);
		const value = rawValue.startsWith(' ') ? rawValue.slice(1) : rawValue;
		if (field === 'id') {
			id = value;
		}
		if (field === 'event') {
			eventType = value || 'message';
		}
		if (field === 'data') {
			dataLines.push(value);
		}
	}

	return { id, eventType, dataText: dataLines.join('\n'), isComment };
}

export function parseProfessionalJobSseChunk(
	chunk: string
): JobProgressEvent[] {
	return chunk
		.split(/\r?\n\r?\n/)
		.map((block) => block.trim())
		.filter(Boolean)
		.map(parseSseBlock)
		.map(({ id, eventType, dataText, isComment }) => {
			if (isComment && !dataText) {
				return {
					id,
					type: 'keep-alive',
				} satisfies JobProgressEvent;
			}
			let data: Record<string, unknown> = {};
			if (dataText) {
				try {
					const parsed = JSON.parse(dataText) as unknown;
					data =
						parsed && typeof parsed === 'object' && !Array.isArray(parsed)
							? (parsed as Record<string, unknown>)
							: { value: parsed };
				} catch {
					data = { message: dataText };
				}
			}
			const message =
				typeof data.message === 'string'
					? data.message
					: typeof data.status === 'string'
						? data.status
						: undefined;
			const rawPercent = data.percent ?? data.progress;
			return {
				id,
				type: eventType,
				message,
				percent: typeof rawPercent === 'number' ? rawPercent : undefined,
				data,
			} satisfies JobProgressEvent;
		});
}

export function JobProgressStream({
	events,
	title,
	active = false,
	onCancel,
}: {
	events: JobProgressEvent[];
	title?: string;
	active?: boolean;
	onCancel?: () => void;
}) {
	const { t } = useTranslation(PROFESSIONAL_WORLDS_NS);
	const panelTitle = title ?? t('runtimeComponents.jobProgress.defaultTitle');
	const visibleEvents = useMemo(
		() => events.filter((event) => event.type !== 'keep-alive'),
		[events]
	);
	const latestPercent = useMemo(() => {
		for (const event of [...events].reverse()) {
			const percent = clampPercent(event.percent);
			if (percent != null) {
				return percent;
			}
		}
		if (events.some((event) => event.type === 'done')) {
			return 100;
		}
		return active ? 10 : 0;
	}, [active, events]);
	const terminalEvent = [...events]
		.reverse()
		.find((event) => event.type === 'done' || event.type === 'error');

	if (events.length === 0) {
		return (
			<DesktopAppEmptyState
				title={t('runtimeComponents.jobProgress.emptyTitle')}
				description={t('runtimeComponents.jobProgress.emptyDescription')}
			/>
		);
	}

	return (
		<ProfessionalWorldsWorkspacePanel
			title={panelTitle}
			className="grid gap-4 p-4"
			actions={
				onCancel && active ? (
					<DesktopAppButton variant="ghost" onClick={onCancel}>
						{t('runtimeComponents.jobProgress.cancel')}
					</DesktopAppButton>
				) : undefined
			}
		>
			<p className="text-xs text-(--desktop-text-secondary)">
				{terminalEvent?.type === 'error'
					? t('runtimeComponents.jobProgress.statusError')
					: terminalEvent?.type === 'done'
						? t('runtimeComponents.jobProgress.statusDone')
						: active
							? t('runtimeComponents.jobProgress.statusRunning')
							: t('runtimeComponents.jobProgress.statusIdle')}
			</p>
			<div
				className="h-2 overflow-hidden rounded-full bg-black/25"
				role="progressbar"
				aria-label={t('runtimeComponents.jobProgress.progressAria', {
					title: panelTitle,
				})}
				aria-valuemin={0}
				aria-valuemax={100}
				aria-valuenow={latestPercent}
			>
				<div
					className="h-full rounded-full bg-[rgb(var(--desktop-accent-rgb))] transition-[width] duration-500 motion-reduce:transition-none"
					style={{ width: `${latestPercent}%` }}
				/>
			</div>
			<div className="grid gap-2">
				{visibleEvents.map((event) => (
					<div
						key={eventKey(event)}
						className={pwJobProgressEventSurfaceClass(event.type)}
					>
						<div className="flex flex-wrap items-center justify-between gap-2">
							<strong>
								{t(`runtimeComponents.jobProgress.events.${event.type}`, {
									defaultValue: t(
										'runtimeComponents.jobProgress.unknownEvent',
										{
											event: humanizeEventType(event.type),
										}
									),
								})}
							</strong>
							{event.at && (
								<span className="text-[11px] opacity-70">
									{new Date(event.at).toLocaleTimeString()}
								</span>
							)}
						</div>
						{event.message && <p className="mt-1">{event.message}</p>}
					</div>
				))}
			</div>
		</ProfessionalWorldsWorkspacePanel>
	);
}
