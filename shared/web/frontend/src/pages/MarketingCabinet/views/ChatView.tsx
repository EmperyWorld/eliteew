import type { MutationLike } from '../marketingCabinetPage/marketingCabinetComposeHosts';
import { VirtualVariableList } from '@/components/shared/VirtualList';
import { cn } from '@/utils/cn';
import {
	ArrowRightIcon,
	ArrowUturnLeftIcon,
	ExclamationCircleIcon,
	ArrowPathIcon,
} from '@heroicons/react/24/outline';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { AssistantMessageRenderer } from '@/components/assistantMessage';
import {
	DesktopAppButton,
	DesktopAppEmptyState,
	DesktopAppSectionLabel,
	DesktopAppSurface,
} from '../../Desktop/components/DesktopAppChrome';
import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { EmptyProjectState } from '../components/EmptyProjectState';
import { SectionPanel } from '../components/SectionPanel';
import { MARKETING_SECTION_LIST_VIRTUAL_THRESHOLD } from '../constants';
import { useMarketingShellClasses } from '../hooks/useMarketingShellClasses';
import type {
	MarketingCompany,
	MarketingProject,
} from '../marketingCabinetApi';

interface ChatMessage {
	id: string;
	role: 'user' | 'assistant';
	content: string;
}

interface ChatViewProps {
	selectedCompanyId: string | null;
	selectedProjectId: string | null;
	selectedCompany: MarketingCompany | null;
	selectedProject: MarketingProject | null;
	/** Представитель заказчика: только просмотр, без чата с ассистентом */
	readOnlyMarketing?: boolean;
	chatMessages: ChatMessage[];
	chatDraft: string;
	setChatDraft: React.Dispatch<React.SetStateAction<string>>;
	sendChatMutation: MutationLike;
	sendToolAgentMutation: MutationLike;
	onSendMessage: (e: React.FormEvent) => void;
	onSendToolAgentMessage: (e: React.FormEvent) => void;
	/** Router + инструменты (RAG) требуют выбранный проект */
	toolAgentAvailable: boolean;
	onClearChat?: () => void;
}

