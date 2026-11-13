import { useEffect, useRef, useState } from "react";
// The legacy build of pdf.js carries what older Safari versions lack.
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import pdfWorkerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";
import { Button, EmptyState, Notice } from "@study/ui";
import { t, errorMessage } from "../i18n";
import { api, type CourseFile } from "../lib/api";
import { usePinchZoom } from "../lib/pinch";
import { Rich } from "./Rich";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

type Kind = "pdf" | "word" | "old-word" | "image" | "markdown" | "text" | "other";

export function kindOf(file: Pick<CourseFile, "name" | "mime">): Kind {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (file.mime === "application/pdf" || extension === "pdf") return "pdf";
  if (/wordprocessingml\.document/.test(file.mime) || extension === "docx") return "word";
  if (file.mime === "application/msword" || extension === "doc") return "old-word";
  if (file.mime.startsWith("image/")) return "image";
  if (["md", "markdown"].includes(extension)) return "markdown";
  if (file.mime.startsWith("text/") || ["txt", "tex", "csv", "json", "py", "m", "c", "cpp", "h", "java", "ts", "js"].includes(extension)) return "text";
  return "other";
}

interface Props {
  file: CourseFile;
  /** The page to scroll to, for documents that have pages. */
  page?: number | null;
  /** Called with the page in view while scrolling through a PDF. */
  onPageChange?: (page: number) => void;
  /** Buttons for the bar above the document. */
  actions?: React.ReactNode;
  /** Zoom as a factor of the page width (1 = fill the width); without it, pages keep their usual size. */
  zoom?: number;
  /** Called while the reader zooms with Ctrl/⌘ + wheel or two fingers. */
  onZoom?: (zoom: number) => void;
}

/** Shows a document of a subject, or offers to download it. */
export function DocumentViewer({ file, page, onPageChange, actions, zoom, onZoom }: Props) {
  const viewer = useRef<HTMLDivElement>(null);
  usePinchZoom(viewer, zoom ?? 1, onZoom);
  const [data, setData] = useState<ArrayBuffer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const kind = kindOf(file);

  useEffect(() => {
    setData(null);
    setError(null);
    if (kind === "other" || kind === "old-word") return;
    let stale = false;
    api.fileBytes(file.id).then(
      (bytes) => !stale && setData(bytes),
      (e) => !stale && setError(errorMessage(e)),
    );
    return () => {
      stale = true;
    };
  }, [file.id, kind]);

  return (
    <>
      <div className="viewer-bar">
        <span className="name" title={file.name}>
          {file.name}
        </span>
        <span className="viewer-actions">
          {actions}
          <Button size="sm" icon="download" onClick={() => api.download(file)}>
            {t.common.download}
          </Button>
        </span>
      </div>
      <div className={zoom === undefined ? "viewer" : "viewer zoomable"} ref={viewer} style={zoom === undefined ? undefined : ({ "--viewer-zoom": zoom } as React.CSSProperties)}>
        {error && <Notice tone="danger">{error}</Notice>}
        {kind === "other" && <EmptyState variant="plain" size="sm" illustration="buecher" title={t.course.noPreview} />}
        {kind === "old-word" && <EmptyState variant="plain" size="sm" illustration="buecher" title={t.course.noPreview}>{t.course.oldWord}</EmptyState>}
        {data && kind === "word" && <WordPreview data={data} />}
        {data && kind === "pdf" && <PdfPages data={data} page={page ?? null} onPageChange={onPageChange} zoom={zoom} />}
        {data && kind === "image" && <ImagePreview data={data} mime={file.mime} name={file.name} zoom={zoom} />}
        {data && kind === "markdown" && (
          <div className="text">
            <Rich>{new TextDecoder().decode(data)}</Rich>
          </div>
        )}
        {data && kind === "text" && <pre className="text">{new TextDecoder().decode(data)}</pre>}
      </div>
    </>
  );
}

/**
 * A Word document as a page of text, converted in the browser. Its HTML is
 * cleaned before it is shown, as a document may come from anyone in the subject.
 */
function WordPreview({ data }: { data: ArrayBuffer }) {
  const [html, setHtml] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let stale = false;
    setHtml(null);
    setFailed(false);
    Promise.all([import("mammoth"), import("dompurify")])
      .then(async ([mammoth, purify]) => {
        const { value } = await mammoth.default.convertToHtml({ arrayBuffer: data.slice(0) });
        const clean = purify.default.sanitize(value, { USE_PROFILES: { html: true } });
        if (!stale) setHtml(clean);
      })
      .catch((e) => {
        console.error(e);
        if (!stale) setFailed(true);
      });
    return () => {
      stale = true;
    };
  }, [data]);
  if (failed) return <Notice tone="danger">{t.course.wordFailed}</Notice>;
  if (html === null) return null;
  return (
    <article
      className="word-page"
      dangerouslySetInnerHTML={{ __html: html }}
      onClick={(event) => {
        // Links in a document open beside the app, never in its place.
        const link = (event.target as HTMLElement).closest("a");
        if (link?.href) {
          event.preventDefault();
          window.open(link.href, "_blank", "noopener,noreferrer");
        }
      }}
    />
  );
}

