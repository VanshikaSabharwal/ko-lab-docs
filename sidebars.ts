import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docsSidebar: [
    {
      type: 'category',
      label: 'Getting Started',
      collapsed: false,
      items: [
        'getting-started/introduction',
        'getting-started/installation',
        'getting-started/credentials',
        'getting-started/environment-variables',
        'getting-started/testing',
      ],
    },
    {
      type: 'category',
      label: 'Frontend',
      items: ['frontend/overview', 'frontend/setup', 'frontend/testing'],
    },
    {
      type: 'category',
      label: 'Backend',
      items: ['backend/overview', 'backend/setup', 'backend/api-reference', 'backend/testing'],
    },
    {
      type: 'category',
      label: 'WebSocket',
      items: ['websocket/overview', 'websocket/setup', 'websocket/protocol', 'websocket/testing'],
    },
    {
      type: 'category',
      label: 'Features',
      items: [
        'features/overview',
        'features/groups-chat',
        'features/workspace-boards',
        'features/code-editor-vcs',
        'features/voice-video',
      ],
    },
    {
      type: 'category',
      label: 'Architecture',
      items: ['architecture/overview', 'architecture/data-model', 'architecture/security'],
    },
    {
      type: 'category',
      label: 'Operations',
      items: ['operations/deployment', 'operations/known-limitations'],
    },
  ],
};

export default sidebars;
