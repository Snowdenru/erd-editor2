import React, { useEffect, useRef, useState } from 'react';
import { Star } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/dialog/dialog';
import { Button } from '@/components/button/button';
import { cn } from '@/lib/utils';
import { trackEvent } from '@/lib/sqllab-account';
import {
    fetchMyReview,
    markReviewed,
    submitReview,
    tagsForRating,
} from '@/lib/erd2-review';

type Step = 1 | 2 | 3;

const RATING_LABELS = [
    '',
    'Очень плохо',
    'Плохо',
    'Нормально',
    'Хорошо',
    'Отлично!',
];
const STEP_TITLES: Record<Step, string> = {
    1: 'Оцените ERD-редактор',
    2: 'Что отметите?',
    3: 'Добавите что-нибудь?',
};

export interface ReviewDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export const ReviewDialog: React.FC<ReviewDialogProps> = ({
    open,
    onOpenChange,
}) => {
    const [step, setStep] = useState<Step>(1);
    const [rating, setRating] = useState(0);
    const [hovered, setHovered] = useState(0);
    const [tags, setTags] = useState<string[]>([]);
    const [customTag, setCustomTag] = useState('');
    const [text, setText] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [done, setDone] = useState(false);
    const [error, setError] = useState(false);

    const interactedRef = useRef(false);
    const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clearCloseTimer = () => {
        if (closeTimerRef.current !== null) {
            clearTimeout(closeTimerRef.current);
            closeTimerRef.current = null;
        }
    };

    useEffect(() => clearCloseTimer, []);

    // При открытии сбрасываем форму и подгружаем прежний отзыв для правки
    useEffect(() => {
        if (!open) {
            return;
        }
        clearCloseTimer();
        interactedRef.current = false;
        setStep(1);
        setRating(0);
        setHovered(0);
        setTags([]);
        setCustomTag('');
        setText('');
        setDone(false);
        setError(false);
        setSubmitting(false);
        let cancelled = false;
        void fetchMyReview()
            .then((previous) => {
                if (cancelled || interactedRef.current || !previous) {
                    return;
                }
                setRating(previous.rating);
                setTags(previous.tags);
                setText(previous.text);
                setStep(2); // сразу показываем прежнюю оценку и теги для правки
            })
            .catch(() => undefined);
        return () => {
            cancelled = true;
        };
    }, [open]);

    const toggleTag = (tag: string) => {
        interactedRef.current = true;
        setTags((prev) =>
            prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
        );
    };

    const handleSubmit = async () => {
        if (submitting) {
            return;
        }
        setError(false);
        setSubmitting(true);
        const custom = customTag.trim();
        const allTags =
            custom && !tags.includes(custom) ? [...tags, custom] : tags;
        try {
            await submitReview({ rating, tags: allTags, text });
            markReviewed();
            trackEvent('erd2_review_submit', window.location.pathname, {
                rating,
                tags_count: allTags.length,
                has_text: text.trim().length > 0,
            });
            setDone(true);
            clearCloseTimer();
            closeTimerRef.current = setTimeout(() => {
                closeTimerRef.current = null;
                onOpenChange(false);
            }, 1800);
        } catch {
            setError(true);
        } finally {
            setSubmitting(false);
        }
    };

    const availableTags = rating > 0 ? tagsForRating(rating) : [];
    // При низкой оценке теги не объясняют, что сломалось, - просим описать словами
    const textRequired = rating > 0 && rating <= 2;
    const canSubmit = !textRequired || text.trim().length > 0;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                {done ? (
                    <div className="space-y-2 p-6 text-center">
                        <DialogTitle className="sr-only">
                            Спасибо за оценку
                        </DialogTitle>
                        <DialogDescription className="sr-only">
                            Отзыв отправлен
                        </DialogDescription>
                        <p className="text-3xl">🙏</p>
                        <p className="text-lg font-semibold">
                            Спасибо за оценку!
                        </p>
                        <p className="text-sm text-muted-foreground">
                            Ваш отзыв поможет улучшить редактор
                        </p>
                    </div>
                ) : (
                    <>
                        <DialogHeader>
                            <DialogTitle>{STEP_TITLES[step]}</DialogTitle>
                            <DialogDescription className="sr-only">
                                Оценка редактора
                            </DialogDescription>
                        </DialogHeader>

                        {step === 1 && (
                            <div className="space-y-3">
                                <div className="flex gap-2">
                                    {[1, 2, 3, 4, 5].map((n) => (
                                        <button
                                            key={n}
                                            type="button"
                                            aria-label={`Оценка ${n} из 5`}
                                            onMouseEnter={() => setHovered(n)}
                                            onMouseLeave={() => setHovered(0)}
                                            onClick={() => {
                                                interactedRef.current = true;
                                                setRating(n);
                                                setTags([]);
                                                setStep(2);
                                            }}
                                            className="transition-transform hover:scale-110"
                                        >
                                            <Star
                                                className={cn(
                                                    'size-10 transition-colors',
                                                    n <= (hovered || rating)
                                                        ? 'fill-yellow-400 text-yellow-400'
                                                        : 'text-muted-foreground/40'
                                                )}
                                            />
                                        </button>
                                    ))}
                                </div>
                                {rating > 0 && (
                                    <p className="text-sm text-muted-foreground">
                                        {RATING_LABELS[rating]}
                                    </p>
                                )}
                            </div>
                        )}

                        {step === 2 && (
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <span>Ваша оценка:</span>
                                    <span className="text-yellow-500">
                                        {'★'.repeat(rating)}
                                        {'☆'.repeat(5 - rating)}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setStep(1)}
                                        className="text-xs underline"
                                    >
                                        изменить
                                    </button>
                                </div>
                                <p className="font-semibold">
                                    {rating <= 2
                                        ? 'Что пошло не так?'
                                        : rating === 3
                                          ? 'Что можно улучшить?'
                                          : 'Что понравилось?'}
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {availableTags.map((tag) => (
                                        <button
                                            key={tag}
                                            type="button"
                                            onClick={() => toggleTag(tag)}
                                            className={cn(
                                                'rounded-full border px-3 py-1.5 text-xs transition-colors',
                                                tags.includes(tag)
                                                    ? 'border-primary bg-primary text-primary-foreground'
                                                    : 'border-border bg-muted/50 hover:bg-muted'
                                            )}
                                        >
                                            {tag}
                                        </button>
                                    ))}
                                </div>
                                <div>
                                    <p className="mb-1 text-xs text-muted-foreground">
                                        Или напишите своё:
                                    </p>
                                    <input
                                        type="text"
                                        value={customTag}
                                        onChange={(e) => {
                                            interactedRef.current = true;
                                            setCustomTag(e.target.value);
                                        }}
                                        placeholder="Ваш вариант..."
                                        maxLength={100}
                                        className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                                    />
                                </div>
                                <Button
                                    type="button"
                                    className="w-full"
                                    onClick={() => setStep(3)}
                                >
                                    Далее →
                                </Button>
                            </div>
                        )}

                        {step === 3 && (
                            <div className="space-y-4">
                                {textRequired && (
                                    <p className="text-sm font-semibold">
                                        Расскажите, что пошло не так
                                        <span className="ml-1 font-normal text-muted-foreground">
                                            (обязательно)
                                        </span>
                                    </p>
                                )}
                                <textarea
                                    value={text}
                                    onChange={(e) => {
                                        interactedRef.current = true;
                                        setText(e.target.value);
                                    }}
                                    placeholder={
                                        textRequired
                                            ? 'Что именно сломалось или не понравилось? Так мы быстрее исправим'
                                            : 'Пожелания, предложения...'
                                    }
                                    rows={4}
                                    maxLength={2000}
                                    className="w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                                />
                                {error && (
                                    <p className="text-xs text-destructive">
                                        Не удалось отправить. Попробуйте ещё
                                        раз.
                                    </p>
                                )}
                                <div className="flex gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="flex-1"
                                        onClick={() => setStep(2)}
                                    >
                                        ← Назад
                                    </Button>
                                    <Button
                                        type="button"
                                        className="flex-1"
                                        disabled={submitting || !canSubmit}
                                        onClick={() => void handleSubmit()}
                                    >
                                        {submitting
                                            ? 'Отправляем...'
                                            : 'Отправить'}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
};
