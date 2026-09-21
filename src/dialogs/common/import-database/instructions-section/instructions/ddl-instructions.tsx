import React from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { DatabaseType } from '@/lib/domain/database-type';
import type { DatabaseEdition } from '@/lib/domain/database-edition';
import { DDLInstructionStep } from './ddl-instruction-step';

interface DDLInstruction {
    text: (t: TFunction) => string;
    code?: string;
    example?: string;
}

const DDLInstructionsMap: Record<DatabaseType, DDLInstruction[]> = {
    [DatabaseType.GENERIC]: [],
    [DatabaseType.MYSQL]: [
        {
            text: (t) =>
                t('new_diagram_dialog.import_database.ddl.install', {
                    tool: 'mysqldump',
                }),
        },
        {
            text: (t) =>
                t('new_diagram_dialog.import_database.ddl.run_command_sudo'),
            code: `mysqldump -h <host> -u <username>\n-P <port> -p --no-data\n<database_name> > <output_path>`,
            example: `mysqldump -h localhost -u root -P\n3306 -p --no-data my_db >\nschema_export.sql`,
        },
        {
            text: (t) =>
                t('new_diagram_dialog.import_database.ddl.open_exported'),
        },
    ],
    [DatabaseType.POSTGRESQL]: [
        {
            text: (t) =>
                t('new_diagram_dialog.import_database.ddl.install', {
                    tool: 'pg_dump',
                }),
        },
        {
            text: (t) =>
                t('new_diagram_dialog.import_database.ddl.run_command_sudo'),
            code: `pg_dump -h <host> -p <port> -d <database_name> \n  -U <username> -s -F p -E UTF-8 \n  -f <output_file_path>`,
            example: `pg_dump -h localhost -p 5432 -d my_db \n  -U postgres -s -F p -E UTF-8 \n  -f schema_export.sql`,
        },
        {
            text: (t) =>
                t('new_diagram_dialog.import_database.ddl.open_exported'),
        },
    ],
    [DatabaseType.SQLITE]: [
        {
            text: (t) =>
                t('new_diagram_dialog.import_database.ddl.install', {
                    tool: 'sqlite3',
                }),
        },
        {
            text: (t) =>
                t('new_diagram_dialog.import_database.ddl.run_command'),
            code: `sqlite3 <database_file_path>\n".schema" > <output_file_path>`,
            example: `sqlite3 my_db.db\n".schema" > schema_export.sql`,
        },
        {
            text: (t) =>
                t('new_diagram_dialog.import_database.ddl.open_exported'),
        },
    ],
    [DatabaseType.SQL_SERVER]: [
        {
            text: (t) =>
                t('new_diagram_dialog.import_database.ddl.ssms_install'),
        },
        {
            text: (t) =>
                t('new_diagram_dialog.import_database.ddl.ssms_connect'),
        },
        {
            text: (t) =>
                t('new_diagram_dialog.import_database.ddl.ssms_script'),
        },
        {
            text: (t) => t('new_diagram_dialog.import_database.ddl.ssms_copy'),
        },
    ],
    [DatabaseType.CLICKHOUSE]: [],
    [DatabaseType.COCKROACHDB]: [
        {
            text: (t) =>
                t('new_diagram_dialog.import_database.ddl.install', {
                    tool: 'pg_dump',
                }),
        },
        {
            text: (t) =>
                t('new_diagram_dialog.import_database.ddl.run_command_sudo'),
            code: `pg_dump -h <host> -p <port> -d <database_name> \n  -U <username> -s -F p -E UTF-8 \n  -f <output_file_path>`,
            example: `pg_dump -h localhost -p 5432 -d my_db \n  -U postgres -s -F p -E UTF-8 \n  -f schema_export.sql`,
        },
        {
            text: (t) =>
                t('new_diagram_dialog.import_database.ddl.open_exported'),
        },
    ],
    [DatabaseType.MARIADB]: [
        {
            text: (t) =>
                t('new_diagram_dialog.import_database.ddl.install', {
                    tool: 'mysqldump',
                }),
        },
        {
            text: (t) =>
                t('new_diagram_dialog.import_database.ddl.run_command_sudo'),
            code: `mysqldump -h <host> -u <username>\n-P <port> -p --no-data\n<database_name> > <output_path>`,
            example: `mysqldump -h localhost -u root -P\n3306 -p --no-data my_db >\nschema_export.sql`,
        },
        {
            text: (t) =>
                t('new_diagram_dialog.import_database.ddl.open_exported'),
        },
    ],
    [DatabaseType.ORACLE]: [],
};

export interface DDLInstructionsProps {
    databaseType: DatabaseType;
    databaseEdition?: DatabaseEdition;
}

export const DDLInstructions: React.FC<DDLInstructionsProps> = ({
    databaseType,
}) => {
    const { t } = useTranslation();
    return (
        <>
            {DDLInstructionsMap[databaseType].map((instruction, index) => (
                <DDLInstructionStep
                    key={index}
                    index={index + 1}
                    text={instruction.text(t)}
                    code={instruction.code}
                    example={instruction.example}
                />
            ))}
        </>
    );
};
