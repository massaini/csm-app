/**
 * Comandos do desenvolvedor para o super-admin (RF27-CA3):
 *   npm run admin:transferir-super -- --cpf=<cpf>
 *   npm run admin:redefinir-senha -- --cpf=<cpf>
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { relogioSistema } from '../src/domain/clock';
import { somenteDigitos } from '../src/domain/documentos';
import { redefinirSenhaDoAdmin, transferirSuperAdmin } from '../src/server/cadastros';

async function main() {
  const [comando] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const cpf = somenteDigitos(process.argv.find((a) => a.startsWith('--cpf='))?.slice(6) ?? '');
  if (!cpf) throw new Error('Informe --cpf=<cpf>');
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL não definida');
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  const deps = { db, clock: relogioSistema };
  try {
    if (comando === 'transferir-super') {
      const r = await transferirSuperAdmin(deps, cpf);
      console.log(r.ok ? 'Super-admin transferido.' : JSON.stringify(r.erros));
    } else if (comando === 'redefinir-senha') {
      const admin = await db.admin.findUnique({ where: { cpf } });
      if (!admin) throw new Error('Administrador não encontrado');
      const { senhaTemporaria } = await redefinirSenhaDoAdmin(deps, null, admin.id);
      console.log(`Senha temporária (válida por 72 h, troca obrigatória): ${senhaTemporaria}`);
    } else {
      throw new Error('Comandos: transferir-super | redefinir-senha');
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
