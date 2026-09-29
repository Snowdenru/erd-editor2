/**
 * Type mappings for MySQL (and MariaDB, which shares its type list) as the
 * source dialect. Maps MySQL types to PostgreSQL and SQL Server equivalents.
 *
 * Scoped to the types this app actually lets a MySQL/MariaDB diagram use
 * (see mysql-data-types.ts / mariadb-data-types.ts) rather than every type
 * MySQL itself supports.
 */

import type {
    TypeMapping,
    TypeMappingTable,
    IndexTypeMappingTable,
} from '../types';

/**
 * MySQL to PostgreSQL type mappings
 */
export const mysqlToPostgreSQL: TypeMappingTable = {
    // Integer types
    int: { targetType: 'integer' },
    smallint: { targetType: 'smallint' },
    mediumint: {
        targetType: 'integer',
        conversionNote:
            'PostgreSQL has no 3-byte integer type; widened to integer',
        includeInlineComment: true,
    },
    bigint: { targetType: 'bigint' },
    tinyint: {
        targetType: 'smallint',
        conversionNote:
            'PostgreSQL has no 1-byte integer type; widened to smallint. Use the "boolean" column type instead of tinyint(1) for true/false flags.',
        includeInlineComment: true,
    },

    // Fixed/floating point types
    decimal: { targetType: 'numeric', defaultPrecision: 10, defaultScale: 0 },
    float: { targetType: 'real' },
    double: { targetType: 'double precision' },

    // Character types
    varchar: { targetType: 'varchar', defaultLength: 255 },
    char: { targetType: 'char', defaultLength: 1 },
    text: { targetType: 'text' },
    tinytext: { targetType: 'text' },
    mediumtext: { targetType: 'text' },
    longtext: { targetType: 'text' },

    // Binary types
    binary: {
        targetType: 'bytea',
        conversionNote:
            'PostgreSQL bytea is variable-length; fixed-length zero-padding is not enforced',
        includeInlineComment: true,
    },
    varbinary: { targetType: 'bytea' },
    tinyblob: { targetType: 'bytea' },
    blob: { targetType: 'bytea' },
    mediumblob: { targetType: 'bytea' },
    longblob: { targetType: 'bytea' },

    // Boolean
    boolean: { targetType: 'boolean' },

    // Date/time types
    date: { targetType: 'date' },
    time: { targetType: 'time' },
    year: {
        targetType: 'smallint',
        conversionNote: 'PostgreSQL has no YEAR type; stored as smallint',
        includeInlineComment: true,
    },
    datetime: { targetType: 'timestamp' },
    timestamp: {
        targetType: 'timestamp',
        conversionNote:
            "MySQL TIMESTAMP auto-converts to/from UTC and this behavior has no PostgreSQL equivalent; use 'timestamptz' and application-level UTC handling if that matters",
        includeInlineComment: true,
    },

    // JSON
    json: {
        targetType: 'jsonb',
        conversionNote:
            'Mapped to jsonb (binary, indexable) rather than json (text); use json instead if byte-for-byte storage is required',
        includeInlineComment: true,
    },

    // Bit
    bit: {
        targetType: 'smallint',
        conversionNote:
            'PostgreSQL bit(n) requires a fixed length this app does not track for MySQL BIT columns; using smallint as a safe bitmask-compatible fallback',
        includeInlineComment: true,
    },

    // Enum / Set (values are not modeled for MySQL fields in this app, same
    // limitation as the native MySQL exporter, which also flattens ENUM)
    enum: {
        targetType: 'varchar',
        defaultLength: 50,
        conversionNote:
            'MySQL ENUM converted to varchar(50); recreate as a native PostgreSQL enum (CREATE TYPE ... AS ENUM) if you need the values enforced',
        includeInlineComment: true,
    },
    set: {
        targetType: 'text',
        conversionNote:
            'MySQL SET (multiple comma-separated values) has no PostgreSQL equivalent; converted to text. Consider a text[] column or a join table',
        includeInlineComment: true,
    },

    // Spatial types - PostgreSQL's built-in geometric types are not
    // GIS-aware (no SRID/projection support) the way MySQL's spatial types
    // are, so downgrading to text and pointing at PostGIS is more honest
    // than picking a same-named built-in type that behaves differently.
    geometry: {
        targetType: 'text',
        conversionNote:
            'MySQL spatial type has no built-in PostgreSQL equivalent; install the PostGIS extension and use its geometry type',
        includeInlineComment: true,
    },
    point: {
        targetType: 'text',
        conversionNote:
            'MySQL spatial type has no built-in PostgreSQL equivalent; install the PostGIS extension and use its geometry(Point) type',
        includeInlineComment: true,
    },
    linestring: {
        targetType: 'text',
        conversionNote:
            'MySQL spatial type has no built-in PostgreSQL equivalent; install the PostGIS extension and use its geometry(LineString) type',
        includeInlineComment: true,
    },
    polygon: {
        targetType: 'text',
        conversionNote:
            'MySQL spatial type has no built-in PostgreSQL equivalent; install the PostGIS extension and use its geometry(Polygon) type',
        includeInlineComment: true,
    },
    multipoint: {
        targetType: 'text',
        conversionNote:
            'MySQL spatial type has no built-in PostgreSQL equivalent; install the PostGIS extension and use its geometry(MultiPoint) type',
        includeInlineComment: true,
    },
    multilinestring: {
        targetType: 'text',
        conversionNote:
            'MySQL spatial type has no built-in PostgreSQL equivalent; install the PostGIS extension and use its geometry(MultiLineString) type',
        includeInlineComment: true,
    },
    multipolygon: {
        targetType: 'text',
        conversionNote:
            'MySQL spatial type has no built-in PostgreSQL equivalent; install the PostGIS extension and use its geometry(MultiPolygon) type',
        includeInlineComment: true,
    },
    geometrycollection: {
        targetType: 'text',
        conversionNote:
            'MySQL spatial type has no built-in PostgreSQL equivalent; install the PostGIS extension and use its geometry(GeometryCollection) type',
        includeInlineComment: true,
    },
};

