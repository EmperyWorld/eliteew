/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Ollenti / Ollenti2 demo presentation templates and contact-slide i18n helper.
 *
 * Invariants:
 * - Contact slide index constants match template slide order.
 *
 * Related:
 * - PresentationEditPage.tsx
 * - presentationEdit/presentationEditorPresets.ts
 */

import type { PresentationSlide } from '@services/api/presentations';

/** Public static template art (not Rollup-imported binaries). */
const T = '/site-studio-template-assets/presentations';
const ollentiAboutImage = `${T}/ollenti-about.jpg.png`;
const ollentiContactImage = `${T}/ollenti-contact.png`;
const ollentiHeroImage = `${T}/ollenti-hero.png`;
const ollentiPhilosophyImage = `${T}/ollenti-philosophy.png`;
const ollentiQualityImage = `${T}/ollenti-quality.png`;
const ollentiServicesImage = `${T}/ollenti-services.png`;

/** Индекс слайда «Свяжитесь с нами» в шаблонах (подмена текста через i18n). */
export const OLLENTI_TEMPLATE_CONTACT_SLIDE_INDEX = 5;
export const OLLENTI2_TEMPLATE_CONTACT_SLIDE_INDEX = 11;

export function withPresentationTemplateContactI18n(
	template: PresentationSlide[],
	contactIndex: number,
	contactBody: string
): PresentationSlide[] {
	return template.map((slide, index) =>
		index === contactIndex ? { ...slide, content: contactBody } : slide
	);
}

// Готовая презентация в стиле Demo Brand 1
export const ollentiPresentationTemplate: PresentationSlide[] = [
	{
		id: Date.now().toString(),
		title: 'Demo Brand',
		content: 'Ценность, сервис и понятная витрина',
		layout: 'title-image-content',
		backgroundColor: '#1a1612',
		backgroundGradient:
			'linear-gradient(135deg, #1a1612 0%, #2d2419 40%, #3d2e1f 70%, #4a3a2a 100%)',
		textColor: '#f5f0e8',
		titleColor: '#d4af7a',
		contentColor: '#e8ddd0',
		titleAlign: 'center',
		textAlign: 'center',
		titleFontSize: '5.5em',
		contentFontSize: '2.2em',
		lineHeight: '1.4',
		transition: 'fade',
		imagePosition: 'top',
		imageSize: 'large',
		image: ollentiHeroImage,
	},
	{
		id: (Date.now() + 1).toString(),
		title: 'О нас',
		content:
			'Ваш бренд — это сочетание экспертизы, сервиса и понятной витрины предложений.\n\nМы помогаем упаковать ценность в структуру сайта, которую легко адаптировать под вашу тематику.',
		layout: 'title-image-content',
		backgroundColor: '#ffffff',
		backgroundGradient:
			'linear-gradient(135deg, #ffffff 0%, #faf8f5 30%, #f5f0e8 60%, #f0ebe0 100%)',
		textColor: '#3d2e1f',
		titleColor: '#ad8b56',
		contentColor: '#5a4a3a',
		titleAlign: 'center',
		textAlign: 'center',
		titleFontSize: '4em',
		contentFontSize: '1.6em',
		lineHeight: '1.75',
		transition: 'slide',
		imagePosition: 'top',
		imageSize: 'large',
		image: ollentiAboutImage,
	},
	{
		id: (Date.now() + 2).toString(),
		title: 'Наша философия',
		content:
			'Каждый проект — это история\n\nМы верим, что сайт должен быстро объяснять ценность, вызывать доверие и вести к понятному действию.',
		layout: 'title-image-content',
		backgroundColor: '#faf8f5',
		backgroundGradient:
			'linear-gradient(135deg, #faf8f5 0%, #f5f0e8 30%, #f0ebe0 60%, #ede8df 100%)',
		textColor: '#3d2e1f',
		titleColor: '#ad8b56',
		contentColor: '#5a4a3a',
		titleAlign: 'center',
		textAlign: 'center',
		titleFontSize: '4em',
		contentFontSize: '1.7em',
		lineHeight: '1.85',
		transition: 'fade',
		imagePosition: 'top',
		imageSize: 'large',
		image: ollentiPhilosophyImage,
	},
	{
		id: (Date.now() + 3).toString(),
		title: 'Наши услуги',
		content:
			'✨ Консультации\n\n🎓 Мастер-классы\n\n🛍️ Каталог предложений\n\n💼 Корпоративные форматы',
		layout: 'title-image-content',
		backgroundColor: '#ffffff',
		backgroundGradient:
			'linear-gradient(135deg, #ffffff 0%, #faf8f5 40%, #f5f0e8 80%, #f0ebe0 100%)',
		textColor: '#3d2e1f',
		titleColor: '#ad8b56',
		contentColor: '#5a4a3a',
		titleAlign: 'center',
		textAlign: 'center',
		titleFontSize: '4em',
		contentFontSize: '1.8em',
		lineHeight: '2.1',
		transition: 'slide',
		imagePosition: 'top',
		imageSize: 'large',
		image: ollentiServicesImage,
	},
	{
		id: (Date.now() + 4).toString(),
		title: 'Почему выбирают нас',
		content:
			'• Индивидуальный подход к каждому клиенту\n• Проработанные предложения под задачу\n• Прозрачные условия и сроки\n• Профессиональные консультации\n• Сопровождение от идеи до результата',
		layout: 'title-image-content',
		backgroundColor: '#faf8f5',
		backgroundGradient:
			'linear-gradient(135deg, #faf8f5 0%, #f5f0e8 35%, #f0ebe0 70%, #ede8df 100%)',
		textColor: '#3d2e1f',
		titleColor: '#ad8b56',
		contentColor: '#5a4a3a',
		titleAlign: 'center',
		textAlign: 'left',
		titleFontSize: '4em',
		contentFontSize: '1.7em',
		lineHeight: '2.1',
		transition: 'fade',
		imagePosition: 'top',
		imageSize: 'large',
		image: ollentiQualityImage,
	},
	{
		id: (Date.now() + 5).toString(),
		title: 'Свяжитесь с нами',
		content:
			'Мы всегда рады помочь вам презентовать ваш проект\n\n📧 Email: укажите ваш адрес\n\n🌐 Сайт: укажите адрес сайта\n\n💬 Консультации, услуги или каталог',
		layout: 'title-image-content',
		backgroundColor: '#1a1612',
		backgroundGradient:
			'linear-gradient(135deg, #1a1612 0%, #2d2419 40%, #3d2e1f 70%, #4a3a2a 100%)',
		textColor: '#f5f0e8',
		titleColor: '#d4af7a',
		contentColor: '#e8ddd0',
		titleAlign: 'center',
		textAlign: 'center',
		titleFontSize: '4em',
		contentFontSize: '1.8em',
		lineHeight: '2',
		transition: 'fade',
		imagePosition: 'top',
		imageSize: 'large',
		image: ollentiContactImage,
	},
];

