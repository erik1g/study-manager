// The 404 page. The documentation moved from German to English addresses without
// redirects, so old links land here; the page points to the start and the three areas.
import Link from "@docusaurus/Link";
import Heading from "@theme/Heading";
import type { Props } from "@theme/NotFound/Content";

export default function NotFoundContent({ className }: Props) {
  return (
    <main className={`container margin-vert--xl ${className ?? ""}`}>
      <div className="row">
        <div className="col col--6 col--offset-3">
          <Heading as="h1" className="hero__title">
            Page not found
          </Heading>
          <p>This page does not exist (any more). The documentation is now in English and its addresses have changed.</p>
          <p>
            <Link to="/">Go to the start page</Link> or straight to the docs for <Link to="/users">users</Link>,{" "}
            <Link to="/admin">admins</Link> or <Link to="/developers">developers</Link>.
          </p>
        </div>
      </div>
    </main>
  );
}
