import { relogioSistema } from '@/domain/clock';
import { db } from '@/server/db';
import { varrer } from '@/server/senhas';

export const INTERVALO_DO_JOB_MS = 30_000;

export function iniciarJob() {
  const rodar = async () => {
    try {
      const r = await varrer({ db, clock: relogioSistema });
      if (r.expiradas || r.canceladasNaVirada || r.concluidasNaVirada) {
        console.info(JSON.stringify({ nivel: 'info', evento: 'job.varredura', ...r }));
      }
    } catch (erro) {
      console.error(JSON.stringify({ nivel: 'erro', evento: 'job.varredura', erro: String(erro) }));
    }
  };
  setInterval(rodar, INTERVALO_DO_JOB_MS).unref?.();
  void rodar();
}
