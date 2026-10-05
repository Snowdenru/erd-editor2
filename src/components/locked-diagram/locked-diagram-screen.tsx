import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link, useParams } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { Button } from '@/components/button/button';
import { useLockedCards } from '@/hooks/use-locked-cards';
import { trackEvent } from '@/lib/sqllab-account';
import { DIAGRAMS_PATH, PRICING_PATH } from '@/lib/erd-paths';

// Показ карточки считаем один раз на схему за загрузку страницы.
const viewed = new Set<string>();

// Прямая ссылка /d/<id> на закрытую схему, которой нет в этом браузере: поверх пустого
// редактора — состояние «открывается с Pro». Для открытых схем ничего не рисует.
export const LockedDiagramScreen: React.FC = () => {
    const { diagramId } = useParams<{ diagramId: string }>();
    const cards = useLockedCards();
    const card = cards.find((c) => c.id === diagramId);

    useEffect(() => {
        if (!card || viewed.has(card.id)) return;
        viewed.add(card.id);
        trackEvent('erd2_locked_card_view', window.location.pathname, {
            tables: card.tables,
        });
    }, [card]);

    if (!card) return null;

    // Портал в body + z-[100] + pointer-events: Radix-модалка (диалог открытия схемы) вешает
    // pointer-events:none на body и лежит на z-50: без этого карточка оказалась бы под ней.
    return createPortal(
        <div
            data-testid="locked-diagram-overlay"
            style={{ pointerEvents: 'auto' }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 p-6"
        >
            <div className="flex max-w-md flex-col items-center gap-4 text-center">
                <Lock size={40} className="text-muted-foreground" />
                <h1 className="text-xl font-semibold">{card.title}</h1>
                <p className="text-sm text-muted-foreground">
                    {card.tables} таблиц · сохранена{' '}
                    {card.savedAt.toLocaleDateString('ru-RU')}. Схема лежит в
                    облаке целиком — на этом устройстве она откроется с Pro.
                </p>
                <div className="flex gap-2">
                    <Button asChild>
                        <Link
                            to={PRICING_PATH}
                            onClick={() =>
                                trackEvent(
                                    'erd2_locked_card_click',
                                    window.location.pathname
                                )
                            }
                        >
                            Открыть с Pro
                        </Link>
                    </Button>
                    <Button asChild variant="secondary">
                        <Link to={DIAGRAMS_PATH}>Мои схемы</Link>
                    </Button>
                </div>
            </div>
        </div>,
        document.body
    );
};
