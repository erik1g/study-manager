// The pages before and around signing in: a warm picture at the left, the
// form at the right; on phones the picture shrinks to a band on top.
import type { ReactNode } from "react";
import { Card, Illustration, Logo } from "@study/ui";
import { de } from "../i18n/de";

export function AuthLayout({ children, inApp = false }: { children: ReactNode; inApp?: boolean }) {
  if (inApp) {
    return (
      <div className="page auth-in-app">
        <Card padding="lg" className="auth-card">
          {children}
        </Card>
      </div>
    );
  }
  return (
    <div className="auth-page">
      <Card as="section" tone="orange" glow grain padding="lg" className="auth-picture" aria-hidden="true">
        <Logo />
        <div className="auth-scenes">
          <Illustration kind="buecher" />
          <Illustration kind="tasse" />
        </div>
        <div>
          <p className="auth-tagline ui-display">{de.signIn.tagline}</p>
          <p className="auth-subline">{de.signIn.subline}</p>
        </div>
      </Card>
      <main className="auth-form">
        <div className="auth-form-inner">{children}</div>
      </main>
    </div>
  );
}
