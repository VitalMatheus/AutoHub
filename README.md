# AutoHub

Initial bootstrap for the AutoHub workshop-management SaaS.

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

The versioned health endpoint is available at `http://localhost:3000/api/v1/health`; Swagger is at `http://localhost:3000/api/v1/docs`.

## Checks

```bash
npm run typecheck
npm run prisma:validate
npm run build
npm run test:e2e
```

Integration and E2E checks require PostgreSQL from Docker Compose.
