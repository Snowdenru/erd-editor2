// Разбирает SSE-поток: события разделены пустой строкой, нужны только строки `data: {...}`.
// Чанки сети могут рвать событие посередине, поэтому копим буфер до разделителя.
export async function* readSse(
    body: ReadableStream<Uint8Array>
): AsyncGenerator<Record<string, unknown>> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    try {
        for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            let boundary = buffer.indexOf('\n\n');
            while (boundary !== -1) {
                const block = buffer.slice(0, boundary);
                buffer = buffer.slice(boundary + 2);
                const event = parseBlock(block);
                if (event) yield event;
                boundary = buffer.indexOf('\n\n');
            }
        }
        const tail = parseBlock(buffer);
        if (tail) yield tail;
    } finally {
        reader.releaseLock();
    }
}

function parseBlock(block: string): Record<string, unknown> | null {
    const line = block.split('\n').find((l) => l.startsWith('data:'));
    if (!line) return null;
    try {
        const value: unknown = JSON.parse(line.slice('data:'.length).trim());
        return value && typeof value === 'object'
            ? (value as Record<string, unknown>)
            : null;
    } catch {
        return null;
    }
}