/**
 * MySQL to SQL Server type mappings
 */
export const mysqlToSQLServer: TypeMappingTable = {
    // Integer types
    int: { targetType: 'INT' },
    smallint: { targetType: 'SMALLINT' },
    mediumint: {
        targetType: 'INT',
        conversionNote:
            'SQL Server has no 3-byte integer type; widened to INT',
        includeInlineComment: true,
    },
    bigint: { targetType: 'BIGINT' },
    tinyint: {
        targetType: 'TINYINT',
        conversionNote:
            'SQL Server TINYINT is unsigned (0-255) while MySQL TINYINT is signed (-128-127) by default; widen to SMALLINT if negative values are used',
        includeInlineComment: true,
    },

    // Fixed/floating point types
    decimal: { targetType: 'DECIMAL', defaultPrecision: 10, defaultScale: 0 },
    float: { targetType: 'REAL' },
    double: { targetType: 'FLOAT' },

    // Character types
    varchar: { targetType: 'NVARCHAR', defaultLength: 255 },
    char: { targetType: 'NCHAR', defaultLength: 1 },
    text: { targetType: 'NVARCHAR(MAX)' },
    tinytext: { targetType: 'NVARCHAR(MAX)' },
    mediumtext: { targetType: 'NVARCHAR(MAX)' },
    longtext: { targetType: 'NVARCHAR(MAX)' },

    // Binary types
    binary: { targetType: 'BINARY' },
    varbinary: { targetType: 'VARBINARY' },
    tinyblob: { targetType: 'VARBINARY(MAX)' },
    blob: { targetType: 'VARBINARY(MAX)' },
    mediumblob: { targetType: 'VARBINARY(MAX)' },
    longblob: { targetType: 'VARBINARY(MAX)' },

    // Boolean
    boolean: { targetType: 'BIT' },

    // Date/time types
    date: { targetType: 'DATE' },
    time: { targetType: 'TIME' },
    year: {
        targetType: 'SMALLINT',
        conversionNote: 'SQL Server has no YEAR type; stored as SMALLINT',
        includeInlineComment: true,
    },
    datetime: { targetType: 'DATETIME2' },
    timestamp: {
        targetType: 'DATETIME2',
        conversionNote:
            'MySQL TIMESTAMP auto-converts to/from UTC; SQL Server DATETIME2 has no equivalent automatic behavior',
        includeInlineComment: true,
    },

    // JSON (SQL Server has no native JSON type; stored as NVARCHAR(MAX))
    json: {
        targetType: 'NVARCHAR(MAX)',
        conversionNote:
            'SQL Server has no native JSON type; use ISJSON()/JSON_VALUE() for validation and querying',
        includeInlineComment: true,
    },

    // Bit
    bit: {
        targetType: 'BINARY',
        defaultLength: 8,
        conversionNote:
            'SQL Server BIT is a single 0/1 flag, not a bitmask; converted to BINARY for a closer size match. Reconsider the column design',
        includeInlineComment: true,
    },

    // Enum / Set
    enum: {
        targetType: 'NVARCHAR',
        defaultLength: 50,
        conversionNote:
            'MySQL ENUM converted to NVARCHAR(50); add a CHECK constraint if the values need to be enforced',
        includeInlineComment: true,
    },
    set: {
        targetType: 'NVARCHAR(MAX)',
        conversionNote:
            'MySQL SET (multiple comma-separated values) has no SQL Server equivalent; converted to NVARCHAR(MAX). Consider a join table',
        includeInlineComment: true,
    },

    // Spatial types
    geometry: { targetType: 'GEOMETRY' },
    point: { targetType: 'GEOMETRY' },
    linestring: { targetType: 'GEOMETRY' },
    polygon: { targetType: 'GEOMETRY' },
    multipoint: { targetType: 'GEOMETRY' },
    multilinestring: { targetType: 'GEOMETRY' },
    multipolygon: { targetType: 'GEOMETRY' },
    geometrycollection: { targetType: 'GEOMETRY' },
};

