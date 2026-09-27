import dotenv from 'dotenv';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

dotenv.config({ path: ['.env.local', '.env'] });

console.log(
  'DATABASE_URL:',
  process.env.DATABASE_URL ? 'Loaded' : 'Not Loaded',
);

const serializeBigInt = (_key: string, value: unknown): unknown =>
  typeof value === 'bigint' ? value.toString() : value;

describe('DB Connection Check', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    console.log('Initializing Prisma...');
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL as string,
    });
    prisma = new PrismaClient({ adapter });
    console.log('Prisma initialized.');

    console.log('Connecting...');
    try {
      await prisma.$connect();
      console.log('Connected successfully.');
    } catch (e) {
      console.error('Connection failed:', e);
    }

    console.log('Prisma Keys:', Object.keys(prisma));
    console.log('Has SalesCommercial?', !!prisma.salesCommercial);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should fetch SalesCommercial data', async () => {
    try {
      const sales = await prisma.salesCommercial.findFirst({ take: 1 });
      console.log('--- SalesCommercial Data ---');
      console.log(JSON.stringify(sales, serializeBigInt, 2));
      expect(sales).toBeDefined();
    } catch (error) {
      console.error('Error fetching SalesCommercial:', error);
      throw error;
    }
  });

  it('should fetch StoreCommercial data', async () => {
    try {
      const store = await prisma.storeCommercial.findFirst({ take: 1 });
      console.log('--- StoreCommercial Data ---');
      console.log(JSON.stringify(store, serializeBigInt, 2));
      expect(store).toBeDefined();
    } catch (error) {
      console.error('Error fetching StoreCommercial:', error);
      throw error;
    }
  });

  it('should fetch ResidentPopulationCommercial data', async () => {
    try {
      const population = await prisma.residentPopulationCommercial.findFirst({
        take: 1,
      });
      console.log('--- ResidentPopulationCommercial Data ---');
      console.log(JSON.stringify(population, serializeBigInt, 2));
      expect(population).toBeDefined();
    } catch (error) {
      console.error('Error fetching ResidentPopulationCommercial:', error);
      throw error;
    }
  });
});
