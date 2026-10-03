import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@/i18n/i18n';

import { DdlPasteEditor, type DdlPasteEditorProps } from '../ddl-paste-editor';
import { DatabaseType } from '@/lib/domain/database-type';
import type { Diagram } from '@/lib/domain/diagram';
import type * as ApplyDdlModule from '../apply-ddl';

// Monaco в happy-dom не работает — подменяем управляемым textarea
vi.mock('@/components/code-snippet/code-snippet', () => ({
    Editor: ({
        value,
        onChange,
    }: {
        value: string;
        onChange: (value: string | undefined) => void;
    }) => (
        <textarea
            data-testid="mock-editor"
            value={value}
            onChange={(e) => onChange(e.target.value)}
        />
    ),
}));

const parseDdlOverride = vi.hoisted(() => ({
    fn: undefined as undefined | (() => Promise<unknown>),
}));
vi.mock('../apply-ddl', async (importOriginal) => {
    const actual = await importOriginal<typeof ApplyDdlModule>();
    return {
        ...actual,
        parseDdl: (...args: Parameters<typeof actual.parseDdl>) =>
            parseDdlOverride.fn
                ? (parseDdlOverride.fn() as ReturnType<typeof actual.parseDdl>)
                : actual.parseDdl(...args),
    };
});

const toast = vi.fn();
vi.mock('@/components/toast/use-toast', () => ({
    useToast: () => ({ toast }),
}));

const showAlert = vi.fn();
vi.mock('@/context/alert-context/alert-context', () => ({
    useAlert: () => ({ showAlert, closeAlert: vi.fn() }),
}));

// Состояние SQL живёт в родителе (как в DDLSection)
const Harness: React.FC<Omit<DdlPasteEditorProps, 'sql' | 'onSqlChange'>> = (
    props
) => {
    const [sql, setSql] = React.useState('');
    return <DdlPasteEditor {...props} sql={sql} onSqlChange={setSql} />;
};

const VALID_SQL =
    'CREATE TABLE users (id SERIAL PRIMARY KEY, email VARCHAR(255) NOT NULL);';

const emptyDiagram: Diagram = {
    id: 'd1',
    name: 'Test',
    databaseType: DatabaseType.POSTGRESQL,
    tables: [],
    relationships: [],
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
};

const typeSql = (sql: string) =>
    fireEvent.change(screen.getByTestId('mock-editor'), {
        target: { value: sql },
    });

const applyButton = () => screen.getByRole('button', { name: 'Применить' });

