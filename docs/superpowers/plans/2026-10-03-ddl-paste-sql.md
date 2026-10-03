# Вставка своего SQL во вкладке DDL — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Во вкладке DDL боковой панели можно вставить свой SQL и нажать «Применить» — текущая диаграмма заменяется схемой из SQL.

**Architecture:** Чистая функция `parseDdl` (валидация + парсинг через существующие `validateSQL`, `parseSQLError`, `sqlImportToDiagram`) и `replaceDiagramContent` (подмена таблиц/связей в текущей диаграмме с сохранением id, имени, типа БД). Компонент `DdlPasteEditor` (Monaco + статус + кнопка + подтверждение через `useAlert`). `DDLSection` получает переключатель «Из диаграммы / Свой SQL» и применяет результат через `updateDiagramData`.

**Tech Stack:** React 18, TypeScript, Monaco (`Editor` из `components/code-snippet/code-snippet`), react-i18next, vitest + @testing-library/react (happy-dom).

## Global Constraints

Из спецификации [2026-10-03-ddl-paste-sql-design.md](../specs/2026-10-03-ddl-paste-sql-design.md):

- SQL **заменяет** диаграмму (таблицы и связи), слияния нет.
- Непустая диаграмма → подтверждение перед заменой; пустая применяется без него.
- Только явная кнопка «Применить», живого обновления нет.
- Диалект = `diagram.databaseType`.
- Невалидный SQL и SQL без таблиц: диаграмма не меняется, «Применить» недоступна.
- Режим «Из диаграммы» (SQL только для чтения, `AuthBlurGate`) остаётся как есть.
- Тексты UI через i18n: ключи добавляются в `ru.ts` (fallback-язык) и `en.ts`.
- Код во фронтенде: отступ 4 пробела, одинарные кавычки, `React.FC` (как в соседних файлах).
- Ничего не пушим в публичный форк, коммиты только локально.

## Структура файлов

| Файл | Ответственность |
|---|---|
| Create `src/pages/editor-page/side-panel/ddl-section/apply-ddl.ts` | `parseDdl`, `replaceDiagramContent` (без React) |
| Create `src/pages/editor-page/side-panel/ddl-section/__tests__/apply-ddl.test.ts` | тесты чистой логики |
| Create `src/pages/editor-page/side-panel/ddl-section/ddl-paste-editor.tsx` | редактор, статус, «Применить», подтверждение |
| Create `src/pages/editor-page/side-panel/ddl-section/__tests__/ddl-paste-editor.test.tsx` | тесты компонента |
| Modify `src/pages/editor-page/side-panel/ddl-section/ddl-section.tsx` | переключатель режимов, вызов `updateDiagramData` |
| Modify `src/i18n/locales/ru.ts`, `src/i18n/locales/en.ts` | новые строки в `side_panel.ddl_section` |

Все команды выполняются из `/home/vps/sandbox/erd2-eval`.

---

### Task 1: Логика парсинга и замены (`apply-ddl.ts`)

**Files:**
- Create: `src/pages/editor-page/side-panel/ddl-section/apply-ddl.ts`
- Test: `src/pages/editor-page/side-panel/ddl-section/__tests__/apply-ddl.test.ts`

**Interfaces:**
- Consumes: `validateSQL(sql, databaseType): ValidationResult` и тип `ValidationResult` из `@/lib/data/sql-import/sql-validator`; `parseSQLError({ sqlContent, sourceDatabaseType }): Promise<{ success: boolean; error?: string }>` и `sqlImportToDiagram({ sqlContent, sourceDatabaseType, targetDatabaseType }): Promise<Diagram>` из `@/lib/data/sql-import`.
- Produces:
  - `type DdlParseResult = { status: 'empty' } | { status: 'no-tables'; validation: ValidationResult } | { status: 'error'; message: string; validation: ValidationResult } | { status: 'ok'; diagram: Diagram; validation: ValidationResult }`
  - `parseDdl(sql: string, databaseType: DatabaseType): Promise<DdlParseResult>`
  - `replaceDiagramContent(current: Diagram, parsed: Diagram): Diagram`

- [ ] **Step 1: Write the failing test**

