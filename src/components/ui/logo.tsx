import Image from 'next/image';

export function Logo({ largura = 160 }: { largura?: number }) {
  return (
    <Image
      src="/logo-csm.png"
      alt="CSM — Conectando Soluções em Movimento"
      width={largura}
      height={largura / 2}
      priority
      className="h-auto"
      style={{ width: largura }}
    />
  );
}
