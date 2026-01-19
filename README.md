https://nilsbaumgartner1994.github.io/ExamSyncDashboard/

## Cloudflare KV Worker

Dieses Projekt enthält einen Cloudflare Worker für den KV-Store. Lege eine KV-namespace an und trage die IDs in `wrangler.toml` ein. Danach kannst du den Worker deployen:

```bash
npx wrangler deploy
```

Setze anschließend die Worker-URL im Frontend über `VITE_KV_WORKER_URL` (siehe `.env.example`), damit der KV-Screen die URL automatisch übernimmt.



# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript and enable type-aware lint rules. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