function ImagePreview({ data, mime, name, zoom }: { data: ArrayBuffer; mime: string; name: string; zoom?: number }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const objectUrl = URL.createObjectURL(new Blob([data], { type: mime }));
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [data, mime]);
  return url ? <img src={url} alt={name} style={zoom === undefined ? undefined : { width: `calc((100% - 32px) * ${zoom})`, maxWidth: "none" }} /> : null;
}

function PdfPages({ data, page, onPageChange, zoom }: { data: ArrayBuffer; page: number | null; onPageChange?: (page: number) => void; zoom?: number }) {
  const [pdf, setPdf] = useState<pdfjs.PDFDocumentProxy | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let stale = false;
    setPdf(null);
    setFailed(false);
    // pdf.js takes ownership of the buffer, so hand it a copy.
    const task = pdfjs.getDocument({ data: data.slice(0) });
    task.promise.then(
      (loaded) => !stale && setPdf(loaded),
      (e) => {
        if (stale) return;
        console.error(e);
        setFailed(true);
      },
    );
    return () => {
      stale = true;
      void task.destroy();
    };
  }, [data]);

  if (failed) return <Notice tone="danger">{t.common.pdfFailed}</Notice>;
  if (!pdf) return null;
  return (
    <>
      {Array.from({ length: pdf.numPages }, (_, i) => (
        <PdfPage key={i} pdf={pdf} number={i + 1} target={page === i + 1} onVisible={onPageChange} zoom={zoom} />
      ))}
    </>
  );
}

const PAGE_WIDTH = 820;

/**
 * Renders its page only once it scrolls near the viewport: the image on a
 * canvas, and on top of it the page's text, invisible but selectable.
 */
function PdfPage(props: {
  pdf: pdfjs.PDFDocumentProxy;
  number: number;
  target: boolean;
  /** Called when the page fills a good part of the view. */
  onVisible?: (page: number) => void;
  zoom?: number;
}) {
  const { pdf, number, target, onVisible, zoom } = props;
  const frame = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const textLayer = useRef<HTMLDivElement>(null);
  // The page is drawn again when its width changes (zoom, a pane that opens beside it).
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry!.contentRect.width / 8) * 8));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (target) frame.current?.scrollIntoView({ block: "start" });
  }, [target]);

  useEffect(() => {
    const element = frame.current;
    if (!element || !onVisible) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) onVisible(number);
      },
      // The page counts as shown when it crosses the upper third of the view.
      { rootMargin: "-30% 0px -60% 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [number, onVisible]);

  useEffect(() => {
    const element = frame.current;
    if (!element || !canvas.current || !textLayer.current || width === 0) return;
    const image = canvas.current;
    const text = textLayer.current;
    let task: pdfjs.RenderTask | null = null;
    let layer: pdfjs.TextLayer | null = null;
    let cancelled = false;

    const observer = new IntersectionObserver(
      async ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        const page = await pdf.getPage(number);
        if (cancelled) return;
        const base = page.getViewport({ scale: 1 });
        const cssScale = element.clientWidth / base.width;
        element.style.aspectRatio = `${base.width} / ${base.height}`;
        // The text layer positions its spans with these.
        element.style.setProperty("--total-scale-factor", String(cssScale));

        const viewport = page.getViewport({ scale: cssScale * window.devicePixelRatio });
        image.width = viewport.width;
        image.height = viewport.height;
        task = page.render({ canvas: image, viewport });
        task.promise.catch(() => {});

        layer = new pdfjs.TextLayer({
          textContentSource: page.streamTextContent(),
          container: text,
          viewport: page.getViewport({ scale: cssScale }),
        });
        layer.render().catch(() => {});
      },
      { rootMargin: "800px" },
    );
    observer.observe(element);
    return () => {
      cancelled = true;
      observer.disconnect();
      task?.cancel();
      layer?.cancel();
      text.replaceChildren();
    };
  }, [pdf, number, width]);

  return (
    <div
      ref={frame}
      className="pdf-page"
      data-page={number}
      style={zoom === undefined ? { width: PAGE_WIDTH, maxWidth: "calc(100% - 32px)", aspectRatio: "1 / 1.414" } : { width: `calc((100% - 32px) * ${zoom})`, aspectRatio: "1 / 1.414" }}
      aria-label={t.course.page(number, pdf.numPages)}
    >
      <canvas ref={canvas} />
      <div ref={textLayer} className="textLayer" />
    </div>
  );
}
