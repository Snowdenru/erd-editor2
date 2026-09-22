import React, { Suspense, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/button/button';
import { useStorage } from '@/hooks/use-storage';
import { DatabaseType } from '@/lib/domain/database-type';
import type { Diagram } from '@/lib/domain/diagram';
import { Spinner } from '@/components/spinner/spinner';
import { LoginPromptDialog } from '@/components/login-prompt/login-prompt-dialog';
import { APP_BASE, isLoggedIn } from '@/lib/sqllab-account';

const DdlCanvasPreview = React.lazy(() =>
    import('./ddl-canvas-preview').then((module) => ({
        default: module.DdlCanvasPreview,
    }))
);

const PARSE_DEBOUNCE_MS = 400;

const DIALECT_OPTIONS: Array<{ label: string; type: DatabaseType }> = [
    { label: 'PostgreSQL', type: DatabaseType.POSTGRESQL },
    { label: 'MySQL', type: DatabaseType.MYSQL },
    { label: 'SQLite', type: DatabaseType.SQLITE },
    { label: 'SQL Server', type: DatabaseType.SQL_SERVER },
    { label: 'MariaDB', type: DatabaseType.MARIADB },
];

const SAMPLE_DDL = `CREATE TABLE customers (
  id serial PRIMARY KEY,
  name varchar(100) NOT NULL,
  email varchar(255) UNIQUE
);

CREATE TABLE products (
  id serial PRIMARY KEY,
  title varchar(200) NOT NULL,
  price numeric(10, 2) NOT NULL
);

CREATE TABLE orders (
  id serial PRIMARY KEY,
  customer_id integer NOT NULL REFERENCES customers (id),
  created_at timestamp DEFAULT now()
);

CREATE TABLE order_items (
  order_id integer NOT NULL REFERENCES orders (id),
  product_id integer NOT NULL REFERENCES products (id),
  quantity integer NOT NULL,
  PRIMARY KEY (order_id, product_id)
);`;

export const DdlTryBlock: React.FC = () => {
    const navigate = useNavigate();
    const { addDiagram } = useStorage();
    const [sql, setSql] = useState(SAMPLE_DDL);
    const [databaseType, setDatabaseType] = useState<DatabaseType>(
        DatabaseType.POSTGRESQL
    );
    const [diagram, setDiagram] = useState<Diagram | undefined>();
    const [error, setError] = useState<string>('');
    const [isOpening, setIsOpening] = useState(false);
    const [promptForId, setPromptForId] = useState<string | null>(null);

    useEffect(() => {
        if (!sql.trim()) {
            setDiagram(undefined);
            setError('');
            return;
        }

        let cancelled = false;
        const timeout = setTimeout(async () => {
            try {
                // Парсер тяжёлый — грузим его только когда до блока дошли
                const { sqlImportToDiagram } =
                    await import('@/lib/data/sql-import');
                const result = await sqlImportToDiagram({
                    sqlContent: sql,
                    sourceDatabaseType: databaseType,
                    targetDatabaseType: databaseType,
                });
                if (!cancelled) {
                    setDiagram(result);
                    setError(
                        result.tables?.length
                            ? ''
                            : 'Таблицы не найдены — вставьте CREATE TABLE и проверьте выбранный диалект.'
                    );
                }
            } catch {
                if (!cancelled) {
                    setError(
                        'Не получается разобрать SQL — проверьте синтаксис и выбранный диалект.'
                    );
                }
            }
        }, PARSE_DEBOUNCE_MS);

        return () => {
            cancelled = true;
            clearTimeout(timeout);
        };
    }, [sql, databaseType]);

    const hasTables = (diagram?.tables?.length ?? 0) > 0;

    const openInEditor = async () => {
        if (!diagram || !hasTables) {
            return;
        }
        setIsOpening(true);
        const now = new Date();
        await addDiagram({
            diagram: {
                ...diagram,
                name: 'Моя схема',
                createdAt: now,
                updatedAt: now,
            },
        });

        if (isLoggedIn()) {
            navigate(`/diagrams/${diagram.id}`);
            return;
        }
        // Схема уже лежит в браузере: после входа пользователь вернётся прямо в неё
        setPromptForId(diagram.id);
    };

    return (
        <div className="mx-auto w-full max-w-6xl px-6 pb-20">
            <div className="mb-8 flex flex-col items-center gap-3 text-center">
                <h2 className="text-4xl font-bold sm:text-5xl">
                    Вставьте DDL — получите диаграмму
                </h2>
                <p className="text-lg text-muted-foreground">
                    Попробуйте прямо здесь: схема строится по мере ввода.
                </p>
            </div>
            <div className="grid gap-5 lg:grid-cols-2">
                <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                        {DIALECT_OPTIONS.map(({ label, type }) => (
                            <button
                                key={type}
                                type="button"
                                onClick={() => setDatabaseType(type)}
                                className={`rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
                                    databaseType === type
                                        ? 'border-pink-600 bg-pink-600 text-white'
                                        : 'text-muted-foreground hover:bg-accent'
                                }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                    <textarea
                        value={sql}
                        onChange={(event) => setSql(event.target.value)}
                        spellCheck={false}
                        aria-label="SQL-скрипт для построения диаграммы"
                        placeholder="Вставьте сюда CREATE TABLE ..."
                        className="h-[420px] w-full resize-y rounded-2xl border bg-card p-4 font-mono text-sm leading-relaxed shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-600"
                    />
                    {error ? (
                        <p className="flex items-start gap-2 text-sm text-destructive">
                            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                            {error}
                        </p>
                    ) : null}
                </div>
                <div className="flex flex-col gap-3">
                    {diagram && hasTables ? (
                        <Suspense
                            fallback={
                                <div className="flex h-[420px] items-center justify-center rounded-2xl border">
                                    <Spinner className="text-pink-600" />
                                </div>
                            }
                        >
                            <DdlCanvasPreview diagram={diagram} />
                        </Suspense>
                    ) : (
                        <div className="flex h-[420px] items-center justify-center rounded-2xl border border-dashed text-sm text-muted-foreground">
                            Схема появится здесь по мере ввода
                        </div>
                    )}
                    <Button
                        type="button"
                        size="lg"
                        disabled={!hasTables || !!error || isOpening}
                        onClick={openInEditor}
                        className="h-12 rounded-xl text-base"
                    >
                        Открыть в редакторе
                        <ArrowRight className="ml-2 size-5" />
                    </Button>
                </div>
            </div>
            <LoginPromptDialog
                open={promptForId !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setPromptForId(null);
                        setIsOpening(false);
                    }
                }}
                reason="save_landing"
                returnPath={
                    promptForId
                        ? `${APP_BASE}/diagrams/${promptForId}`
                        : undefined
                }
                onSecondary={() => {
                    if (promptForId) {
                        navigate(`/diagrams/${promptForId}`);
                    }
                }}
            />
        </div>
    );
};
