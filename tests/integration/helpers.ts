import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';
import { relogioFixo } from '@/domain/clock';

const url = process.env.DATABASE_URL_TEST;
if (!url) throw new Error('DATABASE_URL_TEST não definida');

export const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url, max: 20 }) });

export const RAMALHO_89 = { lat: -23.650304755462123, lng: -46.51091622883612 };
export const LONGE = { lat: -23.5505, lng: -46.6333 };

export async function limpar() {
  const tabelas = await db.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  const lista = tabelas.map((t) => `"${t.tablename}"`).join(', ');
  await db.$executeRawUnsafe(`TRUNCATE ${lista} RESTART IDENTITY CASCADE`);
}

/** Meio-dia em São Paulo (15:00Z) de um dia fixo: longe da virada. */
export const T0 = new Date('2026-11-11T15:00:00Z');

export function novoRelogio(inicio: Date = T0) {
  return relogioFixo(inicio);
}

export async function cenario() {
  const local = await db.local.create({
    data: {
      nome: 'Av. André Ramalho, 89',
      endereco: 'Av. André Ramalho, 89',
      latitude: RAMALHO_89.lat,
      longitude: RAMALHO_89.lng,
    },
  });
  const galpao = await db.galpao.create({
    data: { nome: 'F SDR', endereco: local.nome, prefixoSenha: 'A', localId: local.id },
  });
  const regiao = await db.regiao.create({ data: { codigo: '500', nome: 'Centro de Santo André' } });
  const bancada = await db.bancada.create({ data: { galpaoId: galpao.id, identificacao: '07' } });
  await db.regiaoBancada.create({
    data: { galpaoId: galpao.id, regiaoId: regiao.id, bancadaId: bancada.id },
  });
  await db.configuracao.create({ data: { id: 1 } });
  const admin = await db.admin.create({
    data: { nome: 'Marcos T.', cpf: '52998224725', senhaHash: 'x' },
  });
  return { local, galpao, regiao, bancada, admin };
}

let seq = 0;
export async function novoMotorista(regiaoId: number, nome = 'Motorista') {
  seq++;
  return db.motorista.create({
    data: {
      nome: `${nome} ${seq}`,
      cpf: String(10000000000 + seq),
      senhaHash: 'x',
      regiaoId,
      deveTrocarSenha: false,
    },
  });
}

export const dentro = { ...RAMALHO_89, precisaoM: 10 };
export const PLACA = 'ABC1D23';
