import Link from "next/link";

/** Shared footer for the marketing and error pages. */
export function SiteFooter() {
  return (
    <footer>
      <div className="wrap">
        <div className="foot-grid">
          <div className="foot-brand">
            <Link className="brand" href="/">
              <span>Thapar Nexus</span>
            </Link>
            <p>Verified opportunities for the institute community.</p>
          </div>
          <div className="foot-team">
            <div className="h">Explore</div>
            <div><Link href="/">Home</Link></div>
            <div><Link href="/product">Product</Link></div>
            <div><Link href="/about">About</Link></div>
            <div><Link href="/register">Get started</Link></div>
          </div>
          <div className="foot-team">
            <div className="h">Team · UCS503</div>
            <div>Harshdeep Athawale · 1024031062</div>
            <div>Aakriti Chauhan · 1024031055</div>
            <div>Sehaj Dhillon · 1024030620</div>
          </div>
          <div className="foot-team">
            <div className="h">Institute</div>
            <div>Thapar Institute of</div>
            <div>Engineering &amp; Technology</div>
            <div>Patiala, Punjab</div>
          </div>
        </div>
        <div className="foot-bottom">
          <span>© 2026 Thapar Nexus · Software Engineering course project</span>
          <a
            href="https://github.com/HarshdeepAthawale/UCS503-Software-Engineering"
            target="_blank"
            rel="noopener"
          >
            github.com/HarshdeepAthawale/UCS503-Software-Engineering ↗
          </a>
        </div>
      </div>
    </footer>
  );
}
