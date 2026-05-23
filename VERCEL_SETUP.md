Vercel deployment notes
======================

Recommended setup for this repository to deploy the nested Next.js app in `pup-focus`:

1. In the Vercel Project settings, set **Root Directory** to `pup-focus`.
2. Clear the Vercel build cache and redeploy.

If you prefer GitHub Actions to build and deploy (recommended to avoid Vercel framework detection issues):

1. Create the following repository secrets in GitHub: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`.
2. The included GitHub Actions workflow `.github/workflows/vercel-deploy.yml` will run on every push to `main`, build `pup-focus`, and deploy to Vercel.

Notes:
- Do not commit `.next` or `node_modules` into the repo. A root `.gitignore` is present to prevent this.
- If you keep the Vercel Git integration, setting the Project Root to `pup-focus` is the simplest fix.