describe('DdlPasteEditor', () => {
    beforeEach(() => {
        showAlert.mockClear();
        toast.mockClear();
        parseDdlOverride.fn = undefined;
    });

    it('«Применить» отключена, пока SQL пустой', () => {
        render(<Harness currentDiagram={emptyDiagram} onApply={vi.fn()} />);
        expect(applyButton()).toBeDisabled();
    });

    it('валидный SQL на пустой диаграмме применяется без подтверждения', async () => {
        const onApply = vi.fn();
        render(<Harness currentDiagram={emptyDiagram} onApply={onApply} />);

        typeSql(VALID_SQL);
        await waitFor(() => expect(applyButton()).toBeEnabled(), {
            timeout: 3000,
        });
        fireEvent.click(applyButton());

        await waitFor(() => expect(onApply).toHaveBeenCalledTimes(1));
        expect(showAlert).not.toHaveBeenCalled();
        const applied: Diagram = onApply.mock.calls[0][0];
        expect(applied.id).toBe('d1');
        expect(applied.tables?.map((t) => t.name)).toEqual(['users']);
    });

    it('SQL без таблиц оставляет «Применить» отключённой', async () => {
        const onApply = vi.fn();
        render(<Harness currentDiagram={emptyDiagram} onApply={onApply} />);

        typeSql('CREATE TABL users (id INT);');
        // ждём, пока пройдёт debounce и парсинг: появится сообщение «таблиц не найдено»
        await waitFor(
            () =>
                expect(
                    screen.getByText('В SQL не найдено ни одной таблицы')
                ).toBeInTheDocument(),
            { timeout: 3000 }
        );

        expect(applyButton()).toBeDisabled();
        expect(onApply).not.toHaveBeenCalled();
    });

    it('на непустой диаграмме сначала просит подтверждение', async () => {
        const onApply = vi.fn();
        const filled: Diagram = {
            ...emptyDiagram,
            tables: [
                {
                    id: 't1',
                    name: 'old',
                    fields: [],
                    indexes: [],
                    x: 0,
                    y: 0,
                    color: '#000000',
                    isView: false,
                    createdAt: 0,
                },
            ],
        };
        render(<Harness currentDiagram={filled} onApply={onApply} />);

        typeSql(VALID_SQL);
        await waitFor(() => expect(applyButton()).toBeEnabled(), {
            timeout: 3000,
        });
        fireEvent.click(applyButton());

        expect(onApply).not.toHaveBeenCalled();
        expect(showAlert).toHaveBeenCalledTimes(1);

        // подтверждаем
        showAlert.mock.calls[0][0].onAction();
        await waitFor(() => expect(onApply).toHaveBeenCalledTimes(1));
    });

    it('быстрый двойной клик вызывает onApply один раз', async () => {
        const onApply = vi.fn(
            () => new Promise<void>((resolve) => setTimeout(resolve, 10))
        );
        render(<Harness currentDiagram={emptyDiagram} onApply={onApply} />);

        typeSql(VALID_SQL);
        await waitFor(() => expect(applyButton()).toBeEnabled(), {
            timeout: 3000,
        });
        fireEvent.click(applyButton());
        fireEvent.click(applyButton());

        await waitFor(() =>
            expect(screen.getByTestId('mock-editor')).toHaveValue('')
        );
        expect(onApply).toHaveBeenCalledTimes(1);
    });

    it('отклонённый onApply не ломает компонент и сохраняет SQL', async () => {
        const onApply = vi.fn().mockRejectedValue(new Error('boom'));
        const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => undefined);
        render(<Harness currentDiagram={emptyDiagram} onApply={onApply} />);

        typeSql(VALID_SQL);
        await waitFor(() => expect(applyButton()).toBeEnabled(), {
            timeout: 3000,
        });
        fireEvent.click(applyButton());

        await waitFor(() => expect(errorSpy).toHaveBeenCalled());
        expect(onApply).toHaveBeenCalledTimes(1);
        expect(screen.getByTestId('mock-editor')).toHaveValue(VALID_SQL);
        expect(toast).toHaveBeenCalledWith(
            expect.objectContaining({ variant: 'destructive' })
        );
        errorSpy.mockRestore();
    });

    it('ошибка парсера показывает сообщение и оставляет «Применить» отключённой', async () => {
        parseDdlOverride.fn = () =>
            Promise.reject(new Error('parser exploded'));
        render(<Harness currentDiagram={emptyDiagram} onApply={vi.fn()} />);

        typeSql(VALID_SQL);
        await waitFor(
            () =>
                expect(screen.getByText(/parser exploded/)).toBeInTheDocument(),
            { timeout: 3000 }
        );
        expect(applyButton()).toBeDisabled();
    });

    it('слишком много таблиц: сообщение и отключённая «Применить»', async () => {
        parseDdlOverride.fn = () =>
            Promise.resolve({
                status: 'too-many-tables',
                count: 501,
                limit: 500,
                validation: { isValid: true, errors: [], warnings: [] },
            });
        render(<Harness currentDiagram={emptyDiagram} onApply={vi.fn()} />);

        typeSql(VALID_SQL);
        await waitFor(
            () =>
                expect(
                    screen.getByText(/слишком много таблиц \(501\).*500/)
                ).toBeInTheDocument(),
            { timeout: 3000 }
        );
        expect(applyButton()).toBeDisabled();
    });

    it('SQL переживает перемонтирование редактора (состояние в родителе)', () => {
        const Parent: React.FC = () => {
            const [sql, setSql] = React.useState('');
            const [shown, setShown] = React.useState(true);
            return (
                <>
                    <button onClick={() => setShown((v) => !v)}>toggle</button>
                    {shown && (
                        <DdlPasteEditor
                            currentDiagram={emptyDiagram}
                            sql={sql}
                            onSqlChange={setSql}
                            onApply={vi.fn()}
                        />
                    )}
                </>
            );
        };
        render(<Parent />);
        typeSql(VALID_SQL);
        fireEvent.click(screen.getByText('toggle'));
        fireEvent.click(screen.getByText('toggle'));
        expect(screen.getByTestId('mock-editor')).toHaveValue(VALID_SQL);
    });
});
