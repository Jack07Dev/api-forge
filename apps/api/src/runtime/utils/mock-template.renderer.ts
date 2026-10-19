export interface MockTemplateContext {
    params: Record<string, string>;
    query?: Record<string, string>;
}

const PLACEHOLDER = /\{\{\s*(params|query)\.([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;
const MAX_DEPTH = 50;
const MAX_RESPONSE_BYTES = 64 * 1024;

export const renderMockTemplate = (
    template: unknown,
    context: MockTemplateContext
): unknown => {
    const render = (value: unknown, depth: number): unknown => {
        if (depth > MAX_DEPTH) {
            throw new Error("MOCK_TEMPLATE_TOO_DEEP");
        }

        if (typeof value === "string") {
            return value.replace(PLACEHOLDER, (original, source: "params" | "query", key: string) => {
                const values = source === "params" ? context.params : context.query;
                if (values && Object.prototype.hasOwnProperty.call(values, key)) {
                    return values[key] ?? original;
                }
                return original;
            });
        }

        if (Array.isArray(value)) {
            return value.map((item) => render(item, depth + 1));
        }

        if (value !== null && typeof value === "object") {
            const output: Record<string, unknown> = {};
            for (const [key, item] of Object.entries(value)) {
                Object.defineProperty(output, key, {
                    value: render(item, depth + 1),
                    enumerable: true,
                    writable: true,
                    configurable: true,
                });
            }
            return output;
        }

        return value;
    };

    const result = render(template, 0);
    let serialized: string;
    try {
        serialized = JSON.stringify(result);
        if (typeof serialized !== "string") throw new Error("INVALID_JSON");
    } catch {
        throw new Error("INVALID_RENDERED_MOCK_RESPONSE");
    }
    if (Buffer.byteLength(serialized, "utf8") > MAX_RESPONSE_BYTES) {
        throw new Error("RENDERED_MOCK_RESPONSE_TOO_LARGE");
    }
    return result;
};