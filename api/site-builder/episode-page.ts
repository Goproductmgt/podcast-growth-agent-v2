import { mergeBrandKit } from './brand-kits';
import { buildEditorBlocks } from './blocks';
import { hasOpenAIApiKey } from '../agents/shared/openai-client';
import type {
  BrandKit,
  EpisodeMetadataInput,
  EpisodePageDocument,
  EpisodePageInput,
  EpisodePageSection,
  PageCreatorGuideItem,
  ResourceItem,
  SiteIntegration
} from './types';

const DEFAULT_EPISODE_TITLE = "What If You Didn't Have to Choose Between Productivity and Peace?";
const DEFAULT_APPLE_URL = 'https://podcasts.apple.com/us/podcast/what-if-you-didnt-have-to-choose-between-productivity/id1799868338?i=1000765053598';

export async function buildEpisodePageWithCurator(input: EpisodePageInput): Promise<EpisodePageDocument> {
  if (input.pageStrategy || input.usePageCuratorAgent === false || !hasOpenAIApiKey()) {
    return buildEpisodePage(input);
  }

  const { runPageCuratorAgent } = await import('../agents/page-curator');
  const curatorResult = await runPageCuratorAgent(input);
  if (!curatorResult.success || !curatorResult.data) {
    return buildEpisodePage(input);
  }

  return buildEpisodePage({
    ...input,
    pageStrategy: curatorResult.data
  });
}

export function buildEpisodePage(input: EpisodePageInput): EpisodePageDocument {
  const brandKit = mergeBrandKit(input.brandKit);
  const episode = normalizeEpisode(input.episode, brandKit);
  const integrations = input.integrations || [];
  const siteSlug = slugify(input.siteSlug || brandKit.siteSlug || brandKit.showName);
  const episodeSlug = slugify(input.episodeSlug || episode.episodeTitle);
  const now = new Date().toISOString();
  const agents = input.growthPlan?.agents || {};
  const insight = agents.insight || {};
  const hook = agents.hook || {};
  const spotlight = agents.spotlight || {};
  const amplify = agents.amplify || {};
  const pulse = agents.pulse || {};
  const bridge = agents.bridge || {};
  const beacon = agents.beacon || {};
  const pageStrategy = input.pageStrategy;
  const keywords = extractKeywords(insight);
  const summary = cleanText(
    insight.episode_summary ||
    episode.description ||
    `${episode.podcastTitle} shares a practical, encouraging conversation for listeners who want to redesign their health, home, and routines with more intention.`
  );
  const title = cleanText(pageStrategy?.seoTitle || hook.title_options?.[0]?.title || episode.episodeTitle);
  const canonicalPath = `/episodes/${episodeSlug}`;
  const socialStrategy = {
    caption: spotlight.ready_to_post_caption || null,
    communities: amplify.communities || [],
    podcastMatches: normalizePodcastMatches(amplify, bridge),
    publications: beacon.publications || [],
    trend: normalizePulseTrend(pulse),
    audienceMagnet: pageStrategy?.audienceMagnet || null,
    curatorBlurb: pageStrategy?.audienceMagnet?.blurb || buildCuratorBlurb(summary, pulse, brandKit),
    sectionPlan: pageStrategy?.sectionPlan || [],
    llmSummary: pageStrategy?.llmSummary
  };
  const creatorGuide = pageStrategy?.creatorGuide?.length
    ? pageStrategy.creatorGuide
    : buildCreatorGuide(socialStrategy, spotlight.shareable_quotes || []);

  const sections: EpisodePageSection[] = [
    {
      id: 'hero',
      label: 'Hero',
      type: 'hero',
      content: {
        eyebrow: episode.podcastTitle,
        title: pageStrategy?.heroTitle || episode.episodeTitle,
        summary,
        imageUrl: episode.imageUrl || brandKit.logoUrl || brandKit.artworkUrl,
        imageAlt: brandKit.imageAlt || `${episode.podcastTitle} artwork`,
        listenLinks: buildListenLinks(episode),
        primaryCta: 'Listen Now',
        publishDate: episode.publishDate,
        duration: episode.duration
      }
    },
    {
      id: 'summary',
      label: 'Episode Overview',
      type: 'summary',
      content: {
        summary,
        discoveryPhrases: insight.key_discovery_phrases || [],
        keywords
      }
    },
    {
      id: 'listen',
      label: 'Listen and Watch',
      type: 'listen',
      content: {
        appleUrl: episode.appleUrl,
        spotifyUrl: episode.spotifyUrl,
        youtubeUrl: episode.youtubeUrl,
        audioUrl: episode.audioUrl,
        listenerAngles: buildListenerAngles(hook)
      }
    },
    {
      id: 'takeaways',
      label: 'Key Takeaways',
      type: 'takeaways',
      content: {
        items: buildTakeaways(insight, hook, pulse)
      }
    },
    {
      id: 'quotes',
      label: 'Shareable Moments',
      type: 'quotes',
      content: {
        quotes: spotlight.shareable_quotes || []
      }
    },
    {
      id: 'resources',
      label: 'Resources Mentioned',
      type: 'resources',
      content: {
        items: filterResources(input.resources || [], false)
      }
    },
    {
      id: 'shop',
      label: 'Shop the Episode',
      type: 'shop',
      content: {
        items: filterResources(input.resources || [], true),
        disclosure: 'Some links may be affiliate links. We only share resources that fit the episode and the show.'
      }
    },
    {
      id: 'social',
      label: 'Growth Kit',
      type: 'social',
      content: {
        ...socialStrategy,
        creatorGuide
      }
    }
  ];

  return {
    id: `page_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    siteSlug,
    episodeSlug,
    status: input.status || 'draft',
    createdAt: now,
    updatedAt: now,
    reportId: input.reportId,
    reportBlobUrl: input.reportBlobUrl,
    publicUrl: `https://${siteSlug}.podcastgrowthagent.com${canonicalPath}`,
    fallbackUrl: `https://podcastgrowthagent.com/site/${siteSlug}${canonicalPath}`,
    brandKit,
    episode,
    seo: {
      title: buildSeoTitle(title, episode.podcastTitle),
      description: truncateAtWord(summary, 300),
      keywords,
      canonicalPath
    },
    sections,
    blocks: buildEditorBlocks({
      brandKit,
      episode,
      growthPlan: input.growthPlan,
      resources: input.resources || [],
      integrations,
      selectedBlocks: input.selectedBlocks,
      showBrandCustomizer: input.showBrandCustomizer
    }),
    integrations
  };
}

