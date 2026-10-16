import { DatabaseType } from '@/lib/domain';
import { supportsArrayDataType, type DataTypeData } from './data-types';

// Patterns that let a user type a full type such as "varchar(100)" into the
// type select. `regex` is meant to be applied with the "i" flag; whitespace
// around the parentheses and comma is allowed.
export const generateFieldRegexPatterns = (
    dataType: DataTypeData,
    databaseType: DatabaseType
): {
    regex?: string;
    extractRegex?: RegExp;
} => {
    const typeName = dataType.name;
    const supportsArrays = supportsArrayDataType(dataType.id, databaseType);
    const arrayPattern = supportsArrays ? '(\\[\\])?' : '';

    if (!dataType.fieldAttributes) {
        // For types without field attributes, support plain type + optional array notation
        return {
            regex: `^${typeName}${arrayPattern}$`,
            extractRegex: new RegExp(`^${typeName}${arrayPattern}$`, 'i'),
        };
    }

    const fieldAttributes = dataType.fieldAttributes;

    if (fieldAttributes.hasCharMaxLength) {
        const lengthPattern = fieldAttributes.hasCharMaxLengthOption
            ? '(\\d+|max)'
            : '(\\d+)';
        return {
            regex: `^${typeName}\\s*\\(\\s*${lengthPattern}\\s*\\)${arrayPattern}$`,
            extractRegex: new RegExp(
                `\\(\\s*${lengthPattern}\\s*\\)${arrayPattern}`,
                'i'
            ),
        };
    }

    if (fieldAttributes.precision && fieldAttributes.scale) {
        return {
            regex: `^${typeName}\\s*\\(\\s*\\d+\\s*(?:,\\s*\\d+\\s*)?\\)${arrayPattern}$`,
            extractRegex: new RegExp(
                `${typeName}\\s*\\(\\s*(\\d+)\\s*(?:,\\s*(\\d+)\\s*)?\\)${arrayPattern}`,
                'i'
            ),
        };
    }

    if (fieldAttributes.precision) {
        return {
            regex: `^${typeName}\\s*\\(\\s*\\d+\\s*\\)${arrayPattern}$`,
            extractRegex: new RegExp(
                `\\(\\s*(\\d+)\\s*\\)${arrayPattern}`,
                'i'
            ),
        };
    }

    return { regex: undefined, extractRegex: undefined };
};

const DEFAULT_VARCHAR_LENGTH = 255;

// Variable-length string types that practically always need a length.
// `char` is left out on purpose: char(255) pads every value in most databases.
const VARCHAR_LIKE_TYPE_IDS = [
    'varchar',
    'nvarchar',
    'varchar2',
    'nvarchar2',
    'character_varying',
];

// Length to prefill when a user picks a varchar-like type from the list.
// Returns undefined when no length should be set.
export const getDefaultCharLength = (
    dataType: DataTypeData,
    databaseType: DatabaseType
): string | undefined => {
    if (
        databaseType === DatabaseType.CLICKHOUSE || // String has no length
        !dataType.fieldAttributes?.hasCharMaxLength ||
        !VARCHAR_LIKE_TYPE_IDS.includes(dataType.id)
    ) {
        return undefined;
    }

    const maxLength = dataType.fieldAttributes.maxLength;
    return String(
        maxLength
            ? Math.min(DEFAULT_VARCHAR_LENGTH, maxLength)
            : DEFAULT_VARCHAR_LENGTH
    );
};
