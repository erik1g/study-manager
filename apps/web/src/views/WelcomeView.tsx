// Where invitation and reset links lead: the account gets a name, a password
// and, if wanted, a passkey.
import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { Button, Notice, SectionHeader, TextField } from "@study/ui";
import { AuthLayout } from "../components/AuthLayout";
import { de, errorMessage } from "../i18n/de";
import { api } from "../lib/api";
import { auth } from "../lib/auth";
import { useSession } from "../lib/session";

const MIN_PASSWORD = 10;

export function WelcomeView() {
  const { session, me, reloadMe } = useSession();
  const navigate = useNavigate();
  const [step, setStep] = useState<"account" | "passkey">("account");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [passkeyDone, setPasskeyDone] = useState(false);
  const linkFailed = /error/.test(window.location.hash) || /error/.test(window.location.search);
  // Came from "forgot password": only the password is new, the rest stays.
  const reset = new URLSearchParams(window.location.search).get("neu") === "passwort";

  useEffect(() => {
    if (me && !name && me.displayName !== "Admin") setName(me.displayName);
  }, [me, name]);

  if (!session) {
    return (
      <AuthLayout>
        <div className="ui-stack">
          <SectionHeader level={1} size="lg" title={de.welcome.title} />
          {linkFailed ? <Notice tone="danger">{de.welcome.expired}</Notice> : <p className="quiet">{de.common.loading}</p>}
        </div>
      </AuthLayout>
    );
  }

  async function saveAccount(event: FormEvent) {
    event.preventDefault();
    if (password.length < MIN_PASSWORD) return setError(de.welcome.tooShort);
    if (password !== again) return setError(de.welcome.mismatch);
    setBusy(true);
    setError(null);
    try {
      const { error } = await auth().auth.updateUser({ password });
      if (error) throw error;
      if (name.trim() && !reset) await api.updateProfile({ displayName: name.trim() });
      await reloadMe();
      if (reset) navigate("/", { replace: true });
      else setStep("passkey");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function addPasskey() {
    setError(null);
    const { error } = await auth().auth.registerPasskey();
    if (error) setError(error.message);
    else setPasskeyDone(true);
  }

  return (
    <AuthLayout>
      {step === "account" ? (
        <form className="ui-stack" onSubmit={saveAccount}>
          <SectionHeader level={1} size="lg" title={reset ? de.welcome.resetTitle : de.welcome.title} description={reset ? de.welcome.resetText : de.welcome.text} />
          <p className="quiet small">{session.user.email}</p>
          {!reset && <TextField label={de.welcome.name} size="lg" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />}
          <TextField label={de.welcome.password} type="password" size="lg" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <TextField label={de.welcome.passwordAgain} type="password" size="lg" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} required />
          {error && <Notice tone="danger">{error}</Notice>}
          <Button type="submit" variant="primary" size="lg" wide loading={busy}>
            {de.welcome.save}
          </Button>
        </form>
      ) : (
        <div className="ui-stack">
          <SectionHeader level={1} size="lg" title={de.welcome.passkeyTitle} description={de.welcome.passkeyText} />
          {passkeyDone ? (
            <Notice tone="success">{de.welcome.passkeyDone}</Notice>
          ) : (
            <Button variant="primary" size="lg" wide icon="key" onClick={addPasskey}>
              {de.welcome.passkeyAdd}
            </Button>
          )}
          {error && <Notice tone="danger">{error}</Notice>}
          <Button size="lg" wide onClick={() => navigate("/", { replace: true })}>
            {passkeyDone ? de.welcome.finish : de.welcome.skip}
          </Button>
        </div>
      )}
    </AuthLayout>
  );
}