export function renderEpisodePageHtml(page: EpisodePageDocument): string {
  const colors = page.brandKit.colors;
  const fonts = page.brandKit.fonts;
  const hero = getSection(page, 'hero')?.content || {};
  const summary = getSection(page, 'summary')?.content || {};
  const quotes = getSection(page, 'quotes')?.content?.quotes || [];
  const takeaways = getSection(page, 'takeaways')?.content?.items || [];
  const resources = getSection(page, 'resources')?.content?.items || [];
  const shop = getSection(page, 'shop')?.content?.items || [];
  const social = getSection(page, 'social')?.content || {};
  const blocks = page.blocks || [];
  const brandCustomizerBlock = blocks.find(block => block.visible && block.type === 'brand-customizer');
  const mediaBlocks = blocks.filter(block => block.visible && (block.type === 'youtube-player' || block.type === 'youtube-channel' || block.type === 'instagram-reel'));
  const newsletterBlock = blocks.find(block => block.visible && block.type === 'newsletter-signup');
  const socialLinksBlock = blocks.find(block => block.visible && block.type === 'social-links');
  const personalizationConfig = buildPersonalizationConfig(page, socialLinksBlock);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(page.seo.title)}</title>
  <meta name="description" content="${escapeHtml(page.seo.description)}">
  <link rel="canonical" href="${escapeHtml(page.publicUrl)}">
  <link rel="alternate" type="text/plain" title="LLM page summary" href="${escapeHtml(page.fallbackUrl)}/llm.txt">
  <meta property="og:type" content="article">
  <meta property="og:title" content="${escapeHtml(page.seo.title)}">
  <meta property="og:description" content="${escapeHtml(page.seo.description)}">
  <meta property="og:url" content="${escapeHtml(page.publicUrl)}">
  ${page.episode.imageUrl || page.brandKit.logoUrl || page.brandKit.artworkUrl ? `<meta property="og:image" content="${escapeHtml(page.episode.imageUrl || page.brandKit.logoUrl || page.brandKit.artworkUrl || '')}">` : ''}
  <meta name="twitter:card" content="summary_large_image">
  ${renderEpisodeStructuredData(page)}
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400;1,700&family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500;1,600&family=Playfair+Display:wght@600;700&family=Raleway:wght@500;600;700&display=swap');
    :root {
      --primary: ${colors.primary};
      --background: ${colors.background};
      --text: ${colors.text};
      --accent: ${colors.accent};
      --clay: ${colors.secondaryAccent};
      --display: "${fonts.display}", Georgia, serif;
      --body: "${fonts.body}", Arial, sans-serif;
      --accent-font: "${fonts.accent}", Georgia, serif;
      --pga-background: hsl(0 0% 98%);
      --pga-foreground: hsl(224 71% 10%);
      --pga-card: hsl(0 0% 100%);
      --pga-primary: hsl(224 80% 60%);
      --pga-primary-foreground: hsl(0 0% 100%);
      --pga-secondary: hsl(145 60% 45%);
      --pga-muted: hsl(210 40% 96%);
      --pga-muted-foreground: hsl(215 16% 47%);
      --pga-accent: hsl(145 60% 90%);
      --pga-border: hsl(214 32% 91%);
      --pga-ring: hsl(224 80% 60%);
      --pga-font: "Atkinson Hyperlegible", Arial, sans-serif;
    }
    body.template-default {
      --primary: var(--pga-primary);
      --background: var(--pga-background);
      --text: var(--pga-foreground);
      --accent: var(--pga-accent);
      --clay: var(--pga-secondary);
      --display: var(--pga-font);
      --body: var(--pga-font);
      --accent-font: var(--pga-font);
    }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--background); color: var(--text); font-family: var(--body); line-height: 1.6; }
    a { color: var(--primary); }
    .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
    .shell { width: min(1120px, calc(100% - 36px)); margin: 0 auto; }
    header { padding: 22px 0; border-bottom: 1px solid var(--pga-border); background: color-mix(in srgb, var(--pga-background) 88%, transparent); backdrop-filter: blur(18px); color: var(--pga-foreground); }
    nav { display: flex; justify-content: space-between; align-items: center; gap: 18px; }
    .nav-actions { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    .brand { font-family: var(--display); font-weight: 700; font-size: clamp(24px, 4vw, 38px); color: var(--primary); }
    .brand-lockup { display: flex; align-items: center; gap: 12px; }
    .brand-logo { width: 52px; height: 52px; border-radius: 8px; object-fit: cover; border: 1px solid color-mix(in srgb, var(--primary) 20%, transparent); }
    .links { display: flex; gap: 12px; flex-wrap: wrap; }
    .links a, .button { display: inline-flex; align-items: center; gap: 8px; min-height: 42px; padding: 9px 14px; border-radius: 6px; text-decoration: none; font-weight: 700; border: 1px solid color-mix(in srgb, var(--primary) 30%, transparent); }
    button.button { cursor: pointer; font: inherit; background: rgba(255,255,255,.55); color: var(--primary); }
    .button.primary { background: var(--primary); color: var(--background); }
    .platform-icon { width: 22px; height: 22px; flex: 0 0 22px; display: inline-grid; place-items: center; }
    .platform-icon svg { width: 22px; height: 22px; display: block; }
    .platform-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; }
    .platform-card { display: grid; gap: 10px; align-content: start; text-decoration: none; color: var(--text); min-height: 142px; transition: transform .16s ease, box-shadow .16s ease; }
    .platform-card:hover { transform: translateY(-2px); box-shadow: 0 12px 30px rgba(15, 23, 42, .08); }
    .platform-card strong { display: flex; align-items: center; gap: 10px; color: var(--primary); font-size: 18px; }
    .platform-card span { color: color-mix(in srgb, var(--text) 72%, white); font-weight: 600; }
    .access-intro { max-width: 720px; margin-top: -8px; margin-bottom: 18px; color: color-mix(in srgb, var(--text) 78%, white); }
    .listen-layout { display: grid; grid-template-columns: minmax(0, 1fr) minmax(280px, .72fr); gap: 18px; align-items: start; }
    .angle-panel { background: color-mix(in srgb, var(--accent) 22%, white); border-left: 5px solid var(--clay); }
    .angle-panel h3 { margin: 0 0 12px; font-family: var(--display); color: var(--primary); font-size: 24px; line-height: 1.15; }
    .angle-list { display: grid; gap: 10px; margin: 0; padding: 0; list-style: none; }
    .angle-list li { background: rgba(255,255,255,.58); border: 1px solid color-mix(in srgb, var(--primary) 12%, transparent); border-radius: 8px; padding: 12px; font-weight: 700; line-height: 1.35; }
    header .links a, header .button, .personalize-panel .button { font-family: var(--pga-font); border-color: var(--pga-border); color: var(--pga-foreground); background: var(--pga-card); }
    header .button.primary, .personalize-panel .button.primary { background: var(--pga-primary); color: var(--pga-primary-foreground); border-color: var(--pga-primary); }
    header .links a:hover, header .button:hover, .personalize-panel .button:hover { box-shadow: 0 8px 24px rgba(15, 23, 42, .08); transform: translateY(-1px); }
    .hero { padding: clamp(44px, 7vw, 86px) 0 38px; display: grid; grid-template-columns: 1.3fr .7fr; gap: 34px; align-items: end; }
    .eyebrow { color: var(--primary); font-weight: 700; text-transform: uppercase; letter-spacing: .08em; font-size: 13px; }
    h1 { font-family: var(--display); color: var(--primary); font-size: clamp(42px, 7vw, 78px); line-height: .98; margin: 12px 0 18px; letter-spacing: 0; }
    .summary { font-size: clamp(18px, 2vw, 22px); max-width: 760px; }
    .hero-note { background: color-mix(in srgb, var(--accent) 30%, white); border-left: 6px solid var(--clay); padding: 22px; border-radius: 8px; }
    section { padding: 38px 0; border-top: 1px solid color-mix(in srgb, var(--primary) 14%, transparent); }
    h2 { font-family: var(--display); color: var(--primary); font-size: clamp(30px, 4vw, 46px); margin: 0 0 18px; }
    .grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
    .card { background: rgba(255,255,255,.55); border: 1px solid color-mix(in srgb, var(--primary) 14%, transparent); border-radius: 8px; padding: 20px; }
    blockquote { margin: 0; font-family: var(--accent-font); color: var(--primary); font-size: clamp(23px, 3vw, 34px); line-height: 1.2; }
    .tag-list { display: flex; gap: 10px; flex-wrap: wrap; padding: 0; list-style: none; }
    .tag-list li { background: color-mix(in srgb, var(--accent) 42%, white); border-radius: 999px; padding: 7px 11px; font-weight: 700; }
    .media-layout { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(280px, .65fr); gap: 16px; align-items: stretch; }
    .media-primary { min-height: 100%; }
    .media-frame { width: 100%; border: 0; border-radius: 8px; background: #000; aspect-ratio: 16 / 9; }
    .media-frame.reel { aspect-ratio: 9 / 16; max-height: 720px; background: color-mix(in srgb, var(--accent) 28%, white); display: grid; place-items: center; padding: 20px; }
    .embed-card { display: flex; justify-content: center; min-height: 520px; }
    .instagram-media { max-width: 540px; min-width: 326px; width: 100%; }
    .media-hint { color: color-mix(in srgb, var(--text) 72%, white); font-size: 14px; margin-top: 12px; max-width: 360px; }
    .media-rail { display: grid; gap: 14px; }
    .follow-card { display: grid; gap: 10px; align-content: space-between; min-height: 170px; }
    .follow-card h3 { display: flex; align-items: center; gap: 10px; font-family: var(--display); font-size: 24px; line-height: 1.1; margin: 0; color: var(--primary); }
    .follow-card p { margin: 0; }
    .follow-card .button { width: fit-content; }
    .brand-panel { background: rgba(255,255,255,.62); border: 1px solid color-mix(in srgb, var(--primary) 14%, transparent); border-radius: 8px; padding: 24px; }
    .brand-panel[open] summary { margin-bottom: 20px; }
    summary { cursor: pointer; list-style: none; }
    summary::-webkit-details-marker { display: none; }
    .brand-summary { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
    .swatches { display: flex; gap: 10px; flex-wrap: wrap; }
    .swatch { width: 58px; height: 58px; border-radius: 8px; border: 1px solid rgba(0,0,0,.12); display: grid; place-items: end; overflow: hidden; }
    .swatch span { background: rgba(255,255,255,.84); width: 100%; font-size: 10px; text-align: center; padding: 3px; }
    .brand-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
    .field-list { margin: 0; padding-left: 18px; }
    .personalize-panel { display: none; background: linear-gradient(135deg, var(--pga-background), color-mix(in srgb, var(--pga-accent) 52%, white)); border-bottom: 1px solid var(--pga-border); padding: 30px 0 38px; color: var(--pga-foreground); font-family: var(--pga-font); }
    .personalize-panel.is-open { display: block; }
    .personalize-panel h2, .personalize-panel h3 { font-family: var(--pga-font); color: var(--pga-foreground); font-weight: 700; }
    .personalize-panel .eyebrow { color: var(--pga-primary); }
    .personalize-panel .brand-panel { background: color-mix(in srgb, var(--pga-card) 82%, transparent); border-color: var(--pga-border); box-shadow: 0 8px 32px rgba(15, 23, 42, .04); }
    .personalize-head { display: flex; justify-content: space-between; gap: 18px; align-items: flex-start; flex-wrap: wrap; margin-bottom: 22px; }
    .personalize-head p { max-width: 700px; margin: 6px 0 0; }
    .before-after { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; margin-bottom: 18px; }
    .compare-card { background: color-mix(in srgb, var(--pga-card) 86%, transparent); border: 1px solid var(--pga-border); border-radius: 8px; padding: 18px; box-shadow: 0 8px 32px rgba(15, 23, 42, .04); }
    .compare-card h3 { margin: 0 0 12px; font-family: var(--pga-font); color: var(--pga-primary); font-size: 26px; font-weight: 700; }
    .compare-card dl { margin: 0; display: grid; gap: 10px; }
    .compare-card dt { font-size: 12px; text-transform: uppercase; letter-spacing: .08em; color: var(--pga-muted-foreground); font-weight: 700; }
    .compare-card dd { margin: 0; font-weight: 700; }
    .creator-guide { margin: 18px 0; }
    .creator-guide summary { display: flex; justify-content: space-between; gap: 16px; align-items: center; }
    .creator-guide-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; margin-top: 16px; }
    .creator-guide-card { background: color-mix(in srgb, var(--pga-card) 88%, transparent); border: 1px solid var(--pga-border); border-radius: 8px; padding: 16px; display: grid; gap: 8px; }
    .creator-guide-card h3 { margin: 0; color: var(--pga-primary); font-size: 18px; font-family: var(--pga-font); }
    .creator-guide-card p { margin: 0; }
    .creator-guide-card a { color: var(--pga-primary); font-weight: 700; }
    .edit-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
    .edit-line { display: grid; gap: 6px; }
    .edit-line.full { grid-column: 1 / -1; }
    .edit-line label { font-weight: 700; color: var(--pga-primary); }
    .edit-line input, .edit-line textarea { width: 100%; min-height: 42px; border-radius: 6px; border: 1px solid var(--pga-border); padding: 10px 12px; color: var(--pga-foreground); background: color-mix(in srgb, var(--pga-card) 88%, transparent); font: inherit; }
    .edit-line input:focus, .edit-line textarea:focus { outline: 3px solid color-mix(in srgb, var(--pga-ring) 20%, transparent); border-color: var(--pga-ring); }
    .edit-line textarea { min-height: 96px; resize: vertical; }
    .launch-row { display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; margin-top: 18px; }
    .launch-status { display: none; background: var(--pga-primary); color: var(--pga-primary-foreground); border-radius: 8px; padding: 14px 16px; font-weight: 700; }
    .launch-status.is-live { display: block; }
    .applied-banner { display: none; background: linear-gradient(90deg, var(--primary), var(--clay)); color: var(--background); padding: 12px 0; font-family: var(--body); font-weight: 700; }
    body.is-personalized .applied-banner { display: block; }
    .discovery-results { display: none; margin-top: 16px; gap: 10px; }
    .discovery-results.is-live { display: grid; }
    .candidate { background: color-mix(in srgb, var(--pga-card) 88%, transparent); border: 1px solid var(--pga-border); border-radius: 8px; padding: 14px; display: grid; gap: 8px; }
    .candidate strong { color: var(--pga-primary); }
    .conversation-grid { display: grid; grid-template-columns: 1.1fr .9fr; gap: 18px; align-items: start; }
    .conversation-stack { display: grid; gap: 14px; }
    .conversation-card h3 { margin: 0 0 8px; color: var(--primary); font-family: var(--display); font-size: 24px; line-height: 1.15; }
    .conversation-card p { margin: 0 0 12px; }
    .conversation-label { color: var(--clay); font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; }
    .conversation-meta { color: color-mix(in srgb, var(--text) 68%, white); font-size: 14px; font-weight: 700; }
    .signup { background: var(--primary); color: var(--background); border-radius: 8px; padding: 28px; display: grid; gap: 14px; }
    .signup h2 { color: var(--background); margin: 0; }
    footer { padding: 34px 0 48px; color: color-mix(in srgb, var(--text) 72%, white); }
    @media (max-width: 800px) {
      .hero, .grid, .platform-grid, .brand-fields, .before-after, .edit-grid, .media-layout, .listen-layout, .conversation-grid, .creator-guide-grid { grid-template-columns: 1fr; }
      nav { align-items: flex-start; flex-direction: column; }
    }
  </style>
</head>
<body class="template-default">
  <header>
    <nav class="shell">
      <div class="brand-lockup">${renderLogo(page.brandKit.logoUrl || page.brandKit.artworkUrl, page.brandKit.imageAlt || page.brandKit.showName)}<div class="brand">${escapeHtml(page.brandKit.showName)}</div></div>
      <div class="nav-actions">
        <button class="button primary" type="button" data-open-personalizer>Make This Ours</button>
        <div class="links">
          <a href="#listen">Listen</a>
          <a href="#resources">Resources</a>
          <a href="#shop">Shop</a>
        </div>
      </div>
    </nav>
  </header>
  <div class="applied-banner"><div class="shell">RHH configuration applied: colors, fonts, voice, links, and brand language are now active.</div></div>
  ${renderPersonalizePanel(personalizationConfig)}
  <main>
    <div class="shell hero">
      <div>
        <div class="eyebrow">${escapeHtml(hero.eyebrow || page.episode.podcastTitle)}</div>
        <h1>${escapeHtml(hero.title)}</h1>
        <p class="summary">${escapeHtml(hero.summary)}</p>
        <div class="links">
          ${renderListenLinks(hero.listenLinks || [])}
        </div>
      </div>
      <aside class="hero-note">
        ${hero.imageUrl ? `<img src="${escapeHtml(hero.imageUrl)}" alt="${escapeHtml(hero.imageAlt)}" style="width: 100%; border-radius: 8px; margin-bottom: 18px;">` : ''}
        <strong>A gentle episode reset</strong>
        <p>${escapeHtml(page.brandKit.wordsUseOften.slice(0, 4).join(' • '))}</p>
      </aside>
    </div>

    ${brandCustomizerBlock ? renderBrandCustomizerBlock(brandCustomizerBlock) : ''}

    <section>
      <div class="shell">
        <h2>Episode Overview</h2>
        <p class="summary">${escapeHtml(summary.summary || hero.summary)}</p>
        ${renderTags(summary.discoveryPhrases || [])}
      </div>
    </section>

    <section>
      <div class="shell">
        <h2>What This Episode Opens Up</h2>
        <div class="grid">${takeaways.map(renderCard).join('')}</div>
      </div>
    </section>

    <section>
      <div class="shell">
        <h2>Shareable Moments</h2>
        <div class="grid">${quotes.map(renderQuote).join('')}</div>
      </div>
    </section>

    <section id="resources">
      <div class="shell">
        <h2>Resources Mentioned</h2>
        <div class="grid">${resources.map(renderResource).join('') || renderEmpty('Resources can be added before publishing.')}</div>
      </div>
    </section>

    <section id="shop">
      <div class="shell">
        <h2>Shop the Episode</h2>
        <div class="grid">${shop.map(renderResource).join('') || renderEmpty('Add host favorites, affiliate links, or tools mentioned in the episode.')}</div>
      </div>
    </section>

    <section id="listen">
      <div class="shell">
        <div class="eyebrow">Listen</div>
        <h2>Choose Your Podcast App</h2>
        <p class="access-intro">Start the episode wherever you already listen. Follow the show there so the next conversation is easy to find.</p>
        <div class="listen-layout">
          ${renderListenCards(hero.listenLinks || [])}
          ${renderListenerAngles(getSection(page, 'listen')?.content?.listenerAngles || [])}
        </div>
      </div>
    </section>

    ${renderMediaBlocks(mediaBlocks)}

    ${newsletterBlock ? renderNewsletterBlock(newsletterBlock) : ''}

    ${socialLinksBlock ? renderSocialLinksBlock(socialLinksBlock) : ''}

    ${renderConversationSection(social)}
  </main>
  <footer>
    <div class="shell">Generated by Podcast Growth Agent for ${escapeHtml(page.brandKit.showName)}.</div>
  </footer>
  ${renderPersonalizeScript(personalizationConfig)}
</body>
</html>`;
}

export function renderEpisodePageLlmText(page: EpisodePageDocument): string {
  const hero = getSection(page, 'hero')?.content || {};
  const summary = getSection(page, 'summary')?.content || {};
  const listen = getSection(page, 'listen')?.content || {};
  const takeaways = getSection(page, 'takeaways')?.content?.items || [];
  const quotes = getSection(page, 'quotes')?.content?.quotes || [];
  const resources = getSection(page, 'resources')?.content?.items || [];
  const shop = getSection(page, 'shop')?.content?.items || [];
  const social = getSection(page, 'social')?.content || {};
  const listenLinks = buildListenLinks(page.episode);
  const mediaLinks = (page.blocks || [])
    .filter(block => block.visible && ['youtube-player', 'youtube-channel', 'instagram-reel'].includes(block.type))
    .map(block => {
      const url = block.content?.embedUrl || block.content?.url;
      if (!url) return null;
      return `${block.label}: ${url}`;
    })
    .filter(Boolean) as string[];

  const lines = [
    `# ${cleanText(page.episode.episodeTitle)}`,
    '',
    `Show: ${cleanText(page.episode.podcastTitle)}`,
    `Canonical page: ${page.publicUrl}`,
    `Fallback page: ${page.fallbackUrl}`,
    page.episode.publishDate ? `Published: ${page.episode.publishDate}` : '',
    page.episode.duration ? `Duration: ${page.episode.duration}` : '',
    '',
    '## Summary',
    cleanText(summary.summary || hero.summary || page.seo.description),
    '',
    '## Listen',
    ...listenLinks.map(link => `- ${link.label}: ${link.url}`),
    listen.listenerAngles?.length ? '' : '',
    listen.listenerAngles?.length ? '### Reasons to Press Play' : '',
    ...(listen.listenerAngles || []).map((item: string) => `- ${cleanText(item)}`),
    '',
    mediaLinks.length ? '## Watch and Social Media' : '',
    ...mediaLinks.map(link => `- ${link}`),
    mediaLinks.length ? '' : '',
    takeaways.length ? '## What This Episode Opens Up' : '',
    ...takeaways.map((item: string) => `- ${cleanText(item)}`),
    takeaways.length ? '' : '',
    quotes.length ? '## Shareable Quotes' : '',
    ...quotes.map((quote: any) => {
      const text = typeof quote === 'string' ? quote : quote.quote;
      const timestamp = typeof quote === 'string' ? '' : quote.timestamp;
      return `- ${cleanText(text || '')}${timestamp ? ` (${timestamp})` : ''}`;
    }),
    quotes.length ? '' : '',
    resources.length ? '## Resources' : '',
    ...resources.map((item: ResourceItem) => `- ${cleanText(item.title)}: ${item.url}${item.description ? ` - ${cleanText(item.description)}` : ''}`),
    resources.length ? '' : '',
    shop.length ? '## Shop' : '',
    ...shop.map((item: ResourceItem) => `- ${cleanText(item.title)}: ${item.url}${item.description ? ` - ${cleanText(item.description)}` : ''}`),
    shop.length ? '' : '',
    social.curatorBlurb ? '## Explore More' : '',
    social.curatorBlurb ? cleanText(social.curatorBlurb) : '',
    social.trend?.trend_or_hashtag ? `- Trend lens: ${social.trend.trend_or_hashtag} - ${cleanText(publicAgentCopy(social.trend.why_it_connects || ''))}` : '',
    ...(social.communities || []).map((item: any) => `- Community: ${cleanText(item.name)} (${item.platform || 'Community'}) - ${item.url || ''}`),
    ...(social.podcastMatches || []).map((item: any) => `- Related podcast: ${cleanText(item.podcast_name)}${item.host_name ? ` with ${cleanText(item.host_name)}` : ''} - ${item.podcast_url || ''}`),
    ...(social.publications || []).map((item: any) => `- Publication angle: ${cleanText(item.publication_name)} (${item.platform || 'Publication'}) - ${item.url || ''}`),
    social.curatorBlurb ? '' : '',
    '## Brand Context',
    `Voice: ${page.brandKit.voice.join(', ') || 'Not configured'}`,
    `Words to use: ${page.brandKit.wordsUseOften.join(', ') || 'Not configured'}`,
    `Words to avoid: ${page.brandKit.wordsAvoid.join(', ') || 'Not configured'}`,
    `Colors: ${[
      page.brandKit.colors.primary,
      page.brandKit.colors.background,
      page.brandKit.colors.text,
      page.brandKit.colors.accent,
      page.brandKit.colors.secondaryAccent,
      ...(page.brandKit.colors.palette || [])
    ].filter(Boolean).join(', ')}`,
    `Fonts: ${page.brandKit.fonts.display}, ${page.brandKit.fonts.body}, ${page.brandKit.fonts.accent}`,
    '',
    'Generated by Podcast Growth Agent.'
  ];

  return lines
    .filter((line, index, all) => line !== '' || all[index - 1] !== '')
    .join('\n')
    .trimEnd() + '\n';
}