/**
 * Index type mappings from MySQL to PostgreSQL
 */
export const mysqlIndexTypeToPostgreSQL: IndexTypeMappingTable = {
    btree: { targetType: 'btree' },
    hash: { targetType: 'hash' },
    fulltext: {
        targetType: 'gin',
        note: 'MySQL FULLTEXT index converted to a plain GIN index; wrap the column in to_tsvector(...) for real full-text search',
    },
    spatial: {
        targetType: 'gist',
        note: 'MySQL SPATIAL index converted to GiST; install PostGIS for real spatial indexing',
    },
};

/**
 * Index type mappings from MySQL to SQL Server
 */
export const mysqlIndexTypeToSQLServer: IndexTypeMappingTable = {
    btree: { targetType: 'NONCLUSTERED' },
    hash: {
        targetType: 'NONCLUSTERED',
        note: 'Hash index converted to NONCLUSTERED (SQL Server does not support MEMORY-table hash indexes)',
    },
    fulltext: {
        targetType: 'NONCLUSTERED',
        note: 'MySQL FULLTEXT index downgraded to NONCLUSTERED; create a SQL Server Full-Text Index separately for real full-text search',
    },
    spatial: { targetType: 'SPATIAL' },
};

/**
 * Get the type mapping for a MySQL type to a target dialect
 */
export function getTypeMapping(
    mysqlType: string,
    targetDialect: 'postgresql' | 'sqlserver'
): TypeMapping | undefined {
    const normalizedType = mysqlType.toLowerCase().trim();
    const mappingTable =
        targetDialect === 'postgresql' ? mysqlToPostgreSQL : mysqlToSQLServer;
    return mappingTable[normalizedType];
}

/**
 * Get fallback type mapping when no explicit mapping exists
 */
export function getFallbackTypeMapping(
    targetDialect: 'postgresql' | 'sqlserver'
): TypeMapping {
    return targetDialect === 'postgresql'
        ? {
              targetType: 'text',
              conversionNote: 'Unknown MySQL type converted to text',
              includeInlineComment: true,
          }
        : {
              targetType: 'NVARCHAR(MAX)',
              conversionNote: 'Unknown MySQL type converted to NVARCHAR(MAX)',
              includeInlineComment: true,
          };
}
