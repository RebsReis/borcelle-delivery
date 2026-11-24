import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container-app flex flex-col items-center py-s9 text-center">
      <p className="text-display grunge text-primary">404</p>
      <h1 className="text-h3">Essa página saiu pra entrega e não voltou.</h1>
      <Link href="/" className="btn btn-primary mt-s5">Voltar ao início</Link>
    </div>
  );
}