export function ChatView({
	selectedCompanyId,
	selectedProjectId,
	selectedCompany,
	selectedProject,
	readOnlyMarketing = false,
	chatMessages,
	chatDraft,
	setChatDraft,
	sendChatMutation,
	sendToolAgentMutation,
	onSendMessage,
	onSendToolAgentMessage,
	toolAgentAvailable,
	onClearChat,
}: ChatViewProps) {
	const { t } = useTranslation('marketing');
	const { nestedInset, toolbarInset } = useMarketingShellClasses();
	const chatBusy =
		sendChatMutation.isPending || sendToolAgentMutation.isPending;
	const examplePrompts = t('chatView.examples', {
		returnObjects: true,
	}) as string[];

	function renderChatMessage(message: ChatMessage) {
		return (
			<div
				className={cn(
					'flex',
					message.role === 'user' ? 'justify-end' : 'justify-start'
				)}
			>
				<div
					className={cn(
						'max-w-[min(92%,42rem)] px-4 py-3 text-sm leading-6 shadow-sm',
						message.role === 'user'
							? 'rounded-(--desktop-radius-lg) rounded-br-md border border-(--mc-accent-30) bg-(--desktop-surface-accent) text-white'
							: cn(
									toolbarInset,
									'rounded-(--desktop-radius-lg) rounded-bl-md text-(--desktop-text-secondary)'
								)
					)}
				>
					<span className="sr-only">
						{message.role === 'user'
							? `${t('chatView.userBubble', { defaultValue: 'You' })}: `
							: `${t('chatView.assistantBubble', { defaultValue: 'Assistant' })}: `}
					</span>
					{message.role === 'assistant' ? (
						<AssistantMessageRenderer content={message.content} />
					) : (
						<div className="whitespace-pre-wrap wrap-break-word">
							{message.content}
						</div>
					)}
				</div>
			</div>
		);
	}

	if (!selectedCompanyId && !selectedProjectId) {
		return (
			<EmptyProjectState
				title={t('chatView.emptyTitle')}
				description={t('chatView.emptyDescription')}
			/>
		);
	}

	return (
		<div className="grid min-h-0 gap-4 xl:grid-cols-[0.8fr_1.2fr]">
			<SectionPanel
				title={t('chatView.contextPanelTitle')}
				description={t('chatView.contextPanelDescription')}
				helpBlockId="chat.context"
			>
				<div className="space-y-3 text-sm text-(--desktop-text-secondary)">
					<DesktopAppSurface variant="soft" className="space-y-2 p-4">
						<DesktopAppSectionLabel>
							{t('chatView.companyLabel')}
						</DesktopAppSectionLabel>
						<div className="text-sm font-medium text-(--desktop-text-primary)">
							{selectedCompany?.name || t('chatView.companyNotSelected')}
						</div>
						<p className={cn(DESKTOP_TYPOGRAPHY.meta, 'leading-5')}>
							{selectedCompany?.description ||
								selectedCompany?.industry ||
								t('chatView.companyFallbackHint')}
						</p>
					</DesktopAppSurface>
					<DesktopAppSurface variant="soft" className="space-y-3 p-4">
						<DesktopAppSectionLabel>
							{t('chatView.projectLabel')}
						</DesktopAppSectionLabel>
						<div className="text-sm font-medium text-(--desktop-text-primary)">
							{selectedProject?.name || t('chatView.projectNotSelected')}
						</div>
						{!selectedProject ? (
							<p className={cn(DESKTOP_TYPOGRAPHY.meta, 'leading-5')}>
								{t('chatView.projectFallbackHint')}
							</p>
						) : (
							<div
								className={cn(
									'space-y-2.5',
									DESKTOP_TYPOGRAPHY.meta,
									'leading-5'
								)}
							>
								<div>
									<div className="mb-0.5 font-medium text-(--desktop-text-dim)">
										{t('chatView.projectDescriptionBlock')}
									</div>
									<p className="text-(--desktop-text-secondary)">
										{selectedProject.description?.trim() ||
											t('chatView.projectBlockEmpty')}
									</p>
								</div>
								<div>
									<div className="mb-0.5 font-medium text-(--desktop-text-dim)">
										{t('chatView.projectGoalsBlock')}
									</div>
									<p className="text-(--desktop-text-secondary)">
										{selectedProject.goals?.trim() ||
											t('chatView.projectBlockEmpty')}
									</p>
								</div>
								<div>
									<div className="mb-0.5 font-medium text-(--desktop-text-dim)">
										{t('chatView.projectTasksBlock')}
									</div>
									<p className="text-(--desktop-text-secondary)">
										{selectedProject.key_tasks?.trim() ||
											t('chatView.projectBlockEmpty')}
									</p>
								</div>
							</div>
						)}
					</DesktopAppSurface>
					<DesktopAppSurface variant="soft" className="space-y-2 p-4">
						<DesktopAppSectionLabel>
							{t('chatView.examplesLabel')}
						</DesktopAppSectionLabel>
						<ul
							className={cn(
								'space-y-2',
								DESKTOP_TYPOGRAPHY.meta,
								'leading-5 text-(--desktop-text-secondary)'
							)}
						>
							{Array.isArray(examplePrompts)
								? examplePrompts.map((line) => <li key={line}>{line}</li>)
								: null}
						</ul>
					</DesktopAppSurface>
				</div>
			</SectionPanel>

			<SectionPanel
				className="min-h-0"
				title={t('chatView.sectionTitle')}
				description={t('chatView.sectionDescription')}
				helpBlockId="chat.dialog"
				actions={
					!readOnlyMarketing && chatMessages.length > 0 && onClearChat ? (
						<DesktopAppButton
							type="button"
							variant="ghost"
							size="sm"
							onClick={onClearChat}
							disabled={chatBusy}
							aria-label={t('chatView.newChatAria')}
						>
							<ArrowUturnLeftIcon
								className="h-3.5 w-3.5"
								strokeWidth={DESKTOP_LUCIDE.stroke}
							/>
							{t('chatView.newChat')}
						</DesktopAppButton>
					) : null
				}
			>
				<div className="flex min-h-0 flex-1 flex-col gap-4">
					<div
						className={cn(
							toolbarInset,
							'flex min-h-0 flex-1 flex-col overflow-hidden rounded-(--desktop-radius-lg)'
						)}
						aria-busy={chatBusy}
					>
						<div
							className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain scroll-smooth p-4"
							role="log"
							aria-live="polite"
							aria-relevant="additions"
						>
							<div className="flex min-h-full flex-col gap-3">
								{chatMessages.length > 0 ? (
									chatMessages.length >
									MARKETING_SECTION_LIST_VIRTUAL_THRESHOLD ? (
										<VirtualVariableList
											items={chatMessages}
											estimateSize={() => 120}
											getItemKey={(index) =>
												chatMessages[index]?.id ?? `chat-${index}`
											}
											height={Math.min(560, chatMessages.length * 120)}
											overscanCount={6}
											className="w-full"
											renderItem={(message) => (
												<div className="pb-3">{renderChatMessage(message)}</div>
											)}
										/>
									) : (
										<ul className="flex list-none flex-col gap-3 p-0">
											{chatMessages.map((message) => (
												<li key={message.id}>{renderChatMessage(message)}</li>
											))}
										</ul>
									)
								) : (
									<div className="flex min-h-[min(280px,42dvh)] flex-1 flex-col items-center justify-center py-6">
										<DesktopAppEmptyState
											title={t('chatView.emptyMessagesTitle')}
											description={t('chatView.emptyMessagesDescription')}
											className="max-w-md border-0 bg-transparent p-0 shadow-none"
										/>
									</div>
								)}
								{chatBusy ? (
									<div
										className={cn(
											nestedInset,
											'flex shrink-0 items-center gap-2 px-3 py-2.5 text-sm text-(--desktop-text-muted) antialiased'
										)}
										aria-live="polite"
									>
										<ArrowPathIcon
											className="h-4 w-4 shrink-0 motion-safe:animate-spin motion-reduce:animate-none text-(--mc-accent-30)"
											strokeWidth={DESKTOP_LUCIDE.stroke}
											aria-hidden
										/>
										<span>
											{sendToolAgentMutation.isPending
												? t('chatView.toolAgentThinking')
												: t('chatView.thinking')}
										</span>
									</div>
								) : null}
							</div>
						</div>
					</div>
					{sendChatMutation.isError ? (
						<div
							className="flex shrink-0 items-start gap-3 rounded-(--desktop-radius-lg) border border-red-500/35 bg-red-500/10 px-3 py-3 text-sm text-(--desktop-text-primary)"
							role="alert"
						>
							<ExclamationCircleIcon
								className="mt-0.5 h-4 w-4 shrink-0 text-red-400"
								strokeWidth={DESKTOP_LUCIDE.stroke}
								aria-hidden
							/>
							<div className="min-w-0 flex-1 space-y-1">
								<p className="font-medium leading-5 text-red-200/95">
									{t('chatView.sendFailedTitle', {
										defaultValue: 'Message could not be sent',
									})}
								</p>
								<p
									className={cn(
										DESKTOP_TYPOGRAPHY.meta,
										'wrap-break-word leading-5 text-(--desktop-text-secondary)'
									)}
								>
									{sendChatMutation.error?.message ||
										t('chatView.sendFailedHint', {
											defaultValue:
												'Check your connection and try again. Your draft is still in the box below.',
										})}
								</p>
							</div>
							<DesktopAppButton
								type="button"
								variant="ghost"
								size="sm"
								className="shrink-0 self-center"
								onClick={() => sendChatMutation.reset()}
							>
								{t('chatView.dismissError', { defaultValue: 'Dismiss' })}
							</DesktopAppButton>
						</div>
					) : null}
					{sendToolAgentMutation.isError ? (
						<div
							className="flex shrink-0 items-start gap-3 rounded-(--desktop-radius-lg) border border-red-500/35 bg-red-500/10 px-3 py-3 text-sm text-(--desktop-text-primary)"
							role="alert"
						>
							<ExclamationCircleIcon
								className="mt-0.5 h-4 w-4 shrink-0 text-red-400"
								strokeWidth={DESKTOP_LUCIDE.stroke}
								aria-hidden
							/>
							<div className="min-w-0 flex-1 space-y-1">
								<p className="font-medium leading-5 text-red-200/95">
									{t('chatView.toolAgentFailedTitle', {
										defaultValue: 'Tool-agent reply failed',
									})}
								</p>
								<p
									className={cn(
										DESKTOP_TYPOGRAPHY.meta,
										'wrap-break-word leading-5 text-(--desktop-text-secondary)'
									)}
								>
									{sendToolAgentMutation.error?.message ||
										t('chatView.sendFailedHint', {
											defaultValue:
												'Check your connection and try again. Your draft is still in the box below.',
										})}
								</p>
							</div>
							<DesktopAppButton
								type="button"
								variant="ghost"
								size="sm"
								className="shrink-0 self-center"
								onClick={() => sendToolAgentMutation.reset()}
							>
								{t('chatView.dismissError', { defaultValue: 'Dismiss' })}
							</DesktopAppButton>
						</div>
					) : null}
					{readOnlyMarketing ? (
						<p
							className={cn(
								DESKTOP_TYPOGRAPHY.meta,
								'shrink-0 border-t border-(--desktop-border-subtle)/50 pt-3'
							)}
						>
							{t('chatView.readOnlyHint', {
								defaultValue:
									'В режиме представителя заказчика чат с ассистентом отключён.',
							})}
						</p>
					) : (
						<form
							className="shrink-0 space-y-2 border-t border-(--desktop-border-subtle)/50 pt-3"
							onSubmit={onSendMessage}
						>
							<label className="sr-only" htmlFor="marketing-cabinet-chat-input">
								{t('chatView.messageAria')}
							</label>
							<textarea
								id="marketing-cabinet-chat-input"
								className={cn(
									nestedInset,
									'min-h-[108px] w-full resize-y px-3 py-3 text-sm text-(--desktop-text-primary) placeholder:text-(--desktop-text-dim)',
									'outline-none transition-[border-color,box-shadow]',
									'focus-visible:border-[rgb(var(--desktop-accent-rgb)/0.35)]',
									'focus-visible:ring-2 focus-visible:ring-(--mc-accent-30)/55 focus-visible:ring-offset-2 focus-visible:ring-offset-(--desktop-surface-panel)'
								)}
								value={chatDraft}
								onChange={(event) => setChatDraft(event.target.value)}
								onKeyDown={(e) => {
									if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
										e.preventDefault();
										if (chatDraft.trim() && !chatBusy) {
											onSendMessage(e as unknown as React.FormEvent);
										}
									}
								}}
								placeholder={t('chatView.placeholder')}
								aria-label={t('chatView.messageAria')}
								aria-invalid={
									sendChatMutation.isError || sendToolAgentMutation.isError
								}
							/>
							<div className="flex flex-col gap-2">
								<div className="flex flex-wrap items-center justify-end gap-2">
									<DesktopAppButton
										type="button"
										variant="ghost"
										size="sm"
										disabled={
											chatBusy || !chatDraft.trim() || !toolAgentAvailable
										}
										onClick={onSendToolAgentMessage}
										title={t('chatView.sendWithToolsHint')}
										aria-label={t('chatView.sendWithToolsAria')}
									>
										{sendToolAgentMutation.isPending ? (
											<ArrowPathIcon
												className="h-4 w-4 motion-safe:animate-spin motion-reduce:animate-none"
												strokeWidth={DESKTOP_LUCIDE.stroke}
											/>
										) : null}
										{t('chatView.sendWithTools')}
									</DesktopAppButton>
									<DesktopAppButton
										type="submit"
										variant="accent"
										disabled={chatBusy || !chatDraft.trim()}
										aria-label={t('chatView.sendAria')}
									>
										{sendChatMutation.isPending ? (
											<ArrowPathIcon
												className="h-4 w-4 motion-safe:animate-spin motion-reduce:animate-none"
												strokeWidth={DESKTOP_LUCIDE.stroke}
											/>
										) : (
											<ArrowRightIcon
												className="h-4 w-4"
												strokeWidth={DESKTOP_LUCIDE.stroke}
											/>
										)}
										{t('chatView.send')}
									</DesktopAppButton>
								</div>
								<p className="text-[11px] leading-4 text-(--desktop-text-dim)">
									{t('chatView.sendHint', {
										defaultValue: 'Ctrl+Enter or ⌘+Enter to send',
									})}
								</p>
							</div>
						</form>
					)}
				</div>
			</SectionPanel>
		</div>
	);
}
