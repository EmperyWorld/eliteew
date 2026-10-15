/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * External store for desktop Socket.IO connection state — decoupled from GAFChatProvider context.
 *
 * Invariants:
 * - Leader tab only: followers always read `connected: false`.
 * - Updates must go through this module so tray/header subscribe without GAF context rerenders.
 *
 * Related:
 * - `pages/Desktop/context/GAFChatProvider.tsx`, `utils/browserTabLeaderState.ts`
 */

import { useSyncExternalStore } from 'react';

export type SocketConnectionSnapshot = {
	connected: boolean;
	isLeader: boolean;
};

let snapshot: SocketConnectionSnapshot = {
	connected: false,
	isLeader: false,
};

const listeners = new Set<() => void>();

function emit(): void {
	for (const listener of listeners) {
		listener();
	}
}

function snapshotsEqual(
	a: SocketConnectionSnapshot,
	b: SocketConnectionSnapshot
): boolean {
	return a.connected === b.connected && a.isLeader === b.isLeader;
}

export function getSocketConnectionSnapshot(): SocketConnectionSnapshot {
	return snapshot;
}

export function subscribeSocketConnection(listener: () => void): () => void {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

export function setSocketConnectionLeader(isLeader: boolean): void {
	const next: SocketConnectionSnapshot = {
		connected: isLeader ? snapshot.connected : false,
		isLeader,
	};
	if (snapshotsEqual(snapshot, next)) {
		return;
	}
	snapshot = next;
	emit();
}

export function setSocketConnectionConnected(connected: boolean): void {
	if (!snapshot.isLeader) {
		if (!snapshot.connected) {
			return;
		}
		snapshot = { connected: false, isLeader: false };
		emit();
		return;
	}
	const next: SocketConnectionSnapshot = {
		connected,
		isLeader: true,
	};
	if (snapshotsEqual(snapshot, next)) {
		return;
	}
	snapshot = next;
	emit();
}

export function resetSocketConnectionStore(): void {
	snapshot = { connected: false, isLeader: false };
	emit();
}

export function useSocketConnectionState(): SocketConnectionSnapshot {
	return useSyncExternalStore(
		subscribeSocketConnection,
		getSocketConnectionSnapshot,
		getSocketConnectionSnapshot
	);
}
