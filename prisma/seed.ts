/**
 * Seed idempotente que só CRIA o que não existe (PRD §9.7): nunca altera
 * configuração, raio, nomes, `ativo` nem a senha do super-admin já existentes.
 * Dados fictícios só com NODE_ENV=development.
 */
import { loadEnvConfig } from '@next/env';
import { hash } from '@node-rs/argon2';

// O Prisma 7 não lê o .env sozinho; mesmo carregador do Next, sem sobrescrever o ambiente
loadEnvConfig(process.cwd());
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL não definida');
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

const LOCAIS = [
  {
    chave: 'RAMALHO_89',
    nome: 'Av. André Ramalho, 89',
    lat: -23.650304755462123,
    lng: -46.51091622883612,
  },
  { chave: 'RAMALHO_95', nome: 'Av. André Ramalho, 95', lat: -23.6501175, lng: -46.5108664 },
  { chave: 'ESTADOS_6761', nome: 'Av. dos Estados, 6761', lat: -23.6516062, lng: -46.51458 },
] as const;

const GALPOES = [
  { nome: 'F SDR', prefixo: 'A', local: 'RAMALHO_89' },
  { nome: 'F SDR 03', prefixo: 'B', local: 'ESTADOS_6761' },
  { nome: 'DS AET', prefixo: 'C', local: 'RAMALHO_95' },
  { nome: 'DS SDE', prefixo: 'D', local: 'ESTADOS_6761' },
  { nome: 'SP-R-D228', prefixo: 'E', local: 'RAMALHO_89' }, // Anjun
] as const;

async function main() {
  const locais = new Map<string, number>();
  for (const l of LOCAIS) {
    const existente = await db.local.findFirst({ where: { endereco: l.nome } });
    const local =
      existente ??
      (await db.local.create({
        data: { nome: l.nome, endereco: l.nome, latitude: l.lat, longitude: l.lng },
      }));
    locais.set(l.chave, local.id);
  }

  for (const g of GALPOES) {
    const local = LOCAIS.find((l) => l.chave === g.local)!;
    await db.galpao.upsert({
      where: { nome: g.nome },
      update: {},
      create: {
        nome: g.nome,
        endereco: local.nome,
        prefixoSenha: g.prefixo,
        localId: locais.get(g.local)!,
      },
    });
  }

  await db.configuracao.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });

  if ((await db.admin.count({ where: { papel: 'SUPER_ADMIN' } })) === 0) {
    const { SUPERADMIN_NOME, SUPERADMIN_CPF, SUPERADMIN_SENHA_INICIAL } = process.env;
    if (!SUPERADMIN_NOME || !SUPERADMIN_CPF || !SUPERADMIN_SENHA_INICIAL) {
      throw new Error('Defina SUPERADMIN_NOME, SUPERADMIN_CPF e SUPERADMIN_SENHA_INICIAL');
    }
    await db.admin.create({
      data: {
        nome: SUPERADMIN_NOME,
        cpf: SUPERADMIN_CPF.replace(/\D/g, ''),
        senhaHash: await hash(SUPERADMIN_SENHA_INICIAL),
        papel: 'SUPER_ADMIN',
        deveTrocarSenha: true,
        senhaTemporariaExpiraEm: null, // a senha inicial do super-admin não expira (RF02-CA4)
      },
    });
  }

  if (process.env.NODE_ENV === 'development') await dadosDeDesenvolvimento();
}

async function dadosDeDesenvolvimento() {
  const regioes = [
    { codigo: '500', nome: 'Centro de Santo André' },
    { codigo: '320', nome: 'Zona Leste SP' },
    { codigo: '420', nome: 'ABC Paulista' },
    { codigo: '620', nome: 'Osasco' },
  ];
  for (const r of regioes) {
    await db.regiao.upsert({ where: { codigo: r.codigo }, update: {}, create: r });
  }
  const galpoes = await db.galpao.findMany();
  for (const g of galpoes) {
    for (let i = 1; i <= regioes.length; i++) {
      const identificacao = String(i).padStart(2, '0');
      const bancada = await db.bancada.upsert({
        where: { galpaoId_identificacao: { galpaoId: g.id, identificacao } },
        update: {},
        create: { galpaoId: g.id, identificacao },
      });
      const regiao = await db.regiao.findUniqueOrThrow({
        where: { codigo: regioes[i - 1].codigo },
      });
      await db.regiaoBancada.upsert({
        where: { galpaoId_regiaoId: { galpaoId: g.id, regiaoId: regiao.id } },
        update: {},
        create: { galpaoId: g.id, regiaoId: regiao.id, bancadaId: bancada.id },
      });
    }
  }
  const regiao500 = await db.regiao.findUniqueOrThrow({ where: { codigo: '500' } });
  const senhaHash = await hash('motorista123');
  for (const [nome, cpf] of [
    ['João da Silva', '52998224725'],
    ['Marcos Oliveira', '11144477735'],
  ] as const) {
    await db.motorista.upsert({
      where: { cpf },
      update: {},
      create: { nome, cpf, senhaHash, regiaoId: regiao500.id, deveTrocarSenha: false },
    });
  }
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
