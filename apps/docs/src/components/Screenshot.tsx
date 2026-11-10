import ThemedImage from "@theme/ThemedImage";
import useBaseUrl from "@docusaurus/useBaseUrl";

/** A picture of the app from img/oberflaeche/, in the light or dark version of the page's theme.
 *  They are taken by `./infra/test/stack.sh screenshots`. */
export function Screenshot({ name, alt }: { name: string; alt: string }) {
  const hell = useBaseUrl(`/img/oberflaeche/${name}-hell.png`);
  const dunkel = useBaseUrl(`/img/oberflaeche/${name}-dunkel.png`);
  return <ThemedImage alt={alt} sources={{ light: hell, dark: dunkel }} style={{ borderRadius: 12, border: "1px solid var(--ifm-toc-border-color)" }} />;
}
