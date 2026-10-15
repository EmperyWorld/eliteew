/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Single source for Ollenti / Ollenti2 template bootstrap on new presentations.
 *
 * Invariants:
 * - Bootstrap runs only when isNew, empty single slide, and format matches.
 *
 * Related:
 * - PresentationEditPage.tsx
 * - ollentiPresentationTemplates.ts
 */

import type { PresentationSlide } from '@services/api/presentations';
import { useEffect, useState } from 'react';
import type { TFunction } from 'i18next';
import {
	OLLENTI2_TEMPLATE_CONTACT_SLIDE_INDEX,
	OLLENTI_TEMPLATE_CONTACT_SLIDE_INDEX,
	ollenti2PresentationTemplate,
	ollentiPresentationTemplate,
	withPresentationTemplateContactI18n,
} from './ollentiPresentationTemplates';

export type PresentationFormat =
	| 'classic'
	| 'modern'
	| 'minimal'
	| 'ollenti'
	| 'ollenti2';

function createTemplateSlidesWithIds(
	template: PresentationSlide[]
): PresentationSlide[] {
	return template.map((slide, index) => ({
		...slide,
		id:
			(Date.now() + index).toString() + Math.random().toString(36).substr(2, 9),
	}));
}

export type OllentiBootstrapResult = {
	slides: PresentationSlide[];
	title?: string;
};

export function buildOllentiTemplateBootstrap(
	format: PresentationFormat,
	t: TFunction<'siteStudio'>
): OllentiBootstrapResult | null {
	if (format === 'ollenti') {
		const localized = withPresentationTemplateContactI18n(
			ollentiPresentationTemplate,
			OLLENTI_TEMPLATE_CONTACT_SLIDE_INDEX,
			t('adminCatalog.presentationEditor.ollentiTemplateContactBody')
		);
		return {
			slides: createTemplateSlidesWithIds(localized),
			title: t('adminCatalog.presentationEditor.ollentiTemplateDefaultTitle'),
		};
	}
	if (format === 'ollenti2') {
		const localized = withPresentationTemplateContactI18n(
			ollenti2PresentationTemplate,
			OLLENTI2_TEMPLATE_CONTACT_SLIDE_INDEX,
			t('adminCatalog.presentationEditor.ollenti2TemplateContactBody')
		);
		return {
			slides: createTemplateSlidesWithIds(localized),
			title: t('adminCatalog.presentationEditor.ollenti2TemplateDefaultTitle'),
		};
	}
	return null;
}

export type UseOllentiTemplateBootstrapArgs = {
	isNew: boolean;
	format: PresentationFormat;
	slides: PresentationSlide[];
	title: string;
	setSlides: (slides: PresentationSlide[]) => void;
	setTitle: (title: string) => void;
	setHistory: (history: PresentationSlide[][]) => void;
	setHistoryIndex: (index: number) => void;
	t: TFunction<'siteStudio'>;
};

export function useOllentiTemplateBootstrap({
	isNew,
	format,
	slides,
	title,
	setSlides,
	setTitle,
	setHistory,
	setHistoryIndex,
	t,
}: UseOllentiTemplateBootstrapArgs) {
	const [ollentiTemplateInitialized, setOllentiTemplateInitialized] =
		useState(false);
	const [ollenti2TemplateInitialized, setOllenti2TemplateInitialized] =
		useState(false);

	// biome-ignore lint/correctness/useExhaustiveDependencies: mirrors original bootstrap gate; setters are stable
	useEffect(() => {
		if (
			isNew &&
			format === 'ollenti' &&
			!ollentiTemplateInitialized &&
			slides.length === 1 &&
			!slides[0].title
		) {
			const bootstrap = buildOllentiTemplateBootstrap('ollenti', t);
			if (bootstrap) {
				setSlides(bootstrap.slides);
				if (!title && bootstrap.title) setTitle(bootstrap.title);
				setHistory([bootstrap.slides]);
				setHistoryIndex(0);
				setOllentiTemplateInitialized(true);
			}
		}
		if (format !== 'ollenti') {
			setOllentiTemplateInitialized(false);
		}
	}, [
		format,
		isNew,
		ollentiTemplateInitialized,
		slides.length,
		slides[0]?.title,
		title,
		t,
	]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: mirrors original bootstrap gate; setters are stable
	useEffect(() => {
		if (
			isNew &&
			format === 'ollenti2' &&
			!ollenti2TemplateInitialized &&
			slides.length === 1 &&
			!slides[0].title
		) {
			const bootstrap = buildOllentiTemplateBootstrap('ollenti2', t);
			if (bootstrap) {
				setSlides(bootstrap.slides);
				if (!title && bootstrap.title) setTitle(bootstrap.title);
				setHistory([bootstrap.slides]);
				setHistoryIndex(0);
				setOllenti2TemplateInitialized(true);
			}
		}
		if (format !== 'ollenti2') {
			setOllenti2TemplateInitialized(false);
		}
	}, [
		format,
		isNew,
		ollenti2TemplateInitialized,
		slides.length,
		slides[0]?.title,
		title,
		t,
	]);
}
