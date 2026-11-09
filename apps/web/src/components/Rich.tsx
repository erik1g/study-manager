import Markdown from "react-markdown";
import { useNavigate } from "react-router";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import "katex/dist/katex.min.css";

/**
 * The Markdown parser only treats `$$` as a displayed formula when the
 * delimiters stand on lines of their own; Claude usually writes them inline.
 */
function withDisplayMath(markdown: string): string {
  return markdown.replace(/\$\$([^\n$]+)\$\$/g, (_, formula: string) => `\n$$\n${formula.trim()}\n$$\n`);
}

/** Markdown with LaTeX formulas, as notes and cards are written. */
export function Rich({ children }: { children: string }) {
  const navigate = useNavigate();
  return (
    <div className="prose">
      <Markdown
        // Raw HTML is not shown; this keeps the markers in the notes invisible.
        skipHtml
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        urlTransform={(url) => (/^(https?:|mailto:|#|\/)/.test(url) ? url : "")}
        components={{
          a({ href, children }) {
            // Links inside the app, such as a transcript in the notes.
            if (href?.startsWith("/")) {
              return (
                <a
                  href={href}
                  onClick={(event) => {
                    event.preventDefault();
                    navigate(href);
                  }}
                >
                  {children}
                </a>
              );
            }
            return (
              <a href={href} target="_blank" rel="noreferrer">
                {children}
              </a>
            );
          },
        }}
      >
        {withDisplayMath(children)}
      </Markdown>
    </div>
  );
}
