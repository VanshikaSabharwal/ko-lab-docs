---
sidebar_position: 2
title: Setup
---

# Backend setup

## Database

Ko-Lab needs PostgreSQL 14+.

<details>
<summary>Docker</summary>

```bash
docker run --name kolab-db \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=kolab \
  -p 5432:5432 -d postgres:16
```

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/kolab
```
</details>

<details>
<summary>Local install</summary>

```bash
sudo -u postgres createdb kolab
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'postgres';"
```
</details>

## Prisma

```bash
# From the repo root — generates the client
npm run db:web

# From apps/web
npx prisma migrate dev      # apply migrations (dev)
npx prisma migrate deploy   # apply migrations (production)
npx prisma studio           # browse data
npx prisma db push          # prototype without a migration
```

:::tip Regenerate after every schema change
`npx prisma generate` (or `npm run db:web`) must run after editing
`schema.prisma`, or TypeScript will not see your new fields.
:::

### Migrations

Nine migrations live in `apps/web/prisma/migrations/`, plus an archived set in
`_migrations_archive_2026-07/`.

Creating one:

```bash
cd apps/web
npx prisma migrate dev --name add_group_lock_field
```

Review the generated SQL before committing. Prisma will happily write a
destructive migration if a change implies one.

### Seeds

```bash
cd apps/web
npx tsx prisma/seed-call.ts          # call system fixtures
node prisma/seedPlanningDemo.mjs     # demo planning board
npx tsx prisma/backfill-planning.ts  # backfill existing boards
```

## Running

```bash
cd apps/web && npm run dev
```

API routes are served from the same origin as the UI, under `/api/*`.

## Adding a route

1. Create `app/api/<name>/route.ts`
2. Export the verbs you support: `GET`, `POST`, `PATCH`, `DELETE`
3. Validate inputs before touching the database
4. Authenticate via `lib/apiAuth.ts` — do not trust a `userId` from the query
   string for anything privileged
5. Return `{ success: boolean, … }`
6. Add a test under `__tests__/api/`

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const body = await req.json();

  if (!body.groupId) {
    return NextResponse.json(
      { success: false, error: "groupId required" },
      { status: 400 },
    );
  }

  try {
    const result = await prisma.group.update({
      where: { id: body.groupId },
      data: { name: body.name },
    });
    return NextResponse.json({ success: true, result });
  } catch (err) {
    console.error("update failed:", err);
    return NextResponse.json(
      { success: false, error: "Internal error" },
      { status: 500 },
    );
  }
}
```

:::danger Authorization is not automatic
Several existing routes accept a `userId` query parameter and trust it. When
writing new privileged routes, derive the caller's identity from the session
instead. See [Security](../architecture/security.md).
:::

## Storage

Uploads go through `lib/s3.ts`, which targets any S3-compatible endpoint.
Configure per [Credentials](../getting-started/credentials.md#object-storage).

Two buckets: `S3_BUCKET` for durable objects (avatars), `DRAFT_BUCKET` for
unsaved editor drafts.
