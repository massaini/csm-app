import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';

const globalParaDev = globalThis as unknown as { prisma?: PrismaClient };

function criarCliente(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL não definida');
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

/** Cliente único por processo (reaproveitado no HMR em desenvolvimento). */
export const db = globalParaDev.prisma ?? criarCliente();
if (process.env.NODE_ENV !== 'production') globalParaDev.prisma = db;
