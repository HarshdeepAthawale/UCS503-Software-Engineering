import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { HttpStatusScreen } from "@/components/http-status-screen";
import { HTTP_CATALOG, httpEntryByStatus } from "@/lib/http/catalog";

type Props = { params: Promise<{ code: string }> };

export function generateStaticParams() {
  return HTTP_CATALOG.map((e) => ({ code: String(e.status) }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const entry = httpEntryByStatus(Number(code));
  if (!entry) return { title: "HTTP status · Thapar Nexus" };
  return { title: `${entry.status} ${entry.title} · Thapar Nexus` };
}

export default async function HttpStatusCodePage({ params }: Props) {
  const { code } = await params;
  const n = Number(code);
  if (!Number.isInteger(n)) notFound();
  const entry = httpEntryByStatus(n);
  if (!entry) notFound();
  return <HttpStatusScreen entry={entry} />;
}
