import { Button } from '@components/atoms/Button';
import { Input } from '@components/atoms/Input';
import { Textarea } from '@components/atoms/Textarea';
import {
    useCreatePresentation,
    usePresentation,
    useUpdatePresentation,
    type Presentation,
    type PresentationSlide,
} from '@services/api/presentations';
import { uploadImage } from '@services/api/upload';
import { getUploadedImageUrl } from '@utils/imageUrl';
import {
    ArrowDown,
    ArrowLeft,
    ArrowRight,
    ArrowUp,
    BarChart3,
    Copy,
    Eye,
    GripVertical,
    Loader2,
    Maximize2,
    Minimize2,
    Palette,
    Plus,
    Redo,
    Save,
    Search,
    Settings,
    Trash2,
    Type,
    Undo,
    X,
    Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import './presentation.css';

const OLLENTI_TEMPLATE_IMAGES = {
  hero: '/uploads/content/about-hero-atelier.webp',
  about: '/uploads/content/home-about-preview-portrait.webp',
  philosophy: '/uploads/content/about-philosophy-ingredients.webp',
  services: '/uploads/services/masterclass-1.webp',
  quality: '/uploads/services/consultation-3.webp',
  contact: '/uploads/services/masterclass-4.webp',
} as const;

const defaultSlide: PresentationSlide = {
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

// Предустановленные цветовые схемы
const colorSchemes = [
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
];

// Градиенты для фона
const backgroundGradients = [
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
];

// Шаблоны слайдов
const slideTemplates = [
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
];

// Готовая презентация в стиле Demo Brand 1
const ollentiPresentationTemplate: PresentationSlide[] = [
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
    image: OLLENTI_TEMPLATE_IMAGES.hero,
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
    image: OLLENTI_TEMPLATE_IMAGES.about,
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
    image: OLLENTI_TEMPLATE_IMAGES.philosophy,
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
    image: OLLENTI_TEMPLATE_IMAGES.services,
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
    image: OLLENTI_TEMPLATE_IMAGES.quality,
  },
  {
    id: (Date.now() + 5).toString(),
    title: 'Свяжитесь с нами',
    content:
      'Мы всегда рады помочь вам презентовать ваш проект\n\n📧 Email: hello@example.com\n\n🌐 Сайт: example.com\n\n💬 Консультации, услуги или каталог',
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
    image: OLLENTI_TEMPLATE_IMAGES.contact,
  },
];

// Премиальная презентация в стиле Олленти2 - расширенная версия с разнообразием
const ollenti2PresentationTemplate: PresentationSlide[] = [
  {
    id: Date.now().toString(),
    title: 'Demo Brand',
    content: 'Премиум. Элегантность. Мастерство.\n\nСоздаем будущее уже сегодня',
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
      'Мы готовы обсудить ваш проект\n\n📧 Email: hello@example.com\n\n🌐 Сайт: example.com\n\n💬 Связь, консультации и встречи\n\n✨ Настройте этот шаблон под свой бренд\n\n🚀 Начните с базовой структуры',
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

export const PresentationEditPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === 'new';

  const { data: presentationData, isLoading: isLoadingPresentation } = usePresentation(
    isNew ? '' : id || ''
  );
  const createPresentation = useCreatePresentation();
  const updatePresentation = useUpdatePresentation();

  const [title, setTitle] = useState('');
  const [format, setFormat] = useState<'classic' | 'modern' | 'minimal' | 'ollenti' | 'ollenti2'>(
    'classic'
  );
  const [slides, setSlides] = useState<PresentationSlide[]>([{ ...defaultSlide }]);
  const [isPublished, setIsPublished] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedSlideIndex, setSelectedSlideIndex] = useState(0);
  const [uploadingImageIndex, setUploadingImageIndex] = useState<number | null>(null);
  const [activeSettingsTab, setActiveSettingsTab] = useState<
    'basic' | 'typography' | 'colors' | 'image'
  >('basic');
  const [copiedStyle, setCopiedStyle] = useState<Partial<PresentationSlide> | null>(null);
  const [isFullscreenPreview, setIsFullscreenPreview] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [history, setHistory] = useState<PresentationSlide[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [slideSearchQuery, setSlideSearchQuery] = useState('');
  const [draggedSlideIndex, setDraggedSlideIndex] = useState<number | null>(null);
  const [previewSlideIndex, setPreviewSlideIndex] = useState(0);
  const [ollentiTemplateInitialized, setOllentiTemplateInitialized] = useState(false);
  const [ollenti2TemplateInitialized, setOllenti2TemplateInitialized] = useState(false);

  // Автосохранение черновика в localStorage
  const DRAFT_STORAGE_KEY = `presentation_draft_${id || 'new'}`;

  useEffect(() => {
    if (isNew) {
      // Загружаем черновик для новой презентации
      const draft = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (draft) {
        try {
          const parsed = JSON.parse(draft);
          if (parsed.title) setTitle(parsed.title);
          if (parsed.format) setFormat(parsed.format);
          if (parsed.slides && parsed.slides.length > 0) {
            setSlides(parsed.slides);
            setHistory([parsed.slides]);
            setHistoryIndex(0);
          }
        } catch (error) {
          console.error('Failed to load draft:', error);
        }
      }
    }
  }, [isNew, DRAFT_STORAGE_KEY]);

  useEffect(() => {
    // Автосохранение черновика каждые 5 секунд
    const draftSaveInterval = setInterval(() => {
      if (title || slides.some((s) => s.title || s.content)) {
        const draft = {
          title,
          format,
          slides,
          updatedAt: new Date().toISOString(),
        };
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
      }
    }, 5000);

    return () => clearInterval(draftSaveInterval);
  }, [title, format, slides, DRAFT_STORAGE_KEY]);

  // Очистка черновика после успешного сохранения
  useEffect(() => {
    if (!isNew && id) {
      localStorage.removeItem(`presentation_draft_new`);
      localStorage.removeItem(`presentation_draft_${id}`);
    }
  }, [isNew, id]);

  useEffect(() => {
    if (isNew || !presentationData) return;

    setTitle(presentationData.title);
    setFormat(presentationData.format);
    const initialSlides =
      presentationData.slides.length > 0 ? presentationData.slides : [{ ...defaultSlide }];
    setSlides(initialSlides);
    setIsPublished(presentationData.isPublished);
    // Инициализируем историю
    setHistory([initialSlides]);
    setHistoryIndex(0);
  }, [presentationData, isNew]);

  // Инициализация шаблона Олленти при выборе формата
  useEffect(() => {
    if (
      isNew &&
      format === 'ollenti' &&
      !ollentiTemplateInitialized &&
      slides.length === 1 &&
      !slides[0].title
    ) {
      const templateSlides = ollentiPresentationTemplate.map((slide, index) => ({
        ...slide,
        id: (Date.now() + index).toString() + Math.random().toString(36).substr(2, 9),
      }));
      setSlides(templateSlides);
      if (!title) setTitle('Презентация Demo Brand 1');
      setHistory([templateSlides]);
      setHistoryIndex(0);
      setOllentiTemplateInitialized(true);
    }
    if (format !== 'ollenti') {
      setOllentiTemplateInitialized(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [format, isNew]);

  // Инициализация шаблона Олленти2 при выборе формата
  useEffect(() => {
    if (
      isNew &&
      format === 'ollenti2' &&
      !ollenti2TemplateInitialized &&
      slides.length === 1 &&
      !slides[0].title
    ) {
      const templateSlides = ollenti2PresentationTemplate.map((slide, index) => ({
        ...slide,
        id: (Date.now() + index).toString() + Math.random().toString(36).substr(2, 9),
      }));
      setSlides(templateSlides);
      if (!title) setTitle('Презентация Demo Brand 2');
      setHistory([templateSlides]);
      setHistoryIndex(0);
      setOllenti2TemplateInitialized(true);
    }
    if (format !== 'ollenti2') {
      setOllenti2TemplateInitialized(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [format, isNew]);

  // Сохранение в историю при изменении слайдов
  useEffect(() => {
    if (historyIndex === -1 || history.length === 0) return; // Пропускаем начальную инициализацию

    // Сравниваем по содержимому, а не по ссылке
    const currentHistory = history[historyIndex];
    if (
      currentHistory.length === slides.length &&
      currentHistory.every(
        (slide, index) =>
          slide.id === slides[index]?.id &&
          slide.title === slides[index]?.title &&
          slide.content === slides[index]?.content &&
          slide.layout === slides[index]?.layout
      )
    ) {
      return; // Нет изменений
    }

    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(slides.map((slide) => ({ ...slide })));
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);

    // Ограничиваем историю 50 шагами
    if (newHistory.length > 50) {
      setHistory(newHistory.slice(-50));
      setHistoryIndex(49);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slides]);

  // Undo/Redo
  const handleUndo = useCallback(() => {
    if (historyIndex > 0 && history.length > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setSlides(history[newIndex].map((slide) => ({ ...slide })));
      setSelectedSlideIndex((currentIndex) => {
        if (currentIndex >= history[newIndex].length) {
          return Math.max(0, history[newIndex].length - 1);
        }
        return currentIndex;
      });
    }
  }, [history, historyIndex]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1 && history.length > 0) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setSlides(history[newIndex].map((slide) => ({ ...slide })));
      setSelectedSlideIndex((currentIndex) => {
        if (currentIndex >= history[newIndex].length) {
          return Math.max(0, history[newIndex].length - 1);
        }
        return currentIndex;
      });
    }
  }, [history, historyIndex]);

  const handleAddSlide = () => {
    const newSlide: PresentationSlide = {
      ...defaultSlide,
      id: Date.now().toString(),
    };
    setSlides([...slides, newSlide]);
    setSelectedSlideIndex(slides.length);
  };

  // Drag & Drop handlers
  const handleDragStart = (index: number) => {
    setDraggedSlideIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedSlideIndex === null || draggedSlideIndex === index) return;

    const newSlides = [...slides];
    const draggedSlide = newSlides[draggedSlideIndex];
    newSlides.splice(draggedSlideIndex, 1);
    const insertIndex = draggedSlideIndex < index ? index - 1 : index;
    newSlides.splice(insertIndex, 0, draggedSlide);
    setSlides(newSlides);
    setDraggedSlideIndex(insertIndex);
    setSelectedSlideIndex(insertIndex);
  };

  const handleDragEnd = () => {
    setDraggedSlideIndex(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDraggedSlideIndex(null);
  };

  // Статистика презентации
  const getPresentationStats = useCallback(() => {
    const totalSlides = slides.length;
    const totalWords = slides.reduce((acc, slide) => {
      const text = `${slide.title || ''} ${slide.content || ''}`;
      return (
        acc +
        text
          .trim()
          .split(/\s+/)
          .filter((w) => w.length > 0).length
      );
    }, 0);
    const totalChars = slides.reduce((acc, slide) => {
      const text = `${slide.title || ''} ${slide.content || ''}`;
      return acc + text.length;
    }, 0);
    const slidesWithImages = slides.filter((slide) => slide.image).length;
    const slidesWithContent = slides.filter((slide) => slide.title || slide.content).length;

    return {
      totalSlides,
      totalWords,
      totalChars,
      slidesWithImages,
      slidesWithContent,
      emptySlides: totalSlides - slidesWithContent,
    };
  }, [slides]);

  // Статистика для текущего слайда
  const getSlideStats = useCallback((slide: PresentationSlide) => {
    const text = `${slide.title || ''} ${slide.content || ''}`;
    const words = text
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 0).length;
    const chars = text.length;
    const charsNoSpaces = text.replace(/\s/g, '').length;

    return { words, chars, charsNoSpaces };
  }, []);

  // Дублирование презентации
  const handleDuplicatePresentation = useCallback(async () => {
    if (!id || !presentationData) return;

    if (!window.confirm('Создать копию этой презентации?')) return;

    try {
      const duplicatedPresentation: Partial<Presentation> = {
        title: `${presentationData.title} (копия)`,
        format: presentationData.format,
        slides: presentationData.slides.map((slide) => ({
          ...slide,
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        })),
        isPublished: false,
      };

      const result = await createPresentation.mutateAsync(duplicatedPresentation);
      navigate(`/admin/presentations/${result.id}`);
    } catch (error) {
      console.error('Failed to duplicate presentation:', error);
      alert('Ошибка при создании копии презентации');
    }
  }, [id, presentationData, createPresentation, navigate]);

  const handleDeleteSlide = useCallback((index: number) => {
    setSlides((currentSlides) => {
      if (currentSlides.length === 1) {
        if (
          !window.confirm(
            'Нельзя удалить последний слайд. Презентация должна содержать хотя бы один слайд.'
          )
        ) {
          return currentSlides;
        }
        return currentSlides;
      }
      if (window.confirm(`Удалить слайд ${index + 1}?`)) {
        const newSlides = currentSlides.filter((_, i) => i !== index);
        setSelectedSlideIndex((currentIndex) => {
          if (currentIndex >= newSlides.length) {
            return newSlides.length - 1;
          }
          return currentIndex;
        });
        return newSlides;
      }
      return currentSlides;
    });
  }, []);

  const handleMoveSlide = (index: number, direction: 'up' | 'down') => {
    const newSlides = [...slides];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= slides.length) return;
    [newSlides[index], newSlides[targetIndex]] = [newSlides[targetIndex], newSlides[index]];
    setSlides(newSlides);
    setSelectedSlideIndex(targetIndex);
  };

  const handleDuplicateSlide = useCallback((index: number) => {
    setSlides((currentSlides) => {
      const slideToCopy = currentSlides[index];
      const newSlide: PresentationSlide = {
        ...slideToCopy,
        id: Date.now().toString(),
      };
      const newSlides = [...currentSlides];
      newSlides.splice(index + 1, 0, newSlide);
      setSelectedSlideIndex(index + 1);
      return newSlides;
    });
  }, []);

  const handleSlideChange = (
    index: number,
    field: keyof PresentationSlide,
    value: string | undefined
  ) => {
    const newSlides = [...slides];
    newSlides[index] = { ...newSlides[index], [field]: value };
    setSlides(newSlides);
  };

  const handleApplyColorScheme = (scheme: (typeof colorSchemes)[0]) => {
    const newSlides = [...slides];
    newSlides[selectedSlideIndex] = {
      ...newSlides[selectedSlideIndex],
      backgroundColor: scheme.backgroundColor,
      textColor: scheme.textColor,
      titleColor: scheme.titleColor,
      contentColor: scheme.contentColor,
    };
    setSlides(newSlides);
  };

  const handleCopyStyle = () => {
    const slide = slides[selectedSlideIndex];
    const style: Partial<PresentationSlide> = {
      backgroundColor: slide.backgroundColor,
      backgroundGradient: slide.backgroundGradient,
      textColor: slide.textColor,
      titleColor: slide.titleColor,
      contentColor: slide.contentColor,
      titleFontSize: slide.titleFontSize,
      contentFontSize: slide.contentFontSize,
      textAlign: slide.textAlign,
      titleAlign: slide.titleAlign,
      fontFamily: slide.fontFamily,
      lineHeight: slide.lineHeight,
      transition: slide.transition,
    };
    setCopiedStyle(style);
  };

  const handlePasteStyle = () => {
    if (!copiedStyle) return;
    const newSlides = [...slides];
    newSlides[selectedSlideIndex] = {
      ...newSlides[selectedSlideIndex],
      ...copiedStyle,
    };
    setSlides(newSlides);
  };

  const handleApplyTemplate = (template: (typeof slideTemplates)[0]) => {
    const newSlides = [...slides];
    newSlides[selectedSlideIndex] = {
      ...newSlides[selectedSlideIndex],
      ...template.slide,
      id: newSlides[selectedSlideIndex].id,
      title: newSlides[selectedSlideIndex].title || '',
      content: newSlides[selectedSlideIndex].content || '',
      image: newSlides[selectedSlideIndex].image,
    };
    setSlides(newSlides);
  };

  // Автосохранение
  const autoSave = useCallback(async () => {
    if (isNew || !id) return;

    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    autoSaveTimeoutRef.current = setTimeout(async () => {
      setAutoSaveStatus('saving');
      try {
        await updatePresentation.mutateAsync({
          id: id!,
          title: title.trim(),
          format,
          slides,
          isPublished,
        });
        setAutoSaveStatus('saved');
        setTimeout(() => setAutoSaveStatus('idle'), 2000);
      } catch (error) {
        console.error('Auto-save failed:', error);
        setAutoSaveStatus('idle');
      }
    }, 2000); // Сохраняем через 2 секунды после последнего изменения
  }, [id, isNew, title, format, slides, isPublished, updatePresentation]);

  useEffect(() => {
    if (!isNew && id) {
      autoSave();
    }
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [title, format, slides, isPublished, isNew, id, autoSave]);

  // Горячие клавиши
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Игнорируем, если пользователь вводит текст в поле ввода
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable)
      ) {
        return;
      }

      // Ctrl/Cmd + S - сохранить
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (!isSaving) {
          const form = document.querySelector('form');
          if (form) {
            form.requestSubmit();
          }
        }
      }

      // Ctrl/Cmd + D - дублировать слайд
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        handleDuplicateSlide(selectedSlideIndex);
      }

      // Delete - удалить слайд
      if (e.key === 'Delete') {
        e.preventDefault();
        if (slides.length > 1) {
          handleDeleteSlide(selectedSlideIndex);
        }
      }

      // Стрелки вверх/вниз - переключение слайдов
      if (e.key === 'ArrowUp' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (selectedSlideIndex > 0) {
          setSelectedSlideIndex(selectedSlideIndex - 1);
        }
      }
      if (e.key === 'ArrowDown' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (selectedSlideIndex < slides.length - 1) {
          setSelectedSlideIndex(selectedSlideIndex + 1);
        }
      }

      // F - полноэкранный предпросмотр
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        setIsFullscreenPreview(!isFullscreenPreview);
      }

      // Escape - закрыть полноэкранный предпросмотр
      if (e.key === 'Escape' && isFullscreenPreview) {
        e.preventDefault();
        setIsFullscreenPreview(false);
      }

      // Ctrl/Cmd + Z - отменить
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }

      // Ctrl/Cmd + Shift + Z или Ctrl/Cmd + Y - повторить
      if (
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z') ||
        ((e.ctrlKey || e.metaKey) && e.key === 'y')
      ) {
        e.preventDefault();
        handleRedo();
      }

      // Стрелки влево/вправо для навигации по слайдам в предпросмотре
      if (isFullscreenPreview && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        if (e.key === 'ArrowLeft' && previewSlideIndex > 0) {
          e.preventDefault();
          setPreviewSlideIndex(previewSlideIndex - 1);
        }
        if (e.key === 'ArrowRight' && previewSlideIndex < slides.length - 1) {
          e.preventDefault();
          setPreviewSlideIndex(previewSlideIndex + 1);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    selectedSlideIndex,
    slides.length,
    isSaving,
    isFullscreenPreview,
    previewSlideIndex,
    handleDuplicateSlide,
    handleDeleteSlide,
    handleUndo,
    handleRedo,
  ]);

  const handleImageUpload = async (slideIndex: number, file: File) => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Пожалуйста, выберите файл изображения');
      return;
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      alert('Размер файла не должен превышать 10 МБ');
      return;
    }

    setUploadingImageIndex(slideIndex);
    try {
      const url = await uploadImage(file);
      handleSlideChange(slideIndex, 'image', url);
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Ошибка загрузки изображения. Пожалуйста, попробуйте еще раз.');
    } finally {
      setUploadingImageIndex(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!title.trim()) {
      alert('Пожалуйста, введите название презентации');
      return;
    }

    if (slides.length === 0) {
      alert('Презентация должна содержать хотя бы один слайд');
      return;
    }

    // Validate slides
    const hasEmptySlides = slides.some(
      (slide) =>
        !slide.title?.trim() &&
        !slide.content?.trim() &&
        !slide.image &&
        slide.layout !== 'full-image'
    );

    if (hasEmptySlides) {
      if (!window.confirm('Некоторые слайды пустые. Продолжить сохранение?')) {
        return;
      }
    }

    setIsSaving(true);

    try {
      const presentationData: Partial<Presentation> = {
        title: title.trim(),
        format,
        slides,
        isPublished,
      };

      if (isNew) {
        const result = await createPresentation.mutateAsync(presentationData);
        // Очищаем черновик после успешного сохранения
        localStorage.removeItem(DRAFT_STORAGE_KEY);
        navigate(`/admin/presentations/${result.id}`);
      } else {
        await updatePresentation.mutateAsync({ id: id!, ...presentationData });
        // Очищаем черновик после успешного сохранения
        localStorage.removeItem(DRAFT_STORAGE_KEY);
      }
    } catch (error) {
      console.error('Failed to save presentation:', error);
      alert('Ошибка сохранения презентации. Пожалуйста, попробуйте еще раз.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoadingPresentation && !isNew) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-900/30 dark:to-blue-800/20 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        </div>
        <p className="text-neutral-500 dark:text-slate-400 text-sm">Загрузка презентации...</p>
      </div>
    );
  }

  const selectedSlide = slides[selectedSlideIndex];

  return (
    <form onSubmit={handleSubmit} className="pb-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-display font-semibold text-neutral-900 dark:text-white flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/30 dark:to-blue-800/20 rounded-xl">
              <span className="text-blue-600 dark:text-blue-400 text-xl">📊</span>
            </div>
            {isNew ? 'Создание презентации' : 'Редактирование презентации'}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {!isNew && presentationData && (
            <a
              href={`/presentations/${presentationData.slug}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline" type="button">
                <Eye size={16} className="mr-1" />
                Просмотр
              </Button>
            </a>
          )}
          <Button variant="ghost" type="button" onClick={() => navigate('/admin/presentations')}>
            Отмена
          </Button>
          {!isNew && presentationData && (
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={handleDuplicatePresentation}
              title="Создать копию презентации"
            >
              <Copy size={16} className="mr-1" />
              Дублировать
            </Button>
          )}
          <div className="flex items-center gap-3">
            {!isNew && (
              <div className="text-xs text-neutral-500 dark:text-slate-400 flex items-center gap-1.5">
                {autoSaveStatus === 'saving' && (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    <span>Сохранение...</span>
                  </>
                )}
                {autoSaveStatus === 'saved' && (
                  <>
                    <Save size={12} />
                    <span className="text-emerald-600 dark:text-emerald-400">Сохранено</span>
                  </>
                )}
              </div>
            )}
            <div className="text-xs text-neutral-400 dark:text-slate-500 hidden lg:flex items-center gap-1">
              <Zap size={12} />
              <span>Ctrl+S сохранить, Ctrl+D дублировать, Ctrl+Z отменить, F предпросмотр</span>
            </div>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 size={16} className="mr-1 animate-spin" />
                  Сохранение...
                </>
              ) : (
                <>
                  <Save size={16} className="mr-1" />
                  Сохранить
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Editor */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-neutral-200 dark:border-slate-700 shadow-sm p-6">
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">
              Основная информация
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-slate-300 mb-2">
                  Название презентации
                </label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Введите название"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-slate-300 mb-2">
                  Формат презентации
                </label>
                <select
                  value={format}
                  onChange={(e) => {
                    const newFormat = e.target.value as typeof format;
                    setFormat(newFormat);
                    // При выборе Олленти инициализируем шаблон, если это новая презентация
                    if (
                      isNew &&
                      newFormat === 'ollenti' &&
                      !ollentiTemplateInitialized &&
                      slides.length === 1 &&
                      !slides[0].title
                    ) {
                      const templateSlides = ollentiPresentationTemplate.map((slide, index) => ({
                        ...slide,
                        id:
                          (Date.now() + index).toString() + Math.random().toString(36).substr(2, 9),
                      }));
                      setSlides(templateSlides);
                      if (!title) setTitle('Презентация Demo Brand 1');
                      setHistory([templateSlides]);
                      setHistoryIndex(0);
                      setOllentiTemplateInitialized(true);
                    }
                    // При выборе Олленти2 инициализируем шаблон, если это новая презентация
                    if (
                      isNew &&
                      newFormat === 'ollenti2' &&
                      !ollenti2TemplateInitialized &&
                      slides.length === 1 &&
                      !slides[0].title
                    ) {
                      const templateSlides = ollenti2PresentationTemplate.map((slide, index) => ({
                        ...slide,
                        id:
                          (Date.now() + index).toString() + Math.random().toString(36).substr(2, 9),
                      }));
                      setSlides(templateSlides);
                      if (!title) setTitle('Презентация Demo Brand 2');
                      setHistory([templateSlides]);
                      setHistoryIndex(0);
                      setOllenti2TemplateInitialized(true);
                    }
                  }}
                  aria-label="Формат презентации"
                  className="w-full rounded-xl border border-neutral-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm text-neutral-700 dark:text-slate-300 focus:border-primary-300 dark:focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:focus:ring-primary-900"
                >
                  <option value="classic">Классический</option>
                  <option value="modern">Современный</option>
                  <option value="minimal">Минималистичный</option>
                  <option value="ollenti">Demo Brand 1</option>
                  <option value="ollenti2">Demo Brand 2</option>
                </select>
              </div>
            </div>
          </div>

          {/* Slide Preview */}
          {selectedSlide && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-neutral-200 dark:border-slate-700 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
                  Предпросмотр слайда
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  onClick={() => {
                    setIsFullscreenPreview(!isFullscreenPreview);
                    setPreviewSlideIndex(selectedSlideIndex);
                  }}
                  title="Полноэкранный предпросмотр (F)"
                >
                  {isFullscreenPreview ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                </Button>
              </div>
              <div
                className={`slide-preview-container ${
                  isFullscreenPreview
                    ? 'fixed inset-0 z-50 rounded-none w-screen h-screen'
                    : 'border border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-900'
                } ${(() => {
                  const displaySlide = isFullscreenPreview
                    ? slides[previewSlideIndex] || selectedSlide
                    : selectedSlide;
                  return displaySlide.backgroundGradient ? '[data-bg-gradient]' : '';
                })()}`}
                style={(() => {
                  const displaySlide = isFullscreenPreview
                    ? slides[previewSlideIndex] || selectedSlide
                    : selectedSlide;
                  return {
                    '--preview-bg-color': displaySlide.backgroundColor || '#ffffff',
                    '--preview-text-color': displaySlide.textColor || '#000000',
                    '--preview-bg-gradient': displaySlide.backgroundGradient || undefined,
                    '--preview-content-align': displaySlide.textAlign || 'left',
                  } as React.CSSProperties;
                })()}
              >
                {(() => {
                  const displaySlide = isFullscreenPreview
                    ? slides[previewSlideIndex] || selectedSlide
                    : selectedSlide;
                  return (
                    <>
                      {isFullscreenPreview && (
                        <>
                          <button
                            type="button"
                            onClick={() => setIsFullscreenPreview(false)}
                            className="absolute top-4 right-4 p-2 rounded-lg bg-white/90 dark:bg-slate-800/90 hover:bg-white dark:hover:bg-slate-800 border border-neutral-200 dark:border-slate-700 z-10"
                            title="Закрыть (Esc)"
                          >
                            <X size={20} />
                          </button>
                          {/* Навигация по слайдам в полноэкранном режиме */}
                          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-white/90 dark:bg-slate-800/90 rounded-lg px-4 py-2 border border-neutral-200 dark:border-slate-700 z-10">
                            <button
                              type="button"
                              onClick={() =>
                                setPreviewSlideIndex(Math.max(0, previewSlideIndex - 1))
                              }
                              disabled={previewSlideIndex === 0}
                              className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Предыдущий слайд (←)"
                            >
                              <ArrowLeft size={18} />
                            </button>
                            <span className="text-sm font-medium text-neutral-700 dark:text-slate-300 min-w-[80px] text-center">
                              {previewSlideIndex + 1} / {slides.length}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setPreviewSlideIndex(
                                  Math.min(slides.length - 1, previewSlideIndex + 1)
                                )
                              }
                              disabled={previewSlideIndex === slides.length - 1}
                              className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Следующий слайд (→)"
                            >
                              <ArrowRight size={18} />
                            </button>
                          </div>
                        </>
                      )}
                      {displaySlide.layout === 'full-image' && displaySlide.image ? (
                        <img
                          src={getUploadedImageUrl(displaySlide.image)}
                          alt={displaySlide.title || 'Slide'}
                          className="w-full h-full object-cover rounded-lg"
                        />
                      ) : (
                        <>
                          {displaySlide.title && (
                            <h3
                              className="slide-preview-title"
                              style={
                                {
                                  '--preview-title-font-size':
                                    displaySlide.titleFontSize || '2.5em',
                                  '--preview-title-color':
                                    displaySlide.titleColor || displaySlide.textColor || '#000000',
                                  '--preview-title-align': displaySlide.titleAlign || 'center',
                                } as React.CSSProperties
                              }
                            >
                              {displaySlide.title}
                            </h3>
                          )}
                          {(displaySlide.layout === 'image-content' ||
                            displaySlide.layout === 'title-image-content') &&
                            displaySlide.image && (
                              <img
                                src={getUploadedImageUrl(displaySlide.image)}
                                alt={displaySlide.title || 'Slide'}
                                className={`object-contain mb-4 rounded-lg ${
                                  displaySlide.imageSize === 'small'
                                    ? 'max-h-32'
                                    : displaySlide.imageSize === 'large'
                                      ? 'max-h-64'
                                      : displaySlide.imageSize === 'full'
                                        ? 'w-full h-full'
                                        : 'max-h-48'
                                }`}
                              />
                            )}
                          {displaySlide.content && (
                            <p
                              className="whitespace-pre-wrap slide-preview-content"
                              style={
                                {
                                  '--preview-content-font-size':
                                    displaySlide.contentFontSize || '1.1em',
                                  '--preview-content-color':
                                    displaySlide.contentColor ||
                                    displaySlide.textColor ||
                                    '#000000',
                                  '--preview-content-align': displaySlide.textAlign || 'left',
                                  '--preview-line-height': displaySlide.lineHeight || '1.6',
                                } as React.CSSProperties
                              }
                            >
                              {displaySlide.content}
                            </p>
                          )}
                        </>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Slide Editor */}
          {selectedSlide && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-neutral-200 dark:border-slate-700 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
                  Слайд {selectedSlideIndex + 1} из {slides.length}
                </h2>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    onClick={() => handleMoveSlide(selectedSlideIndex, 'up')}
                    disabled={selectedSlideIndex === 0}
                  >
                    <ArrowUp size={16} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    onClick={() => handleMoveSlide(selectedSlideIndex, 'down')}
                    disabled={selectedSlideIndex === slides.length - 1}
                  >
                    <ArrowDown size={16} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    onClick={() => handleDuplicateSlide(selectedSlideIndex)}
                    title="Дублировать слайд"
                  >
                    <Copy size={16} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    onClick={() => handleDeleteSlide(selectedSlideIndex)}
                    disabled={slides.length === 1}
                    className="text-red-600 hover:text-red-700"
                    title="Удалить слайд"
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              </div>

              {/* Settings Tabs */}
              <div className="mb-4 border-b border-neutral-200 dark:border-slate-700">
                <div className="flex gap-2 overflow-x-auto">
                  <button
                    type="button"
                    onClick={() => setActiveSettingsTab('basic')}
                    className={`px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                      activeSettingsTab === 'basic'
                        ? 'border-b-2 border-primary-500 text-primary-600 dark:text-primary-400'
                        : 'text-neutral-600 dark:text-slate-400 hover:text-neutral-900 dark:hover:text-slate-200'
                    }`}
                  >
                    <Settings size={16} className="inline mr-1.5" />
                    Основные
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveSettingsTab('typography')}
                    className={`px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                      activeSettingsTab === 'typography'
                        ? 'border-b-2 border-primary-500 text-primary-600 dark:text-primary-400'
                        : 'text-neutral-600 dark:text-slate-400 hover:text-neutral-900 dark:hover:text-slate-200'
                    }`}
                  >
                    <Type size={16} className="inline mr-1.5" />
                    Типографика
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveSettingsTab('colors')}
                    className={`px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                      activeSettingsTab === 'colors'
                        ? 'border-b-2 border-primary-500 text-primary-600 dark:text-primary-400'
                        : 'text-neutral-600 dark:text-slate-400 hover:text-neutral-900 dark:hover:text-slate-200'
                    }`}
                  >
                    <Palette size={16} className="inline mr-1.5" />
                    Цвета
                  </button>
                  {(selectedSlide.layout === 'image-content' ||
                    selectedSlide.layout === 'title-image-content' ||
                    selectedSlide.layout === 'full-image') && (
                    <button
                      type="button"
                      onClick={() => setActiveSettingsTab('image')}
                      className={`px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                        activeSettingsTab === 'image'
                          ? 'border-b-2 border-primary-500 text-primary-600 dark:text-primary-400'
                          : 'text-neutral-600 dark:text-slate-400 hover:text-neutral-900 dark:hover:text-slate-200'
                      }`}
                    >
                      Изображение
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                {/* Basic Settings Tab */}
                {activeSettingsTab === 'basic' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 dark:text-slate-300 mb-2">
                        Макет слайда
                      </label>
                      <select
                        value={selectedSlide.layout}
                        onChange={(e) =>
                          handleSlideChange(selectedSlideIndex, 'layout', e.target.value)
                        }
                        aria-label="Макет слайда"
                        className="w-full rounded-xl border border-neutral-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm text-neutral-700 dark:text-slate-300 focus:border-primary-300 dark:focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:focus:ring-primary-900"
                      >
                        <option value="title-content">Заголовок + Текст</option>
                        <option value="image-content">Изображение + Текст</option>
                        <option value="title-image-content">Заголовок + Изображение + Текст</option>
                        <option value="full-image">Полноэкранное изображение</option>
                      </select>
                    </div>

                    {selectedSlide.layout !== 'full-image' && (
                      <div>
                        <label className="block text-sm font-medium text-neutral-700 dark:text-slate-300 mb-2">
                          Заголовок
                        </label>
                        <Input
                          value={selectedSlide.title || ''}
                          onChange={(e) =>
                            handleSlideChange(selectedSlideIndex, 'title', e.target.value)
                          }
                          placeholder="Введите заголовок слайда"
                        />
                      </div>
                    )}

                    {(selectedSlide.layout === 'title-content' ||
                      selectedSlide.layout === 'title-image-content' ||
                      selectedSlide.layout === 'image-content') && (
                      <div>
                        <label className="block text-sm font-medium text-neutral-700 dark:text-slate-300 mb-2">
                          Текст
                        </label>
                        <Textarea
                          value={selectedSlide.content || ''}
                          onChange={(e) =>
                            handleSlideChange(selectedSlideIndex, 'content', e.target.value)
                          }
                          placeholder="Введите текст слайда"
                          rows={6}
                        />
                      </div>
                    )}

                    {/* Настройки переходов */}
                    <div className="pt-4 border-t border-neutral-200 dark:border-slate-700">
                      <label className="block text-sm font-medium text-neutral-700 dark:text-slate-300 mb-2">
                        Переход между слайдами
                      </label>
                      <select
                        value={selectedSlide.transition || 'slide'}
                        onChange={(e) =>
                          handleSlideChange(
                            selectedSlideIndex,
                            'transition',
                            e.target.value as
                              | 'none'
                              | 'fade'
                              | 'slide'
                              | 'zoom'
                              | 'convex'
                              | 'concave'
                          )
                        }
                        aria-label="Переход между слайдами"
                        className="w-full rounded-xl border border-neutral-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm text-neutral-700 dark:text-slate-300 focus:border-primary-300 dark:focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:focus:ring-primary-900"
                      >
                        <option value="none">Без перехода</option>
                        <option value="fade">Плавное затухание</option>
                        <option value="slide">Слайд</option>
                        <option value="zoom">Масштабирование</option>
                        <option value="convex">Выпуклый</option>
                        <option value="concave">Вогнутый</option>
                      </select>
                    </div>

                    {/* Шаблоны слайдов */}
                    <div className="pt-4 border-t border-neutral-200 dark:border-slate-700">
                      <label className="block text-sm font-medium text-neutral-700 dark:text-slate-300 mb-2">
                        Шаблоны слайдов
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {slideTemplates.map((template) => (
                          <button
                            key={template.name}
                            type="button"
                            onClick={() => handleApplyTemplate(template)}
                            className="p-3 rounded-lg border border-neutral-200 dark:border-slate-700 hover:border-primary-300 dark:hover:border-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors text-sm"
                          >
                            {template.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Копирование стилей */}
                    <div className="flex gap-2 pt-4 border-t border-neutral-200 dark:border-slate-700">
                      <Button
                        variant="outline"
                        size="sm"
                        type="button"
                        onClick={handleCopyStyle}
                        className="flex-1"
                      >
                        <Copy size={14} className="mr-1" />
                        Копировать стиль
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        type="button"
                        onClick={handlePasteStyle}
                        disabled={!copiedStyle}
                        className="flex-1"
                      >
                        Вставить стиль
                      </Button>
                    </div>
                  </>
                )}

                {/* Typography Settings Tab */}
                {activeSettingsTab === 'typography' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-neutral-700 dark:text-slate-300 mb-2">
                          Размер заголовка
                        </label>
                        <select
                          value={selectedSlide.titleFontSize || '2.5em'}
                          onChange={(e) =>
                            handleSlideChange(selectedSlideIndex, 'titleFontSize', e.target.value)
                          }
                          aria-label="Размер заголовка"
                          className="w-full rounded-xl border border-neutral-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm text-neutral-700 dark:text-slate-300 focus:border-primary-300 dark:focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:focus:ring-primary-900"
                        >
                          <option value="1.5em">Маленький</option>
                          <option value="2em">Средний</option>
                          <option value="2.5em">Большой</option>
                          <option value="3em">Очень большой</option>
                          <option value="4em">Огромный</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-neutral-700 dark:text-slate-300 mb-2">
                          Размер текста
                        </label>
                        <select
                          value={selectedSlide.contentFontSize || '1.1em'}
                          onChange={(e) =>
                            handleSlideChange(selectedSlideIndex, 'contentFontSize', e.target.value)
                          }
                          aria-label="Размер текста"
                          className="w-full rounded-xl border border-neutral-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm text-neutral-700 dark:text-slate-300 focus:border-primary-300 dark:focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:focus:ring-primary-900"
                        >
                          <option value="0.9em">Маленький</option>
                          <option value="1em">Обычный</option>
                          <option value="1.1em">Средний</option>
                          <option value="1.3em">Большой</option>
                          <option value="1.5em">Очень большой</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-neutral-700 dark:text-slate-300 mb-2">
                          Выравнивание заголовка
                        </label>
                        <select
                          value={selectedSlide.titleAlign || 'center'}
                          onChange={(e) =>
                            handleSlideChange(
                              selectedSlideIndex,
                              'titleAlign',
                              e.target.value as 'left' | 'center' | 'right'
                            )
                          }
                          aria-label="Выравнивание заголовка"
                          className="w-full rounded-xl border border-neutral-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm text-neutral-700 dark:text-slate-300 focus:border-primary-300 dark:focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:focus:ring-primary-900"
                        >
                          <option value="left">Слева</option>
                          <option value="center">По центру</option>
                          <option value="right">Справа</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-neutral-700 dark:text-slate-300 mb-2">
                          Выравнивание текста
                        </label>
                        <select
                          value={selectedSlide.textAlign || 'left'}
                          onChange={(e) =>
                            handleSlideChange(
                              selectedSlideIndex,
                              'textAlign',
                              e.target.value as 'left' | 'center' | 'right' | 'justify'
                            )
                          }
                          aria-label="Выравнивание текста"
                          className="w-full rounded-xl border border-neutral-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm text-neutral-700 dark:text-slate-300 focus:border-primary-300 dark:focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:focus:ring-primary-900"
                        >
                          <option value="left">Слева</option>
                          <option value="center">По центру</option>
                          <option value="right">Справа</option>
                          <option value="justify">По ширине</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 dark:text-slate-300 mb-2">
                        Межстрочный интервал
                      </label>
                      <select
                        value={selectedSlide.lineHeight || '1.6'}
                        onChange={(e) =>
                          handleSlideChange(selectedSlideIndex, 'lineHeight', e.target.value)
                        }
                        aria-label="Межстрочный интервал"
                        className="w-full rounded-xl border border-neutral-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm text-neutral-700 dark:text-slate-300 focus:border-primary-300 dark:focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:focus:ring-primary-900"
                      >
                        <option value="1.2">Плотный</option>
                        <option value="1.4">Компактный</option>
                        <option value="1.6">Обычный</option>
                        <option value="1.8">Просторный</option>
                        <option value="2">Очень просторный</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* Color Settings Tab */}
                {activeSettingsTab === 'colors' && (
                  <div className="space-y-4">
                    {/* Предустановленные схемы */}
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 dark:text-slate-300 mb-2">
                        Предустановленные схемы
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {colorSchemes.map((scheme) => (
                          <button
                            key={scheme.name}
                            type="button"
                            onClick={() => handleApplyColorScheme(scheme)}
                            className="p-3 rounded-lg border border-neutral-200 dark:border-slate-700 hover:border-primary-300 dark:hover:border-primary-600 transition-colors text-sm text-left color-scheme-preview"
                            style={
                              {
                                '--scheme-bg-color': scheme.backgroundColor,
                                '--scheme-text-color': scheme.textColor,
                              } as React.CSSProperties
                            }
                          >
                            <div className="font-medium">{scheme.name}</div>
                            <div className="flex gap-1 mt-1">
                              <div
                                className="w-4 h-4 rounded border border-neutral-300 color-swatch"
                                style={
                                  {
                                    '--swatch-color': scheme.backgroundColor,
                                  } as React.CSSProperties
                                }
                              />
                              <div
                                className="w-4 h-4 rounded border border-neutral-300 color-swatch"
                                style={
                                  { '--swatch-color': scheme.textColor } as React.CSSProperties
                                }
                              />
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Градиенты */}
                    <div className="pt-4 border-t border-neutral-200 dark:border-slate-700">
                      <label className="block text-sm font-medium text-neutral-700 dark:text-slate-300 mb-2">
                        Градиент фона
                      </label>
                      <select
                        value={
                          backgroundGradients.find(
                            (g) => g.value === selectedSlide.backgroundGradient
                          )?.name || 'Нет'
                        }
                        onChange={(e) => {
                          const gradient = backgroundGradients.find(
                            (g) => g.name === e.target.value
                          );
                          handleSlideChange(
                            selectedSlideIndex,
                            'backgroundGradient',
                            gradient?.value
                          );
                        }}
                        aria-label="Градиент фона"
                        className="w-full rounded-xl border border-neutral-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm text-neutral-700 dark:text-slate-300 focus:border-primary-300 dark:focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:focus:ring-primary-900"
                      >
                        {backgroundGradients.map((gradient) => (
                          <option key={gradient.name} value={gradient.name}>
                            {gradient.name}
                          </option>
                        ))}
                      </select>
                      {selectedSlide.backgroundGradient && (
                        <div
                          className="mt-2 h-12 rounded-lg border border-neutral-200 dark:border-slate-700 gradient-preview"
                          style={
                            {
                              '--gradient-value': selectedSlide.backgroundGradient,
                            } as React.CSSProperties
                          }
                        />
                      )}
                    </div>

                    {/* Индивидуальные цвета */}
                    <div className="pt-4 border-t border-neutral-200 dark:border-slate-700">
                      <label className="block text-sm font-medium text-neutral-700 dark:text-slate-300 mb-3">
                        Индивидуальные настройки
                      </label>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-neutral-600 dark:text-slate-400 mb-2">
                            Цвет фона
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={selectedSlide.backgroundColor || '#ffffff'}
                              onChange={(e) =>
                                handleSlideChange(
                                  selectedSlideIndex,
                                  'backgroundColor',
                                  e.target.value
                                )
                              }
                              aria-label="Цвет фона слайда"
                              className="w-12 h-10 rounded-lg border border-neutral-200 dark:border-slate-600 cursor-pointer"
                            />
                            <Input
                              value={selectedSlide.backgroundColor || '#ffffff'}
                              onChange={(e) =>
                                handleSlideChange(
                                  selectedSlideIndex,
                                  'backgroundColor',
                                  e.target.value
                                )
                              }
                              placeholder="#ffffff"
                              className="flex-1 text-xs"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-neutral-600 dark:text-slate-400 mb-2">
                            Цвет текста
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={selectedSlide.textColor || '#000000'}
                              onChange={(e) =>
                                handleSlideChange(selectedSlideIndex, 'textColor', e.target.value)
                              }
                              aria-label="Цвет текста слайда"
                              className="w-12 h-10 rounded-lg border border-neutral-200 dark:border-slate-600 cursor-pointer"
                            />
                            <Input
                              value={selectedSlide.textColor || '#000000'}
                              onChange={(e) =>
                                handleSlideChange(selectedSlideIndex, 'textColor', e.target.value)
                              }
                              placeholder="#000000"
                              className="flex-1 text-xs"
                            />
                          </div>
                        </div>
                        {selectedSlide.layout !== 'full-image' && (
                          <>
                            <div>
                              <label className="block text-xs font-medium text-neutral-600 dark:text-slate-400 mb-2">
                                Цвет заголовка
                              </label>
                              <div className="flex items-center gap-2">
                                <input
                                  type="color"
                                  value={
                                    selectedSlide.titleColor || selectedSlide.textColor || '#000000'
                                  }
                                  onChange={(e) =>
                                    handleSlideChange(
                                      selectedSlideIndex,
                                      'titleColor',
                                      e.target.value
                                    )
                                  }
                                  aria-label="Цвет заголовка слайда"
                                  className="w-12 h-10 rounded-lg border border-neutral-200 dark:border-slate-600 cursor-pointer"
                                />
                                <Input
                                  value={
                                    selectedSlide.titleColor || selectedSlide.textColor || '#000000'
                                  }
                                  onChange={(e) =>
                                    handleSlideChange(
                                      selectedSlideIndex,
                                      'titleColor',
                                      e.target.value
                                    )
                                  }
                                  placeholder="Авто"
                                  className="flex-1 text-xs"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-neutral-600 dark:text-slate-400 mb-2">
                                Цвет контента
                              </label>
                              <div className="flex items-center gap-2">
                                <input
                                  type="color"
                                  value={
                                    selectedSlide.contentColor ||
                                    selectedSlide.textColor ||
                                    '#000000'
                                  }
                                  onChange={(e) =>
                                    handleSlideChange(
                                      selectedSlideIndex,
                                      'contentColor',
                                      e.target.value
                                    )
                                  }
                                  aria-label="Цвет контента слайда"
                                  className="w-12 h-10 rounded-lg border border-neutral-200 dark:border-slate-600 cursor-pointer"
                                />
                                <Input
                                  value={
                                    selectedSlide.contentColor ||
                                    selectedSlide.textColor ||
                                    '#000000'
                                  }
                                  onChange={(e) =>
                                    handleSlideChange(
                                      selectedSlideIndex,
                                      'contentColor',
                                      e.target.value
                                    )
                                  }
                                  placeholder="Авто"
                                  className="flex-1 text-xs"
                                />
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Image Settings Tab */}
                {activeSettingsTab === 'image' &&
                  (selectedSlide.layout === 'image-content' ||
                    selectedSlide.layout === 'title-image-content' ||
                    selectedSlide.layout === 'full-image') && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-neutral-700 dark:text-slate-300 mb-2">
                          Изображение
                        </label>
                      </div>
                      {selectedSlide.image ? (
                        <div className="relative group">
                          <img
                            src={getUploadedImageUrl(selectedSlide.image)}
                            alt="Slide"
                            className="w-full h-64 object-cover rounded-xl mb-2"
                            onError={(e) => {
                              console.error('Failed to load image:', selectedSlide.image);
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            type="button"
                            onClick={() => {
                              if (window.confirm('Удалить изображение?')) {
                                handleSlideChange(selectedSlideIndex, 'image', '');
                              }
                            }}
                            className="absolute top-2 right-2 bg-white/90 dark:bg-slate-800/90 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Удалить изображение"
                          >
                            <X size={16} />
                          </Button>
                        </div>
                      ) : (
                        <div className="border-2 border-dashed border-neutral-200 dark:border-slate-700 rounded-xl p-8 text-center">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleImageUpload(selectedSlideIndex, file);
                              // Reset input to allow selecting the same file again
                              e.target.value = '';
                            }}
                            className="hidden"
                            id={`slide-image-${selectedSlideIndex}`}
                            disabled={uploadingImageIndex === selectedSlideIndex}
                          />
                          <label
                            htmlFor={`slide-image-${selectedSlideIndex}`}
                            className={`cursor-pointer text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 ${
                              uploadingImageIndex === selectedSlideIndex
                                ? 'opacity-50 cursor-not-allowed'
                                : ''
                            }`}
                          >
                            {uploadingImageIndex === selectedSlideIndex ? (
                              <div className="flex flex-col items-center gap-2">
                                <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
                                <span>Загрузка изображения...</span>
                              </div>
                            ) : (
                              'Нажмите для загрузки изображения'
                            )}
                          </label>
                        </div>
                      )}

                      <div className="pt-4 border-t border-neutral-200 dark:border-slate-700">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-neutral-700 dark:text-slate-300 mb-2">
                              Позиция изображения
                            </label>
                            <select
                              value={selectedSlide.imagePosition || 'center'}
                              onChange={(e) =>
                                handleSlideChange(
                                  selectedSlideIndex,
                                  'imagePosition',
                                  e.target.value as 'top' | 'center' | 'bottom'
                                )
                              }
                              aria-label="Позиция изображения"
                              className="w-full rounded-xl border border-neutral-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm text-neutral-700 dark:text-slate-300 focus:border-primary-300 dark:focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:focus:ring-primary-900"
                            >
                              <option value="top">Сверху</option>
                              <option value="center">По центру</option>
                              <option value="bottom">Снизу</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-neutral-700 dark:text-slate-300 mb-2">
                              Размер изображения
                            </label>
                            <select
                              value={selectedSlide.imageSize || 'medium'}
                              onChange={(e) =>
                                handleSlideChange(
                                  selectedSlideIndex,
                                  'imageSize',
                                  e.target.value as 'small' | 'medium' | 'large' | 'full'
                                )
                              }
                              aria-label="Размер изображения"
                              className="w-full rounded-xl border border-neutral-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm text-neutral-700 dark:text-slate-300 focus:border-primary-300 dark:focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:focus:ring-primary-900"
                            >
                              <option value="small">Маленький</option>
                              <option value="medium">Средний</option>
                              <option value="large">Большой</option>
                              <option value="full">Полный</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          <div className="sticky top-24 space-y-6">
            {/* Slides List */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-neutral-200 dark:border-slate-700 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Слайды</h2>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    onClick={handleUndo}
                    disabled={historyIndex <= 0}
                    title="Отменить (Ctrl+Z)"
                  >
                    <Undo size={14} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    onClick={handleRedo}
                    disabled={historyIndex >= history.length - 1}
                    title="Повторить (Ctrl+Y)"
                  >
                    <Redo size={14} />
                  </Button>
                  <Button variant="outline" size="sm" type="button" onClick={handleAddSlide}>
                    <Plus size={16} className="mr-1" />
                    Добавить
                  </Button>
                </div>
              </div>

              {/* Поиск по слайдам */}
              <div className="mb-4">
                <div className="relative">
                  <Search
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-slate-500"
                    size={16}
                  />
                  <Input
                    value={slideSearchQuery}
                    onChange={(e) => setSlideSearchQuery(e.target.value)}
                    placeholder="Поиск слайдов..."
                    className="pl-9 text-sm"
                  />
                </div>
              </div>

              <div
                className="space-y-2 max-h-96 overflow-y-auto"
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
              >
                {slides
                  .filter((slide) => {
                    if (!slideSearchQuery) return true;
                    const query = slideSearchQuery.toLowerCase();
                    return (
                      slide.title?.toLowerCase().includes(query) ||
                      slide.content?.toLowerCase().includes(query)
                    );
                  })
                  .map((slide) => {
                    const actualIndex = slides.findIndex((s) => s.id === slide.id);
                    const isDragging = draggedSlideIndex === actualIndex;
                    return (
                      <div
                        key={slide.id}
                        draggable
                        onDragStart={() => handleDragStart(actualIndex)}
                        onDragOver={(e) => handleDragOver(e, actualIndex)}
                        onDragEnd={handleDragEnd}
                        className={`group relative cursor-move ${isDragging ? 'opacity-50' : ''}`}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedSlideIndex(actualIndex)}
                          className={`w-full p-3 rounded-xl text-left transition-all flex items-start gap-3 ${
                            actualIndex === selectedSlideIndex
                              ? 'bg-primary-100 dark:bg-primary-900/30 border-2 border-primary-300 dark:border-primary-700'
                              : 'bg-neutral-50 dark:bg-slate-900 border border-neutral-200 dark:border-slate-700 hover:bg-neutral-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          {/* Drag handle */}
                          <div className="shrink-0 mt-0.5 cursor-move opacity-0 group-hover:opacity-100 transition-opacity">
                            <GripVertical
                              size={16}
                              className="text-neutral-400 dark:text-slate-500"
                            />
                          </div>

                          {/* Миниатюра слайда */}
                          <div
                            className={`shrink-0 w-16 h-12 rounded-lg border border-neutral-200 dark:border-slate-700 overflow-hidden slide-thumbnail ${
                              slide.backgroundGradient ? '[data-bg-gradient]' : ''
                            }`}
                            style={
                              {
                                '--thumbnail-bg-color': slide.backgroundColor || '#ffffff',
                                '--thumbnail-bg-gradient': slide.backgroundGradient || undefined,
                              } as React.CSSProperties
                            }
                          >
                            {slide.image ? (
                              <img
                                src={getUploadedImageUrl(slide.image)}
                                alt=""
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            ) : slide.title ? (
                              <div className="w-full h-full flex items-center justify-center p-1">
                                <span
                                  className="text-xs font-bold truncate slide-thumbnail-text"
                                  style={
                                    {
                                      '--thumbnail-text-color': slide.textColor || '#000000',
                                    } as React.CSSProperties
                                  }
                                >
                                  {slide.title.charAt(0).toUpperCase()}
                                </span>
                              </div>
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <span className="text-xs text-neutral-400 dark:text-slate-500">
                                  {actualIndex + 1}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Информация о слайде */}
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-neutral-900 dark:text-white flex items-center gap-2">
                              <span>Слайд {actualIndex + 1}</span>
                              {slide.layout && (
                                <span className="text-xs px-1.5 py-0.5 rounded bg-neutral-200 dark:bg-slate-700 text-neutral-600 dark:text-slate-300">
                                  {slide.layout === 'full-image'
                                    ? 'Изобр'
                                    : slide.layout === 'title-image-content'
                                      ? 'Т+И+Т'
                                      : slide.layout === 'image-content'
                                        ? 'И+Т'
                                        : 'Т+Т'}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-neutral-500 dark:text-slate-400 mt-1 truncate">
                              {slide.title || 'Без названия'}
                            </div>
                            {(() => {
                              const stats = getSlideStats(slide);
                              return stats.words > 0 || stats.chars > 0 ? (
                                <div className="text-xs text-neutral-400 dark:text-slate-500 mt-1">
                                  {stats.words} слов • {stats.chars} симв.
                                </div>
                              ) : null;
                            })()}
                          </div>
                        </button>
                      </div>
                    );
                  })}
              </div>

              {slideSearchQuery && (
                <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setSlideSearchQuery('')}
                    className="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
                  >
                    Очистить поиск
                  </button>
                </div>
              )}
            </div>

            {/* Statistics */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-neutral-200 dark:border-slate-700 shadow-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 size={18} className="text-primary-600 dark:text-primary-400" />
                <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
                  Статистика
                </h2>
              </div>
              <div className="space-y-3">
                {(() => {
                  const stats = getPresentationStats();
                  const slideStats = getSlideStats(selectedSlide);
                  return (
                    <>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="p-3 rounded-lg bg-neutral-50 dark:bg-slate-900">
                          <div className="text-xs text-neutral-500 dark:text-slate-400 mb-1">
                            Всего слайдов
                          </div>
                          <div className="text-lg font-semibold text-neutral-900 dark:text-white">
                            {stats.totalSlides}
                          </div>
                        </div>
                        <div className="p-3 rounded-lg bg-neutral-50 dark:bg-slate-900">
                          <div className="text-xs text-neutral-500 dark:text-slate-400 mb-1">
                            С изображениями
                          </div>
                          <div className="text-lg font-semibold text-neutral-900 dark:text-white">
                            {stats.slidesWithImages}
                          </div>
                        </div>
                        <div className="p-3 rounded-lg bg-neutral-50 dark:bg-slate-900">
                          <div className="text-xs text-neutral-500 dark:text-slate-400 mb-1">
                            Всего слов
                          </div>
                          <div className="text-lg font-semibold text-neutral-900 dark:text-white">
                            {stats.totalWords}
                          </div>
                        </div>
                        <div className="p-3 rounded-lg bg-neutral-50 dark:bg-slate-900">
                          <div className="text-xs text-neutral-500 dark:text-slate-400 mb-1">
                            Символов
                          </div>
                          <div className="text-lg font-semibold text-neutral-900 dark:text-white">
                            {stats.totalChars.toLocaleString()}
                          </div>
                        </div>
                      </div>
                      <div className="pt-3 border-t border-neutral-200 dark:border-slate-700">
                        <div className="text-xs font-medium text-neutral-600 dark:text-slate-400 mb-2">
                          Текущий слайд:
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-neutral-600 dark:text-slate-400">Слов:</span>
                          <span className="font-semibold text-neutral-900 dark:text-white">
                            {slideStats.words}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-neutral-600 dark:text-slate-400">Символов:</span>
                          <span className="font-semibold text-neutral-900 dark:text-white">
                            {slideStats.chars}
                          </span>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Publishing */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-neutral-200 dark:border-slate-700 shadow-sm p-6">
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">
                Публикация
              </h2>
              <div className="space-y-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPublished}
                    onChange={(e) => setIsPublished(e.target.checked)}
                    className="w-5 h-5 rounded border-neutral-300 dark:border-slate-600 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm font-medium text-neutral-700 dark:text-slate-300">
                    Опубликовать презентацию
                  </span>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
};
