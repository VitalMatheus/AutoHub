# Vekar

Initial bootstrap for the Vekar workshop-management SaaS.

## Local development

1. Copy `.env.example` to `.env` and replace the local database password if needed. Do not commit `.env`.
2. Start PostgreSQL:

   ```bash
   npm run db:up
   ```

3. Install dependencies and generate the Prisma client:

   ```bash
   npm install
   npm run prisma:generate
   ```

4. Apply migrations:

   ```bash
   npm run prisma:migrate:deploy
   ```

5. Start the API:

   ```bash
   npm run start:dev
   ```

To create the first Super Admin, provide `SUPER_ADMIN_EMAIL` and
`SUPER_ADMIN_PASSWORD` only in the operator environment and run:

```bash
npm run bootstrap:super-admin
```

The command refuses a second bootstrap and stores only an Argon2id password
hash. It does not read credentials from source-controlled files.

For a repeatable local development dataset, run the seed with credentials
provided in the shell (never commit them):

```bash
DEV_ADMIN_EMAIL=admin@autohub.example \
DEV_ADMIN_PASSWORD='local-development-password-123' \
DEV_ADMIN_NAME='Admin de Desenvolvimento' \
npx prisma db seed
```

The seed is idempotent, creates or updates a development Organization and
Admin, and inserts three Customers and four Vehicles for frontend testing. It
refuses to run with `NODE_ENV=production` and never deletes existing data.

The versioned health endpoint is available at `http://localhost:3000/api/v1/health`; Swagger is at `http://localhost:3000/api/v1/docs`.

## Checks

```bash
npm run typecheck
npm run prisma:validate
npm run build
npm run test:e2e
```

Integration and E2E checks require PostgreSQL from Docker Compose.
