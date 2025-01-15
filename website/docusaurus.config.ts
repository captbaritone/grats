import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";
import { themes } from "prism-react-renderer";

const lightCodeTheme = themes.github;
const darkCodeTheme = themes.dracula;

const config: Config = {
  title: "Grats",
  tagline: "The cleanest way to build a TypeScript GraphQL server",
  favicon: "img/favicon.ico",

  // Set the production url of your site here
  url: "https://grats.capt.dev",
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: "/",

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: "captbaritone", // Usually your GitHub org/user name.
  projectName: "grats", // Usually your repo name.

  onBrokenLinks: "throw",
  onBrokenMarkdownLinks: "throw",
  // This causes problems with playground links since the there's no explicit anchors.
  onBrokenAnchors: "ignore",

  // Even if you don't use internalization, you can use this field to set useful
  // metadata like html lang. For example, if your site is Chinese, you may want
  // to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: "en",
    locales: ["en"],
  },

  customFields: {
    // Put your custom environment here
    gitHash: process.env.REACT_APP_GIT_HASH,
  },

  plugins: [require.resolve("./plugins/webpack.js")],

  presets: [
    [
      "classic",
      {
        docs: {
          sidebarPath: require.resolve("./sidebars.js"),
          // Please change this to your repo.
          // Remove this to remove the "edit this page" links.
          /*
          editUrl:
            "https://github.com/facebook/docusaurus/tree/main/packages/create-docusaurus/templates/shared/",
            */
        },
        /*
        blog: {
          showReadingTime: true,
          // Please change this to your repo.
          // Remove this to remove the "edit this page" links.
          editUrl:
            "https://github.com/facebook/docusaurus/tree/main/packages/create-docusaurus/templates/shared/",
        },
        */
        gtag: {
          trackingID: "G-B361WM0C9X",
        },
        theme: {
          customCss: require.resolve("./src/css/custom.css"),
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    metadata: [
      { name: "og:image", content: "https://grats.capt.dev/img/grats-og.png" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    // Replace with your project's social card
    // image: "img/docusaurus-social-card.jpg",
    navbar: {
      title: "Grats",
      logo: {
        alt: "Grats",
        src: "img/logo.svg",
        target: "_self",
        style: {},
      },
      items: [
        {
          type: "docSidebar",
          sidebarId: "tutorialSidebar",
          position: "left",
          label: "Docs",
        },
        /*
          { to: "/blog", label: "Blog", position: "left" },
          */
        {
          to: "/playground",
          label: "Playground",
          position: "right",
        },
        {
          href: "https://github.com/captbaritone/grats",
          label: "GitHub",
          position: "right",
        },
      ],
    },
    footer: {
      style: "dark",
      links: [
        {
          title: "Docs",
          items: [
            {
              label: "Docs",
              to: "/docs/getting-started/",
            },
          ],
        },
        {
          title: "Community",
          items: [
            {
              label: "Discord",
              href: "https://capt.dev/grats-chat",
            },
          ],
        },
        {
          title: "More",
          items: [
            {
              label: "GitHub",
              href: "https://github.com/captbaritone/grats",
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Jordan Eldredge`,
    },
    prism: {
      additionalLanguages: ["typescript", "json", "bash"],
      theme: lightCodeTheme,
      darkTheme: darkCodeTheme,
      magicComments: [
        // Remember to extend the default highlight class name as well!
        {
          className: "theme-code-block-highlighted-line",
          line: "highlight-next-line",
          block: { start: "highlight-start", end: "highlight-end" },
        },
        {
          className: "code-block-error-line",
          line: "This will error",
        },
        {
          className: "code-trimmed-line",
          block: { start: "trim-start", end: "trim-end" },
        },
      ],
    },
    // https://docusaurus.io/docs/search
    algolia: {
      // The application ID provided by Algolia
      appId: "J2ZGHESLS2",

      // Public API key: it is safe to commit it
      apiKey: "a16f71626910d3e7fcf4a5ffdb25d2e5",

      indexName: "grats",

      // Optional: see doc section below
      contextualSearch: true,

      // Optional: Specify domains where the navigation should occur through window.location instead on history.push. Useful when our Algolia config crawls multiple documentation sites and we want to navigate with window.location.href to them.
      // externalUrlRegex: "external\\.com|domain\\.com",

      // Optional: Replace parts of the item URLs from Algolia. Useful when using the same search index for multiple deployments using a different baseUrl. You can use regexp or string in the `from` param. For example: localhost:3000 vs myCompany.com/docs
      /*
        replaceSearchResultPathname: {
          from: "/docs/", // or as RegExp: /\/docs\//
          to: "/",
        },
        */

      // Optional: Algolia search parameters
      // searchParameters: {},

      // Optional: path for search page that enabled by default (`false` to disable it)
      searchPagePath: "search",

      //... other Algolia params
    },
  } satisfies Preset.ThemeConfig,
};

module.exports = config;