interface PersonalizationConfig {
  defaultTemplate: {
    label: string;
    colors: {
      primary: string;
      background: string;
      text: string;
      accent: string;
      secondaryAccent: string;
    };
    fonts: {
      display: string;
      body: string;
      accent: string;
    };
  };
  showName: string;
  siteSlug: string;
  logoUrl: string;
  colors: {
    primary: string;
    background: string;
    text: string;
    accent: string;
    secondaryAccent: string;
    palette: string[];
  };
  fonts: {
    display: string;
    body: string;
    accent: string;
  };
  voice: string[];
  wordsUseOften: string[];
  wordsAvoid: string[];
  links: Record<string, string>;
  episode: {
    episodeTitle: string;
    podcastTitle: string;
    appleUrl?: string;
    spotifyUrl?: string;
    youtubeUrl?: string;
  };
  integrations: SiteIntegration[];
  publicUrl: string;
  creatorGuide: PageCreatorGuideItem[];
}

function buildPersonalizationConfig(page: EpisodePageDocument, socialLinksBlock: any): PersonalizationConfig {
  const socialLinks = socialLinksBlock?.content?.links || [];
  const links: Record<string, string> = {};

  for (const link of socialLinks) {
    if (link?.provider && link?.url) links[link.provider] = link.url;
  }

  for (const integration of page.integrations || []) {
    if (integration.provider && integration.url) links[integration.provider] = integration.url;
  }

  for (const link of buildListenLinks(page.episode)) {
    links[link.label.toLowerCase().replace(/\s+/g, '-')] = link.url;
  }

  const shopItems = getSection(page, 'shop')?.content?.items || [];
  if (shopItems[0]?.url) links.shopping = shopItems[0].url;
  const social = getSection(page, 'social')?.content || {};
  const quotes = getSection(page, 'quotes')?.content?.quotes || [];

  return {
    defaultTemplate: {
      label: 'Podcast Growth Agent default',
      colors: {
        primary: 'hsl(224 80% 60%)',
        background: 'hsl(0 0% 98%)',
        text: 'hsl(224 71% 10%)',
        accent: 'hsl(145 60% 90%)',
        secondaryAccent: 'hsl(145 60% 45%)'
      },
      fonts: {
        display: 'Atkinson Hyperlegible',
        body: 'Atkinson Hyperlegible',
        accent: 'Atkinson Hyperlegible'
      }
    },
    showName: page.brandKit.showName,
    siteSlug: page.siteSlug,
    logoUrl: page.brandKit.logoUrl || page.brandKit.artworkUrl || '',
    colors: {
      primary: page.brandKit.colors.primary,
      background: page.brandKit.colors.background,
      text: page.brandKit.colors.text,
      accent: page.brandKit.colors.accent,
      secondaryAccent: page.brandKit.colors.secondaryAccent,
      palette: page.brandKit.colors.palette || []
    },
    fonts: page.brandKit.fonts,
    voice: page.brandKit.voice,
    wordsUseOften: page.brandKit.wordsUseOften,
    wordsAvoid: page.brandKit.wordsAvoid,
    links,
    episode: {
      episodeTitle: page.episode.episodeTitle,
      podcastTitle: page.episode.podcastTitle,
      appleUrl: page.episode.appleUrl,
      spotifyUrl: page.episode.spotifyUrl,
      youtubeUrl: page.episode.youtubeUrl
    },
    integrations: page.integrations || [],
    publicUrl: page.publicUrl,
    creatorGuide: social.creatorGuide || buildCreatorGuide(social, quotes)
  };
}

