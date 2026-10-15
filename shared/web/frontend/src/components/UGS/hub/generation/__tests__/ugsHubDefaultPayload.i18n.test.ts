/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock EN default generation payloads and localized prompt helpers.
 *
 * Related:
 * - ../ugsHubDefaultPayload.ts, i18n/locales/en/ugsHub.json
 */

import i18next, { type i18n, type TFunction } from 'i18next';
import { initReactI18next } from 'react-i18next';
import { beforeAll, describe, expect, it } from 'vitest';

import type { GenerationType } from '@/hooks/api/useUgsDashboard';
import enUgsHub from '@/i18n/locales/en/ugsHub.json';
import ruUgsHub from '@/i18n/locales/ru/ugsHub.json';
import { UGS_HUB_NS } from '@/i18n/namespaces';

import {
	buildDefaultPayload,
	getDefaultPromptForType,
} from '../ugsHubDefaultPayload';
import { buildUgsHubAudioPlaceholderCaptionsVtt } from '../../results/ugsHubResultConstants';

let enI18n: i18n;
let ruI18n: i18n;
let enT: TFunction<'ugsHub'>;
let ruT: TFunction<'ugsHub'>;

beforeAll(async () => {
	enI18n = i18next.createInstance();
	await enI18n.use(initReactI18next).init({
		lng: 'en',
		fallbackLng: 'en',
		ns: [UGS_HUB_NS],
		defaultNS: UGS_HUB_NS,
		resources: {
			en: { [UGS_HUB_NS]: enUgsHub },
		},
	});
	enT = enI18n.getFixedT('en', UGS_HUB_NS) as TFunction<'ugsHub'>;

	ruI18n = i18next.createInstance();
	await ruI18n.use(initReactI18next).init({
		lng: 'ru',
		fallbackLng: 'ru',
		ns: [UGS_HUB_NS],
		defaultNS: UGS_HUB_NS,
		resources: {
			ru: { [UGS_HUB_NS]: ruUgsHub },
		},
	});
	ruT = ruI18n.getFixedT('ru', UGS_HUB_NS) as TFunction<'ugsHub'>;
});

describe('ugsHubDefaultPayload i18n', () => {
	it('builds EN text defaults from generationDefaults keys', () => {
		const payload = buildDefaultPayload(enT, {
			type_key: 'text_chat',
			category: 'text',
		} as GenerationType);

		expect(payload.prompt).toBe(enUgsHub.generationDefaults.textPrompt);
		expect(payload.prompt).toMatch(/company news/i);
		expect(payload.max_tokens).toBe(600);
	});

	it('builds EN audio defaults from generationDefaults keys', () => {
		const payload = buildDefaultPayload(enT, {
			type_key: 'tts_basic',
			category: 'audio',
		} as GenerationType);

		expect(payload.text).toBe(enUgsHub.generationDefaults.audioText);
		expect(payload.text).toMatch(/Welcome to EliteEW/i);
	});

	it('localizes specialized text prompts by type key', () => {
		expect(getDefaultPromptForType(enT, 'text_translation')).toBe(
			enUgsHub.generationDefaults.translationPrompt
		);
		expect(getDefaultPromptForType(ruT, 'text_translation')).toBe(
			ruUgsHub.generationDefaults.translationPrompt
		);
		expect(getDefaultPromptForType(enT, 'text_translation')).toMatch(
			/Translate to English/i
		);
	});

	it('builds localized VTT fallback cue without hardcoded RU in module', () => {
		const enVtt = decodeURIComponent(
			buildUgsHubAudioPlaceholderCaptionsVtt(enT).replace(
				/^data:text\/vtt;charset=utf-8,/,
				''
			)
		);
		const ruVtt = decodeURIComponent(
			buildUgsHubAudioPlaceholderCaptionsVtt(ruT).replace(
				/^data:text\/vtt;charset=utf-8,/,
				''
			)
		);

		expect(enVtt).toContain(enUgsHub.result.vttFallbackCue);
		expect(ruVtt).toContain(ruUgsHub.result.vttFallbackCue);
		expect(enVtt).toMatch(/WEBVTT/);
	});
});
