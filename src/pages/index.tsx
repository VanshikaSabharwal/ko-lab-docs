import type { ReactNode } from 'react';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';

import styles from './index.module.css';

function Hero() {
  const { siteConfig } = useDocusaurusContext();
  return (
    <header className={styles.hero}>
      <div className={styles.heroGlow} aria-hidden="true" />
      <div className="container">
        <div className={styles.heroInner}>
          <span className={styles.eyebrow}>Documentation</span>
          <Heading as="h1" className={styles.heroTitle}>
            {siteConfig.title}
          </Heading>
          <p className={styles.heroSubtitle}>{siteConfig.tagline}</p>
          <div className={styles.heroButtons}>
            <Link className={styles.btnPrimary} to="/docs/">
              Get started
            </Link>
            <Link className={styles.btnGhost} to="/docs/architecture/overview">
              Architecture
            </Link>
          </div>
          <div className={styles.stats}>
            <div className={styles.stat}>
              <strong>3</strong>
              <span>services</span>
            </div>
            <div className={styles.stat}>
              <strong>34</strong>
              <span>data models</span>
            </div>
            <div className={styles.stat}>
              <strong>~40</strong>
              <span>API routes</span>
            </div>
            <div className={styles.stat}>
              <strong>261</strong>
              <span>tests</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

type Card = {
  title: string;
  to: string;
  body: string;
  meta: string;
};

const start: Card[] = [
  {
    title: 'Getting started',
    to: '/docs/',
    body: 'Install, generate every credential, and run all three services locally.',
    meta: '5 pages',
  },
  {
    title: 'Testing',
    to: '/docs/getting-started/testing',
    body: 'The Vitest suite, plus manual procedures for realtime, media and canvas work.',
    meta: '261 tests',
  },
  {
    title: 'Deployment',
    to: '/docs/operations/deployment',
    body: 'Two apps with different hosting needs, and the constraints that decide them.',
    meta: 'Operations',
  },
];

const layers: Card[] = [
  {
    title: 'Frontend',
    to: '/docs/frontend/overview',
    body: 'Next.js 14 App Router, React Flow canvases, CodeMirror, and the realtime hooks.',
    meta: 'apps/web',
  },
  {
    title: 'Backend',
    to: '/docs/backend/overview',
    body: 'Route handlers over Prisma and PostgreSQL, with the full API reference.',
    meta: 'apps/web/api',
  },
  {
    title: 'WebSocket',
    to: '/docs/websocket/overview',
    body: 'The realtime hub — which is also a git microservice. Protocol, guards and limits.',
    meta: 'apps/web-socket',
  },
];

const features: Card[] = [
  {
    title: 'Groups, chat & notifications',
    to: '/docs/features/groups-chat',
    body: 'The unit of collaboration: membership, roles, live chat and the notification centre.',
    meta: 'All three layers',
  },
  {
    title: 'Workspace boards',
    to: '/docs/features/workspace-boards',
    body: 'Four collaborative canvases with live cursors, presence and throttled broadcast.',
    meta: 'React Flow',
  },
  {
    title: 'Code editor, VCS & GitHub',
    to: '/docs/features/code-editor-vcs',
    body: 'In-browser IDE, change requests, merges, and the code-access state machine.',
    meta: 'Git service',
  },
  {
    title: 'Voice & video',
    to: '/docs/features/voice-video',
    body: 'LiveKit-backed calls with screen sharing — the best-tested area of the codebase.',
    meta: 'LiveKit',
  },
];

function CardGrid({ items, wide }: { items: Card[]; wide?: boolean }) {
  return (
    <div className={styles.grid}>
      {items.map((c) => (
        <Link
          key={c.title}
          to={c.to}
          className={wide ? `${styles.card} ${styles.cardWide}` : styles.card}
        >
          <span className={styles.cardMeta}>{c.meta}</span>
          <Heading as="h3" className={styles.cardTitle}>
            {c.title}
          </Heading>
          <p className={styles.cardBody}>{c.body}</p>
          <span className={styles.cardArrow} aria-hidden="true">
            →
          </span>
        </Link>
      ))}
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className={styles.section}>
      <div className="container">
        <div className={styles.sectionHead}>
          <Heading as="h2" className={styles.sectionTitle}>
            {title}
          </Heading>
          <p className={styles.sectionDesc}>{description}</p>
        </div>
        {children}
      </div>
    </section>
  );
}

export default function Home(): ReactNode {
  const { siteConfig } = useDocusaurusContext();
  return (
    <Layout
      title={siteConfig.title}
      description="Documentation for Ko-Lab — collaborative coding, planning and calls in one workspace."
    >
      <Hero />
      <main>
        <Section
          title="Start here"
          description="Get it running, understand how it is tested, and know what deployment requires."
        >
          <CardGrid items={start} />
        </Section>

        <Section
          title="The three services"
          description="Ko-Lab is two deployable apps over one database. The WebSocket service is also a git microservice."
        >
          <CardGrid items={layers} />
        </Section>

        <Section
          title="Features"
          description="Each feature spans all three layers, so each is documented end to end — from code to demo."
        >
          <CardGrid items={features} wide />
        </Section>
      </main>
    </Layout>
  );
}