function renderPersonalizePanel(config: PersonalizationConfig): string {
  const beforeRows = [
    ['Template', config.defaultTemplate.label],
    ['Primary color', config.defaultTemplate.colors.primary],
    ['Accent color', config.defaultTemplate.colors.accent],
    ['Display font', config.defaultTemplate.fonts.display],
    ['Body font', config.defaultTemplate.fonts.body],
    ['Voice', 'General-purpose growth plan preview'],
    ['Words to use', 'growth, clips, captions, community'],
    ['Words to avoid', 'not configured yet']
  ];
  const rows = [
    ['Show name', config.showName],
    ['Site slug', config.siteSlug],
    ['Primary color', config.colors.primary],
    ['Accent color', config.colors.accent],
    ['Display font', config.fonts.display],
    ['Body font', config.fonts.body],
    ['Voice', config.voice.join(', ')],
    ['Words to use', config.wordsUseOften.join(', ')],
    ['Words to avoid', config.wordsAvoid.join(', ')]
  ];

  return `<section class="personalize-panel" id="personalize-panel" aria-label="Make this page ours">
    <div class="shell">
      <div class="personalize-head">
        <div>
          <div class="eyebrow">Website Builder</div>
          <h2>Make This Ours</h2>
          <p>The page starts in the Podcast Growth Agent default template. Every line below is the captured RHH configuration; launch it to apply their colors, fonts, voice, links, and brand language.</p>
        </div>
        <button class="button" type="button" data-close-personalizer>Close</button>
      </div>
      <div class="before-after">
        <article class="compare-card">
          <h3>Before</h3>
          <dl>${beforeRows.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('')}</dl>
        </article>
        <article class="compare-card">
          <h3>After</h3>
          <dl id="personalize-after-preview">${rows.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('')}</dl>
        </article>
      </div>
      ${renderCreatorGuide(config.creatorGuide)}
      <form class="brand-panel" id="personalize-form">
        <div class="edit-grid">
          ${renderEditLine('showName', 'Show name', config.showName)}
          ${renderEditLine('siteSlug', 'Subdomain slug', config.siteSlug)}
          ${renderEditLine('logoUrl', 'Logo / artwork URL', config.logoUrl, true)}
          ${renderEditLine('primary', 'Primary color', config.colors.primary)}
          ${renderEditLine('background', 'Background color', config.colors.background)}
          ${renderEditLine('text', 'Text color', config.colors.text)}
          ${renderEditLine('accent', 'Accent color', config.colors.accent)}
          ${renderEditLine('secondaryAccent', 'Secondary accent', config.colors.secondaryAccent)}
          ${renderEditLine('palette', 'Extra palette colors', config.colors.palette.join('\n'), true, true)}
          ${renderEditLine('displayFont', 'Title font', config.fonts.display)}
          ${renderEditLine('bodyFont', 'Body font', config.fonts.body)}
          ${renderEditLine('accentFont', 'Quote font', config.fonts.accent)}
          ${renderEditLine('voice', 'Brand voice', config.voice.join('\n'), true, true)}
          ${renderEditLine('wordsUseOften', 'Words we use often', config.wordsUseOften.join('\n'), true, true)}
          ${renderEditLine('wordsAvoid', 'Words we avoid', config.wordsAvoid.join('\n'), true, true)}
          ${renderEditLine('spotify', 'Spotify URL', config.links.spotify || '')}
          ${renderEditLine('youtube', 'YouTube URL', config.links.youtube || '')}
          ${renderEditLine('instagram', 'Instagram URL', config.links.instagram || '')}
          ${renderEditLine('facebook', 'Facebook URL', config.links.facebook || '')}
          ${renderEditLine('shopping', 'Shopping page URL', config.links.custom || config.links.shopping || '')}
        </div>
        <div class="launch-row">
          <div class="links">
            <button class="button" type="button" data-discover-media>Find Episode Media</button>
            <button class="button primary" type="submit">Launch Personalized Page</button>
          </div>
          <div class="launch-status" id="launch-status" role="status"></div>
        </div>
        <div class="discovery-results" id="discovery-results" aria-live="polite"></div>
      </form>
    </div>
  </section>`;
}

