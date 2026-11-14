import Image from 'next/image';

/** `destaque`: o logo é o maior elemento da tela (login, troca de senha), então é pré-carregado. */
export function Logo({
  largura = 160,
  destaque = false,
}: {
  largura?: number;
  destaque?: boolean;
}) {
  return (
    <Image
      src="/logo-csm.png"
      alt="CSM — Conectando Soluções em Movimento"
      width={largura}
      height={largura / 2}
      preload={destaque}
      // sempre no topo da tela: nunca adiar o carregamento
      loading="eager"
      className="h-auto"
      style={{ width: largura }}
    />
  );
}
