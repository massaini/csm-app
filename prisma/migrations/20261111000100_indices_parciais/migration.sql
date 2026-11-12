-- Regras que o Prisma não expressa em @@unique (PRD §9.2).

-- Uma senha ativa por motorista.
CREATE UNIQUE INDEX "Senha_uma_ativa_por_motorista"
  ON "Senha" ("motoristaId")
  WHERE "status" IN ('AGUARDANDO', 'CHAMADA', 'EM_ATENDIMENTO');

-- Uma bancada atende um motorista por vez (RF18-CA6).
CREATE UNIQUE INDEX "Senha_uma_ocupando_por_bancada"
  ON "Senha" ("bancadaId")
  WHERE "status" IN ('CHAMADA', 'EM_ATENDIMENTO');

-- Existe no máximo um SUPER_ADMIN (RF27-CA3).
CREATE UNIQUE INDEX "Admin_um_super_admin"
  ON "Admin" ("papel")
  WHERE "papel" = 'SUPER_ADMIN';

-- Sessão pertence a exatamente um tipo de usuário.
ALTER TABLE "Sessao" ADD CONSTRAINT "Sessao_dono_coerente" CHECK (
  ("tipo" = 'MOTORISTA' AND "motoristaId" IS NOT NULL AND "adminId" IS NULL) OR
  ("tipo" = 'ADMIN' AND "adminId" IS NOT NULL AND "motoristaId" IS NULL)
);

-- Configuração é uma linha única.
ALTER TABLE "Configuracao" ADD CONSTRAINT "Configuracao_linha_unica" CHECK ("id" = 1);
