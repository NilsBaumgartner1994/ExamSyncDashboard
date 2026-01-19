https://nilsbaumgartner1994.github.io/ExamSyncDashboard/

## Cloudflare KV Worker

Dieses Projekt enthält einen Cloudflare Worker für den KV-Store. Lege eine KV-namespace an und binde sie im Cloudflare-Dashboard unter "Bindings" als `EXAM_SYNC_KV` an. Danach kannst du den Worker deployen:

```bash
npx wrangler deploy
```

Wenn das Dashboard über `*.workers.dev` läuft, wird die Worker-URL automatisch übernommen. Für andere Domains kannst du `VITE_KV_WORKER_URL` als öffentliches Build-Variable in der Cloudflare-UI unter "Variables and secrets" setzen.


# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript and enable type-aware lint rules. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
