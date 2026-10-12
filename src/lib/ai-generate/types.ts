export type AiDialect = 'postgresql' | 'mysql' | 'mssql' | 'sqlite';

export interface AiUsage {
    tier: 'free' | 'erd' | 'pro';
    kind: 'lifetime' | 'daily';
    limit: number;
    used: number;
    remaining: number;
}

export interface AiHistoryItem {
    id: string;
    prompt: string;
    dialect: AiDialect;
    table_count: number | null;
    diagram_id: string | null;
    tables: string[];
    created_at: string;
}

export interface AiGenerationDetail {
    id: string;
    prompt: string;
    dialect: AiDialect;
    table_count: number | null;
    ddl: string;
    created_at: string;
}

export type GenerateOutcome =
    | {
          status: 'generated';
          generationId: string;
          ddl: string;
          remaining: number;
      }
    | {
          status: 'rejected_off_topic' | 'provider_error';
          generationId: string;
          remaining: number;
      };

export type AiRefineMode = 'review' | 'edit';

export type RefineOutcome =
    | {
          status: 'generated';
          generationId: string;
          ddl: string;
          changes: string[];
          remaining: number;
      }
    | { status: 'no_changes'; generationId: string; remaining: number }
    | { status: 'provider_error'; generationId: string; remaining: number };

export class AiApiError extends Error {
    status: number;
    code: string;
    limit?: number;

    constructor(status: number, code: string, limit?: number) {
        super(`ai-generate: ${code} (HTTP ${status})`);
        this.name = 'AiApiError';
        this.status = status;
        this.code = code;
        this.limit = limit;
    }
}
