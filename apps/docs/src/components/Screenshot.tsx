import ThemedImage from "@theme/ThemedImage";
import useBaseUrl from "@docusaurus/useBaseUrl";

/** A picture of the app from img/screenshots/, in the light or dark version of the page's theme.
 *  They are taken by `./infra/test/stack.sh screenshots`. */
export function Screenshot({ name, alt }: { name: string; alt: string }) {
  const light = useBaseUrl(`/img/screenshots/${name}-light.png`);
  const dark = useBaseUrl(`/img/screenshots/${name}-dark.png`);
  return <ThemedImage alt={alt} sources={{ light, dark }} style={{ borderRadius: 12, border: "1px solid var(--ifm-toc-border-color)" }} />;
}
