import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { HTTP_ERRORS, HTTP_SUCCESS } from "@/lib/http/catalog";

export const metadata: Metadata = {
  title: "HTTP status codes · Thapar Nexus",
  description:
    "Every HTTP status the portal returns, with the machine error code from the JSON envelope.",
};

function Table({
  caption,
  rows,
}: {
  caption: string;
  rows: typeof HTTP_SUCCESS;
}) {
  return (
    <div className="split http-catalog">
      <table className="atable">
        <caption className="http-catalog-caption">{caption}</caption>
        <thead>
          <tr>
            <th>Status</th>
            <th>Code</th>
            <th>What it means</th>
            <th>When it happens</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((e) => (
            <tr key={e.status}>
              <td>
                <Link className="mono http-code-link" href={`/errors/${e.status}`}>
                  {e.status}
                </Link>
              </td>
              <td className="mono-cell">{e.code}</td>
              <td>
                <strong>{e.title}.</strong> {e.meaning}
              </td>
              <td className="http-when">{e.when}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Developer catalogue — not linked in member UI; production sends people home. */
export default function HttpErrorsPage() {
  if (process.env.NODE_ENV === "production") {
    redirect("/");
  }

  return (
    <>
      <SiteNav />
      <main id="top">
        <section className="page-hero">
          <div className="wrap">
            <p className="eyebrow">API contract</p>
            <h1>HTTP status codes</h1>
            <p className="lede">
              The portal answers with a small, documented set of statuses — not an
              ad-hoc scatter. Errors share one envelope:{" "}
              <code className="mono">{`{ error: { code, message, field, requestId } }`}</code>
              . No stack traces, and 401/404 do not confirm that an account or posting
              exists.
            </p>
          </div>
        </section>
        <section>
          <div className="wrap">
            <Table caption="Success" rows={HTTP_SUCCESS} />
            <Table caption="Errors" rows={HTTP_ERRORS} />
            <p className="http-catalog-foot">
              Source of truth: <code className="mono">src/lib/http/errors.ts</code> ·
              documented in <code className="mono">docs/Rules.md</code> §4.
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