function renderCreatorGuide(items: PersonalizationConfig['creatorGuide']): string {
  if (!items.length) return '';

  return `<details class="brand-panel creator-guide" open>
    <summary>
      <div>
        <div class="eyebrow">Creator Research Notes</div>
        <h2>How to Use This Episode Page</h2>
      </div>
      <span class="button">Review Notes</span>
    </summary>
    <div class="creator-guide-grid">
      ${items.map(item => `<article class="creator-guide-card">
        <div class="conversation-label">${escapeHtml(item.label)}</div>
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.body)}</p>
        ${item.url ? `<a href="${escapeHtml(item.url)}">Open source</a>` : ''}
      </article>`).join('')}
    </div>
  </details>`;
}

function renderEditLine(id: string, label: string, value: string, full = false, multiline = false): string {
  const safeValue = escapeHtml(value);
  return `<div class="edit-line ${full ? 'full' : ''}">
    <label for="personalize-${escapeHtml(id)}">${escapeHtml(label)}</label>
    ${multiline
      ? `<textarea id="personalize-${escapeHtml(id)}" name="${escapeHtml(id)}">${safeValue}</textarea>`
      : `<input id="personalize-${escapeHtml(id)}" name="${escapeHtml(id)}" value="${safeValue}">`}
  </div>`;
}

function renderPersonalizeScript(config: PersonalizationConfig): string {
  return `<script type="application/json" id="personalize-config">${escapeScriptJson(config)}</script>
  <script>
    (function () {
      var configEl = document.getElementById('personalize-config');
      var panel = document.getElementById('personalize-panel');
      var form = document.getElementById('personalize-form');
      var status = document.getElementById('launch-status');
      var preview = document.getElementById('personalize-after-preview');
      var discoveryButton = document.querySelector('[data-discover-media]');
      var discoveryResults = document.getElementById('discovery-results');
      if (!configEl || !panel || !form || !preview) return;

      var initial = JSON.parse(configEl.textContent || '{}');
      var root = document.documentElement;
      var openButton = document.querySelector('[data-open-personalizer]');
      var closeButton = document.querySelector('[data-close-personalizer]');
      var brand = document.querySelector('.brand');
      var heroEyebrow = document.querySelector('.eyebrow');
      var logo = document.querySelector('.brand-logo');
      var footer = document.querySelector('footer .shell');

      function field(name) {
        return form.elements[name] ? String(form.elements[name].value || '').trim() : '';
      }

      function lines(name) {
        return field(name).split('\\n').map(function (item) { return item.trim(); }).filter(Boolean);
      }

      function currentValues() {
        return {
          showName: field('showName') || initial.showName,
          siteSlug: field('siteSlug') || initial.siteSlug,
          logoUrl: field('logoUrl') || initial.logoUrl,
          colors: {
            primary: field('primary') || initial.colors.primary,
            background: field('background') || initial.colors.background,
            text: field('text') || initial.colors.text,
            accent: field('accent') || initial.colors.accent,
            secondaryAccent: field('secondaryAccent') || initial.colors.secondaryAccent,
            palette: lines('palette')
          },
          fonts: {
            display: field('displayFont') || initial.fonts.display,
            body: field('bodyFont') || initial.fonts.body,
            accent: field('accentFont') || initial.fonts.accent
          },
          voice: lines('voice'),
          wordsUseOften: lines('wordsUseOften'),
          wordsAvoid: lines('wordsAvoid'),
          links: {
            spotify: field('spotify'),
            youtube: field('youtube'),
            instagram: field('instagram'),
            facebook: field('facebook'),
            shopping: field('shopping')
          }
        };
      }

      function renderRows(values) {
        var rows = [
          ['Show name', values.showName],
          ['Site slug', values.siteSlug],
          ['Primary color', values.colors.primary],
          ['Accent color', values.colors.accent],
          ['Display font', values.fonts.display],
          ['Body font', values.fonts.body],
          ['Voice', values.voice.join(', ')],
          ['Words to use', values.wordsUseOften.join(', ')],
          ['Words to avoid', values.wordsAvoid.join(', ')]
        ];
        preview.innerHTML = rows.map(function (row) {
          return '<div><dt>' + escapeText(row[0]) + '</dt><dd>' + escapeText(row[1]) + '</dd></div>';
        }).join('');
      }

      function escapeText(value) {
        return String(value || '').replace(/[&<>"']/g, function (char) {
          return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char];
        });
      }

      function applyValues(values) {
        document.body.classList.remove('template-default');
        document.body.classList.add('is-personalized');
        root.style.setProperty('--primary', values.colors.primary);
        root.style.setProperty('--background', values.colors.background);
        root.style.setProperty('--text', values.colors.text);
        root.style.setProperty('--accent', values.colors.accent);
        root.style.setProperty('--clay', values.colors.secondaryAccent);
        root.style.setProperty('--display', '"' + values.fonts.display + '", Georgia, serif');
        root.style.setProperty('--body', '"' + values.fonts.body + '", Arial, sans-serif');
        root.style.setProperty('--accent-font', '"' + values.fonts.accent + '", Georgia, serif');
        if (brand) brand.textContent = values.showName;
        if (heroEyebrow) heroEyebrow.textContent = values.showName;
        if (footer) footer.textContent = 'Generated by Podcast Growth Agent for ' + values.showName + '.';
        if (logo && values.logoUrl) logo.setAttribute('src', values.logoUrl);
      }

      function launch(values) {
        applyValues(values);
        renderRows(values);
        var publicPath = '/';
        try {
          publicPath = new URL(initial.publicUrl).pathname;
        } catch (error) {}
        var launchedUrl = 'https://' + values.siteSlug + '.podcastgrowthagent.com' + publicPath;
        if (status) {
          status.textContent = 'Personalized page launched: ' + launchedUrl;
          status.classList.add('is-live');
        }
        window.location.hash = 'personalized-page';
      }

      function renderDiscoveryMessage(message) {
        if (!discoveryResults) return;
        discoveryResults.innerHTML = '<div class="candidate">' + escapeText(message) + '</div>';
        discoveryResults.classList.add('is-live');
      }

      function renderDiscovery(discovery) {
        if (!discoveryResults) return;
        var providerCards = (discovery.providers || []).map(function (provider) {
          var candidates = provider.candidates || [];
          var rows = candidates.length
            ? candidates.map(function (item) {
                return '<div><strong>' + escapeText(item.provider.toUpperCase()) + ' ' + Math.round(item.confidence * 100) + '%</strong><br><a href="' + escapeText(item.url) + '">' + escapeText(item.title) + '</a><br><span>' + escapeText(item.matchReason) + '</span></div>';
              }).join('')
            : '<div>' + escapeText(provider.message) + '</div>';
          return '<article class="candidate"><strong>' + escapeText(provider.provider) + '</strong>' + rows + '</article>';
        }).join('');
        discoveryResults.innerHTML = providerCards || '<div class="candidate">No media candidates found yet.</div>';
        discoveryResults.classList.add('is-live');
      }

      async function discoverMedia() {
        if (window.location.protocol === 'file:') {
          renderDiscoveryMessage('Media discovery is ready for the app endpoint. In production this button searches Spotify, YouTube, and connected Instagram using the episode title and Apple episode URL.');
          return;
        }

        renderDiscoveryMessage('Searching Spotify, YouTube, and connected Instagram...');
        try {
          var response = await fetch('/api/sites/discover-media', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              episode: initial.episode,
              integrations: initial.integrations,
              providers: ['spotify', 'youtube', 'instagram'],
              maxResults: 5
            })
          });
          var json = await response.json();
          if (!json.success) throw new Error(json.error || 'Discovery failed');
          renderDiscovery(json.discovery);
        } catch (error) {
          renderDiscoveryMessage(error && error.message ? error.message : 'Media discovery failed.');
        }
      }

      if (openButton) {
        openButton.addEventListener('click', function () {
          panel.classList.add('is-open');
          panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
          renderRows(currentValues());
        });
      }

      if (closeButton) {
        closeButton.addEventListener('click', function () {
          panel.classList.remove('is-open');
        });
      }

      form.addEventListener('input', function () {
        renderRows(currentValues());
      });

      form.addEventListener('submit', function (event) {
        event.preventDefault();
        launch(currentValues());
      });

      if (discoveryButton) {
        discoveryButton.addEventListener('click', discoverMedia);
      }
    })();
  </script>`;
}

