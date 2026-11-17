-- P29: um código de região atende vários bairros ("545" → Paranapiacaba, Represa Billings).
-- `nome` continua sendo o texto exibido (bairros juntos por ", ").
ALTER TABLE "Regiao" ADD COLUMN     "bairros" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- regiões que já existem: o nome atual vira o primeiro bairro
UPDATE "Regiao" SET "bairros" = ARRAY["nome"] WHERE cardinality("bairros") = 0;
