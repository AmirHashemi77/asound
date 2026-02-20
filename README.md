# ASound

Hear With Us.

## Run

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## GitHub + Vercel CI/CD

This repo includes `.github/workflows/vercel-deploy.yml`.

Required GitHub repository secrets:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

To get `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` locally:

```bash
vercel login
vercel link
cat .vercel/project.json
```

Set `VERCEL_TOKEN` from your Vercel account settings.
