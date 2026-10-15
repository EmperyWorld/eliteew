/**
 * Unified notification types for toast + notification center.
 */

import type { ReactNode } from 'react';

export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export interface NotificationAction {
	label: string;
	onClick: () => void;
}

/** Serializable intent for `desktop-open-app` when the user activates the row. */
export interface NotificationOpenAppIntent {
	appComponent: string;
	targetChatId?: string;
	targetUsername?: string;
	documentId?: string;
	unifiedContentId?: string;
	/** Doc Editor: открыть панель совместной работы после загрузки документа. */
	openCollabPanel?: boolean;
	/** Doc Editor: автоматически подключиться к совместному редактированию после загрузки. */
	autoJoinCollaboration?: boolean;
	[key: string]: unknown;
}

/** Serializable actions from server (Socket.IO); executed in the notification hub. */
export interface ServerNotificationAction {
	label: string;
	/** Logical id, e.g. doc_collab_invite_accept */
	action: string;
}

export interface Notification {
	id: string;
	type: NotificationType;
	title: string;
	message: string;
	timestamp: Date;
	read: boolean;
	/** Single client-side action (legacy / simple rows). */
	action?: NotificationAction;
	/** Multiple actions from server notification payload (buttons in hub). */
	serverActions?: ServerNotificationAction[];
	/** Copied from server event for action handlers (invite ids, etc.). */
	metadata?: Record<string, unknown>;
	/**
	 * When set, clicking the notification row opens this app (and optional deep link).
	 * Not persisted to localStorage (re-open from source if needed).
	 */
	openApp?: NotificationOpenAppIntent;
	icon?: ReactNode;
	/**
	 * If true, the notification should not auto-disappear from the center.
	 */
	persistent?: boolean;
	/**
	 * Optional logical source (e.g. 'gaf_chat', 'bi', 'system').
	 */
	source?: string;
	/**
	 * Optional expiration moment; expired notifications may be pruned by the store.
	 */
	expiresAt?: Date;
}

/**
 * Input for creating notifications in the center.
 * Allows passing a stable id/expiresAt when coming from backend events.
 */
export type NotificationInput = Omit<
	Notification,
	'id' | 'timestamp' | 'read'
> & {
	id?: string;
};
