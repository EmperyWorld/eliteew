/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 */

import { describe, expect, it } from 'vitest';
import {
	GENERATION_BUDGET_LIMITS,
	mergeDefaultsForm,
	parseAdvancedDefaultsJson,
	readDefaultsForm,
} from '../desktopAiChatAdminDefaults';

describe('desktopAiChatAdminDefaults', () => {
	it('reads booleans and enums from defaults blob', () => {
		const form = readDefaultsForm({
			feature_enabled: false,
			voice_enabled: true,
			tools_web_search_enabled: true,
			desktop_tool_router_mode: 'full',
			desktop_ensemble_routing_mode: 'semi',
			desktop_ensemble_engine: 'legacy_freeform',
			fetch_url_allow_hosts: ['example.com', 'api.example.com'],
		});
		expect(form.featureEnabled).toBe(false);
		expect(form.voiceEnabled).toBe(true);
		expect(form.toolsWebSearchEnabled).toBe(true);
		expect(form.desktopToolRouterMode).toBe('full');
		expect(form.desktopEnsembleRoutingMode).toBe('semi');
		expect(form.desktopEnsembleEngine).toBe('legacy_freeform');
		expect(form.fetchUrlAllowHosts).toContain('example.com');
		expect(form.desktopChatNumPredict).toBe(
			GENERATION_BUDGET_LIMITS.numPredict.default
		);
	});

	it('clamps generation budget fields on read and merge', () => {
		const form = readDefaultsForm({
			desktop_chat_num_predict: 9_999_999,
			desktop_chat_timeout_sec: 5,
			ensemble_separate_reply_max_tokens: 10,
			ensemble_blueprint_step_max_tokens: 100,
		});
		expect(form.desktopChatNumPredict).toBe(
			GENERATION_BUDGET_LIMITS.numPredict.hi
		);
		expect(form.desktopChatTimeoutSec).toBe(
			GENERATION_BUDGET_LIMITS.timeoutSec.lo
		);
		expect(form.ensembleSeparateReplyMaxTokens).toBe(
			GENERATION_BUDGET_LIMITS.separateReply.lo
		);
		expect(form.ensembleBlueprintStepMaxTokens).toBe(
			GENERATION_BUDGET_LIMITS.blueprintStep.lo
		);

		const merged = mergeDefaultsForm(
			{ rag_top_k: 12 },
			{
				...form,
				desktopChatNumPredict: 4096,
				ensembleJointSectionMaxTokens: 20_000,
			}
		);
		expect(merged.rag_top_k).toBe(12);
		expect(merged.desktop_chat_num_predict).toBe(4096);
		expect(merged.ensemble_joint_section_max_tokens).toBe(20_000);
		expect(merged.ensemble_separate_reply_max_tokens).toBe(
			GENERATION_BUDGET_LIMITS.separateReply.lo
		);
	});

	it('mergeDefaultsForm preserves unrelated keys and patches structured fields', () => {
		const base = { rag_top_k: 12, custom_flag: true };
		const form = readDefaultsForm({ feature_enabled: true });
		const merged = mergeDefaultsForm(base, {
			...form,
			featureEnabled: false,
			toolsWebSearchEnabled: true,
		});
		expect(merged.rag_top_k).toBe(12);
		expect(merged.custom_flag).toBe(true);
		expect(merged.feature_enabled).toBe(false);
		expect(merged.tools_web_search_enabled).toBe(true);
		expect(merged.fetch_url_allow_hosts).toEqual([]);
		expect(merged.desktop_chat_num_predict).toBe(
			GENERATION_BUDGET_LIMITS.numPredict.default
		);
	});

	it('parseAdvancedDefaultsJson rejects non-objects', () => {
		expect(() => parseAdvancedDefaultsJson('[]')).toThrow();
		expect(parseAdvancedDefaultsJson('{"a":1}')).toEqual({ a: 1 });
	});
});
