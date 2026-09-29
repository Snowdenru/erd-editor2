import { describe, it, expect } from 'vitest';
import { exportMySQLToPostgreSQL } from '../cross-dialect/mysql/to-postgresql';
import { exportMySQLToMSSQL } from '../cross-dialect/mysql/to-mssql';
import { exportBaseSQL } from '../export-sql-script';
import { DatabaseType } from '@/lib/domain/database-type';
import type { Diagram } from '@/lib/domain/diagram';
import type { DBTable } from '@/lib/domain/db-table';
import type { DBField } from '@/lib/domain/db-field';

describe('MySQL Cross-Dialect Export Tests', () => {
    let idCounter = 0;
    const testId = () => `test-id-${++idCounter}`;
    const testTime = Date.now();

    const createField = (overrides: Partial<DBField>): DBField =>
        ({
            id: testId(),
            name: 'field',
            type: { id: 'text', name: 'text' },
            primaryKey: false,
            nullable: true,
            unique: false,
            createdAt: testTime,
            ...overrides,
        }) as DBField;

    const createTable = (overrides: Partial<DBTable>): DBTable =>
        ({
            id: testId(),
            name: 'table',
            fields: [],
            indexes: [],
            createdAt: testTime,
            x: 0,
            y: 0,
            width: 200,
            ...overrides,
        }) as DBTable;

    const createDiagram = (overrides: Partial<Diagram>): Diagram =>
        ({
            id: testId(),
            name: 'diagram',
            databaseType: DatabaseType.MYSQL,
            tables: [],
            relationships: [],
            createdAt: testTime,
            updatedAt: testTime,
            ...overrides,
        }) as Diagram;

    describe('MySQL to PostgreSQL Export', () => {
        describe('Type Conversions', () => {
            it('should convert basic integer types', () => {
                const diagram = createDiagram({
                    tables: [
                        createTable({
                            name: 'users',
                            fields: [
                                createField({
                                    name: 'id',
                                    type: { id: 'int', name: 'int' },
                                    primaryKey: true,
                                    nullable: false,
                                }),
                                createField({
                                    name: 'count',
                                    type: { id: 'bigint', name: 'bigint' },
                                }),
                            ],
                        }),
                    ],
                });

                const result = exportMySQLToPostgreSQL({ diagram });

                expect(result).toContain('"id" integer NOT NULL');
                expect(result).toContain('"count" bigint');
            });

            it('should convert boolean to boolean', () => {
                const diagram = createDiagram({
                    tables: [
                        createTable({
                            name: 'flags',
                            fields: [
                                createField({
                                    name: 'is_active',
                                    type: { id: 'boolean', name: 'boolean' },
                                }),
                            ],
                        }),
                    ],
                });

                const result = exportMySQLToPostgreSQL({ diagram });

                expect(result).toContain('"is_active" boolean');
            });

            it('should widen tinyint to smallint with a warning', () => {
                const diagram = createDiagram({
                    tables: [
                        createTable({
                            name: 'items',
                            fields: [
                                createField({
                                    name: 'priority',
                                    type: { id: 'tinyint', name: 'tinyint' },
                                }),
                            ],
                        }),
                    ],
                });

                const result = exportMySQLToPostgreSQL({ diagram });

                expect(result).toContain('"priority" smallint');
                expect(result).toContain('-- Was: tinyint');
            });

            it('should convert json to jsonb with a note', () => {
                const diagram = createDiagram({
                    tables: [
                        createTable({
                            name: 'documents',
                            fields: [
                                createField({
                                    name: 'data',
                                    type: { id: 'json', name: 'json' },
                                }),
                            ],
                        }),
                    ],
                });

                const result = exportMySQLToPostgreSQL({ diagram });

                expect(result).toContain('"data" jsonb');
                expect(result).toContain('-- Was: json');
            });

            it('should flatten enum to varchar(50) with a warning about lost values', () => {
                const diagram = createDiagram({
                    tables: [
                        createTable({
                            name: 'tickets',
                            fields: [
                                createField({
                                    name: 'status',
                                    type: { id: 'enum', name: 'enum' },
                                }),
                            ],
                        }),
                    ],
                });

                const result = exportMySQLToPostgreSQL({ diagram });

                expect(result).toContain('"status" varchar(50)');
                expect(result).toContain('-- Was: enum');
                expect(result).toContain('- tickets.status: Type: enum');
            });

            it('should convert set to text with a warning', () => {
                const diagram = createDiagram({
                    tables: [
                        createTable({
                            name: 'posts',
                            fields: [
                                createField({
                                    name: 'flags',
                                    type: { id: 'set', name: 'set' },
                                }),
                            ],
                        }),
                    ],
                });

                const result = exportMySQLToPostgreSQL({ diagram });

                expect(result).toContain('"flags" text');
                expect(result).toContain('-- Was: set');
            });

            it('should convert spatial types to text and point at PostGIS', () => {
                const diagram = createDiagram({
                    tables: [
                        createTable({
                            name: 'places',
                            fields: [
                                createField({
                                    name: 'location',
                                    type: { id: 'point', name: 'point' },
                                }),
                            ],
                        }),
                    ],
                });

                const result = exportMySQLToPostgreSQL({ diagram });

                expect(result).toContain('"location" text');
                expect(result).toContain('-- Was: point');
            });

            it('should convert varchar with length', () => {
                const diagram = createDiagram({
                    tables: [
                        createTable({
                            name: 'users',
                            fields: [
                                createField({
                                    name: 'email',
                                    type: { id: 'varchar', name: 'varchar' },
                                    characterMaximumLength: '320',
                                }),
                            ],
                        }),
                    ],
                });

                const result = exportMySQLToPostgreSQL({ diagram });

                expect(result).toContain('"email" varchar(320)');
            });
        });

        describe('Auto Increment', () => {
            it('should convert an integer AUTO_INCREMENT primary key to serial', () => {
                const diagram = createDiagram({
                    tables: [
                        createTable({
                            name: 'items',
                            fields: [
                                createField({
                                    name: 'id',
                                    type: { id: 'int', name: 'int' },
                                    primaryKey: true,
                                    nullable: false,
                                    increment: true,
                                }),
                            ],
                        }),
                    ],
                });

                const result = exportMySQLToPostgreSQL({ diagram });

                expect(result).toContain('"id" serial NOT NULL');
                expect(result).not.toContain('DEFAULT');
            });

            it('should convert a bigint AUTO_INCREMENT primary key to bigserial', () => {
                const diagram = createDiagram({
                    tables: [
                        createTable({
                            name: 'items',
                            fields: [
                                createField({
                                    name: 'id',
                                    type: { id: 'bigint', name: 'bigint' },
                                    primaryKey: true,
                                    nullable: false,
                                    increment: true,
                                }),
                            ],
                        }),
                    ],
                });

                const result = exportMySQLToPostgreSQL({ diagram });

                expect(result).toContain('"id" bigserial NOT NULL');
            });
        });

        describe('Default Values', () => {
            it('should convert CURRENT_TIMESTAMP to CURRENT_TIMESTAMP', () => {
                const diagram = createDiagram({
                    tables: [
                        createTable({
                            name: 'logs',
                            fields: [
                                createField({
                                    name: 'created_at',
                                    type: {
                                        id: 'timestamp',
                                        name: 'timestamp',
                                    },
                                    default: 'CURRENT_TIMESTAMP',
                                }),
                            ],
                        }),
                    ],
                });

                const result = exportMySQLToPostgreSQL({ diagram });

                expect(result).toContain('DEFAULT CURRENT_TIMESTAMP');
            });

            it('should drop ON UPDATE CURRENT_TIMESTAMP and warn about it', () => {
                const diagram = createDiagram({
                    tables: [
                        createTable({
                            name: 'logs',
                            fields: [
                                createField({
                                    name: 'updated_at',
                                    type: {
                                        id: 'timestamp',
                                        name: 'timestamp',
                                    },
                                    default:
                                        'CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
                                }),
                            ],
                        }),
                    ],
                });

                const result = exportMySQLToPostgreSQL({ diagram });

                // The DDL default itself must be clean (no PostgreSQL
                // equivalent of ON UPDATE exists), while the warnings header
                // still surfaces the dropped behavior for visibility
                expect(result).toContain(
                    '"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP -- Was: timestamp'
                );
                expect(result).toContain(
                    '- logs.updated_at: ON UPDATE CURRENT_TIMESTAMP'
                );
            });

            it('should convert UUID() to gen_random_uuid()', () => {
                const diagram = createDiagram({
                    tables: [
                        createTable({
                            name: 'entities',
                            fields: [
                                createField({
                                    name: 'id',
                                    type: { id: 'char', name: 'char' },
                                    default: 'UUID()',
                                }),
                            ],
                        }),
                    ],
                });

                const result = exportMySQLToPostgreSQL({ diagram });

                expect(result).toContain('DEFAULT gen_random_uuid()');
            });
        });

        describe('Schema Handling', () => {
            it('should create PostgreSQL schema and quote table names', () => {
                const diagram = createDiagram({
                    tables: [
                        createTable({
                            name: 'users',
                            schema: 'app',
                            fields: [
                                createField({
                                    name: 'id',
                                    type: { id: 'int', name: 'int' },
                                    primaryKey: true,
                                    nullable: false,
                                }),
                            ],
                        }),
                    ],
                });

                const result = exportMySQLToPostgreSQL({ diagram });

                expect(result).toContain(
                    'CREATE SCHEMA IF NOT EXISTS "app"'
                );
                expect(result).toContain('"app"."users"');
            });
        });

        describe('Warnings Header', () => {
            it('should include conversion notes header', () => {
                const diagram = createDiagram({
                    tables: [
                        createTable({
                            name: 'test',
                            fields: [
                                createField({
                                    name: 'data',
                                    type: { id: 'json', name: 'json' },
                                }),
                            ],
                        }),
                    ],
                });

                const result = exportMySQLToPostgreSQL({ diagram });

                expect(result).toContain('-- MySQL to PostgreSQL conversion');
                expect(result).toContain('-- Generated by ChartDB');
            });
        });

        describe('Index Handling', () => {
            it('should downgrade a FULLTEXT index to GIN with a note', () => {
                const fieldId = testId();
                const diagram = createDiagram({
                    tables: [
                        createTable({
                            name: 'articles',
                            fields: [
                                createField({
                                    id: fieldId,
                                    name: 'body',
                                    type: { id: 'text', name: 'text' },
                                }),
                            ],
                            indexes: [
                                {
                                    id: testId(),
                                    name: 'idx_body',
                                    unique: false,
                                    fieldIds: [fieldId],
                                    createdAt: testTime,
                                    type: 'fulltext',
                                },
                            ],
                        }),
                    ],
                });

                const result = exportMySQLToPostgreSQL({ diagram });

                expect(result).toContain('CREATE INDEX');
                expect(result).toContain('USING gin');
                expect(result).toContain('to_tsvector');
            });
        });

        describe('Foreign Key Handling', () => {
            it('should generate foreign keys with PostgreSQL syntax', () => {
                const sourceFieldId = testId();
                const targetFieldId = testId();
                const sourceTableId = testId();
                const targetTableId = testId();

                const diagram = createDiagram({
                    tables: [
                        createTable({
                            id: sourceTableId,
                            name: 'orders',
                            fields: [
                                createField({
                                    id: sourceFieldId,
                                    name: 'user_id',
                                    type: { id: 'int', name: 'int' },
                                }),
                            ],
                        }),
                        createTable({
                            id: targetTableId,
                            name: 'users',
                            fields: [
                                createField({
                                    id: targetFieldId,
                                    name: 'id',
                                    type: { id: 'int', name: 'int' },
                                    primaryKey: true,
                                }),
                            ],
                        }),
                    ],
                    relationships: [
                        {
                            id: testId(),
                            name: 'fk_orders_users',
                            sourceTableId,
                            targetTableId,
                            sourceFieldId,
                            targetFieldId,
                            sourceCardinality: 'many',
                            targetCardinality: 'one',
                            createdAt: testTime,
                        },
                    ],
                });

                const result = exportMySQLToPostgreSQL({ diagram });

                expect(result).toContain('ALTER TABLE');
                expect(result).toContain('ADD CONSTRAINT');
                expect(result).toContain('FOREIGN KEY');
                expect(result).toContain('REFERENCES');
            });
        });
    });

    describe('MySQL to SQL Server Export', () => {
        it('should convert boolean to BIT', () => {
            const diagram = createDiagram({
                tables: [
                    createTable({
                        name: 'flags',
                        fields: [
                            createField({
                                name: 'is_active',
                                type: { id: 'boolean', name: 'boolean' },
                            }),
                        ],
                    }),
                ],
            });

            const result = exportMySQLToMSSQL({ diagram });

            expect(result).toContain('BIT');
        });

        it('should convert an AUTO_INCREMENT primary key to IDENTITY(1,1)', () => {
            const diagram = createDiagram({
                tables: [
                    createTable({
                        name: 'items',
                        fields: [
                            createField({
                                name: 'id',
                                type: { id: 'int', name: 'int' },
                                primaryKey: true,
                                nullable: false,
                                increment: true,
                            }),
                        ],
                    }),
                ],
            });

            const result = exportMySQLToMSSQL({ diagram });

            expect(result).toContain('IDENTITY(1,1)');
        });

        it('should convert text to NVARCHAR(MAX)', () => {
            const diagram = createDiagram({
                tables: [
                    createTable({
                        name: 'articles',
                        fields: [
                            createField({
                                name: 'content',
                                type: { id: 'text', name: 'text' },
                            }),
                        ],
                    }),
                ],
            });

            const result = exportMySQLToMSSQL({ diagram });

            expect(result).toContain('NVARCHAR(MAX)');
        });

        it('should create SQL Server schema', () => {
            const diagram = createDiagram({
                tables: [
                    createTable({
                        name: 'users',
                        schema: 'app',
                        fields: [
                            createField({
                                name: 'id',
                                type: { id: 'int', name: 'int' },
                                primaryKey: true,
                                nullable: false,
                            }),
                        ],
                    }),
                ],
            });

            const result = exportMySQLToMSSQL({ diagram });

            expect(result).toContain(
                "SELECT * FROM sys.schemas WHERE name = 'app'"
            );
            expect(result).toContain('[app].[users]');
        });
    });

    describe('Export Routing via exportBaseSQL', () => {
        it('should route MySQL to PostgreSQL through the deterministic exporter', () => {
            const diagram = createDiagram({
                databaseType: DatabaseType.MYSQL,
                tables: [
                    createTable({
                        name: 'test',
                        fields: [
                            createField({
                                name: 'flag',
                                type: { id: 'tinyint', name: 'tinyint' },
                            }),
                        ],
                    }),
                ],
            });

            const result = exportBaseSQL({
                diagram,
                targetDatabaseType: DatabaseType.POSTGRESQL,
            });

            expect(result).toContain('-- MySQL to PostgreSQL conversion');
            expect(result).toContain('smallint');
        });

        it('should route MySQL to SQL Server through the deterministic exporter', () => {
            const diagram = createDiagram({
                databaseType: DatabaseType.MYSQL,
                tables: [
                    createTable({
                        name: 'test',
                        fields: [
                            createField({
                                name: 'flag',
                                type: { id: 'boolean', name: 'boolean' },
                            }),
                        ],
                    }),
                ],
            });

            const result = exportBaseSQL({
                diagram,
                targetDatabaseType: DatabaseType.SQL_SERVER,
            });

            expect(result).toContain('-- MySQL to SQL Server conversion');
            expect(result).toContain('BIT');
        });

        it('does not yet route MariaDB to PostgreSQL through the MySQL deterministic exporter', () => {
            const diagram = createDiagram({
                databaseType: DatabaseType.MARIADB,
                tables: [
                    createTable({
                        name: 'test',
                        fields: [
                            createField({
                                name: 'id',
                                type: { id: 'int', name: 'int' },
                                primaryKey: true,
                                nullable: false,
                            }),
                        ],
                    }),
                ],
            });

            const result = exportBaseSQL({
                diagram,
                targetDatabaseType: DatabaseType.POSTGRESQL,
            });

            expect(result).not.toContain('MySQL to PostgreSQL');
        });
    });
});
