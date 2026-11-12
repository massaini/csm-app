-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "StatusSenha" AS ENUM ('AGUARDANDO', 'CHAMADA', 'EM_ATENDIMENTO', 'CONCLUIDA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "MotivoCancelamento" AS ENUM ('MOTORISTA', 'EXPIRADA', 'FIM_DO_DIA', 'MOTORISTA_DESATIVADO');

-- CreateEnum
CREATE TYPE "ConcluidaPor" AS ENUM ('MOTORISTA', 'ADMIN', 'SISTEMA');

-- CreateEnum
CREATE TYPE "ChegadaPor" AS ENUM ('MOTORISTA', 'ADMIN');

-- CreateEnum
CREATE TYPE "PapelAdmin" AS ENUM ('ADMIN', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "TipoUsuario" AS ENUM ('MOTORISTA', 'ADMIN');

-- CreateTable
CREATE TABLE "Local" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "endereco" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "raioMetros" INTEGER NOT NULL DEFAULT 150,

    CONSTRAINT "Local_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Galpao" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "endereco" TEXT NOT NULL,
    "prefixoSenha" CHAR(1) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "localId" INTEGER NOT NULL,

    CONSTRAINT "Galpao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bancada" (
    "id" SERIAL NOT NULL,
    "galpaoId" INTEGER NOT NULL,
    "identificacao" TEXT NOT NULL,
    "ativa" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Bancada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Regiao" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativa" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Regiao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegiaoBancada" (
    "galpaoId" INTEGER NOT NULL,
    "regiaoId" INTEGER NOT NULL,
    "bancadaId" INTEGER NOT NULL,

    CONSTRAINT "RegiaoBancada_pkey" PRIMARY KEY ("galpaoId","regiaoId")
);

-- CreateTable
CREATE TABLE "Motorista" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "cpf" VARCHAR(11) NOT NULL,
    "telefone" TEXT,
    "senhaHash" TEXT NOT NULL,
    "senhaTemporariaExpiraEm" TIMESTAMPTZ(3),
    "deveTrocarSenha" BOOLEAN NOT NULL DEFAULT true,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "regiaoId" INTEGER NOT NULL,
    "ultimaPlaca" TEXT,
    "ultimoGalpaoId" INTEGER,
    "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Motorista_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Admin" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "cpf" VARCHAR(11) NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "senhaTemporariaExpiraEm" TIMESTAMPTZ(3),
    "papel" "PapelAdmin" NOT NULL DEFAULT 'ADMIN',
    "deveTrocarSenha" BOOLEAN NOT NULL DEFAULT true,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Senha" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "dia" VARCHAR(10) NOT NULL,
    "motoristaId" INTEGER NOT NULL,
    "galpaoId" INTEGER NOT NULL,
    "bancadaId" INTEGER NOT NULL,
    "placa" TEXT NOT NULL,
    "motoristaNome" TEXT NOT NULL,
    "galpaoNome" TEXT NOT NULL,
    "galpaoEndereco" TEXT NOT NULL,
    "bancadaIdentificacao" TEXT NOT NULL,
    "regiaoCodigo" TEXT NOT NULL,
    "regiaoNome" TEXT NOT NULL,
    "status" "StatusSenha" NOT NULL DEFAULT 'AGUARDANDO',
    "geradaEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "chamadaEm" TIMESTAMPTZ(3),
    "chamadaPorAdminId" INTEGER,
    "prazoEm" TIMESTAMPTZ(3),
    "toleranciaMinNaChamada" INTEGER,
    "foraDeOrdem" BOOLEAN NOT NULL DEFAULT false,
    "aCaminhoEm" TIMESTAMPTZ(3),
    "aCaminhoPor" "ChegadaPor",
    "aCaminhoAdminId" INTEGER,
    "concluidaEm" TIMESTAMPTZ(3),
    "concluidaPor" "ConcluidaPor",
    "concluidaAdminId" INTEGER,
    "canceladaEm" TIMESTAMPTZ(3),
    "motivoCancelamento" "MotivoCancelamento",
    "resultadoVistoEm" TIMESTAMPTZ(3),
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "precisaoM" DOUBLE PRECISION,
    "distanciaM" DOUBLE PRECISION,
    "liberacaoId" INTEGER,

    CONSTRAINT "Senha_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContadorSenha" (
    "galpaoId" INTEGER NOT NULL,
    "dia" VARCHAR(10) NOT NULL,
    "ultimo" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ContadorSenha_pkey" PRIMARY KEY ("galpaoId","dia")
);

-- CreateTable
CREATE TABLE "LiberacaoGeofence" (
    "id" SERIAL NOT NULL,
    "motoristaId" INTEGER NOT NULL,
    "adminId" INTEGER NOT NULL,
    "criadaEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiraEm" TIMESTAMPTZ(3) NOT NULL,
    "usadaEm" TIMESTAMPTZ(3),

    CONSTRAINT "LiberacaoGeofence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Configuracao" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "toleranciaMin" INTEGER NOT NULL DEFAULT 5,
    "carenciaSeg" INTEGER NOT NULL DEFAULT 30,
    "tempoPadraoMin" INTEGER NOT NULL DEFAULT 15,
    "ocupacaoMaxMin" INTEGER NOT NULL DEFAULT 120,

    CONSTRAINT "Configuracao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" SERIAL NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "motoristaId" INTEGER NOT NULL,
    "atualizadaEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnvioPush" (
    "id" SERIAL NOT NULL,
    "senhaId" INTEGER NOT NULL,
    "subscriptionId" INTEGER,
    "enviadoEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "statusHttp" INTEGER,

    CONSTRAINT "EnvioPush_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sessao" (
    "id" SERIAL NOT NULL,
    "tipo" "TipoUsuario" NOT NULL,
    "motoristaId" INTEGER,
    "adminId" INTEGER,
    "tokenHash" TEXT NOT NULL,
    "criadaEm" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiraEm" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Sessao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TentativaLogin" (
    "id" SERIAL NOT NULL,
    "cpf" VARCHAR(11) NOT NULL,
    "ip" TEXT NOT NULL,
    "instante" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sucesso" BOOLEAN NOT NULL,

    CONSTRAINT "TentativaLogin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Auditoria" (
    "id" SERIAL NOT NULL,
    "atorTipo" "TipoUsuario",
    "atorId" INTEGER,
    "acao" TEXT NOT NULL,
    "alvoTipo" TEXT,
    "alvoId" TEXT,
    "dados" JSONB,
    "instante" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Galpao_nome_key" ON "Galpao"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "Galpao_prefixoSenha_key" ON "Galpao"("prefixoSenha");

-- CreateIndex
CREATE UNIQUE INDEX "Bancada_galpaoId_identificacao_key" ON "Bancada"("galpaoId", "identificacao");

-- CreateIndex
CREATE UNIQUE INDEX "Regiao_codigo_key" ON "Regiao"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Motorista_cpf_key" ON "Motorista"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX "Admin_cpf_key" ON "Admin"("cpf");

-- CreateIndex
CREATE INDEX "Senha_bancadaId_status_idx" ON "Senha"("bancadaId", "status");

-- CreateIndex
CREATE INDEX "Senha_motoristaId_geradaEm_idx" ON "Senha"("motoristaId", "geradaEm");

-- CreateIndex
CREATE INDEX "Senha_dia_galpaoId_idx" ON "Senha"("dia", "galpaoId");

-- CreateIndex
CREATE INDEX "Senha_status_prazoEm_idx" ON "Senha"("status", "prazoEm");

-- CreateIndex
CREATE UNIQUE INDEX "Senha_galpaoId_dia_codigo_key" ON "Senha"("galpaoId", "dia", "codigo");

-- CreateIndex
CREATE INDEX "LiberacaoGeofence_motoristaId_expiraEm_idx" ON "LiberacaoGeofence"("motoristaId", "expiraEm");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE UNIQUE INDEX "Sessao_tokenHash_key" ON "Sessao"("tokenHash");

-- CreateIndex
CREATE INDEX "TentativaLogin_cpf_instante_idx" ON "TentativaLogin"("cpf", "instante");

-- CreateIndex
CREATE INDEX "TentativaLogin_ip_instante_idx" ON "TentativaLogin"("ip", "instante");

-- CreateIndex
CREATE INDEX "Auditoria_acao_instante_idx" ON "Auditoria"("acao", "instante");

-- AddForeignKey
ALTER TABLE "Galpao" ADD CONSTRAINT "Galpao_localId_fkey" FOREIGN KEY ("localId") REFERENCES "Local"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bancada" ADD CONSTRAINT "Bancada_galpaoId_fkey" FOREIGN KEY ("galpaoId") REFERENCES "Galpao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegiaoBancada" ADD CONSTRAINT "RegiaoBancada_galpaoId_fkey" FOREIGN KEY ("galpaoId") REFERENCES "Galpao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegiaoBancada" ADD CONSTRAINT "RegiaoBancada_regiaoId_fkey" FOREIGN KEY ("regiaoId") REFERENCES "Regiao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegiaoBancada" ADD CONSTRAINT "RegiaoBancada_bancadaId_fkey" FOREIGN KEY ("bancadaId") REFERENCES "Bancada"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Motorista" ADD CONSTRAINT "Motorista_regiaoId_fkey" FOREIGN KEY ("regiaoId") REFERENCES "Regiao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Motorista" ADD CONSTRAINT "Motorista_ultimoGalpaoId_fkey" FOREIGN KEY ("ultimoGalpaoId") REFERENCES "Galpao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Senha" ADD CONSTRAINT "Senha_motoristaId_fkey" FOREIGN KEY ("motoristaId") REFERENCES "Motorista"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Senha" ADD CONSTRAINT "Senha_galpaoId_fkey" FOREIGN KEY ("galpaoId") REFERENCES "Galpao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Senha" ADD CONSTRAINT "Senha_bancadaId_fkey" FOREIGN KEY ("bancadaId") REFERENCES "Bancada"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Senha" ADD CONSTRAINT "Senha_chamadaPorAdminId_fkey" FOREIGN KEY ("chamadaPorAdminId") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Senha" ADD CONSTRAINT "Senha_aCaminhoAdminId_fkey" FOREIGN KEY ("aCaminhoAdminId") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Senha" ADD CONSTRAINT "Senha_concluidaAdminId_fkey" FOREIGN KEY ("concluidaAdminId") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Senha" ADD CONSTRAINT "Senha_liberacaoId_fkey" FOREIGN KEY ("liberacaoId") REFERENCES "LiberacaoGeofence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContadorSenha" ADD CONSTRAINT "ContadorSenha_galpaoId_fkey" FOREIGN KEY ("galpaoId") REFERENCES "Galpao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiberacaoGeofence" ADD CONSTRAINT "LiberacaoGeofence_motoristaId_fkey" FOREIGN KEY ("motoristaId") REFERENCES "Motorista"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiberacaoGeofence" ADD CONSTRAINT "LiberacaoGeofence_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_motoristaId_fkey" FOREIGN KEY ("motoristaId") REFERENCES "Motorista"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnvioPush" ADD CONSTRAINT "EnvioPush_senhaId_fkey" FOREIGN KEY ("senhaId") REFERENCES "Senha"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnvioPush" ADD CONSTRAINT "EnvioPush_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "PushSubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sessao" ADD CONSTRAINT "Sessao_motoristaId_fkey" FOREIGN KEY ("motoristaId") REFERENCES "Motorista"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sessao" ADD CONSTRAINT "Sessao_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

