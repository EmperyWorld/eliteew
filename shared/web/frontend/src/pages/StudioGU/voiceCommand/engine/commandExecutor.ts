/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Command executor: run voice command ids and return i18n response keys + status.
 *
 * Invariants:
 * - Command ids stay stable; UI terminology can change without changing dispatched desktop events.
 * - Info commands are local, app commands dispatch shell CustomEvents.
 * - User-facing text resolved via `resolveExecutionResponse` + `desktopUi.voiceCommand.responses`.
 *
 * Related:
 * - `commandCatalog.ts`, `utils/voiceCommandI18n.ts`
 */

import { storeUgsDesktopDeepLink } from '@/pages/Desktop/utils/ugsDesktopDeepLink';
import { loadVoiceCenterUI, saveVoiceCenterUI } from '../storage';

export interface ExecutionResult {
	/** Key under `voiceCommand.responses.*` (without prefix). */
	responseKey: string;
	responseParams?: Record<string, string>;
	status: 'success' | 'error';
	/** For clear_history the UI must clear the message feed; executor does not touch React state. */
	sideEffect?: 'clear_messages';
}

export function executeCommand(
	commandId: string,
	params?: Record<string, string>
): ExecutionResult {
	switch (commandId) {
		case 'open_gaf_chat':
			window.dispatchEvent(
				new CustomEvent('desktop-command', {
					detail: { action: 'open_app', app: 'GAFChatApp' },
				})
			);
			return { responseKey: 'open_gaf_chat', status: 'success' };
		case 'open_content':
			window.dispatchEvent(
				new CustomEvent('desktop-command', {
					detail: { action: 'open_app', app: 'ContentManagerPro' },
				})
			);
			return { responseKey: 'open_content', status: 'success' };
		case 'open_ugs_analytics':
			storeUgsDesktopDeepLink({ view: 'analytics' });
			window.dispatchEvent(
				new CustomEvent('desktop-command', {
					detail: { action: 'open_app', app: 'UGS' },
				})
			);
			return { responseKey: 'open_ugs_analytics', status: 'success' };
		case 'open_presentations':
			window.dispatchEvent(
				new CustomEvent('desktop-command', {
					detail: { action: 'open_app', app: 'EWRP' },
				})
			);
			return { responseKey: 'open_presentations', status: 'success' };
		case 'open_doc_editor':
			window.dispatchEvent(
				new CustomEvent('desktop-command', {
					detail: { action: 'open_app', app: 'DocEditor' },
				})
			);
			return { responseKey: 'open_doc_editor', status: 'success' };
		case 'open_image_studio':
			window.dispatchEvent(
				new CustomEvent('desktop-command', {
					detail: { action: 'open_app', app: 'ImageStudio' },
				})
			);
			return { responseKey: 'open_image_studio', status: 'success' };
		case 'open_video_studio':
			window.dispatchEvent(
				new CustomEvent('desktop-command', {
					detail: { action: 'open_app', app: 'VideoStudio' },
				})
			);
			return { responseKey: 'open_video_studio', status: 'success' };
		case 'open_music_player':
			window.dispatchEvent(
				new CustomEvent('desktop-command', {
					detail: { action: 'open_app', app: 'MusicPlayer' },
				})
			);
			return { responseKey: 'open_music_player', status: 'success' };
		case 'open_music_generator':
			window.dispatchEvent(
				new CustomEvent('desktop-command', {
					detail: { action: 'open_app', app: 'MusicForgeApp' },
				})
			);
			return { responseKey: 'open_music_generator', status: 'success' };
		case 'open_clipboard':
			window.dispatchEvent(
				new CustomEvent('desktop-command', {
					detail: { action: 'open_app', app: 'ClipboardManager' },
				})
			);
			return { responseKey: 'open_clipboard', status: 'success' };
		case 'open_app_store':
			window.dispatchEvent(
				new CustomEvent('desktop-command', {
					detail: { action: 'open_app', app: 'AppStore' },
				})
			);
			return { responseKey: 'open_app_store', status: 'success' };
		case 'open_site_studio':
			window.dispatchEvent(
				new CustomEvent('desktop-command', {
					detail: { action: 'open_app', app: 'UserSiteStudio' },
				})
			);
			return { responseKey: 'open_site_studio', status: 'success' };
		case 'open_social_hub':
			window.dispatchEvent(
				new CustomEvent('desktop-command', {
					detail: { action: 'open_app', app: 'SocialHubApp' },
				})
			);
			return { responseKey: 'open_social_hub', status: 'success' };
		case 'open_marketing_cabinet':
			window.dispatchEvent(
				new CustomEvent('desktop-command', {
					detail: { action: 'open_app', app: 'MarketingCabinet' },
				})
			);
			return { responseKey: 'open_marketing_cabinet', status: 'success' };
		case 'open_studio_gu':
			window.dispatchEvent(
				new CustomEvent('desktop-command', {
					detail: { action: 'open_app', app: 'StudioGU' },
				})
			);
			return { responseKey: 'open_studio_gu', status: 'success' };

		case 'create_folder': {
			const folderName = params?.name?.trim() || '';
			window.dispatchEvent(
				new CustomEvent('desktop-command', {
					detail: {
						action: 'create_folder',
						name: folderName || 'New folder',
					},
				})
			);
			return {
				responseKey: 'create_folder',
				responseParams: { name: folderName || 'New folder' },
				status: 'success',
			};
		}
		case 'minimize_all':
			window.dispatchEvent(
				new CustomEvent('desktop-command', {
					detail: { action: 'minimize_all' },
				})
			);
			return { responseKey: 'minimize_all', status: 'success' };
		case 'show_desktop':
			window.dispatchEvent(
				new CustomEvent('desktop-command', {
					detail: { action: 'show_desktop' },
				})
			);
			return { responseKey: 'show_desktop', status: 'success' };
		case 'close_window':
			window.dispatchEvent(
				new CustomEvent('desktop-command', {
					detail: { action: 'close_window' },
				})
			);
			return { responseKey: 'close_window', status: 'success' };

		case 'time': {
			const now = new Date();
			const hours = now.getHours();
			const minutes = now.getMinutes();
			const timeStr = `${hours}:${minutes.toString().padStart(2, '0')}`;
			const period =
				hours < 12
					? 'time_morning'
					: hours < 18
						? 'time_afternoon'
						: 'time_evening';
			return {
				responseKey: period,
				responseParams: { time: timeStr },
				status: 'success',
			};
		}
		case 'date':
			return { responseKey: 'date', status: 'success' };

		case 'help':
			return { responseKey: 'help', status: 'success' };
		case 'clear_history':
			return {
				responseKey: 'clear_feed',
				status: 'success',
				sideEffect: 'clear_messages',
			};
		case 'thanks':
			return { responseKey: 'thanks', status: 'success' };
		case 'greeting': {
			const hour = new Date().getHours();
			const period =
				hour < 12
					? 'greeting_morning'
					: hour < 18
						? 'greeting_afternoon'
						: 'greeting_evening';
			return { responseKey: period, status: 'success' };
		}

		case 'focus_next_window':
			window.dispatchEvent(
				new CustomEvent('desktop-command', {
					detail: { action: 'focus_next_window' },
				})
			);
			return { responseKey: 'focus_next_window', status: 'success' };
		case 'focus_previous_window':
			window.dispatchEvent(
				new CustomEvent('desktop-command', {
					detail: { action: 'focus_previous_window' },
				})
			);
			return { responseKey: 'focus_previous_window', status: 'success' };
		case 'open_command_palette':
			window.dispatchEvent(
				new CustomEvent('desktop-command', {
					detail: { action: 'open_command_palette' },
				})
			);
			return { responseKey: 'open_command_palette', status: 'success' };
		case 'voice_sound_mute':
			saveVoiceCenterUI({ soundFeedback: false });
			return { responseKey: 'voice_sound_mute', status: 'success' };
		case 'voice_sound_unmute':
			saveVoiceCenterUI({ soundFeedback: true });
			return { responseKey: 'voice_sound_unmute', status: 'success' };
		case 'voice_sound_toggle': {
			const cur = loadVoiceCenterUI();
			const on = !cur.soundFeedback;
			saveVoiceCenterUI({ soundFeedback: on });
			return {
				responseKey: on ? 'voice_sound_unmute' : 'voice_sound_mute',
				status: 'success',
			};
		}

		default:
			return { responseKey: 'unknown_command', status: 'error' };
	}
}