function renderMediaBlocks(blocks: any[]): string {
  if (!blocks.length) return '';
  const hasInstagramEmbed = blocks.some(block => block.type === 'instagram-reel' && isInstagramEmbeddableUrl(block.content?.url));
  const youtubePlayer = blocks.find(block => block.type === 'youtube-player' && block.content?.embedUrl);
  const sideCards = blocks
    .filter(block => block !== youtubePlayer)
    .map(renderMediaFollowCard)
    .filter(Boolean)
    .join('');

  return `<section><div class="shell">
    <div class="eyebrow">Watch and Follow</div>
    <h2>Keep Up With the Show</h2>
    <p class="access-intro">Watch clips when there is video, subscribe on YouTube, and follow the show socially for the moments that are easiest to share.</p>
    <div class="media-layout">
      ${youtubePlayer ? `<div class="card media-primary"><iframe class="media-frame" src="${escapeHtml(youtubePlayer.content.embedUrl)}" title="${escapeHtml(youtubePlayer.label || 'YouTube player')}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div>` : ''}
      <div class="media-rail">${sideCards}</div>
    </div>
  </div></section>${hasInstagramEmbed ? '<script async src="https://www.instagram.com/embed.js"></script>' : ''}`;
}

function renderMediaFollowCard(block: any): string {
  if (block.type === 'youtube-channel') {
    return `<article class="card follow-card">
      <div>
        <h3>${platformIcon('youtube')}${escapeHtml('Subscribe on YouTube')}</h3>
        <p>${escapeHtml(block.content.body || 'Watch clips, conversations, and episode extras from the show.')}</p>
        ${block.content.handle ? `<p class="conversation-meta">${escapeHtml(block.content.handle)}</p>` : ''}
      </div>
      <a class="button primary" href="${escapeHtml(block.content.url)}">${platformIcon('youtube')}Subscribe</a>
    </article>`;
  }

  if (block.type === 'instagram-reel') {
    if (isInstagramEmbeddableUrl(block.content.url)) {
      return `<article class="card embed-card"><blockquote class="instagram-media" data-instgrm-permalink="${escapeHtml(block.content.url)}" data-instgrm-version="14"></blockquote></article>`;
    }

    return `<article class="card follow-card">
      <div>
        <h3>${platformIcon('instagram')}${escapeHtml('Follow on Instagram')}</h3>
        <p>Find Reels, behind-the-scenes notes, and easy-to-share moments from the episode.</p>
        <p class="media-hint">Paste the exact episode Reel or post URL to show it here as an embed.</p>
      </div>
      <a class="button" href="${escapeHtml(block.content.url)}">${platformIcon('instagram')}${escapeHtml(block.content.fallbackText || 'Open Instagram')}</a>
    </article>`;
  }

  return '';
}

function renderNewsletterBlock(block: any): string {
  return `<section><div class="shell"><div class="signup"><h2>${escapeHtml(block.content.heading || 'Get new episodes')}</h2><p>${escapeHtml(block.content.body || '')}</p>${block.content.url ? `<a class="button" href="${escapeHtml(block.content.url)}">Sign Up</a>` : '<p>Connect an email provider to activate this form.</p>'}</div></div></section>`;
}

function renderSocialLinksBlock(block: any): string {
  const links = block.content.links || [];
  if (!links.length) return '';

  return `<section><div class="shell">
    <div class="eyebrow">Follow</div>
    <h2>Connect With the Show</h2>
    <p class="access-intro">Pick the platform you actually use. Following is the easiest way to catch new episodes, clips, and gentle reminders from the show.</p>
    <div class="platform-grid">${links.map((link: any) => renderPlatformCard(link.label, link.url, link.provider, followCardBody(link.provider))).join('')}</div>
  </div></section>`;
}

function renderConversationSection(social: any): string {
  const communities = social.communities || [];
  const podcastMatches = social.podcastMatches || [];
  const publications = social.publications || [];
  const trend = social.trend;
  const audienceMagnet = social.audienceMagnet || {};

  if (!social.curatorBlurb && !trend && !communities.length && !podcastMatches.length && !publications.length && !social.caption) {
    return '';
  }

  return `<section>
    <div class="shell">
      <div class="eyebrow">${escapeHtml(audienceMagnet.eyebrow || 'Go Deeper')}</div>
      <h2>${escapeHtml(audienceMagnet.heading || 'Explore More Conversations Like This')}</h2>
      <div class="conversation-grid">
        <article class="card conversation-card">
          <div class="conversation-label">Why this connects</div>
          <p class="summary">${escapeHtml(audienceMagnet.blurb || social.curatorBlurb || social.caption || 'This episode connects to a wider conversation listeners are already having.')}</p>
          ${trend ? `<div class="conversation-label">${escapeHtml(audienceMagnet.trendLabel || 'Related theme')}</div><h3>${escapeHtml(formatTrendTitle(trend.trend_or_hashtag || 'Related conversation'))}</h3><p>${escapeHtml(buildListenerTrendCopy(trend))}</p>` : ''}
        </article>
        <div class="conversation-stack">
          ${communities.map(renderCommunityCard).join('')}
          ${podcastMatches.map(renderPodcastMatchCard).join('')}
          ${publications.map(renderPublicationCard).join('')}
        </div>
      </div>
    </div>
  </section>`;
}

function renderCommunityCard(item: any): string {
  return `<article class="card conversation-card">
    <div class="conversation-label">${escapeHtml(item.platform ? `${item.platform} community` : 'Community conversation')}</div>
    <h3>${escapeHtml(item.name || 'Community')}</h3>
    ${item.member_size ? `<p class="conversation-meta">${escapeHtml(item.member_size)}</p>` : ''}
    <p>${escapeHtml(publicAgentCopy(item.why_this_fits || 'A place where people are already discussing related questions, experiences, and next steps.'))}</p>
    ${item.url ? `<a href="${escapeHtml(item.url)}">Explore community</a>` : ''}
  </article>`;
}

function renderPodcastMatchCard(item: any): string {
  return `<article class="card conversation-card">
    <div class="conversation-label">Similar conversation</div>
    <h3>${escapeHtml(item.podcast_name || 'Podcast match')}</h3>
    ${item.host_name ? `<p class="conversation-meta">Hosted by ${escapeHtml(item.host_name)}</p>` : ''}
    <p>${escapeHtml(publicAgentCopy(item.why_collaborate || ''))}</p>
    ${item.podcast_url ? `<a href="${escapeHtml(item.podcast_url)}">Visit show</a>` : ''}
  </article>`;
}

function renderPublicationCard(item: any): string {
  return `<article class="card conversation-card">
    <div class="conversation-label">${escapeHtml(item.platform ? `${item.platform} reading` : 'Further reading')}</div>
    <h3>${escapeHtml(item.publication_name || 'Publication angle')}</h3>
    <p>${escapeHtml(publicAgentCopy(item.topic_focus || item.why_this_fits || ''))}</p>
    ${item.why_this_fits ? `<p>${escapeHtml(publicAgentCopy(item.why_this_fits))}</p>` : ''}
    ${item.url ? `<a href="${escapeHtml(item.url)}">Read publication</a>` : ''}
  </article>`;
}

function formatTrendTitle(value: string): string {
  const withoutHash = cleanText(value).replace(/^#/, '');
  if (!withoutHash) return 'Related conversation';

  return withoutHash
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, char => char.toUpperCase());
}

function buildListenerTrendCopy(trend: any): string {
  const label = formatTrendTitle(trend.trend_or_hashtag || '');
  const why = publicAgentCopy(trend.why_it_connects || '');

  if (/digital detox/i.test(label) && /silent retreat/i.test(why)) {
    return 'This episode is not about silence for the sake of silence. It is about making room for clarity, faith, and connection when everyday noise has gotten too loud. If that idea landed for you, the broader digital wellness conversation offers a helpful next step: less stimulation, more presence, and a gentler reset for your mind, body, and relationships.';
  }

  return cleanText(why)
    .replace(/,\s*which is exactly what .*? calls? .*?\./i, '.')
    .replace(/Even though .*?, the underlying idea is the same:\s*/i, 'The deeper thread is this: ')
    .replace(/\bthe conversation explores\b/gi, 'This episode explores');
}

function isInstagramEmbeddableUrl(url?: string): boolean {
  return Boolean(url && /instagram\.com\/(p|reel|tv)\//i.test(url));
}

function isYouTubeChannelLink(url?: string): boolean {
  return Boolean(url && /youtube\.com\/(@|channel\/|c\/|user\/)/i.test(url));
}

function renderBrandCustomizerBlock(block: any): string {
  const content = block.content || {};
  const colors = content.colors || {};
  const palette = [
    ['Primary', colors.primary],
    ['Background', colors.background],
    ['Text', colors.text],
    ['Accent', colors.accent],
    ['Clay', colors.secondaryAccent],
    ...(colors.palette || []).map((color: string, index: number) => [`Alt ${index + 1}`, color])
  ].filter(([, color]) => Boolean(color));
  const fonts = content.fonts || {};

  return `<section><div class="shell">
    <details class="brand-panel">
      <summary>
        <div class="brand-summary">
          <div>
            <h2>Make This Ours</h2>
            <p>Review the colors, fonts, voice, and language before publishing.</p>
          </div>
          <span class="button primary">Customize</span>
        </div>
      </summary>
      <div class="brand-fields">
        <div>
          <h3>Colors</h3>
          <div class="swatches">${palette.map(([label, color]) => `<div class="swatch" style="background:${escapeHtml(color)}"><span>${escapeHtml(label)}<br>${escapeHtml(color)}</span></div>`).join('')}</div>
        </div>
        <div>
          <h3>Fonts</h3>
          <ul class="field-list">
            <li>Titles: ${escapeHtml(fonts.display || '')}</li>
            <li>Body: ${escapeHtml(fonts.body || '')}</li>
            <li>Quotes: ${escapeHtml(fonts.accent || '')}</li>
          </ul>
        </div>
        <div>
          <h3>Voice</h3>
          ${renderTags(content.voice || [])}
        </div>
        <div>
          <h3>Words We Use</h3>
          ${renderTags(content.wordsUseOften || [])}
          <h3>Words We Avoid</h3>
          ${renderTags(content.wordsAvoid || [])}
        </div>
      </div>
    </details>
  </div></section>`;
}

function normalizeEpisode(episode: EpisodeMetadataInput | undefined, brandKit: BrandKit): EpisodePageDocument['episode'] {
  return {
    episodeTitle: episode?.episodeTitle || DEFAULT_EPISODE_TITLE,
    podcastTitle: episode?.podcastTitle || brandKit.showName,
    appleUrl: episode?.appleUrl || DEFAULT_APPLE_URL,
    spotifyUrl: episode?.spotifyUrl,
    youtubeUrl: episode?.youtubeUrl,
    publishDate: episode?.publishDate,
    duration: episode?.duration,
    audioUrl: episode?.audioUrl,
    imageUrl: episode?.imageUrl,
    description: episode?.description
  };
}

function buildListenLinks(episode: EpisodeMetadataInput): Array<{ label: string; url: string }> {
  return compact([
    episode.appleUrl ? { label: 'Apple Podcasts', url: episode.appleUrl } : null,
    episode.spotifyUrl ? { label: 'Spotify', url: episode.spotifyUrl } : null,
    episode.youtubeUrl && !isYouTubeChannelLink(episode.youtubeUrl) ? { label: 'YouTube', url: episode.youtubeUrl } : null,
    episode.audioUrl ? { label: 'Audio', url: episode.audioUrl } : null
  ]);
}

function buildTakeaways(insight: any, hook: any, pulse: any): string[] {
  const phrases = insight.key_discovery_phrases || [];
  const trend = normalizePulseTrend(pulse);
  const trendIdeas = compact([
    ...(pulse.trends || pulse.trend_connections || []).map((item: any) => item.why_it_connects || item.trend_or_hashtag),
    trend?.why_it_connects || trend?.trend_or_hashtag
  ]);
  return uniqueTakeaways(compact([
    ...phrases.slice(0, 3).map(buildDiscoveryTakeaway),
    ...trendIdeas.slice(0, 1).map(buildTrendTakeaway)
  ])).slice(0, 5);
}

function buildListenerAngles(hook: any): string[] {
  const titles = (hook.title_options || [])
    .map((item: any) => typeof item === 'string' ? item : item.title)
    .filter(Boolean)
    .map(cleanText);

  return uniqueTakeaways(titles.map((title: string) => {
    const normalized = title.toLowerCase();
    if (normalized.includes('hustle') && normalized.includes('rest')) {
      return 'Press play if you are trying to stay productive without letting hustle culture decide what a good day means.';
    }
    if (normalized.includes('productivity') && normalized.includes('rest')) {
      return 'Listen for a gentler productivity frame: one where rest protects your energy instead of competing with your ambition.';
    }
    if (normalized.includes('without guilt') || normalized.includes('earn your rest')) {
      return 'Start here if you need permission to stop treating rest like something you have to earn.';
    }
    if (normalized.includes('what nobody tells you') && normalized.includes('hustle')) {
      return 'Start here if hustle culture has been sold to you as ambition, but it is starting to feel more like exhaustion.';
    }
    if (normalized.includes('silent') || normalized.includes('quiet')) {
      return 'Press play if you are craving quiet, clarity, or a simple way to begin practicing silence without making it complicated.';
    }
    if (normalized.includes('planner') || normalized.includes('planning')) {
      return 'Listen if planning usually makes you feel behind, but you still want a rhythm that supports your real life.';
    }
    return `Press play for this angle: ${title}.`;
  })).slice(0, 3);
}

function buildDiscoveryTakeaway(phrase: string): string {
  const normalized = cleanText(phrase).toLowerCase();
  if (!normalized) return '';

  if (normalized.includes('balance productivity') || (normalized.includes('productivity') && normalized.includes('rest'))) {
    return 'The episode gives listeners permission to want both momentum and margin, without treating rest as a failure of discipline.';
  }

  if (normalized.includes('slow morning')) {
    return 'Slow mornings become more than a pretty routine; they are a practical way to notice what restores you before the day starts making demands.';
  }

  if (normalized.includes('hustle') || normalized.includes('intentional living')) {
    return 'The episode names a tension many listeners already feel: the routines that help you get things done are only useful if they also help you live with more peace and presence.';
  }

  if (normalized.includes('rest') || normalized.includes('rejuvenation')) {
    return 'Rest is treated as something worth protecting on purpose, not a reward you unlock after every task, plan, and obligation is finished.';
  }

  if (normalized.includes('fill your cup')) {
    return 'Listeners get a softer question to carry into the week: what actually restores me, and where can I make room for that without turning it into another assignment?';
  }

  if (normalized.includes('silent') || normalized.includes('quiet') || normalized.includes('retreat')) {
    return 'The episode turns quiet into an approachable practice: start small, notice what changes, and let silence become a reset instead of an intimidating retreat-only idea.';
  }

  if (normalized.includes('planner') || normalized.includes('planning')) {
    return 'Planning becomes a support system instead of a scoreboard, giving listeners permission to choose tools that match real energy, real homes, and real seasons of life.';
  }

  return `The episode turns ${normalized} into a listener-friendly reflection with enough specificity to help people who are already searching for this topic feel seen.`;
}

function buildTrendTakeaway(value: string): string {
  const copy = publicAgentCopy(value);
  if (!copy) return '';
  const normalized = copy.toLowerCase();
  if (normalized.includes('slow living')) {
    return 'This connects to the wider slow living conversation by shifting the focus from doing more to choosing rhythms that make life feel meaningful and sustainable.';
  }

  if (normalized.includes('digital detox')) {
    return 'This connects to the wider digital detox conversation by showing how less noise can create more clarity, presence, and room to reset.';
  }

  return `Why it travels beyond the episode: ${copy}`;
}

function uniqueTakeaways(items: string[]): string[] {
  const seen = new Set<string>();
  return items.filter(item => {
    const key = item.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizePulseTrend(pulse: any): any | null {
  if (pulse.durable_trend) return pulse.durable_trend;
  if (pulse.viral_moment) return pulse.viral_moment;
  const trends = pulse.trends || pulse.trend_connections || [];
  return trends[0] || null;
}

function normalizePodcastMatches(amplify: any, bridge: any): any[] {
  return compact([
    amplify.podcast_match,
    ...(bridge.podcast_matches || []),
    ...(bridge.matches || [])
  ]);
}

function buildCuratorBlurb(summary: string, pulse: any, brandKit: BrandKit): string {
  const trend = normalizePulseTrend(pulse);
  const voice = brandKit.wordsUseOften.slice(0, 3).join(', ');

  if (trend?.trend_or_hashtag && trend?.why_it_connects) {
    return `If this episode resonated with you, there is a wider ${formatTrendTitle(trend.trend_or_hashtag).toLowerCase()} conversation worth exploring. The paths below can help you keep going with the same spirit this episode brings: ${voice || 'warm, practical, and grounded'}.`;
  }

  return `If this episode sparked something for you, here are a few researched paths for going deeper. These communities, related conversations, and reading ideas point to places where people are already asking similar questions. ${summary}`;
}

function buildCreatorGuide(social: any, quotes: any[]): PageCreatorGuideItem[] {
  const guide = compact<PageCreatorGuideItem>([
    social.trend ? {
      label: 'Pulse',
      title: `Use ${social.trend.trend_or_hashtag || 'the trend'} as the editorial lens`,
      body: publicAgentCopy(social.trend.timing_strategy || social.trend.timing_window || social.trend.why_it_connects || '')
    } : null,
    quotes[0]?.platform_notes ? {
      label: 'Spotlight',
      title: 'Turn the strongest quote into short-form video',
      body: publicAgentCopy(quotes[0].platform_notes)
    } : null,
    social.communities?.[0] ? {
      label: 'Amplify',
      title: `Start with ${social.communities[0].name}`,
      body: publicAgentCopy(social.communities[0].engagement_tip || social.communities[0].why_this_fits || ''),
      url: social.communities[0].url
    } : null,
    social.podcastMatches?.[0] ? {
      label: 'Bridge',
      title: `Consider ${social.podcastMatches[0].podcast_name} for cross-promo`,
      body: publicAgentCopy(social.podcastMatches[0].suggested_approach || social.podcastMatches[0].why_collaborate || ''),
      url: social.podcastMatches[0].podcast_url
    } : null,
    social.publications?.[0] ? {
      label: 'Beacon',
      title: `Shape a written angle for ${social.publications[0].publication_name}`,
      body: publicAgentCopy(social.publications[0].how_to_pitch || social.publications[0].why_this_fits || ''),
      url: social.publications[0].url
    } : null
  ]);

  return guide.slice(0, 5);
}

function extractKeywords(insight: any): string[] {
  return (insight.keywords || [])
    .map((item: any) => typeof item === 'string' ? item : item.keyword)
    .filter(Boolean)
    .slice(0, 8);
}

function filterResources(resources: ResourceItem[], shopOnly: boolean): ResourceItem[] {
  return resources.filter(item => {
    const type = item.type || 'resource';
    const isShop = type === 'product' || type === 'affiliate';
    return shopOnly ? isShop : !isShop;
  });
}

function getSection(page: EpisodePageDocument, id: string): EpisodePageSection | undefined {
  return page.sections.find(section => section.id === id);
}

function renderListenLinks(links: Array<{ label: string; url: string }>): string {
  return links.map((link, index) => `<a class="button ${index === 0 ? 'primary' : ''}" href="${escapeHtml(link.url)}">${platformIcon(link.label)}${escapeHtml(link.label)}</a>`).join('');
}

function renderListenCards(links: Array<{ label: string; url: string }>): string {
  if (!links.length) return renderEmpty('Add listening links before publishing.');

  return `<div class="platform-grid">${links.map(link => renderPlatformCard(link.label, link.url, link.label, listenCardBody(link.label))).join('')}</div>`;
}

function renderListenerAngles(angles: string[]): string {
  if (!angles.length) return '';

  return `<aside class="card angle-panel">
    <h3>Press play if...</h3>
    <ul class="angle-list">${angles.map(angle => `<li>${escapeHtml(angle)}</li>`).join('')}</ul>
  </aside>`;
}

function renderPlatformCard(label: string, url: string, provider: string, body: string): string {
  return `<a class="card platform-card" href="${escapeHtml(url)}">
    <strong>${platformIcon(provider || label)}${escapeHtml(label)}</strong>
    <span>${escapeHtml(body)}</span>
  </a>`;
}

function listenCardBody(label: string): string {
  const provider = normalizeProvider(label);
  if (provider === 'apple') return 'Open in Apple Podcasts and follow the show.';
  if (provider === 'spotify') return 'Listen on Spotify and save the episode.';
  if (provider === 'youtube') return 'Watch or subscribe on YouTube.';
  if (provider === 'audio') return 'Play the direct episode audio.';
  return 'Open this listening option.';
}

function followCardBody(provider: string): string {
  const normalized = normalizeProvider(provider);
  if (normalized === 'youtube') return 'Subscribe for videos, clips, and episode extras.';
  if (normalized === 'instagram') return 'Follow for Reels, reminders, and shareable moments.';
  if (normalized === 'facebook') return 'Follow updates and community posts.';
  return 'Follow the show on this platform.';
}

function normalizeProvider(value: string): string {
  const normalized = String(value || '').toLowerCase();
  if (normalized.includes('apple')) return 'apple';
  if (normalized.includes('spotify')) return 'spotify';
  if (normalized.includes('youtube')) return 'youtube';
  if (normalized.includes('instagram')) return 'instagram';
  if (normalized.includes('facebook')) return 'facebook';
  if (normalized.includes('audio')) return 'audio';
  return normalized;
}

function platformIcon(provider: string): string {
  const normalized = normalizeProvider(provider);
  const label = escapeHtml(provider || 'Platform');
  const icon = (path: string, viewBox = '0 0 24 24') => `<span class="platform-icon" aria-hidden="true"><svg viewBox="${viewBox}" role="img" focusable="false">${path}</svg></span><span class="sr-only">${label}</span>`;

  if (normalized === 'spotify') {
    return icon('<circle cx="12" cy="12" r="10" fill="#1DB954"/><path d="M7 9.2c3.8-1.1 7.6-.7 10.5 1" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/><path d="M7.8 12.2c2.9-.8 5.8-.5 8 .8" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/><path d="M8.4 15c2-.5 4-.3 5.7.6" fill="none" stroke="#fff" stroke-width="1.3" stroke-linecap="round"/>');
  }

  if (normalized === 'youtube') {
    return icon('<rect x="3" y="6.5" width="18" height="11" rx="3" fill="#FF0000"/><path d="M10.5 9.5v5l4.8-2.5-4.8-2.5z" fill="#fff"/>');
  }

  if (normalized === 'instagram') {
    return icon('<rect x="3.5" y="3.5" width="17" height="17" rx="5" fill="#DD2A7B"/><circle cx="12" cy="12" r="4" fill="none" stroke="#fff" stroke-width="1.8"/><circle cx="16.8" cy="7.3" r="1.2" fill="#fff"/>');
  }

  if (normalized === 'facebook') {
    return icon('<circle cx="12" cy="12" r="10" fill="#1877F2"/><path d="M13.5 20v-7h2.3l.4-2.7h-2.7V8.6c0-.8.2-1.3 1.4-1.3h1.5V4.9c-.3 0-1.2-.1-2.2-.1-2.2 0-3.7 1.3-3.7 3.7v1.9H8v2.7h2.5v7h3z" fill="#fff"/>');
  }

  if (normalized === 'apple') {
    return icon('<circle cx="12" cy="12" r="10" fill="#A855F7"/><circle cx="12" cy="10" r="2.3" fill="#fff"/><path d="M8 11.5a4.4 4.4 0 1 1 8 0" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/><path d="M6.2 12.1a6.4 6.4 0 1 1 11.6 0" fill="none" stroke="#fff" stroke-width="1.2" stroke-linecap="round"/><rect x="10.3" y="13" width="3.4" height="5.2" rx="1.7" fill="#fff"/>');
  }

  if (normalized === 'audio') {
    return icon('<circle cx="12" cy="12" r="10" fill="currentColor" opacity=".16"/><path d="M6 13h2.5l3.5 3.2V7.8L8.5 11H6v2z" fill="currentColor"/><path d="M15 9.4a4 4 0 0 1 0 5.2M17.2 7.3a7 7 0 0 1 0 9.4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>');
  }

  return icon('<circle cx="12" cy="12" r="10" fill="currentColor" opacity=".16"/><path d="M8 12h8M12 8v8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>');
}

function renderEpisodeStructuredData(page: EpisodePageDocument): string {
  const hero = getSection(page, 'hero')?.content || {};
  const listenLinks = buildListenLinks(page.episode);
  const imageUrl = page.episode.imageUrl || page.brandKit.logoUrl || page.brandKit.artworkUrl;
  const sameAs = listenLinks.map(link => link.url);
  const webpageId = `${page.publicUrl}#webpage`;
  const episodeId = `${page.publicUrl}#episode`;
  const seriesId = `${page.publicUrl}#series`;
  const graph = [
    {
      '@type': 'WebPage',
      '@id': webpageId,
      url: page.publicUrl,
      name: page.seo.title,
      description: page.seo.description,
      inLanguage: 'en',
      datePublished: page.episode.publishDate || page.createdAt,
      dateModified: page.updatedAt,
      isPartOf: {
        '@id': seriesId
      },
      primaryImageOfPage: imageUrl ? {
        '@type': 'ImageObject',
        url: imageUrl
      } : undefined,
      mainEntity: {
        '@id': episodeId
      }
    },
    {
      '@type': 'PodcastSeries',
      '@id': seriesId,
      name: page.episode.podcastTitle,
      url: page.fallbackUrl.replace(`/episodes/${page.episodeSlug}`, ''),
      image: imageUrl,
      sameAs
    },
    {
      '@type': 'PodcastEpisode',
      '@id': episodeId,
      name: page.episode.episodeTitle,
      description: cleanText(hero.summary || page.seo.description),
      url: page.publicUrl,
      datePublished: page.episode.publishDate || undefined,
      duration: page.episode.duration || undefined,
      image: imageUrl,
      associatedMedia: page.episode.audioUrl ? {
        '@type': 'AudioObject',
        contentUrl: page.episode.audioUrl,
        encodingFormat: 'audio/mpeg'
      } : undefined,
      partOfSeries: {
        '@id': seriesId
      },
      sameAs
    }
  ];

  return `<script type="application/ld+json">${escapeScriptJson({
    '@context': 'https://schema.org',
    '@graph': removeUndefined(graph)
  })}</script>`;
}

