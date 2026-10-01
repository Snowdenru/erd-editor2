import { useEffect, useRef } from 'react';
import { useChartDB } from '@/hooks/use-chartdb';
import {
    getVisitorId,
    isLoggedIn,
    trackEvent,
    trackPageView,
} from '@/lib/sqllab-account';
import {
    buildSnapshotPayload,
    diffActions,
    readStoredSource,
    consumeEntryRedirect,
    resolveSource,
    type Counts,
} from '@/lib/erd2-tracking';

const PULSE_MS = 30_000;
const SNAPSHOT_MS = 5 * 60_000;
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel'] as const;

const page = () => window.location.pathname;

// В общий счётчик просмотров — один путь для редактора (без id схемы, иначе каждая схема станет
// отдельной строкой в «Посещениях страниц»). Маршруты «/diagrams» и «/d/:id» — разные элементы
// роутера: редирект с одного на другой перемонтирует трекер, поэтому повтор в пределах 5 с гасим.
const EDITOR_PAGEVIEW_PATH = '/tools/erd2/';
const PAGEVIEW_KEY = 'erd2_last_pageview';
const PAGEVIEW_DEDUPE_MS = 5000;

function trackEditorPageView(): void {
    try {
        const last = Number(sessionStorage.getItem(PAGEVIEW_KEY) ?? 0);
        if (Date.now() - last < PAGEVIEW_DEDUPE_MS) {
            return;
        }
        sessionStorage.setItem(PAGEVIEW_KEY, String(Date.now()));
    } catch {
        // sessionStorage недоступен — лучше посчитать дважды, чем потерять просмотр
    }
    trackPageView(EDITOR_PAGEVIEW_PATH);
}

// Ничего не рисует: отправляет события использования редактора (открытие, пульс вовлечённости,
// действия, числовой снапшот схемы). Только числа и типы — без названий таблиц и DDL.
export const Erd2Tracker: React.FC = () => {
    const { diagramId, currentDiagram } = useChartDB();
    const latestRef = useRef({ diagramId, currentDiagram });
    latestRef.current = { diagramId, currentDiagram };

    const openedRef = useRef(false);
    const baselineRef = useRef<{ id: string; counts: Counts } | null>(null);
    const lastActivityRef = useRef(0);

    const tableCount = currentDiagram.tables?.length ?? 0;
    const relationCount = currentDiagram.relationships?.length ?? 0;

    useEffect(() => {
        trackEditorPageView();
    }, []);

    // erd2_open — один раз за загрузку страницы, когда диаграмма уже определена
    useEffect(() => {
        if (openedRef.current || !diagramId) {
            return;
        }
        openedRef.current = true;
        trackEvent('erd2_open', page(), {
            source: resolveSource(
                document.referrer,
                readStoredSource(),
                consumeEntryRedirect()
            ),
            is_cloud: isLoggedIn(),
            // постоянный анонимный id (localStorage) — по нему бэкенд считает уникальных и вернувшихся
            visitor_id: getVisitorId(),
        });
    }, [diagramId]);

    // erd2_action — по росту числа таблиц и связей; первая загрузка и смена диаграммы — не действие
    useEffect(() => {
        if (!diagramId) {
            return;
        }
        const counts = { tables: tableCount, relations: relationCount };
        const baseline = baselineRef.current;
        baselineRef.current = { id: diagramId, counts };
        if (!baseline || baseline.id !== diagramId) {
            return;
        }
        for (const type of diffActions(baseline.counts, counts)) {
            trackEvent('erd2_action', page(), { type });
        }
    }, [diagramId, tableCount, relationCount]);

    // erd2_engaged — пульс раз в 30 с, только если вкладка видна и был ввод за последние 30 с
    useEffect(() => {
        const markActivity = () => {
            lastActivityRef.current = Date.now();
        };
        ACTIVITY_EVENTS.forEach((name) =>
            window.addEventListener(name, markActivity, { passive: true })
        );
        const timer = setInterval(() => {
            const active =
                document.visibilityState === 'visible' &&
                Date.now() - lastActivityRef.current <= PULSE_MS;
            if (active) {
                trackEvent('erd2_engaged', page(), {
                    seconds: PULSE_MS / 1000,
                    is_cloud: isLoggedIn(),
                });
            }
        }, PULSE_MS);
        return () => {
            clearInterval(timer);
            ACTIVITY_EVENTS.forEach((name) =>
                window.removeEventListener(name, markActivity)
            );
        };
    }, []);

    // erd2_schema_snapshot — раз в 5 минут и при уходе со страницы, только для непустой схемы
    useEffect(() => {
        const sendSnapshot = (keepalive: boolean) => {
            const { currentDiagram: diagram } = latestRef.current;
            if (!diagram.tables || diagram.tables.length === 0) {
                return;
            }
            trackEvent(
                'erd2_schema_snapshot',
                page(),
                buildSnapshotPayload(diagram, isLoggedIn()),
                { keepalive }
            );
        };
        const timer = setInterval(() => sendSnapshot(false), SNAPSHOT_MS);
        const onHide = () => {
            if (document.visibilityState === 'hidden') {
                sendSnapshot(true);
            }
        };
        document.addEventListener('visibilitychange', onHide);
        return () => {
            clearInterval(timer);
            document.removeEventListener('visibilitychange', onHide);
        };
    }, []);

    return null;
};
