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

        // Break the DDL by appending garbage that won't parse.
        typeInEditor(validDdlWithRelationship + '\nTHIS IS NOT VALID SQL {{{');

        // Give the (now-invalid) input time to run through validation/debounce.
        await waitFor(
            () => {
                expect(screen.getByTestId('mock-editor')).toHaveValue(
                    validDdlWithRelationship +
                        '\nTHIS IS NOT VALID SQL {{{'
                );
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
});
