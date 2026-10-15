import type { Presentation, PresentationSlide } from '@services/api/presentations';
import { getUploadedImageUrl } from '@utils/imageUrl';
import React, { useEffect, useRef, useState } from 'react';
import '../presentation.css';

interface PresentationViewerProps {
  presentation: Presentation;
}

export const PresentationViewer: React.FC<PresentationViewerProps> = ({ presentation }) => {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Полноэкранный режим
  useEffect(() => {
    // Убираем скролл страницы
    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;
    const originalBodyMargin = document.body.style.margin;
    const originalBodyPadding = document.body.style.padding;

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    document.body.style.margin = '0';
    document.body.style.padding = '0';

    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
      document.body.style.margin = originalBodyMargin;
      document.body.style.padding = originalBodyPadding;
    };
  }, []);

  // Навигация клавиатурой
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault();
        if (currentSlideIndex < presentation.slides.length - 1) {
          setCurrentSlideIndex(currentSlideIndex + 1);
        }
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (currentSlideIndex > 0) {
          setCurrentSlideIndex(currentSlideIndex - 1);
        }
      } else if (e.key === 'Home') {
        e.preventDefault();
        setCurrentSlideIndex(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        setCurrentSlideIndex(presentation.slides.length - 1);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        // Можно добавить закрытие презентации
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentSlideIndex, presentation.slides.length]);

  // Инициализация первого слайда при монтировании
  useEffect(() => {
    if (presentation.slides.length > 0) {
      // Устанавливаем первый слайд как активный
      setTimeout(() => {
        const firstSlide = slideRefs.current[0];
        if (firstSlide) {
          const wrapper = firstSlide.closest('.slide-wrapper');
          if (wrapper) {
            wrapper.classList.add('active');
            wrapper.classList.remove('prev', 'next');

            // Показываем элементы первого слайда сразу
            const title = firstSlide.querySelector('.presentation-slide-title, h2');
            const content = firstSlide.querySelector('.slide-content');
            const images = firstSlide.querySelectorAll('img');

            if (title) {
              title.classList.add('animate-in');
              (title as HTMLElement).style.opacity = '1';
              (title as HTMLElement).style.transform = 'translateY(0)';
            }
            if (content) {
              content.classList.add('animate-in');
              (content as HTMLElement).style.opacity = '1';
              (content as HTMLElement).style.transform = 'translateY(0)';
            }
            Array.from(images as NodeListOf<HTMLImageElement>).forEach((img) => {
              img.classList.add('animate-in');
              img.style.opacity = '1';
              img.style.transform = 'scale(1) translateY(0)';
            });
          }
        }
      }, 100);
    }
  }, [presentation.slides.length]);

  // Анимация появления слайда при смене
  useEffect(() => {
    // Сбрасываем все слайды
    slideRefs.current.forEach((slide, index) => {
      if (slide) {
        const wrapper = slide.closest('.slide-wrapper');
        if (wrapper) {
          if (index === currentSlideIndex) {
            wrapper.classList.add('active');
            wrapper.classList.remove('prev', 'next');
          } else if (index < currentSlideIndex) {
            wrapper.classList.remove('active');
            wrapper.classList.add('prev');
            wrapper.classList.remove('next');
          } else {
            wrapper.classList.remove('active');
            wrapper.classList.remove('prev');
            wrapper.classList.add('next');
          }
        }

        // Триггерим анимации элементов для активного слайда (оптимизировано)
        if (index === currentSlideIndex) {
          requestAnimationFrame(() => {
            const title = slide.querySelector('.presentation-slide-title, h2');
            const content = slide.querySelector('.slide-content');
            const images = slide.querySelectorAll('img');

            // Сбрасываем классы
            if (title) title.classList.remove('animate-in');
            if (content) content.classList.remove('animate-in');
            images.forEach((img) => img.classList.remove('animate-in'));

            // Force reflow
            void slide.offsetWidth;

            // Запускаем анимацию через requestAnimationFrame для плавности
            requestAnimationFrame(() => {
              setTimeout(() => {
                if (title) title.classList.add('animate-in');
                requestAnimationFrame(() => {
                  if (content) content.classList.add('animate-in');
                  requestAnimationFrame(() => {
                    Array.from(images as NodeListOf<HTMLImageElement>).forEach((img) => {
                      img.classList.add('animate-in');
                    });
                  });
                });
              }, 100);
            });
          });
        }
      }
    });
  }, [currentSlideIndex]);

  const renderSlide = (slide: PresentationSlide, index: number) => {
    const slideStyle: React.CSSProperties = {
      '--slide-bg-color': slide.backgroundColor || '#ffffff',
      '--slide-text-color': slide.textColor || '#000000',
      '--slide-title-color': slide.titleColor || slide.textColor || '#000000',
      '--slide-content-color': slide.contentColor || slide.textColor || '#000000',
      '--slide-title-font-size': slide.titleFontSize || '2.5em',
      '--slide-content-font-size': slide.contentFontSize || '1.1em',
      '--slide-text-align': slide.textAlign || 'left',
      '--slide-title-align': slide.titleAlign || 'center',
      '--slide-line-height': slide.lineHeight || '1.6',
      '--slide-bg-gradient': slide.backgroundGradient || undefined,
    } as React.CSSProperties;

    const slideClassName = `presentation-slide ${slide.backgroundGradient ? 'has-gradient' : ''} ${presentation.format === 'ollenti' ? 'format-ollenti' : ''} ${presentation.format === 'ollenti2' ? 'format-ollenti2' : ''} ${index === currentSlideIndex ? 'slide-active' : ''}`;

    const getImageClassName = () => {
      const baseClass = 'presentation-slide-image';
      const sizeClass =
        slide.imageSize === 'small'
          ? 'image-small'
          : slide.imageSize === 'large'
            ? 'image-large'
            : slide.imageSize === 'full'
              ? 'image-full'
              : 'image-medium';
      return `${baseClass} ${sizeClass}`;
    };

    switch (slide.layout) {
      case 'full-image':
        return (
          <div
            key={slide.id}
            ref={(el) => {
              slideRefs.current[index] = el;
            }}
            className={slideClassName}
            style={slideStyle}
            data-slide-index={index}
          >
            {slide.image && (
              <div
                className="full-image-background"
                style={{
                  backgroundImage: `url(${getUploadedImageUrl(slide.image)})`,
                }}
              />
            )}
            {slide.title && <h2 className="presentation-slide-title">{slide.title}</h2>}
          </div>
        );

      case 'image-content':
        return (
          <div
            key={slide.id}
            ref={(el) => {
              slideRefs.current[index] = el;
            }}
            className={slideClassName}
            style={slideStyle}
            data-slide-index={index}
          >
            {slide.image && (
              <img
                src={getUploadedImageUrl(slide.image)}
                alt={slide.title || 'Slide image'}
                className={getImageClassName()}
              />
            )}
            {slide.content && (
              <div
                className="slide-content"
                dangerouslySetInnerHTML={{ __html: slide.content.replace(/\n/g, '<br>') }}
              />
            )}
          </div>
        );

      case 'title-image-content':
        return (
          <div
            key={slide.id}
            ref={(el) => {
              slideRefs.current[index] = el;
            }}
            className={slideClassName}
            style={slideStyle}
            data-slide-index={index}
          >
            {slide.title && <h2 className="presentation-slide-title">{slide.title}</h2>}
            {slide.image && (
              <img
                src={getUploadedImageUrl(slide.image)}
                alt={slide.title || 'Slide image'}
                className={getImageClassName()}
              />
            )}
            {slide.content && (
              <div
                className="slide-content"
                dangerouslySetInnerHTML={{ __html: slide.content.replace(/\n/g, '<br>') }}
              />
            )}
          </div>
        );

      case 'title-content':
      default:
        return (
          <div
            key={slide.id}
            ref={(el) => {
              slideRefs.current[index] = el;
            }}
            className={slideClassName}
            style={slideStyle}
            data-slide-index={index}
          >
            {slide.title && <h2 className="presentation-slide-title">{slide.title}</h2>}
            {slide.content && (
              <div
                className="slide-content"
                dangerouslySetInnerHTML={{ __html: slide.content.replace(/\n/g, '<br>') }}
              />
            )}
          </div>
        );
    }
  };

  // Дебаг: проверяем, что слайды есть
  if (!presentation.slides || presentation.slides.length === 0) {
    return (
      <div
        className="presentation-viewer"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}
      >
        <div>Нет слайдов для отображения</div>
      </div>
    );
  }

  return (
    <div className="presentation-viewer" ref={containerRef}>
      {/* Навигация */}
      <div className="presentation-nav">
        <button
          className="nav-button nav-prev"
          onClick={() => setCurrentSlideIndex(Math.max(0, currentSlideIndex - 1))}
          disabled={currentSlideIndex === 0}
          aria-label="Предыдущий слайд"
        >
          ‹
        </button>
        <div className="nav-info">
          {currentSlideIndex + 1} / {presentation.slides.length}
        </div>
        <button
          className="nav-button nav-next"
          onClick={() =>
            setCurrentSlideIndex(Math.min(presentation.slides.length - 1, currentSlideIndex + 1))
          }
          disabled={currentSlideIndex === presentation.slides.length - 1}
          aria-label="Следующий слайд"
        >
          ›
        </button>
      </div>

      {/* Слайды */}
      <div className="presentation-slides-container">
        {presentation.slides.map((slide, index) => {
          const isActive = index === currentSlideIndex;
          const isPrev = index < currentSlideIndex;
          const isNext = index > currentSlideIndex;
          return (
            <div
              key={slide.id}
              className={`slide-wrapper ${isActive ? 'active' : ''} ${isPrev ? 'prev' : ''} ${isNext ? 'next' : ''} ${index === 0 ? 'first-slide' : ''}`}
            >
              {renderSlide(slide, index)}
            </div>
          );
        })}
      </div>

      {/* Индикаторы слайдов */}
      <div className="presentation-indicators">
        {presentation.slides.map((_, index) => (
          <button
            key={index}
            className={`indicator ${index === currentSlideIndex ? 'active' : ''}`}
            onClick={() => setCurrentSlideIndex(index)}
            aria-label={`Слайд ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
};
