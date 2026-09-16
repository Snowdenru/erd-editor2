import React, { useEffect, useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
// Side-effect import: initializes the global i18next singleton, same as
// src/main.tsx does at app bootstrap. ImportDatabase (and the components it
// renders) call useTranslation() without an I18nextProvider, matching how
// it's actually mounted in the app.
import '@/i18n/i18n';

import { ImportDatabase } from '../import-database';
import { Dialog } from '@/components/dialog/dialog';
import { DatabaseType } from '@/lib/domain/database-type';
import type { DatabaseEdition } from '@/lib/domain/database-edition';
import type { ImportMethod } from '@/lib/import-method/import-method';

// Monaco does not work in this project's test environment (happy-dom, no
// real Monaco). Mock the lazily-loaded Editor with a plain controlled
// textarea so tests can drive `scriptResult` the same way the real editor
// does via `onChange`.
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
    // InstructionsSection's DDLInstructionStep also renders read-only code
    // blocks via the same module's CodeSnippet export. That component isn't
    // under test here, so it gets a trivial stub instead of real Monaco.
    CodeSnippet: ({ code }: { code: string }) => <pre>{code}</pre>,
}));

interface TestWrapperProps {
    importMethod: ImportMethod;
    databaseType?: DatabaseType;
}

// ImportDatabase's scriptResult/importMethod are meant to be controlled
// from outside (see create-diagram-dialog.tsx), so this wrapper mirrors
// that with its own useState, matching real app wiring. Re-rendering the
// wrapper with a new `importMethod` prop syncs it into the controlled
// state, which is how test case 3 exercises a method switch.
function TestWrapper({
    importMethod,
    databaseType = DatabaseType.POSTGRESQL,
}: TestWrapperProps) {
    const [scriptResult, setScriptResult] = useState('');
    const [databaseEdition, setDatabaseEdition] = useState<
        DatabaseEdition | undefined
    >(undefined);
    const [method, setMethod] = useState<ImportMethod>(importMethod);

    useEffect(() => {
        setMethod(importMethod);
    }, [importMethod]);

    return (
        // ImportDatabase renders DialogHeader/DialogTitle/DialogDescription,
        // which are Radix primitives that require a Dialog.Root ancestor -
        // matching how the component is actually mounted inside
        // CreateDiagramDialog's <Dialog> in the real app.
        <Dialog open>
            <ImportDatabase
                onImport={() => {}}
                scriptResult={scriptResult}
                setScriptResult={setScriptResult}
                databaseType={databaseType}
                databaseEdition={databaseEdition}
                setDatabaseEdition={setDatabaseEdition}
                title="Import database"
                importMethod={method}
                setImportMethod={setMethod}
                keepDialogAfterImport={true}
            />
        </Dialog>
    );
}

const validDdlWithRelationship = `
CREATE TABLE users (id INT PRIMARY KEY);
CREATE TABLE orders (id INT PRIMARY KEY, user_id INT REFERENCES users(id));
`;

// MySQL-flavored DDL used specifically for the "broken DDL" test below.
// Postgres' importer (used by every other test in this file) is
// deliberately fault-tolerant: unrecognized text is classified as an
// "other" statement and silently dropped rather than raising a parse
// error, so garbage appended to Postgres DDL never actually reaches
// import-database.tsx's `!result.success` branch - the promise just
// resolves successfully again with the same tables. MySQL's importer,
// by contrast, deterministically rejects inline `REFERENCES` in a column
// definition (it requires an explicit FOREIGN KEY constraint instead),
// which gives us a genuine, reproducible parse failure to synchronize on.
const validMysqlDdlWithRelationship = `
CREATE TABLE users (id INT PRIMARY KEY);
CREATE TABLE orders (id INT PRIMARY KEY, user_id INT, FOREIGN KEY (user_id) REFERENCES users(id));
`;
const mysqlDdlWithInlineReferences =
    validMysqlDdlWithRelationship +
    '\nCREATE TABLE broken (id INT, other_id INT REFERENCES users(id));';

