/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Focused presentation tests for the GAF Chat E2EE consent toolbar control.
 *
 * Invariants:
 * - Consent actions appear only for the backend state that allows them.
 *
 * Related:
 * - documentation/product/GAF-CHAT-BACKEND.md
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GAFChatEncryptionIconButton } from '../GAFChatEncryptionIconButton';

describe('GAFChatEncryptionIconButton', () => {
	it('shows request only when keys are ready and E2EE is off', () => {
		const onPropose = vi.fn();

		render(
			<GAFChatEncryptionIconButton
				currentUserId="user-1"
				status={{
					chat_id: 'chat-1',
					status: 'off',
					requested_by_user_id: null,
					user_1_consented_at: null,
					user_2_consented_at: null,
					activated_at: null,
					declined_at: null,
					disabled_at: null,
					updated_at: null,
					ready: true,
					current_user_consented: false,
					partner_consented: false,
					partner_user_id: 'user-2',
				}}
				onPropose={onPropose}
			/>
		);

		fireEvent.click(screen.getByRole('button', { name: 'Предложить' }));

		expect(onPropose).toHaveBeenCalledTimes(1);
	});

	it('lets the partner accept or decline a pending request', () => {
		const onAccept = vi.fn();
		const onDecline = vi.fn();

		render(
			<GAFChatEncryptionIconButton
				currentUserId="user-2"
				status={{
					chat_id: 'chat-1',
					status: 'pending',
					requested_by_user_id: 'user-1',
					user_1_consented_at: '2026-06-17T00:00:00Z',
					user_2_consented_at: null,
					activated_at: null,
					declined_at: null,
					disabled_at: null,
					updated_at: '2026-06-17T00:00:00Z',
					ready: true,
					current_user_consented: false,
					partner_consented: true,
					partner_user_id: 'user-1',
				}}
				onAccept={onAccept}
				onDecline={onDecline}
			/>
		);

		fireEvent.click(screen.getByRole('button', { name: 'Принять' }));
		fireEvent.click(screen.getByRole('button', { name: 'Отклонить' }));

		expect(onAccept).toHaveBeenCalledTimes(1);
		expect(onDecline).toHaveBeenCalledTimes(1);
	});

	it('shows disable when E2EE is active', () => {
		const onDisable = vi.fn();

		render(
			<GAFChatEncryptionIconButton
				currentUserId="user-1"
				status={{
					chat_id: 'chat-1',
					status: 'active',
					requested_by_user_id: 'user-1',
					user_1_consented_at: '2026-06-17T00:00:00Z',
					user_2_consented_at: '2026-06-17T00:01:00Z',
					activated_at: '2026-06-17T00:01:00Z',
					declined_at: null,
					disabled_at: null,
					updated_at: '2026-06-17T00:01:00Z',
					ready: true,
					current_user_consented: true,
					partner_consented: true,
					partner_user_id: 'user-2',
				}}
				onDisable={onDisable}
			/>
		);

		fireEvent.click(screen.getByRole('button', { name: 'Отключить' }));

		expect(onDisable).toHaveBeenCalledTimes(1);
	});

	it('shows setup keys when E2EE is unavailable', () => {
		const onSetupKeys = vi.fn();

		render(
			<GAFChatEncryptionIconButton
				currentUserId="user-1"
				status={{
					chat_id: 'chat-1',
					status: 'off',
					requested_by_user_id: null,
					user_1_consented_at: null,
					user_2_consented_at: null,
					activated_at: null,
					declined_at: null,
					disabled_at: null,
					updated_at: null,
					ready: false,
					current_user_consented: false,
					partner_consented: false,
					partner_user_id: 'user-2',
				}}
				onSetupKeys={onSetupKeys}
			/>
		);

		fireEvent.click(screen.getByRole('button', { name: 'Настроить' }));

		expect(onSetupKeys).toHaveBeenCalledTimes(1);
	});
});
