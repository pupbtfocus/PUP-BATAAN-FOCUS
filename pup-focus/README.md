# PUP FOCUS

Faculty Online Compliance and Uploading System for Efficient Academic Document
Management at Polytechnic University of the Philippines - Bataan Campus.

## Stack

- Next.js App Router + TypeScript
- Tailwind CSS + reusable UI primitives
- Supabase (Auth, PostgreSQL, Storage)
- React Hook Form + Zod validation boundaries
- CI/CD pipelines via GitHub Actions

## Architecture Summary

- Modular monolith with Domain-Driven Design feature boundaries.
- Clean Architecture layering inside each feature module.
- Curriculum-based compliance requirements and document versioning support.
- Role-based route segmentation: faculty, program-head, and admin.

## Getting Started

1. Create environment variables from `.env.example`.
2. Install dependencies: `npm install`.
3. Start app: `npm run dev`.
4. Quality checks:
   - `npm run lint`
   - `npm run typecheck`
   - `npm run test`

## Key Directories

- `app`: Next.js route groups and API routes.
- `features`: Bounded-context feature modules.
- `infrastructure`: SQL migrations, RLS policies, storage, and runbooks.
- `tests`: Unit, integration, e2e, and fixtures.
- `docs`: Architecture, API, ERD, UML, and thesis artifacts.

## Database and Security

- Migration SQL files are in `infrastructure/database/migrations`.
- Seed files are in `infrastructure/database/seeders`.
- RLS baseline policies are in `infrastructure/database/policies/rls.sql`.

## Deployment

- CI and deployment workflows live in `.github/workflows`.
