import { DatabaseType } from '@/lib/domain/database-type';

export interface SqlSanityProblem {
    code:
        | 'unbalanced-close'
        | 'unclosed-paren'
        | 'double-comma'
        | 'comma-before-close';
    line: number;
}

interface ScanOptions {
    backslashEscapes: boolean;
    nestedBlockComments: boolean;
    dollarQuotes: boolean;
    hashComments: boolean;
    bracketIdentifiers: boolean;
    oracleQQuotes: boolean;
    // MySQL: «--» — комментарий только если дальше пробел/конец строки
    dashCommentNeedsSpace: boolean;
    // PostgreSQL: E'...' — строка с обратным слэшем
    eStrings: boolean;
}

const isIdentChar = (ch: string | undefined): boolean =>
    ch !== undefined && /[\p{L}\p{N}_$]/u.test(ch);

const Q_CLOSERS: Record<string, string> = {
    '[': ']',
    '(': ')',
    '{': '}',
    '<': '>',
};

// Возвращает null, если ошибка неоднозначна или разбор оборвался внутри
// строки/комментария/идентификатора: ложное срабатывание на валидном SQL хуже
// пропущенной ошибки
const scan = (sql: string, o: ScanOptions): SqlSanityProblem | null => {
    const n = sql.length;
    let i = 0;
    let line = 1;
    let first: SqlSanityProblem | null = null;
    const open: number[] = [];
    let pendingComma: number | null = null; // строка запятой, ждущей соседа

    const report = (problem: SqlSanityProblem) => {
        first ??= problem;
    };

    // Двигаем i до `to`, считая переводы строк
    const moveTo = (to: number) => {
        for (; i < to; i++) {
            if (sql[i] === '\n') line++;
        }
    };

    // Ищем конец «кавычки» из символа q, начиная после открывающей;
    // возвращает индекс после закрывающей или -1
    const skipQuoted = (
        start: number,
        q: string,
        backslash: boolean
    ): number => {
        let j = start;
        while (j < n) {
            const c = sql[j];
            if (backslash && c === '\\') {
                j += 2;
                continue;
            }
            if (c === q) {
                if (sql[j + 1] === q) {
                    j += 2;
                    continue;
                }
                return j + 1;
            }
            j++;
        }
        return -1;
    };

    // Возвращает true, если область пропущена; false — оборвана (неуверенность)
    const skipTo = (end: number): boolean => {
        if (end < 0) {
            return false;
        }
        moveTo(end);
        return true;
    };

    while (i < n) {
        const c = sql[i];
        const next = sql[i + 1];

        if (c === '\n' || c === ' ' || c === '\t' || c === '\r') {
            if (c === '\n') line++;
            i++;
            continue;
        }

        // Комментарии не сбрасывают ожидание второй запятой / скобки
        if (c === '-' && next === '-') {
            const after = sql[i + 2];
            if (
                !o.dashCommentNeedsSpace ||
                after === undefined ||
                /\s/.test(after)
            ) {
                const eol = sql.indexOf('\n', i);
                moveTo(eol < 0 ? n : eol);
                continue;
            }
        }
        if (c === '#' && o.hashComments) {
            const eol = sql.indexOf('\n', i);
            moveTo(eol < 0 ? n : eol);
            continue;
        }
        if (c === '/' && next === '*') {
            let j = i + 2;
            let depth = 1;
            while (j < n && depth > 0) {
                if (
                    o.nestedBlockComments &&
                    sql[j] === '/' &&
                    sql[j + 1] === '*'
                ) {
                    depth++;
                    j += 2;
                } else if (sql[j] === '*' && sql[j + 1] === '/') {
                    depth--;
                    j += 2;
                } else {
                    j++;
                }
            }
            if (depth > 0) return null;
            moveTo(j);
            continue;
        }

        // Дальше идёт значимый токен: он «съедает» ожидание запятой,
        // кроме самой запятой и закрывающей скобки
        if (c === ',') {
            if (pendingComma !== null) {
                report({ code: 'double-comma', line });
            }
            pendingComma = line;
            i++;
            continue;
        }
        if (c === ')') {
            if (pendingComma !== null) {
                report({ code: 'comma-before-close', line: pendingComma });
            }
            pendingComma = null;
            if (open.length === 0) {
                report({ code: 'unbalanced-close', line });
            } else {
                open.pop();
            }
            i++;
            continue;
        }
        pendingComma = null;

        if (c === '(') {
            open.push(line);
            i++;
            continue;
        }

        // Oracle q'[...]' / nq'[...]'
        if (
            o.oracleQQuotes &&
            (c === 'q' || c === 'Q') &&
            next === "'" &&
            !isIdentChar(sql[i - 1])
        ) {
            const d = sql[i + 2];
            if (d === undefined || /\s/.test(d)) return null;
            const closer = Q_CLOSERS[d] ?? d;
            const end = sql.indexOf(closer + "'", i + 3);
            if (end < 0) return null;
            moveTo(end + 2);
            continue;
        }

        if (c === "'") {
            const prev = sql[i - 1];
            const isE =
                o.eStrings &&
                (prev === 'E' || prev === 'e') &&
                !isIdentChar(sql[i - 2]);
            if (!skipTo(skipQuoted(i + 1, "'", o.backslashEscapes || isE))) {
                return null;
            }
            continue;
        }
        if (c === '"') {
            if (!skipTo(skipQuoted(i + 1, '"', o.backslashEscapes)))
                return null;
            continue;
        }
        if (c === '`') {
            if (!skipTo(skipQuoted(i + 1, '`', false))) return null;
            continue;
        }
        if (c === '[' && o.bracketIdentifiers) {
            if (!skipTo(skipQuoted(i + 1, ']', false))) return null;
            continue;
        }
        if (c === '$' && o.dollarQuotes && !isIdentChar(sql[i - 1])) {
            const m = /^\$([\p{L}_][\p{L}\p{N}_]*)?\$/u.exec(
                sql.slice(i, i + 200)
            );
            if (m) {
                const end = sql.indexOf(m[0], i + m[0].length);
                if (end < 0) return null;
                moveTo(end + m[0].length);
                continue;
            }
        }

        i++;
    }

    if (first) return first;
    if (open.length > 0) return { code: 'unclosed-paren', line: open[0] };
    return null;
};

export const findSqlSanityProblem = (
    sql: string,
    databaseType: DatabaseType
): SqlSanityProblem | null => {
    const isPg =
        databaseType === DatabaseType.POSTGRESQL ||
        databaseType === DatabaseType.COCKROACHDB;
    const isMy =
        databaseType === DatabaseType.MYSQL ||
        databaseType === DatabaseType.MARIADB;

    const base: ScanOptions = {
        backslashEscapes: false,
        nestedBlockComments: isPg,
        dollarQuotes: isPg,
        hashComments: isMy,
        bracketIdentifiers: databaseType === DatabaseType.SQL_SERVER,
        oracleQQuotes: databaseType === DatabaseType.ORACLE,
        dashCommentNeedsSpace: isMy,
        eStrings: isPg,
    };

    try {
        if (isMy) {
            // Режим NO_BACKSLASH_ESCAPES заранее неизвестен: ошибку
            // заявляем, только если оба разбора с ней согласны
            const a = scan(sql, { ...base, backslashEscapes: true });
            const b = scan(sql, { ...base, backslashEscapes: false });
            return a && b && a.code === b.code && a.line === b.line ? a : null;
        }
        return scan(sql, base);
    } catch {
        return null;
    }
};
