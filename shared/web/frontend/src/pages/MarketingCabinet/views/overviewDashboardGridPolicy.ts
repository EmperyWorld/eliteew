/**
 * Политика React Grid Layout для интерактивного дашборда (см. MARKETING-DASHBOARD-BACKLOG C.25 / Wave 22).
 * Вынесено из {@link OverviewInteractiveDashboard}, чтобы не дублировать при тестах и будущем распиле сетки.
 *
 * `compactType: null` — свободные ряды снизу (vertical compact схлопывал «пустое» под
 * нижней плиткой и не давал утащить/растянуть область вниз без трюков).
 */
export const RGL_PREVENT_COLLISION = false;

export const RGL_COMPACT_TYPE = null;