function renderLogo(url: string | undefined, alt: string): string {
  if (!url) return '';
  return `<img class="brand-logo" src="${escapeHtml(url)}" alt="${escapeHtml(alt)}">`;
}

function renderTags(tags: string[]): string {
  if (!tags.length) return '';
  return `<ul class="tag-list">${tags.map(tag => `<li>${escapeHtml(tag)}</li>`).join('')}</ul>`;
}

function renderCard(text: string): string {
  return `<div class="card">${escapeHtml(text)}</div>`;
}

function renderQuote(quote: any): string {
  const text = typeof quote === 'string' ? quote : quote.quote;
  const timestamp = typeof quote === 'string' ? '' : quote.timestamp;
  return `<div class="card"><blockquote>${escapeHtml(text || '')}</blockquote>${timestamp ? `<p>${escapeHtml(timestamp)}</p>` : ''}</div>`;
}

function renderResource(item: ResourceItem): string {
  return `<article class="card"><h3>${escapeHtml(item.title)}</h3>${item.description ? `<p>${escapeHtml(item.description)}</p>` : ''}<a href="${escapeHtml(item.url)}">Open resource</a></article>`;
}

function renderEmpty(message: string): string {
  return `<div class="card">${escapeHtml(message)}</div>`;
}

function publicAgentCopy(value: string): string {
  return cleanText(value)
    .replace(/\bYour episode\b/g, 'This episode')
    .replace(/\byour episode\b/g, 'this episode')
    .replace(/\bYour listeners\b/g, "This show's listeners")
    .replace(/\byour listeners\b/g, "this show's listeners")
    .replace(/\bYour audience\b/g, 'The audience')
    .replace(/\byour audience\b/g, 'the audience')
    .replace(/\bYou discussed\b/g, 'The conversation explores')
    .replace(/\byou discussed\b/g, 'the conversation explores');
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90) || 'episode';
}

function cleanText(value: string): string {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function buildSeoTitle(title: string, podcastTitle: string): string {
  const cleanTitle = cleanText(title);
  const cleanPodcastTitle = cleanText(podcastTitle);
  if (!cleanPodcastTitle) return cleanTitle;
  if (cleanTitle.toLowerCase().endsWith(`| ${cleanPodcastTitle.toLowerCase()}`)) return cleanTitle;
  return `${cleanTitle} | ${cleanPodcastTitle}`;
}

function truncateAtWord(value: string, maxLength: number): string {
  const text = cleanText(value);
  if (text.length <= maxLength) return text;
  const truncated = text.slice(0, maxLength + 1);
  const lastSpace = truncated.lastIndexOf(' ');
  return `${(lastSpace > 120 ? truncated.slice(0, lastSpace) : text.slice(0, maxLength)).trim()}...`;
}

function escapeHtml(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeScriptJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function compact<T>(items: Array<T | null | undefined | false>): T[] {
  return items.filter(Boolean) as T[];
}

function removeUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(item => removeUndefined(item)) as T;
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined && item !== null && item !== '')
        .map(([key, item]) => [key, removeUndefined(item)])
    ) as T;
  }

  return value;
}
