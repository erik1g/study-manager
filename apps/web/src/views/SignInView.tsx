import { useState, type FormEvent } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router";
import { Button, Notice, SectionHeader, TextField } from "@study/ui";
import { AuthLayout } from "../components/AuthLayout";
import { de } from "../i18n/de";
import { auth, mailEnabled } from "../lib/auth";
import { useSession } from "../lib/session";

export function SignInView() {
  const { session } = useSession();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const next = params.get("weiter") ?? "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forgot, setForgot] = useState(false);
  const [sent, setSent] = useState(false);

  if (session) return <Navigate to={next} replace />;

  async function withPassword(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await auth().auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) setError(de.signIn.failed);
    else navigate(next, { replace: true });
  }

  async function sendReset(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await auth().auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/willkommen?neu=passwort` });
    setBusy(false);
    // The same answer whether or not the address has an account.
    if (error && error.status !== 400 && error.status !== 422) setError(error.message);
    else setSent(true);
  }

  async function withPasskey() {
    setError(null);
    const { error } = await auth().auth.signInWithPasskey();
    if (error) setError(error.message);
    else navigate(next, { replace: true });
  }

  if (forgot) {
    return (
      <AuthLayout>
        <form className="ui-stack" onSubmit={sendReset}>
          <SectionHeader level={1} size="lg" title={de.signIn.forgotTitle} description={sent ? undefined : de.signIn.forgotText} />
          {sent ? (
            <Notice tone="success">{de.signIn.forgotSent}</Notice>
          ) : (
            <>
              <TextField label={de.signIn.email} type="email" size="lg" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
              {error && <Notice tone="danger">{error}</Notice>}
              <Button type="submit" variant="primary" size="lg" wide loading={busy}>
                {de.signIn.forgotSend}
              </Button>
            </>
          )}
          <Button variant="ghost" icon="arrow-left" onClick={() => (setForgot(false), setSent(false))}>
            {de.signIn.backToSignIn}
          </Button>
        </form>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <form className="ui-stack" onSubmit={withPassword}>
        <SectionHeader level={1} size="lg" title={de.signIn.welcomeBack} description={de.signIn.lead} />
        <Button variant="primary" size="lg" wide icon="key" onClick={withPasskey}>
          {de.signIn.passkey}
        </Button>
        <p className="auth-divider">
          <span>{de.signIn.or}</span>
        </p>
        <TextField label={de.signIn.email} type="email" size="lg" autoComplete="username webauthn" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <TextField label={de.signIn.password} type="password" size="lg" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error && <Notice tone="danger">{error}</Notice>}
        <Button type="submit" size="lg" wide loading={busy}>
          {de.signIn.submit}
        </Button>
        <div className="auth-links">
          {mailEnabled && (
            <Button variant="ghost" size="sm" onClick={() => setForgot(true)}>
              {de.signIn.forgot}
            </Button>
          )}
          <span className="quiet small">{de.signIn.inviteOnly}</span>
        </div>
      </form>
    </AuthLayout>
  );
}