// Премиальная презентация в стиле Олленти2 - расширенная версия с разнообразием
export const ollenti2PresentationTemplate: PresentationSlide[] = [
	{
		id: Date.now().toString(),
		title: 'Demo Brand',
		content:
			'Премиум. Элегантность. Мастерство.\n\nСоздаем будущее уже сегодня',
		layout: 'title-content',
		backgroundColor: '#1a1612',
		backgroundGradient:
			'linear-gradient(135deg, #1a1612 0%, #2d2419 20%, #3d2e1f 40%, #4a3a2a 60%, #5a4a3a 80%, #6a5a4a 100%)',
		textColor: '#f5f0e8',
		titleColor: '#d4af7a',
		contentColor: '#e8ddd0',
		titleAlign: 'center',
		textAlign: 'center',
		titleFontSize: '10em',
		contentFontSize: '3.5em',
		lineHeight: '1.3',
		transition: 'fade',
		imagePosition: 'top',
		imageSize: 'large',
	},
	{
		id: (Date.now() + 1).toString(),
		title: 'О нас',
		content:
			'Мы создаем премиальные решения, сочетающие традиционное мастерство с современными технологиями.\n\nНаша миссия — воплощать элегантность и совершенство в каждом проекте.\n\nС 2015 года мы помогаем компаниям достигать новых высот.',
		layout: 'image-content',
		backgroundColor: '#ffffff',
		backgroundGradient:
			'linear-gradient(135deg, #ffffff 0%, #faf8f5 15%, #f5f0e8 30%, #f0ebe0 50%, #ede8df 70%, #e8ddd0 90%, #e3d8c5 100%)',
		textColor: '#3d2e1f',
		titleColor: '#ad8b56',
		contentColor: '#5a4a3a',
		titleAlign: 'center',
		textAlign: 'center',
		titleFontSize: '7.5em',
		contentFontSize: '2.8em',
		lineHeight: '1.8',
		transition: 'slide',
		imagePosition: 'top',
		imageSize: 'large',
	},
	{
		id: (Date.now() + 2).toString(),
		title: 'Наша философия',
		content:
			'✨ Качество превыше всего\n\n💎 Мы верим в силу деталей, в красоту простоты и в ценность времени.\n\n🎨 Каждый проект — это произведение искусства, созданное с любовью и вниманием к мелочам.\n\n🌟 Мы не просто выполняем задачи — мы создаем ценности.',
		layout: 'title-content',
		backgroundColor: '#faf8f5',
		backgroundGradient:
			'linear-gradient(135deg, #faf8f5 0%, #f5f0e8 15%, #f0ebe0 35%, #ede8df 55%, #e8ddd0 75%, #e3d8c5 95%, #ded3c0 100%)',
		textColor: '#3d2e1f',
		titleColor: '#ad8b56',
		contentColor: '#5a4a3a',
		titleAlign: 'center',
		textAlign: 'center',
		titleFontSize: '7em',
		contentFontSize: '2.6em',
		lineHeight: '2',
		transition: 'fade',
		imagePosition: 'top',
		imageSize: 'large',
	},
	{
		id: (Date.now() + 3).toString(),
		title: 'Наши ценности',
		content:
			'✨ Премиальное качество\n\n🎯 Индивидуальный подход\n\n💎 Эксклюзивность\n\n🏆 Профессионализм\n\n🌟 Инновации',
		layout: 'title-image-content',
		backgroundColor: '#ffffff',
		backgroundGradient:
			'linear-gradient(135deg, #ffffff 0%, #faf8f5 30%, #f5f0e8 60%, #f0ebe0 90%, #ede8df 100%)',
		textColor: '#3d2e1f',
		titleColor: '#ad8b56',
		contentColor: '#5a4a3a',
		titleAlign: 'center',
		textAlign: 'center',
		titleFontSize: '5.5em',
		contentFontSize: '2.2em',
		lineHeight: '2.3',
		transition: 'slide',
		imagePosition: 'top',
		imageSize: 'large',
	},
	{
		id: (Date.now() + 4).toString(),
		title: 'Наши услуги',
		content:
			'🎨 Консалтинг и стратегия\n\n💼 Бизнес-решения\n\n🎓 Обучение и развитие\n\n🛍️ Премиум-продукты\n\n🌟 Эксклюзивные проекты',
		layout: 'image-content',
		backgroundColor: '#faf8f5',
		backgroundGradient:
			'linear-gradient(135deg, #faf8f5 0%, #f5f0e8 25%, #f0ebe0 50%, #ede8df 75%, #e8ddd0 100%)',
		textColor: '#3d2e1f',
		titleColor: '#ad8b56',
		contentColor: '#5a4a3a',
		titleAlign: 'center',
		textAlign: 'center',
		titleFontSize: '6.5em',
		contentFontSize: '2.5em',
		lineHeight: '2.3',
		transition: 'slide',
		imagePosition: 'top',
		imageSize: 'large',
	},
	{
		id: (Date.now() + 5).toString(),
		title: 'Почему выбирают нас',
		content:
			'🎯 Эксклюзивный подход к каждому клиенту\n\n💎 Премиальное качество во всех деталях\n\n👥 Опыт и профессионализм команды\n\n🚀 Инновационные решения\n\n✅ Гарантированный результат\n\n⏱️ Соблюдение сроков\n\n🤝 Долгосрочное партнерство',
		layout: 'title-content',
		backgroundColor: '#ffffff',
		backgroundGradient:
			'linear-gradient(135deg, #ffffff 0%, #faf8f5 30%, #f5f0e8 60%, #f0ebe0 90%, #ede8df 100%)',
		textColor: '#3d2e1f',
		titleColor: '#ad8b56',
		contentColor: '#5a4a3a',
		titleAlign: 'center',
		textAlign: 'center',
		titleFontSize: '7.5em',
		contentFontSize: '2.8em',
		lineHeight: '2.4',
		transition: 'fade',
		imagePosition: 'top',
		imageSize: 'large',
	},
	{
		id: (Date.now() + 6).toString(),
		title: 'Наш процесс',
		content:
			'1️⃣ Анализ и понимание\n\n2️⃣ Разработка концепции\n\n3️⃣ Реализация проекта\n\n4️⃣ Контроль качества\n\n5️⃣ Поддержка и развитие',
		layout: 'title-content',
		backgroundColor: '#faf8f5',
		backgroundGradient:
			'linear-gradient(135deg, #faf8f5 0%, #f5f0e8 30%, #f0ebe0 60%, #ede8df 90%, #e8ddd0 100%)',
		textColor: '#3d2e1f',
		titleColor: '#ad8b56',
		contentColor: '#5a4a3a',
		titleAlign: 'center',
		textAlign: 'center',
		titleFontSize: '5.5em',
		contentFontSize: '2.1em',
		lineHeight: '2.2',
		transition: 'slide',
		imagePosition: 'top',
		imageSize: 'large',
	},
	{
		id: (Date.now() + 7).toString(),
		title: 'Наши достижения',
		content:
			'🏆 Более 1000 успешных проектов\n\n⭐ 98% довольных клиентов\n\n💎 Премиальные награды\n\n🌟 Признание индустрии\n\n🎯 Лидерство в качестве',
		layout: 'image-content',
		backgroundColor: '#ffffff',
		backgroundGradient:
			'linear-gradient(135deg, #ffffff 0%, #faf8f5 25%, #f5f0e8 50%, #f0ebe0 75%, #ede8df 100%)',
		textColor: '#3d2e1f',
		titleColor: '#ad8b56',
		contentColor: '#5a4a3a',
		titleAlign: 'center',
		textAlign: 'center',
		titleFontSize: '6.5em',
		contentFontSize: '2.5em',
		lineHeight: '2.3',
		transition: 'fade',
		imagePosition: 'top',
		imageSize: 'large',
	},
	{
		id: (Date.now() + 8).toString(),
		title: 'Наша команда',
		content:
			'👥 Профессионалы с многолетним опытом\n\n🎓 Эксперты в своих областях\n\n💪 Преданные своему делу\n\n✨ Стремящиеся к совершенству\n\n🤝 Готовые помочь вам достичь цели',
		layout: 'title-image-content',
		backgroundColor: '#faf8f5',
		backgroundGradient:
			'linear-gradient(135deg, #faf8f5 0%, #f5f0e8 20%, #f0ebe0 40%, #ede8df 60%, #e8ddd0 80%, #e3d8c5 100%)',
		textColor: '#3d2e1f',
		titleColor: '#ad8b56',
		contentColor: '#5a4a3a',
		titleAlign: 'center',
		textAlign: 'center',
		titleFontSize: '5.5em',
		contentFontSize: '2.1em',
		lineHeight: '2',
		transition: 'slide',
		imagePosition: 'top',
		imageSize: 'large',
	},
	{
		id: (Date.now() + 9).toString(),
		title: 'Клиенты о нас',
		content:
			'💬 "Исключительное качество и внимание к деталям"\n\n💬 "Профессионализм на высшем уровне"\n\n💬 "Превзошли все ожидания"\n\n💬 "Рекомендуем без сомнений"',
		layout: 'title-content',
		backgroundColor: '#ffffff',
		backgroundGradient:
			'linear-gradient(135deg, #ffffff 0%, #faf8f5 35%, #f5f0e8 70%, #f0ebe0 100%)',
		textColor: '#3d2e1f',
		titleColor: '#ad8b56',
		contentColor: '#5a4a3a',
		titleAlign: 'center',
		textAlign: 'center',
		titleFontSize: '5.5em',
		contentFontSize: '2em',
		lineHeight: '2.1',
		transition: 'fade',
		imagePosition: 'top',
		imageSize: 'large',
	},
	{
		id: (Date.now() + 10).toString(),
		title: 'Партнеры',
		content:
			'🤝 Мы сотрудничаем с ведущими компаниями\n\n💼 Доверие и надежность\n\n📈 Долгосрочные отношения\n\n💎 Взаимная выгода\n\n🚀 Совместный рост',
		layout: 'image-content',
		backgroundColor: '#faf8f5',
		backgroundGradient:
			'linear-gradient(135deg, #faf8f5 0%, #f5f0e8 25%, #f0ebe0 50%, #ede8df 75%, #e8ddd0 100%)',
		textColor: '#3d2e1f',
		titleColor: '#ad8b56',
		contentColor: '#5a4a3a',
		titleAlign: 'center',
		textAlign: 'center',
		titleFontSize: '5em',
		contentFontSize: '2.1em',
		lineHeight: '2.1',
		transition: 'slide',
		imagePosition: 'top',
		imageSize: 'large',
	},
	{
		id: (Date.now() + 11).toString(),
		title: 'Свяжитесь с нами',
		content:
			'Мы готовы обсудить ваш проект\n\n📧 Email: укажите ваш адрес\n\n🌐 Сайт: укажите адрес сайта\n\n💬 Связь, консультации и встречи\n\n✨ Настройте этот шаблон под свой бренд\n\n🚀 Начните с базовой структуры',
		layout: 'title-content',
		backgroundColor: '#1a1612',
		backgroundGradient:
			'linear-gradient(135deg, #1a1612 0%, #2d2419 20%, #3d2e1f 40%, #4a3a2a 60%, #5a4a3a 80%, #6a5a4a 100%)',
		textColor: '#f5f0e8',
		titleColor: '#d4af7a',
		contentColor: '#e8ddd0',
		titleAlign: 'center',
		textAlign: 'center',
		titleFontSize: '8em',
		contentFontSize: '3em',
		lineHeight: '2.1',
		transition: 'fade',
		imagePosition: 'top',
		imageSize: 'large',
	},
];
