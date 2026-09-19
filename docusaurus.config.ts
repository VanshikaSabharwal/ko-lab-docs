import { themes as prismThemes } from 'prism-react-renderer';
import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'Ko-Lab',
  tagline: 'Collaborative coding, planning and calls — in one workspace',
  favicon: 'img/favicon.ico',

  future: { v4: true },

  url: 'https://ko-lab-docs.vercel.app',
  baseUrl: '/',

  organizationName: 'VanshikaSabharwal',
  projectName: 'ko-lab',

  // Broken links are build failures — docs that lie about their own
  // navigation are worse than missing docs.
  onBrokenLinks: 'throw',

  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },

  i18n: { defaultLocale: 'en', locales: ['en'] },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/VanshikaSabharwal/ko-lab/tree/main/',
          // showLastUpdateTime needs git history; this folder is not a repo.
          // Enable it if you `git init` here.
        },
        blog: false,
        theme: { customCss: './src/css/custom.css' },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/ko-lab-social-card.jpg',
    colorMode: {
      defaultMode: 'dark',
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'Ko-Lab',
      logo: { alt: 'Ko-Lab', src: 'img/logo.svg' },
      items: [
        { type: 'docSidebar', sidebarId: 'docsSidebar', position: 'left', label: 'Docs' },
        { to: '/docs/features/overview', label: 'Features', position: 'left' },
        { to: '/docs/architecture/overview', label: 'Architecture', position: 'left' },
        {
          href: 'https://github.com/VanshikaSabharwal/ko-lab',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            { label: 'Getting Started', to: '/docs/' },
            { label: 'Frontend', to: '/docs/frontend/overview' },
            { label: 'Backend', to: '/docs/backend/overview' },
            { label: 'WebSocket', to: '/docs/websocket/overview' },
          ],
        },
        {
          title: 'Reference',
          items: [
            { label: 'Environment variables', to: '/docs/getting-started/environment-variables' },
            { label: 'Testing', to: '/docs/getting-started/testing' },
            { label: 'Data model', to: '/docs/architecture/data-model' },
          ],
        },
        {
          title: 'More',
          items: [{ label: 'GitHub', href: 'https://github.com/VanshikaSabharwal/ko-lab' }],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Ko-Lab.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      // 'prisma' has no Prism component; prisma blocks fall back to plain text.
      additionalLanguages: ['bash', 'json', 'sql', 'yaml'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