Создать `src/pages/editor-page/side-panel/ddl-section/__tests__/apply-ddl.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { DatabaseType } from '@/lib/domain/database-type';
import type { Diagram } from '@/lib/domain/diagram';
import { parseDdl, replaceDiagramContent } from '../apply-ddl';

const VALID_SQL = `
CREATE TABLE users (id SERIAL PRIMARY KEY, email VARCHAR(255) NOT NULL);
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id)
);
`;

describe('parseDdl', () => {
    it('возвращает empty для пустой строки', async () => {
        const result = await parseDdl('   \n ', DatabaseType.POSTGRESQL);
        expect(result.status).toBe('empty');
    });

    it('парсит валидный SQL в диаграмму с таблицами и связью', async () => {
        const result = await parseDdl(VALID_SQL, DatabaseType.POSTGRESQL);
        expect(result.status).toBe('ok');
        if (result.status !== 'ok') return;
        expect(result.diagram.tables?.map((t) => t.name).sort()).toEqual([
            'orders',
            'users',
        ]);
        expect(result.diagram.relationships).toHaveLength(1);
        expect(result.validation.tableCount).toBe(2);
        expect(result.validation.relationshipCount).toBe(1);
    });

    it('возвращает error для синтаксически неверного SQL', async () => {
        const result = await parseDdl(
            'CREATE TABLE users (id SERIAL PRIMARY KEY,,, );',
            DatabaseType.POSTGRESQL
        );
        expect(result.status).toBe('error');
    });

    it('возвращает no-tables, если в SQL нет таблиц', async () => {
        const result = await parseDdl('SELECT 1;', DatabaseType.POSTGRESQL);
        expect(['no-tables', 'error']).toContain(result.status);
        expect(result.status).not.toBe('ok');
    });
});

describe('replaceDiagramContent', () => {
    it('сохраняет id/имя/тип БД и подменяет таблицы и связи', async () => {
        const parsedResult = await parseDdl(VALID_SQL, DatabaseType.POSTGRESQL);
        if (parsedResult.status !== 'ok') throw new Error('parse failed');

        const current: Diagram = {
            id: 'diagram-1',
            name: 'Моя схема',
            databaseType: DatabaseType.POSTGRESQL,
            tables: [],
            relationships: [],
            createdAt: new Date('2026-01-01'),
            updatedAt: new Date('2026-01-01'),
        };

        const next = replaceDiagramContent(current, parsedResult.diagram);

        expect(next.id).toBe('diagram-1');
        expect(next.name).toBe('Моя схема');
        expect(next.databaseType).toBe(DatabaseType.POSTGRESQL);
        expect(next.createdAt).toEqual(current.createdAt);
        expect(next.tables).toHaveLength(2);
        expect(next.relationships).toHaveLength(1);
        expect(next.updatedAt.getTime()).toBeGreaterThan(
            current.updatedAt.getTime()
        );
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/pages/editor-page/side-panel/ddl-section/__tests__/apply-ddl.test.ts`
Expected: FAIL — «Failed to resolve import "../apply-ddl"».

- [ ] **Step 3: Write minimal implementation**

Создать `src/pages/editor-page/side-panel/ddl-section/apply-ddl.ts`:

```ts
import type { DatabaseType } from '@/lib/domain/database-type';
import type { Diagram } from '@/lib/domain/diagram';
import { parseSQLError, sqlImportToDiagram } from '@/lib/data/sql-import';
import {
    validateSQL,
    type ValidationResult,
} from '@/lib/data/sql-import/sql-validator';

export type DdlParseResult =
    | { status: 'empty' }
    | { status: 'no-tables'; validation: ValidationResult }
    | { status: 'error'; message: string; validation: ValidationResult }
    | { status: 'ok'; diagram: Diagram; validation: ValidationResult };

export const parseDdl = async (
    sql: string,
    databaseType: DatabaseType
): Promise<DdlParseResult> => {
    if (!sql.trim()) {
        return { status: 'empty' };
    }

    const validation = validateSQL(sql, databaseType);

    // Те же правила, что в диалоге импорта: ошибки с автоисправлением
    // не парсим, остальные отдаём парсеру
    if (validation.fixedSQL && validation.errors.length > 0) {
        return {
            status: 'error',
            message: validation.errors[0].message,
            validation,
        };
    }

    const check = await parseSQLError({
        sqlContent: sql,
        sourceDatabaseType: databaseType,
    });
    if (!check.success) {
        return {
            status: 'error',
            message: check.error ?? 'SQL contains syntax errors',
            validation,
        };
    }

    try {
        const diagram = await sqlImportToDiagram({
            sqlContent: sql,
            sourceDatabaseType: databaseType,
            targetDatabaseType: databaseType,
        });
        const tableCount = diagram.tables?.length ?? 0;
        const relationshipCount = diagram.relationships?.length ?? 0;
        const counted = { ...validation, tableCount, relationshipCount };

        if (tableCount === 0) {
            return { status: 'no-tables', validation: counted };
        }
        return { status: 'ok', diagram, validation: counted };
    } catch (error) {
        return {
            status: 'error',
            message: error instanceof Error ? error.message : String(error),
            validation,
        };
    }
};

// Id, имя, тип БД и даты создания остаются от текущей диаграммы;
// содержимое (таблицы, связи, зависимости, типы) берётся из SQL
export const replaceDiagramContent = (
    current: Diagram,
    parsed: Diagram
): Diagram => ({
    ...current,
    tables: parsed.tables ?? [],
    relationships: parsed.relationships ?? [],
    dependencies: parsed.dependencies ?? [],
    customTypes: parsed.customTypes ?? [],
    areas: [],
    notes: [],
    updatedAt: new Date(),
});
```

