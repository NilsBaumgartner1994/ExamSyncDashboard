interface Env {
    EXAM_SYNC_KV: KVNamespace;
}

const jsonResponse = (body: unknown, init?: ResponseInit) =>
    new Response(JSON.stringify(body, null, 2), {
        ...init,
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET,PUT,DELETE,OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            ...init?.headers,
        },
    });

const emptyResponse = (status = 204) =>
    new Response(null, {
        status,
        headers: {
            'Cache-Control': 'no-store',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET,PUT,DELETE,OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        },
    });

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url);
        const path = url.pathname.replace(/\/+$/, '');
        const requestId = crypto.randomUUID();
        console.log('[kv-worker]', requestId, request.method, path);

        try {
            if (request.method === 'OPTIONS') {
                return emptyResponse();
            }

            if (!env.EXAM_SYNC_KV) {
                console.warn('[kv-worker]', requestId, 'Missing KV binding EXAM_SYNC_KV');
                return jsonResponse({ error: 'KV binding missing', requestId }, { status: 500 });
            }

            if (path === '/kv' && request.method === 'GET') {
                const keys: string[] = [];
                let cursor: string | undefined;
                do {
                    const list = await env.EXAM_SYNC_KV.list({ cursor });
                    keys.push(...list.keys.map((key) => key.name));
                    cursor = list.list_complete ? undefined : list.cursor;
                } while (cursor);
                return jsonResponse({ keys });
            }

            if (!path.startsWith('/kv/')) {
                return jsonResponse({ error: 'Not found', requestId }, { status: 404 });
            }

            const key = decodeURIComponent(path.slice(4));
            if (!key) {
                return jsonResponse({ error: 'Key missing', requestId }, { status: 400 });
            }

            if (request.method === 'GET') {
                const value = await env.EXAM_SYNC_KV.get(key);
                if (value === null) {
                    return jsonResponse({ error: 'Key not found', requestId }, { status: 404 });
                }
                return jsonResponse({ key, value });
            }

            if (request.method === 'PUT') {
                const rawBody = await request.text();
                if (!rawBody) {
                    return jsonResponse({ error: 'Missing value', requestId }, { status: 400 });
                }
                let value: unknown = rawBody;
                let expectedVersion: number | undefined;
                try {
                    const parsed = JSON.parse(rawBody);
                    if (typeof parsed === 'object' && parsed !== null) {
                        if ('value' in parsed) {
                            value = (parsed as { value?: unknown }).value;
                        } else {
                            value = parsed;
                        }
                        if ('expectedVersion' in parsed) {
                            const rawVersion = (parsed as { expectedVersion?: unknown }).expectedVersion;
                            if (typeof rawVersion === 'number') {
                                expectedVersion = rawVersion;
                            }
                        }
                    } else {
                        value = parsed;
                    }
                } catch {
                    // Keep raw text value when JSON parsing fails.
                }
                if (value === undefined) {
                    return jsonResponse({ error: 'Missing value', requestId }, { status: 400 });
                }
                if (typeof expectedVersion === 'number') {
                    const existing = await env.EXAM_SYNC_KV.get(key);
                    if (existing === null) {
                        if (expectedVersion !== 0) {
                            return jsonResponse(
                                { error: 'Version mismatch', requestId, currentVersion: null },
                                { status: 409 },
                            );
                        }
                    } else {
                        let currentVersion: number | null = null;
                        try {
                            const parsedExisting = JSON.parse(existing);
                            if (
                                parsedExisting &&
                                typeof parsedExisting === 'object' &&
                                typeof (parsedExisting as { version?: unknown }).version === 'number'
                            ) {
                                currentVersion = (parsedExisting as { version: number }).version;
                            }
                        } catch {
                            // ignore parse errors
                        }
                        if (currentVersion === null || currentVersion !== expectedVersion) {
                            return jsonResponse(
                                { error: 'Version mismatch', requestId, currentVersion },
                                { status: 409 },
                            );
                        }
                    }
                }
                const stored = typeof value === 'string' ? value : JSON.stringify(value);
                await env.EXAM_SYNC_KV.put(key, stored);
                return jsonResponse({ key, stored });
            }

            if (request.method === 'DELETE') {
                await env.EXAM_SYNC_KV.delete(key);
                return emptyResponse(204);
            }

            return jsonResponse({ error: 'Method not allowed', requestId }, { status: 405 });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            console.error('[kv-worker]', requestId, message);
            return jsonResponse({ error: message, requestId }, { status: 500 });
        }
    },
};
