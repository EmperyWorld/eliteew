/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Default slide shape and editor presets (color schemes, gradients, templates).
 *
 * Invariants:
 * - defaultSlide is the canonical empty slide baseline for new slides.
 *
 * Related:
 * - PresentationEditPage.tsx
 * - presentationEdit/ollentiPresentationTemplates.ts
 */

import type { PresentationSlide } from '@services/api/presentations';

export const defaultSlide: PresentationSlide = {
	id: Date.now().toString(),
	title: '',
	content: '',
	layout: 'title-content',
	backgroundColor: '#ffffff',
	textColor: '#000000',
	titleColor: undefined,
	contentColor: undefined,
	textAlign: 'left',
	titleAlign: 'center',
	titleFontSize: '2.5em',
	contentFontSize: '1.1em',
	fontFamily: undefined,
	lineHeight: '1.6',
	imagePosition: 'center',
	imageSize: 'medium',
};

export const colorSchemes = [
	{
		name: 'Классическая',
		backgroundColor: '#ffffff',
		textColor: '#000000',
		titleColor: '#1a1a1a',
		contentColor: '#333333',
	},
	{
		name: 'Темная',
		backgroundColor: '#1a1a1a',
		textColor: '#ffffff',
		titleColor: '#ffffff',
		contentColor: '#e0e0e0',
	},
	{
		name: 'Синяя',
		backgroundColor: '#f0f4f8',
		textColor: '#1e3a5f',
		titleColor: '#1e40af',
		contentColor: '#1e3a5f',
	},
	{
		name: 'Зеленая',
		backgroundColor: '#f0fdf4',
		textColor: '#14532d',
		titleColor: '#166534',
		contentColor: '#14532d',
	},
	{
		name: 'Красная',
		backgroundColor: '#fef2f2',
		textColor: '#7f1d1d',
		titleColor: '#991b1b',
		contentColor: '#7f1d1d',
	},
	{
		name: 'Фиолетовая',
		backgroundColor: '#faf5ff',
		textColor: '#581c87',
		titleColor: '#6b21a8',
		contentColor: '#581c87',
	},
] as const;

export type ColorScheme = (typeof colorSchemes)[number];

export const backgroundGradients = [
	{ name: 'Нет', value: undefined },
	{
		name: 'Синий градиент',
		value: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
	},
	{
		name: 'Оранжевый градиент',
		value: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
	},
	{
		name: 'Зеленый градиент',
		value: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
	},
	{
		name: 'Фиолетовый градиент',
		value: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
	},
	{
		name: 'Темный градиент',
		value: 'linear-gradient(135deg, #2c3e50 0%, #34495e 100%)',
	},
	{
		name: 'Светлый градиент',
		value: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
	},
] as const;

export const slideTemplates = [
	{
		name: 'Титульный',
		slide: {
			...defaultSlide,
			layout: 'title-content' as const,
			titleAlign: 'center' as const,
			textAlign: 'center' as const,
			titleFontSize: '3em',
			backgroundColor: '#1e3a5f',
			textColor: '#ffffff',
			titleColor: '#ffffff',
		},
	},
	{
		name: 'С изображением',
		slide: {
			...defaultSlide,
			layout: 'title-image-content' as const,
			titleAlign: 'center' as const,
			textAlign: 'left' as const,
		},
	},
	{
		name: 'Только изображение',
		slide: {
			...defaultSlide,
			layout: 'full-image' as const,
		},
	},
	{
		name: 'Разделитель',
		slide: {
			...defaultSlide,
			layout: 'title-content' as const,
			titleAlign: 'center' as const,
			textAlign: 'center' as const,
			titleFontSize: '2.5em',
			backgroundColor: '#4f8f7f',
			textColor: '#ffffff',
			titleColor: '#ffffff',
		},
	},
	{
		name: 'Цитата',
		slide: {
			...defaultSlide,
			layout: 'title-content' as const,
			titleAlign: 'center' as const,
			textAlign: 'center' as const,
			titleFontSize: '2em',
			contentFontSize: '1.3em',
			lineHeight: '1.8',
			backgroundColor: '#f8f9fa',
			textColor: '#495057',
		},
	},
] as const;

export type SlideTemplate = (typeof slideTemplates)[number];
