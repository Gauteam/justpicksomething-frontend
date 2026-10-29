# justpicksomething-frontend

Next.js + TypeScript UI for Just Pick Something, deployed on Vercel at
`https://pick.rajwalgautam.com`. It talks to the Go API
([justpicksomething-backend](https://github.com/Gauteam/justpicksomething-backend))
over HTTP only. Project plan:
[justpicksomething-docs](https://github.com/rajwalgautam/justpicksomething-docs/blob/main/project-plan.md).

## Local development

Run the backend (`make dev` in `justpicksomething-backend`, port 8080, with
`ALLOWED_ORIGINS=http://localhost:3000`), then:

```bash
cp .env.example .env.local
npm install
npm run dev   # http://localhost:3000
```

## Environment variables

| Name | Value |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | API base URL. Production: `https://api.pick.rajwalgautam.com`. Inlined at build time, so redeploy after changing it. |
