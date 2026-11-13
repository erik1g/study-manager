// How this browser transcribes lectures: the method, the key for a service,
// and how well the device can do it by itself.
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Card, Chip, Notice, ProgressBar, SectionHeader, SegmentedControl, Select, TextField, type NoticeTone } from "@study/ui";
import { t, errorMessage, formatNumber } from "../i18n";
import {
  checkBrowser,
  PROVIDERS,
  rate,
  storedKey,
  storedMethod,
  storedProvider,
  storeKey,
  storeMethod,
  storeProvider,
  testKey,
  testSpeed,
  type BrowserCheck,
  type Method,
  type Phase,
  type Provider,
  type Rating,
  type SpeedResult,
} from "../lib/transcribe";

const RATING_TONE: Record<Rating, NoticeTone> = { good: "success", limited: "info", slow: "warning" };

export function TranscriptionSettings() {
  const [method, setMethod] = useState<Method>(storedMethod);
  const choose = (next: Method) => {
    storeMethod(next);
    setMethod(next);
  };
  return (
    <>
      <Card as="section" className="settings-section">
        <SectionHeader title={t.settings.transcription} description={t.settings.transcriptionText} />
        <div className="ui-stack settings-section-body">
          <SegmentedControl
            label={t.settings.method}
            value={method}
            onChange={choose}
            options={[
              { value: "browser", label: t.settings.methodBrowser, icon: "mic" },
              { value: "api", label: t.settings.methodKey, icon: "key" },
            ]}
          />
          <p className="quiet small">{method === "browser" ? t.settings.methodBrowserText : t.settings.methodKeyText}</p>
          {method === "api" && <KeyForm />}
        </div>
      </Card>
      <BrowserPanel />
    </>
  );
}

function KeyForm() {
  const [provider, setProvider] = useState<Provider>(storedProvider);
  const [key, setKey] = useState(() => storedKey(storedProvider()));
  const [saved, setSaved] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [testing, setTesting] = useState(false);

  const pick = (next: Provider) => {
    storeProvider(next);
    setProvider(next);
    setKey(storedKey(next));
    setSaved(false);
    setResult(null);
  };
  const save = () => {
    storeKey(provider, key.trim());
    setSaved(true);
  };

  const remove = () => {
    storeKey(provider, "");
    setKey("");
    setSaved(false);
    setResult(null);
  };
  const test = async () => {
    setTesting(true);
    setResult(null);
    try {
      await testKey(provider, key.trim());
      save();
      setResult({ ok: true, text: t.settings.keyGood });
    } catch (e) {
      const status = (e as Error).message;
      setResult({ ok: false, text: /^\d+$/.test(status) ? t.settings.keyBad(status) : t.settings.keyUnreachable });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card variant="sunken" padding="sm" className="ui-stack">
      <div className="entry-form">
        <Select label={t.settings.provider} value={provider} onChange={(e) => pick(e.target.value as Provider)}>
          {(Object.keys(PROVIDERS) as Provider[]).map((p) => (
            <option key={p} value={p}>
              {PROVIDERS[p].name}
            </option>
          ))}
        </Select>
        <TextField
          className="wide"
          label={t.settings.apiKey}
          type="password"
          autoComplete="off"
          hint={t.settings.apiKeyHint}
          value={key}
          onChange={(e) => {
            setKey(e.target.value);
            setSaved(false);
            setResult(null);
          }}
        />
      </div>
      <div className="toolbar-row">
        <Button variant="primary" disabled={!key.trim()} onClick={save}>
          {t.settings.keySave}
        </Button>
        <Button loading={testing} disabled={!key.trim()} onClick={test}>
          {t.settings.keyTest}
        </Button>
        {key && storedKey(provider) && (
          <Button variant="ghost" onClick={remove}>
            {t.settings.keyRemove}
          </Button>
        )}
        {saved && !result && (
          <Chip tone="gruen" icon="check">
            {t.settings.keySaved}
          </Chip>
        )}
      </div>
      {result && <Notice tone={result.ok ? "success" : "danger"}>{result.text}</Notice>}
    </Card>
  );
}

function BrowserPanel() {
  const [check, setCheck] = useState<BrowserCheck | null>(null);
  const [phase, setPhase] = useState<{ phase: Phase; fraction: number } | null>(null);
  const [speed, setSpeed] = useState<SpeedResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  const load = useCallback(() => checkBrowser().then(setCheck), []);
  useEffect(() => {
    void load();
    return () => abort.current?.abort();
  }, [load]);

  async function run() {
    setError(null);
    setSpeed(null);
    abort.current = new AbortController();
    try {
      setSpeed(await testSpeed((p, fraction) => setPhase({ phase: p, fraction }), abort.current.signal));
      await load();
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError(errorMessage(e));
    } finally {
      setPhase(null);
    }
  }

  if (!check) return null;
  const rating = rate(check);
  return (
    <Card as="section" className="settings-section">
      <SectionHeader title={t.settings.browserCheck} />
      <div className="ui-stack settings-section-body">
        <Notice tone={RATING_TONE[rating]}>{t.settings.ratings[rating]}</Notice>
        <dl className="check-list">
          <dt>{t.settings.checkGpu}</dt>
          <dd>{check.webGpu ? (check.gpuName ?? t.settings.checkGpuUnnamed) : t.settings.checkNoGpu}</dd>
          <dt>{t.settings.checkCores}</dt>
          <dd>{check.cores || "–"}</dd>
          {check.memoryGb != null && (
            <>
              <dt>{t.settings.checkMemory}</dt>
              <dd>{t.settings.checkMemoryValue(check.memoryGb)}</dd>
            </>
          )}
          {check.freeStorageGb != null && (
            <>
              <dt>{t.settings.checkStorage}</dt>
              <dd>{t.settings.checkStorageValue(check.freeStorageGb)}</dd>
            </>
          )}
          <dt>{t.settings.checkModel}</dt>
          <dd>{check.modelCached ? t.settings.checkModelCached : t.settings.checkModelMissing}</dd>
        </dl>
        <p className="quiet small">{t.settings.speedTestText}</p>
        {phase ? (
          <div className="ui-stack">
            <ProgressBar value={phase.fraction} label={phase.phase === "model" ? t.settings.speedLoad : t.settings.speedRun} tone="violett" />
            <div>
              <Button size="sm" onClick={() => abort.current?.abort()}>
                {t.settings.speedCancel}
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <Button icon="play" onClick={run}>
              {t.settings.speedTest}
            </Button>
          </div>
        )}
        {speed && (
          <Notice tone="success">
            {t.settings.speedResult(speed.model, formatNumber(speed.factor), Math.max(1, Math.round(90 / speed.factor)))}
          </Notice>
        )}
        {error && <Notice tone="danger">{error}</Notice>}
      </div>
    </Card>
  );
}
