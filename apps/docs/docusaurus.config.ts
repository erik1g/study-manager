import type * as Preset from "@docusaurus/preset-classic";
import type { Config } from "@docusaurus/types";
import { themes } from "prism-react-renderer";

const config: Config = {
  title: "Study Manager",
  tagline: "The self-hosted web app for students",
  // Published on GitHub Pages: https://erik1g.github.io/study-manager/
  url: "https://erik1g.github.io",
  baseUrl: "/study-manager/",
  organizationName: "erik1g",
  projectName: "study-manager",
  trailingSlash: false,
  onBrokenLinks: "throw",
  markdown: { hooks: { onBrokenMarkdownLinks: "throw" } },
  favicon: "img/favicon.svg",
  i18n: { defaultLocale: "en", locales: ["en"] },
  clientModules: ["./src/client.ts"],

  presets: [
    [
      "classic",
      {
        docs: {
          routeBasePath: "/",
          sidebarPath: "./sidebars.ts",
          breadcrumbs: true,
          editUrl: "https://github.com/erik1g/study-manager/edit/dev/apps/docs/",
        },
        blog: false,
        pages: false,
        theme: { customCss: "./src/css/custom.css" },
      } satisfies Preset.Options,
    ],
  ],

  themes: [
    "@docusaurus/theme-live-codeblock",
    [
      "@easyops-cn/docusaurus-search-local",
      {
        hashed: true,
        language: ["en"],
        indexBlog: false,
        docsRouteBasePath: "/",
        highlightSearchTermsOnTargetPage: true,
      },
    ],
  ],

  themeConfig: {
    colorMode: { respectPrefersColorScheme: true },
    navbar: {
      title: "Study Manager",
      logo: { alt: "", src: "img/favicon.svg" },
      items: [
        { type: "docSidebar", sidebarId: "users", position: "left", label: "Users" },
        { type: "docSidebar", sidebarId: "admin", position: "left", label: "Admin" },
        { type: "docSidebar", sidebarId: "developers", position: "left", label: "Developers" },
        { href: "https://github.com/erik1g/study-manager", label: "GitHub", position: "right" },
      ],
    },
    footer: {
      copyright: "Study Manager · free software under the GPL-3.0",
    },
    docs: { sidebar: { hideable: true } },
    tableOfContents: { minHeadingLevel: 2, maxHeadingLevel: 3 },
    liveCodeBlock: { playgroundPosition: "top" },
    prism: { theme: themes.github, darkTheme: themes.vsDark },
  } satisfies Preset.ThemeConfig,
};

export default config;
