// Where Supabase Auth sends someone whose MCP client (Claude) asks for
// access: they see which app it is and allow or deny it.
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { Button, Icon, Notice, SectionHeader } from "@study/ui";
import { AuthLayout } from "../components/AuthLayout";
import { t } from "../i18n";
import { auth } from "../lib/auth";
import { useSession } from "../lib/session";
import { isAllowedRedirect } from "../lib/oauthTargets";

interface Details {
  client?: { name?: string; client_name?: string; uri?: string };
  scope?: string;
  redirect_uri?: string;
}

export function ConsentView() {
  const [params] = useSearchParams();
  const { me } = useSession();
  const id = params.get("authorization_id");
  const [details, setDetails] = useState<Details | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return setError(t.consent.missingId);
    auth()
      .auth.oauth.getAuthorizationDetails(id)
      .then(({ data, error }) => {
        if (error) setError(error.message);
        // Already allowed earlier: Auth answers with where to go on.
        else if (data && "redirect_url" in data && data.redirect_url) window.location.href = data.redirect_url as string;
        else if (!isAllowedRedirect((data as Details).redirect_uri)) {
          // An app that would send the access elsewhere than Claude is refused without asking.
          setError(t.consent.unknownTarget((data as Details).redirect_uri));
          void auth().auth.oauth.denyAuthorization(id);
        } else setDetails(data as Details);
      });
  }, [id]);

  async function decide(allow: boolean) {
    if (!id) return;
    setBusy(true);
    const { data, error } = allow ? await auth().auth.oauth.approveAuthorization(id) : await auth().auth.oauth.denyAuthorization(id);
    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    const target = (data as { redirect_url?: string; redirect_to?: string } | null)?.redirect_url ?? (data as { redirect_to?: string } | null)?.redirect_to;
    if (target) window.location.href = target;
  }

  const client = details?.client?.name ?? details?.client?.client_name ?? "Eine App";
  return (
    <AuthLayout inApp>
      <div className="ui-stack">
        <span className="consent-icon" aria-hidden="true">
          <Icon name="claude" size={30} />
        </span>
        <SectionHeader level={1} size="lg" title={t.consent.title} />
        {error && <Notice tone="danger">{error}</Notice>}
        {details && (
          <>
            <p>{t.consent.text(client)}</p>
            {details.redirect_uri && <p className="quiet small mono">{new URL(details.redirect_uri).host}</p>}
            <p className="quiet small">{t.consent.hint}</p>
            {me && <p className="quiet small">{t.consent.signedInAs(me.email)}</p>}
            <div className="form-actions">
              <Button disabled={busy} onClick={() => decide(false)}>
                {t.consent.deny}
              </Button>
              <Button variant="primary" loading={busy} onClick={() => decide(true)}>
                {t.consent.allow}
              </Button>
            </div>
          </>
        )}
      </div>
    </AuthLayout>
  );
}
