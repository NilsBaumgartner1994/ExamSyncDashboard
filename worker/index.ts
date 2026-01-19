interface Env {
    EXAM_SYNC_KV: KVNamespace;
}

const jsonResponse = (body: unknown, init?: ResponseInit) =>
    new Response(JSON.stringify(body, null, 2), {
        ...init,
        headers: {
            'Content-Type': 'application/json',
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
                const list = await env.EXAM_SYNC_KV.list();
                return jsonResponse({ keys: list.keys.map((key) => key.name) });
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
                try {
                    const parsed = JSON.parse(rawBody);
                    value = typeof parsed === 'object' && parsed !== null && 'value' in parsed ? parsed.value : parsed;
                } catch {
                    // Keep raw text value when JSON parsing fails.
                }
                if (value === undefined) {
                    return jsonResponse({ error: 'Missing value', requestId }, { status: 400 });
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
