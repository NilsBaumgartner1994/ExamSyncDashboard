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
        if (request.method === 'OPTIONS') {
            return emptyResponse();
        }

        const url = new URL(request.url);
        const path = url.pathname.replace(/\/+$/, '');

        if (path === '/kv' && request.method === 'GET') {
            const list = await env.EXAM_SYNC_KV.list();
            return jsonResponse({ keys: list.keys.map((key) => key.name) });
        }

        if (!path.startsWith('/kv/')) {
            return jsonResponse({ error: 'Not found' }, { status: 404 });
        }

        const key = decodeURIComponent(path.slice(4));
        if (!key) {
            return jsonResponse({ error: 'Key missing' }, { status: 400 });
        }

        if (request.method === 'GET') {
            const value = await env.EXAM_SYNC_KV.get(key);
            if (value === null) {
                return jsonResponse({ error: 'Key not found' }, { status: 404 });
            }
            return jsonResponse({ key, value });
        }

        if (request.method === 'PUT') {
            let payload: { value?: unknown };
            try {
                payload = await request.json();
            } catch {
                return jsonResponse({ error: 'Invalid JSON body' }, { status: 400 });
            }
            const value = payload?.value;
            if (value === undefined) {
                return jsonResponse({ error: 'Missing value' }, { status: 400 });
            }
            const stored = typeof value === 'string' ? value : JSON.stringify(value);
            await env.EXAM_SYNC_KV.put(key, stored);
            return jsonResponse({ key, stored });
        }

        if (request.method === 'DELETE') {
            await env.EXAM_SYNC_KV.delete(key);
            return emptyResponse(204);
        }

        return jsonResponse({ error: 'Method not allowed' }, { status: 405 });
    },
};
