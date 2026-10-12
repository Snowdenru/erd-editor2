import { describe, expect, it } from 'vitest';
import { ddlToDiagram } from '../import-ddl';

// Без моков: настоящий парсер на DDL в том виде, как его отдаёт ИИ (service_fields, fk_indexes, column_comments).
const PG_WITH_COMMENTS = `
CREATE TABLE students (
    id BIGSERIAL PRIMARY KEY,
    full_name VARCHAR(200) NOT NULL,
    email VARCHAR(255) UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE courses (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE enrollments (
    id BIGSERIAL PRIMARY KEY,
    student_id BIGINT NOT NULL REFERENCES students(id),
    course_id BIGINT NOT NULL REFERENCES courses(id),
    grade SMALLINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_enrollments_student_id ON enrollments (student_id);
CREATE INDEX idx_enrollments_course_id ON enrollments (course_id);

COMMENT ON TABLE students IS 'Ученики школы';
COMMENT ON COLUMN students.full_name IS 'ФИО ученика';
COMMENT ON COLUMN students.email IS 'Контактный email (необязательный)';
COMMENT ON COLUMN enrollments.grade IS 'Оценка за курс, 1–5; NULL — ещё не выставлена';
COMMENT ON COLUMN enrollments.student_id IS 'Кто записан; it''s a FK';
`;

describe('ddlToDiagram с настоящим парсером (PostgreSQL + COMMENT ON COLUMN)', () => {
    it('импортирует схему с COMMENT ON без ошибки и сохраняет таблицы и связи', async () => {
        const diagram = await ddlToDiagram({
            ddl: PG_WITH_COMMENTS,
            dialect: 'postgresql',
            prompt: 'Школа',
        });
        expect(diagram.tables?.map((t) => t.name).sort()).toEqual([
            'courses',
            'enrollments',
            'students',
        ]);
        expect(diagram.relationships?.length).toBe(2);
    });

    it('без COMMENT ON результат по таблицам и связям тот же', async () => {
        const withoutComments = PG_WITH_COMMENTS.split('\n')
            .filter((l) => !l.startsWith('COMMENT ON'))
            .join('\n');
        const a = await ddlToDiagram({
            ddl: PG_WITH_COMMENTS,
            dialect: 'postgresql',
            prompt: 'x',
        });
        const b = await ddlToDiagram({
            ddl: withoutComments,
            dialect: 'postgresql',
            prompt: 'x',
        });
        expect(a.tables?.length).toBe(b.tables?.length);
        expect(a.relationships?.length).toBe(b.relationships?.length);
    });
});