Примечание: тест `updatedAt` сравнивает с 2026-01-01, `new Date()` заведомо позже.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/pages/editor-page/side-panel/ddl-section/__tests__/apply-ddl.test.ts`
Expected: PASS (5 тестов). Если тест `no-tables` падает потому, что `SELECT 1;` даёт `ok` с нулём таблиц, — это баг: такой случай обязан вернуть `no-tables`; чинится в `parseDdl`, не в тесте.

- [ ] **Step 5: Commit**

```bash
git add src/pages/editor-page/side-panel/ddl-section/apply-ddl.ts src/pages/editor-page/side-panel/ddl-section/__tests__/apply-ddl.test.ts
git commit -m "feat(erd2): parseDdl и replaceDiagramContent для вставки SQL во вкладке DDL"
```

---

### Task 2: Строки i18n

**Files:**
- Modify: `src/i18n/locales/ru.ts` (блок `side_panel`, строка ~121)
- Modify: `src/i18n/locales/en.ts` (блок `side_panel`, строка ~122)

**Interfaces:**
- Produces ключи `side_panel.ddl_section.*`: `mode_diagram`, `mode_custom`, `placeholder`, `apply`, `no_tables`, `confirm_title`, `confirm_description`, `confirm_action`, `confirm_cancel`.

- [ ] **Step 1: Добавить ключи в ru.ts**

В `side_panel: {` сразу после строки `view_all_options` добавить:

```ts
            ddl_section: {
                mode_diagram: 'Из диаграммы',
                mode_custom: 'Свой SQL',
                placeholder: 'Вставьте сюда CREATE TABLE …',
                apply: 'Применить',
                no_tables: 'В SQL не найдено ни одной таблицы',
                confirm_title: 'Заменить текущую диаграмму?',
                confirm_description:
                    'Таблицы и связи на холсте будут заменены схемой из вашего SQL. Отменить это действие будет нельзя.',
                confirm_action: 'Заменить',
                confirm_cancel: 'Отмена',
            },
```

- [ ] **Step 2: Добавить ключи в en.ts**

В `side_panel: {` после `view_all_options: 'View all Options...',`:

```ts
            ddl_section: {
                mode_diagram: 'From diagram',
                mode_custom: 'Your SQL',
                placeholder: 'Paste your CREATE TABLE statements here…',
                apply: 'Apply',
                no_tables: 'No tables found in the SQL',
                confirm_title: 'Replace the current diagram?',
                confirm_description:
                    'Tables and relationships on the canvas will be replaced with the schema from your SQL. This cannot be undone.',
                confirm_action: 'Replace',
                confirm_cancel: 'Cancel',
            },
```

- [ ] **Step 3: Проверить типы**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: без ошибок (если локали типизированы по `en.ts`, остальные языки не требуют ключа — fallback `ru`; при ошибке «property missing» добавить те же строки в остальные локали).

- [ ] **Step 4: Commit**

```bash
git add src/i18n/locales/ru.ts src/i18n/locales/en.ts
git commit -m "i18n(erd2): строки вставки своего SQL во вкладке DDL"
```

---

### Task 3: Компонент `DdlPasteEditor`

**Files:**
- Create: `src/pages/editor-page/side-panel/ddl-section/ddl-paste-editor.tsx`
- Test: `src/pages/editor-page/side-panel/ddl-section/__tests__/ddl-paste-editor.test.tsx`

**Interfaces:**
- Consumes: `parseDdl`, `replaceDiagramContent`, `DdlParseResult` (Task 1); ключи `side_panel.ddl_section.*` (Task 2); `useAlert().showAlert({ title, description, actionLabel, closeLabel, onAction })`.
- Produces: `DdlPasteEditor: React.FC<{ currentDiagram: Diagram; onApply: (diagram: Diagram) => Promise<void> | void }>`. `onApply` получает уже собранную диаграмму (результат `replaceDiagramContent`).

- [ ] **Step 1: Write the failing test**

Создать `src/pages/editor-page/side-panel/ddl-section/__tests__/ddl-paste-editor.test.tsx`:

```tsx
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@/i18n/i18n';

import { DdlPasteEditor } from '../ddl-paste-editor';
import { DatabaseType } from '@/lib/domain/database-type';
import type { Diagram } from '@/lib/domain/diagram';

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

const showAlert = vi.fn();
vi.mock('@/context/alert-context/alert-context', () => ({
    useAlert: () => ({ showAlert, closeAlert: vi.fn() }),
}));

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
    });

    it('«Применить» отключена, пока SQL пустой', () => {
        render(
            <DdlPasteEditor currentDiagram={emptyDiagram} onApply={vi.fn()} />
        );
        expect(applyButton()).toBeDisabled();
    });

    it('валидный SQL на пустой диаграмме применяется без подтверждения', async () => {
        const onApply = vi.fn();
        render(
            <DdlPasteEditor currentDiagram={emptyDiagram} onApply={onApply} />
        );

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

    it('невалидный SQL оставляет «Применить» отключённой', async () => {
        const onApply = vi.fn();
        render(
            <DdlPasteEditor currentDiagram={emptyDiagram} onApply={onApply} />
        );

        typeSql('CREATE TABLE users (id SERIAL PRIMARY KEY,,, );');
        // ждём, пока пройдёт debounce и парсинг
        await new Promise((resolve) => setTimeout(resolve, 1200));

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
        render(<DdlPasteEditor currentDiagram={filled} onApply={onApply} />);

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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/pages/editor-page/side-panel/ddl-section/__tests__/ddl-paste-editor.test.tsx`
Expected: FAIL — «Failed to resolve import "../ddl-paste-editor"».

- [ ] **Step 3: Write minimal implementation**

Создать `src/pages/editor-page/side-panel/ddl-section/ddl-paste-editor.tsx`:

```tsx
import React, {
    Suspense,
    useCallback,
    useEffect,
    useMemo,
    useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Editor } from '@/components/code-snippet/code-snippet';
import { Button } from '@/components/button/button';
import { Spinner } from '@/components/spinner/spinner';
import { useTheme } from '@/hooks/use-theme';
import { useAlert } from '@/context/alert-context/alert-context';
import { SQLValidationStatus } from '@/dialogs/common/import-database/sql-validation-status';
import { setupDBMLLanguage } from '@/components/code-snippet/languages/dbml-language';
import type { Diagram } from '@/lib/domain/diagram';
import {
    parseDdl,
    replaceDiagramContent,
    type DdlParseResult,
} from './apply-ddl';

const PARSE_DEBOUNCE_MS = 500;

export interface DdlPasteEditorProps {
    currentDiagram: Diagram;
    onApply: (diagram: Diagram) => Promise<void> | void;
}

export const DdlPasteEditor: React.FC<DdlPasteEditorProps> = ({
    currentDiagram,
    onApply,
}) => {
    const { t } = useTranslation();
    const { effectiveTheme } = useTheme();
    const { showAlert } = useAlert();
    const [sql, setSql] = useState('');
    // null — идёт разбор (после последнего ввода ещё не завершился)
    const [result, setResult] = useState<DdlParseResult | null>({
        status: 'empty',
    });
    const { databaseType } = currentDiagram;

    useEffect(() => {
        if (!sql.trim()) {
            setResult({ status: 'empty' });
            return;
        }

        let cancelled = false;
        setResult(null);
        const timer = setTimeout(async () => {
            const parsed = await parseDdl(sql, databaseType);
            if (!cancelled) {
                setResult(parsed);
            }
        }, PARSE_DEBOUNCE_MS);

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [sql, databaseType]);

    const applyParsed = useCallback(
        async (parsed: Diagram) => {
            await onApply(replaceDiagramContent(currentDiagram, parsed));
            setSql('');
        },
        [currentDiagram, onApply]
    );

    const handleApply = useCallback(() => {
        if (result?.status !== 'ok') {
            return;
        }
        const parsed = result.diagram;

        if ((currentDiagram.tables?.length ?? 0) === 0) {
            void applyParsed(parsed);
            return;
        }

        showAlert({
            title: t('side_panel.ddl_section.confirm_title'),
            description: t('side_panel.ddl_section.confirm_description'),
            actionLabel: t('side_panel.ddl_section.confirm_action'),
            closeLabel: t('side_panel.ddl_section.confirm_cancel'),
            onAction: () => void applyParsed(parsed),
        });
    }, [result, currentDiagram.tables, applyParsed, showAlert, t]);

    const statusMessage = useMemo(() => {
        if (result?.status === 'error') {
            return result.message;
        }
        if (result?.status === 'no-tables') {
            return t('side_panel.ddl_section.no_tables');
        }
        return '';
    }, [result, t]);

    const validation =
        result && result.status !== 'empty' ? result.validation : null;

    return (
        <div className="flex flex-1 flex-col gap-2 overflow-hidden">
            <div className="min-h-40 flex-1 overflow-hidden rounded-md border">
                <Suspense fallback={<Spinner />}>
                    <Editor
                        value={sql}
                        onChange={(value) => setSql(value ?? '')}
                        language="sql"
                        loading={<Spinner />}
                        beforeMount={setupDBMLLanguage}
                        theme={
                            effectiveTheme === 'dark'
                                ? 'dbml-dark'
                                : 'dbml-light'
                        }
                        options={{
                            editContext: false,
                            formatOnPaste: false,
                            minimap: { enabled: false },
                            scrollBeyondLastLine: false,
                            automaticLayout: true,
                            lineNumbers: 'on',
                            lineNumbersMinChars: 3,
                            renderValidationDecorations: 'off',
                            contextmenu: false,
                        }}
                        className="size-full"
                    />
                </Suspense>
            </div>

            <SQLValidationStatus
                validation={validation}
                errorMessage={statusMessage}
            />

            <Button
                className="shrink-0"
                disabled={result?.status !== 'ok'}
                onClick={handleApply}
            >
                {t('side_panel.ddl_section.apply')}
            </Button>
        </div>
    );
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/pages/editor-page/side-panel/ddl-section/__tests__/ddl-paste-editor.test.tsx`
Expected: PASS (4 теста).

- [ ] **Step 5: Lint и типы**

Run: `npx tsc -p tsconfig.app.json --noEmit && npx eslint src/pages/editor-page/side-panel/ddl-section`
Expected: без ошибок. Если eslint ругается на `void` или порядок импортов — поправить по правилам проекта.

- [ ] **Step 6: Commit**

```bash
git add src/pages/editor-page/side-panel/ddl-section/ddl-paste-editor.tsx src/pages/editor-page/side-panel/ddl-section/__tests__/ddl-paste-editor.test.tsx
git commit -m "feat(erd2): редактор своего SQL с проверкой и подтверждением замены"
```

---

### Task 4: Переключатель режимов в `DDLSection`

**Files:**
- Modify: `src/pages/editor-page/side-panel/ddl-section/ddl-section.tsx`

**Interfaces:**
- Consumes: `DdlPasteEditor` (Task 3); `useChartDB()` → `currentDiagram`, `updateDiagramData(diagram, options?)`; ключи `side_panel.ddl_section.mode_diagram` / `mode_custom`.

- [ ] **Step 1: Переписать компонент**

Заменить содержимое [ddl-section.tsx](../../src/pages/editor-page/side-panel/ddl-section/ddl-section.tsx) целиком (логика режима «Из диаграммы» не меняется):

```tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useChartDB } from '@/hooks/use-chartdb';
import { CodeSnippet } from '@/components/code-snippet/code-snippet';
import { AuthBlurGate } from '@/components/auth-blur-gate/auth-blur-gate';
import { Button } from '@/components/button/button';
import { exportBaseSQL } from '@/lib/data/sql-export/export-sql-script';
import type { Diagram } from '@/lib/domain/diagram';
import { DdlPasteEditor } from './ddl-paste-editor';

const DDL_DEBOUNCE_MS = 300;

type DdlMode = 'diagram' | 'custom';

export const DDLSection: React.FC = () => {
    const { t } = useTranslation();
    const { currentDiagram, updateDiagramData } = useChartDB();
    const [mode, setMode] = useState<DdlMode>('diagram');
    const [diagram, setDiagram] = useState(currentDiagram);

    // Пересобираем скрипт не на каждое нажатие клавиши, а после паузы
    useEffect(() => {
        const timeout = setTimeout(
            () => setDiagram(currentDiagram),
            DDL_DEBOUNCE_MS
        );
        return () => clearTimeout(timeout);
    }, [currentDiagram]);

    const ddl = useMemo(() => {
        if (!diagram.tables?.length) {
            return '';
        }
        try {
            return exportBaseSQL({
                diagram,
                targetDatabaseType: diagram.databaseType,
            });
        } catch {
            return '';
        }
    }, [diagram]);

    const handleApply = useCallback(
        async (next: Diagram) => {
            await updateDiagramData(next);
            setMode('diagram');
        },
        [updateDiagramData]
    );

    return (
        <section
            className="flex flex-1 flex-col overflow-hidden px-2"
            data-vaul-no-drag
        >
            <div className="flex flex-1 flex-col overflow-hidden">
                <AuthBlurGate>
                    <div className="mb-1 flex shrink-0 gap-1">
                        <Button
                            size="sm"
                            variant={mode === 'diagram' ? 'secondary' : 'ghost'}
                            onClick={() => setMode('diagram')}
                        >
                            {t('side_panel.ddl_section.mode_diagram')}
                        </Button>
                        <Button
                            size="sm"
                            variant={mode === 'custom' ? 'secondary' : 'ghost'}
                            onClick={() => setMode('custom')}
                        >
                            {t('side_panel.ddl_section.mode_custom')}
                        </Button>
                    </div>

                    {mode === 'diagram' ? (
                        <CodeSnippet
                            code={ddl}
                            className="my-0.5"
                            language="sql"
                            actionsTooltipSide="right"
                            editorProps={{
                                options: { readOnly: true },
                            }}
                        />
                    ) : (
                        <DdlPasteEditor
                            currentDiagram={currentDiagram}
                            onApply={handleApply}
                        />
                    )}
                </AuthBlurGate>
            </div>
        </section>
    );
};
```

- [ ] **Step 2: Типы, линт, все тесты**

Run: `npx tsc -p tsconfig.app.json --noEmit && npx eslint src/pages/editor-page/side-panel/ddl-section && npx vitest run`
Expected: без ошибок типов и линта; весь набор тестов зелёный (допустимо только то, что падало до изменений — сверить с `git stash`-прогоном, если что-то красное).

- [ ] **Step 3: Commit**

```bash
git add src/pages/editor-page/side-panel/ddl-section/ddl-section.tsx
git commit -m "feat(erd2): вкладка DDL — режим «Свой SQL» с применением к диаграмме"
```

---

### Task 5: Проверка в браузере

**Files:** без изменений кода (если найдутся баги — правки в файлах Task 1–4 и отдельный коммит).

- [ ] **Step 1: Запустить dev-сервер**

Run (в фоне): `npm run dev -- --host 127.0.0.1`
Expected: Vite печатает локальный URL (порт из `vite.config.ts`; ERD2 живёт под `/tools/erd2` или `/tools/erd` — открыть тот путь, который выводит Vite/`base`).

- [ ] **Step 2: Прогнать сценарии через playwright (mcp)**

В редакторе (для обхода `AuthBlurGate` выставить признак входа так, как делает `isLoggedIn()` из `src/lib/sqllab-account.ts` — посмотреть, какой cookie/localStorage он читает, и задать его через `browser_evaluate`):

1. Новая пустая диаграмма → вкладка DDL → «Свой SQL» → вставить DDL из двух связанных таблиц → статус «найдено 2 таблицы, 1 связь» → «Применить» → на холсте появились таблицы и связь, режим вернулся на «Из диаграммы», SQL там совпадает по таблицам.
2. Диаграмма с таблицами → «Свой SQL» → вставить другой DDL → «Применить» → появилось подтверждение → «Отмена»: диаграмма не изменилась; повторить и «Заменить»: схема заменена.
3. Вставить SQL с синтаксической ошибкой → показана ошибка, «Применить» неактивна.
4. Тёмная тема и узкая (мобильная) ширина: редактор и кнопка не вылезают за панель.
5. Undo/redo после замены: зафиксировать фактическое поведение (ожидаемо — история сброшена `loadDiagramFromData`); если пользователю это критично, сообщить отдельно, не чинить молча.

Expected: все 5 сценариев проходят; результаты (скриншоты, фактическое поведение undo) записать в итоговый отчёт.

- [ ] **Step 3: Остановить dev-сервер и отчитаться**

Остановить фоновый процесс. Итог для пользователя: что проверено в браузере, что нет (в т.ч. не проверялось на проде), что undo сбрасывается (если подтвердилось). Деплой и пуш в форк — только по явной команде.
