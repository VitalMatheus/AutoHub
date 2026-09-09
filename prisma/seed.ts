import * as argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEVELOPMENT_ORGANIZATION_ID = '00000000-0000-4000-8000-000000000001';
const DEVELOPMENT_ORGANIZATION_DOCUMENT = '00000000000000';

const developmentCustomers = [
  {
    document: '11111111111',
    name: 'Ana Carolina Souza',
    phone: '(81) 99999-1001',
    email: 'ana.souza@example.test',
    notes: 'Cliente recorrente para demonstração do fluxo de oficina.',
  },
  {
    document: '22222222222',
    name: 'Bruno Martins',
    phone: '(81) 99999-1002',
    email: 'bruno.martins@example.test',
    notes: 'Prefere contato por telefone.',
  },
  {
    document: '33333333333',
    name: 'Carla Oliveira',
    phone: '(81) 99999-1003',
    email: 'carla.oliveira@example.test',
    notes: null,
  },
] as const;

const developmentVehicles = [
  {
    customerDocument: '11111111111',
    plate: 'ABC1D23',
    brand: 'Toyota',
    model: 'Corolla XEi 2.0',
    year: 2022,
    color: 'Prata',
    mileage: 48200,
    notes: 'Revisão periódica em dia.',
  },
  {
    customerDocument: '22222222222',
    plate: 'DEF4G56',
    brand: 'Volkswagen',
    model: 'T-Cross Highline',
    year: 2021,
    color: 'Cinza',
    mileage: 67300,
    notes: 'Verificar ruído na suspensão dianteira.',
  },
  {
    customerDocument: '22222222222',
    plate: 'HIJ7K89',
    brand: 'Honda',
    model: 'Civic Touring',
    year: 2020,
    color: 'Preto',
    mileage: 89100,
    notes: null,
  },
  {
    customerDocument: '33333333333',
    plate: 'LMN0P12',
    brand: 'Fiat',
    model: 'Strada Freedom',
    year: 2023,
    color: 'Branco',
    mileage: 21500,
    notes: 'Uso predominantemente urbano.',
  },
] as const;

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} must be set when running the development seed`);
  return value;
}

function argon2Option(name: string, fallback: number): number {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer`);
  return value;
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('The development seed cannot run with NODE_ENV=production');
  }

  const email = requiredEnvironment('DEV_ADMIN_EMAIL').toLowerCase();
  const password = requiredEnvironment('DEV_ADMIN_PASSWORD');
  const name = (process.env.DEV_ADMIN_NAME ?? 'Admin de Desenvolvimento').trim();

  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('DEV_ADMIN_EMAIL must be a valid email');
  if (password.length < 12 || password.length > 128) {
    throw new Error('DEV_ADMIN_PASSWORD must contain between 12 and 128 characters');
  }
  if (!name) throw new Error('DEV_ADMIN_NAME must not be empty');

  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: argon2Option('ARGON2_MEMORY_COST', 65536),
    timeCost: argon2Option('ARGON2_TIME_COST', 3),
    parallelism: argon2Option('ARGON2_PARALLELISM', 1),
  });

  await prisma.$transaction(async (tx) => {
    const organization = await tx.organization.upsert({
      where: { id: DEVELOPMENT_ORGANIZATION_ID },
      update: {
        name: 'AutoHub Desenvolvimento',
        document: DEVELOPMENT_ORGANIZATION_DOCUMENT,
        phone: '(81) 3333-0000',
        email: 'desenvolvimento@autohub.example',
        addressLine1: 'Rua do Desenvolvimento, 100',
        city: 'Recife',
        state: 'PE',
        postalCode: '50000-000',
        operationalStatus: 'ACTIVE',
      },
      create: {
        id: DEVELOPMENT_ORGANIZATION_ID,
        name: 'AutoHub Desenvolvimento',
        document: DEVELOPMENT_ORGANIZATION_DOCUMENT,
        phone: '(81) 3333-0000',
        email: 'desenvolvimento@autohub.example',
        addressLine1: 'Rua do Desenvolvimento, 100',
        city: 'Recife',
        state: 'PE',
        postalCode: '50000-000',
        operationalStatus: 'ACTIVE',
      },
      select: { id: true, name: true },
    });

    let commercialAccount = await tx.commercialAccount.findFirst({ where: { organizations: { some: { id: organization.id } } }, select: { id: true } });
    if (!commercialAccount) {
      commercialAccount = await tx.commercialAccount.create({ data: { name: organization.name, billingEmail: 'desenvolvimento@autohub.example', billingDocument: DEVELOPMENT_ORGANIZATION_DOCUMENT }, select: { id: true } });
      await tx.organization.update({ where: { id: organization.id }, data: { commercialAccountId: commercialAccount.id } });
    }
    const basicVersion = await tx.planVersion.findFirst({ where: { plan: { code: 'BASIC' }, status: 'PUBLISHED' }, orderBy: { version: 'desc' }, select: { id: true } });
    if (basicVersion) {
      const trialStartsAt = new Date();
      const trialEndsAt = new Date(trialStartsAt.getTime() + 14 * 24 * 60 * 60 * 1000);
      const subscription = await tx.subscription.findFirst({ where: { commercialAccountId: commercialAccount.id }, orderBy: { createdAt: 'desc' }, select: { id: true } });
      if (subscription) {
        await tx.subscription.update({
          where: { id: subscription.id },
          data: {
            planVersionId: basicVersion.id,
            status: 'SCHEDULED',
            trialEnabled: true,
            trialStartsAt,
            trialEndsAt,
            commercialStartAt: trialStartsAt,
            firstPaymentReceivedAt: null,
            firstPaidPeriodStartedAt: null,
          },
        });
      } else {
        await tx.subscription.create({ data: {
          commercialAccountId: commercialAccount.id,
          planVersionId: basicVersion.id,
          status: 'SCHEDULED',
          trialEnabled: true,
          trialStartsAt,
          trialEndsAt,
          commercialStartAt: trialStartsAt,
        } });
      }
    }

    const existingUser = await tx.user.findUnique({ where: { email }, select: { role: true, organizationId: true } });
    if (existingUser && (existingUser.role !== 'ADMIN' || existingUser.organizationId !== organization.id)) {
      throw new Error('DEV_ADMIN_EMAIL belongs to another organization or a SUPER_ADMIN');
    }

    await tx.user.upsert({
      where: { email },
      update: { organizationId: organization.id, name, passwordHash, role: 'ADMIN', status: 'ACTIVE' },
      create: { organizationId: organization.id, name, email, passwordHash, role: 'ADMIN', status: 'ACTIVE' },
    });

    const customers = new Map<string, string>();
    for (const customerData of developmentCustomers) {
      const customer = await tx.customer.upsert({
        where: { organizationId_document: { organizationId: organization.id, document: customerData.document } },
        update: { ...customerData, active: true },
        create: { organizationId: organization.id, ...customerData },
        select: { id: true, document: true },
      });
      customers.set(customer.document!, customer.id);
    }

    for (const vehicle of developmentVehicles) {
      const customerId = customers.get(vehicle.customerDocument);
      if (!customerId) throw new Error(`Missing seed customer ${vehicle.customerDocument}`);
      await tx.vehicle.upsert({
        where: { organizationId_plate: { organizationId: organization.id, plate: vehicle.plate } },
        update: {
          customerId,
          brand: vehicle.brand,
          model: vehicle.model,
          year: vehicle.year,
          color: vehicle.color,
          mileage: vehicle.mileage,
          notes: vehicle.notes,
          active: true,
        },
        create: {
          organizationId: organization.id,
          customerId,
          plate: vehicle.plate,
          brand: vehicle.brand,
          model: vehicle.model,
          year: vehicle.year,
          color: vehicle.color,
          mileage: vehicle.mileage,
          notes: vehicle.notes,
        },
      });
    }
  });

  console.log(`Development seed applied for ${email}: 3 customers and 4 vehicles`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