function typeInEditor(value: string) {
    fireEvent.change(screen.getByTestId('mock-editor'), {
        target: { value },
    });
}

describe('ImportDatabase - DDL live preview lifecycle', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders the live preview with the parsed tables once valid DDL settles', async () => {
        render(<TestWrapper importMethod="ddl" />);

        typeInEditor(validDdlWithRelationship);

        await waitFor(
            () => {
                expect(
                    screen.getByTestId('ddl-live-preview')
                ).toBeInTheDocument();
            },
            { timeout: 3000 }
        );

        expect(
            screen.getAllByTestId('ddl-live-preview-table')
        ).toHaveLength(2);
    });

    it('keeps the last valid preview on screen after the DDL is broken', async () => {
        render(
            <TestWrapper importMethod="ddl" databaseType={DatabaseType.MYSQL} />
        );

        typeInEditor(validMysqlDdlWithRelationship);

        await waitFor(
            () => {
                expect(
                    screen.getAllByTestId('ddl-live-preview-table')
                ).toHaveLength(2);
            },
            { timeout: 3000 }
        );

        // Break the DDL: MySQL's importer rejects inline REFERENCES in a
        // column definition, so this statement makes the async
        // parseSQLError(...).then(...) chain in import-database.tsx
        // resolve with success: false and a real, deterministic error.
        typeInEditor(mysqlDdlWithInlineReferences);

        // Wait for the actual error UI to appear. Unlike waiting on the
        // editor's value (which only proves the debounce flushed the text
        // into state), this only becomes true once the parse promise has
        // resolved and taken the `!result.success` branch - a genuine
        // synchronization point on the async chain actually completing.
        await waitFor(
            () => {
                expect(
                    screen.getByText(/does not support inline REFERENCES/i)
                ).toBeInTheDocument();
            },
            { timeout: 3000 }
        );

        // The previously-rendered preview must still be there - it should
        // never be cleared just because the latest input fails to parse.
        expect(screen.getByTestId('ddl-live-preview')).toBeInTheDocument();
        expect(
            screen.getAllByTestId('ddl-live-preview-table')
        ).toHaveLength(2);
    });

    it('removes the live preview when switching away from ddl/dbml', async () => {
        const { rerender } = render(<TestWrapper importMethod="ddl" />);

        typeInEditor(validDdlWithRelationship);

        await waitFor(
            () => {
                expect(
                    screen.getAllByTestId('ddl-live-preview-table')
                ).toHaveLength(2);
            },
            { timeout: 3000 }
        );

        rerender(<TestWrapper importMethod="query" />);

        await waitFor(() => {
            expect(
                screen.queryByTestId('ddl-live-preview')
            ).not.toBeInTheDocument();
            expect(
                screen.queryByTestId('ddl-live-preview-empty')
            ).not.toBeInTheDocument();
        });
    });

    it('clears the live preview when the editor is emptied', async () => {
        render(<TestWrapper importMethod="ddl" />);

        typeInEditor(validDdlWithRelationship);

        await waitFor(
            () => {
                expect(
                    screen.getAllByTestId('ddl-live-preview-table')
                ).toHaveLength(2);
            },
            { timeout: 3000 }
        );

        // Empty out the editor entirely, driving input the same way the
        // other tests do (via the mocked editor's onChange).
        typeInEditor('');

        // Wait for the actual DOM change - the preview swaps from the
        // rendered svg to the "empty" placeholder - rather than an
        // arbitrary timer.
        await waitFor(
            () => {
                expect(
                    screen.getByTestId('ddl-live-preview-empty')
                ).toBeInTheDocument();
            },
            { timeout: 3000 }
        );

        expect(
            screen.queryByTestId('ddl-live-preview')
        ).not.toBeInTheDocument();
        expect(
            screen.queryByTestId('ddl-live-preview-table')
        ).not.toBeInTheDocument();
    });
});
