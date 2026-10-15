# Seeded Handbook Fallback

Этот файл используется как резервный kb-источник для тестового раннера API, когда
каталог `documentation/product/handbook-kb-articles` не попадает в образ.

- Назначение: гарантировать, что `resolve_handbook_kb_articles_dir()` всегда находит
  как минимум один `kb-*.md` документ.
- Для production: задавайте `ASSISTANT_HANDBOOK_KB_ARTICLES_DIR` или монтируйте
  канонический каталог документации.
