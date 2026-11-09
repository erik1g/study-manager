import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Button, Illustration, Notice, SectionHeader } from "@study/ui";
import { AuthLayout } from "../components/AuthLayout";
import { de, errorMessage, semesterName } from "../i18n/de";
import { api } from "../lib/api";
import { useSession } from "../lib/session";

/** Where an invitation link to a subject leads. */
export function JoinView() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { reloadCourses } = useSession();
  const [invite, setInvite] = useState<Awaited<ReturnType<typeof api.invitation>> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.invitation(token!).then(setInvite, (e) => setError(errorMessage(e)));
  }, [token]);

  const [busy, setBusy] = useState(false);
  return (
    <AuthLayout inApp>
      <div className="ui-stack">
        <Illustration kind="buecher" className="auth-in-app-picture" />
        <SectionHeader level={1} size="lg" title={de.join.title} />
        {error && <Notice tone="danger">{error}</Notice>}
        {invite && (
          <>
            <p>{de.join.text(invite.title, semesterName(invite.semester), de.roles[invite.role])}</p>
            <Button
              variant="primary"
              size="lg"
              wide
              loading={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const course = await api.acceptInvitation(token!);
                  await reloadCourses();
                  navigate(`/fach/${course.id}`, { replace: true });
                } catch (e) {
                  setError(errorMessage(e));
                  setBusy(false);
                }
              }}
            >
              {de.join.accept}
            </Button>
          </>
        )}
      </div>
    </AuthLayout>
  );
}
