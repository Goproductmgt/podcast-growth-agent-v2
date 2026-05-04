export interface BrandKit {
  id: string;
  showName: string;
  siteSlug: string;
  logoUrl?: string;
  artworkUrl?: string;
  imageAlt?: string;
  voice: string[];
  wordsUseOften: string[];
  wordsAvoid: string[];
  colors: {
    primary: string;
    background: string;
    text: string;
    accent: string;
    secondaryAccent: string;
    palette?: string[];
  };
  fonts: {
    display: string;
    body: string;
    accent: string;
  };
}

export interface EpisodeMetadataInput {
  appleUrl?: string;
  spotifyUrl?: string;
  youtubeUrl?: string;
  episodeTitle?: string;
  podcastTitle?: string;
  publishDate?: string;
  duration?: string;
  audioUrl?: string;
  imageUrl?: string;
  description?: string;
}

export interface BrandAssetResolution {
  sourceUrl: string;
  provider: 'apple-podcasts' | 'spotify' | 'youtube' | 'webpage' | 'unknown';
  metadataSource?: 'listennotes' | 'apple-itunes-lookup' | 'open-graph';
  showName?: string;
  episodeTitle?: string;
  artworkUrl?: string;
  logoUrl?: string;
  feedUrl?: string;
  websiteUrl?: string;
  description?: string;
  socialLinks?: Record<string, string>;
  candidates: Array<{
    label: string;
    url: string;
    width?: number;
    height?: number;
    source: string;
  }>;
}

export interface ResourceItem {
  title: string;
  url: string;
  description?: string;
  type?: 'resource' | 'product' | 'affiliate' | 'guest' | 'sponsor';
  imageUrl?: string;
}

export type SiteIntegrationProvider =
  | 'apple-podcasts'
  | 'spotify'
  | 'youtube'
  | 'instagram'
  | 'facebook'
  | 'tiktok'
  | 'mailchimp'
  | 'convertkit'
  | 'substack'
  | 'shopify'
  | 'amazon'
  | 'ltk'
  | 'custom';

export interface SiteIntegration {
  provider: SiteIntegrationProvider;
  label?: string;
  connected?: boolean;
  url?: string;
  urls?: string[];
  config?: Record<string, any>;
}

export type MediaDiscoveryProvider = 'spotify' | 'youtube' | 'instagram';

export interface MediaDiscoveryCandidate {
  provider: MediaDiscoveryProvider;
  title: string;
  url: string;
  embedUrl?: string;
  thumbnailUrl?: string;
  description?: string;
  publishedAt?: string;
  confidence: number;
  matchReason: string;
  action: 'auto-attach' | 'review' | 'connect-required';
  source: 'existing-url' | 'api' | 'connected-account' | 'profile';
}

export interface MediaDiscoveryProviderResult {
  provider: MediaDiscoveryProvider;
  status: 'searched' | 'needs-credentials' | 'needs-connection' | 'error';
  message: string;
  candidates: MediaDiscoveryCandidate[];
}

export interface EpisodeMediaDiscoveryInput {
  episode: EpisodeMetadataInput;
  integrations?: SiteIntegration[];
  providers?: MediaDiscoveryProvider[];
  maxResults?: number;
}

export interface EpisodeMediaDiscoveryResult {
  episodeTitle: string;
  podcastTitle?: string;
  providers: MediaDiscoveryProviderResult[];
  bestMatches: MediaDiscoveryCandidate[];
}

export type EditorBlockSource = 'growth-plan' | 'episode-metadata' | 'brand-kit' | 'integration' | 'manual';

export interface EditorBlock {
  id: string;
  type: string;
  label: string;
  source: EditorBlockSource;
  locked?: boolean;
  visible: boolean;
  needsConnection?: SiteIntegrationProvider;
  content: Record<string, any>;
  settings?: Record<string, any>;
}

export interface BlockDefinition {
  type: string;
  label: string;
  description: string;
  category: 'episode' | 'media' | 'growth' | 'commerce' | 'capture' | 'layout';
  source: EditorBlockSource;
  requiresConnection?: SiteIntegrationProvider;
  defaultSettings?: Record<string, any>;
}

export interface EpisodePageInput {
  reportId?: string;
  reportBlobUrl?: string;
  siteSlug?: string;
  episodeSlug?: string;
  brandKit?: BrandKit;
  episode?: EpisodeMetadataInput;
  growthPlan: any;
  pageStrategy?: PageCuratorOutput;
  resources?: ResourceItem[];
  integrations?: SiteIntegration[];
  selectedBlocks?: EditorBlock[];
  showBrandCustomizer?: boolean;
  usePageCuratorAgent?: boolean;
  status?: 'draft' | 'published';
}

export interface ShowProfile {
  id: string;
  siteSlug: string;
  showName: string;
  brandKit: BrandKit;
  integrations: SiteIntegration[];
  defaultResources?: ResourceItem[];
  listenLinks?: {
    appleUrl?: string;
    spotifyUrl?: string;
    youtubeUrl?: string;
    websiteUrl?: string;
  };
  templatePreferences?: {
    showBrandCustomizer?: boolean;
    defaultBlocks?: string[];
  };
  createdAt: string;
  updatedAt: string;
}

export interface EpisodePageSection {
  id: string;
  label: string;
  type:
    | 'hero'
    | 'summary'
    | 'listen'
    | 'takeaways'
    | 'quotes'
    | 'resources'
    | 'shop'
    | 'social'
    | 'seo';
  content: any;
}

export interface EpisodePageDocument {
  id: string;
  siteSlug: string;
  episodeSlug: string;
  status: 'draft' | 'published';
  createdAt: string;
  updatedAt: string;
  reportId?: string;
  reportBlobUrl?: string;
  publicUrl: string;
  fallbackUrl: string;
  brandKit: BrandKit;
  episode: Required<Pick<EpisodeMetadataInput, 'episodeTitle' | 'podcastTitle'>> & EpisodeMetadataInput;
  seo: {
    title: string;
    description: string;
    keywords: string[];
    canonicalPath: string;
  };
  sections: EpisodePageSection[];
  blocks: EditorBlock[];
  integrations: SiteIntegration[];
}

export interface PageCreatorGuideItem {
  label: string;
  title: string;
  body: string;
  url?: string;
}

export interface PageSectionPlanItem {
  id: string;
  label: string;
  purpose: string;
  sourceAgents: string[];
  visibility: 'public' | 'creator-only' | 'both';
}

export interface PageCuratorOutput {
  pageGoal: string;
  seoTitle?: string;
  heroTitle?: string;
  audienceMagnet: {
    eyebrow: string;
    heading: string;
    blurb: string;
    trendLabel?: string;
  };
  creatorGuide: PageCreatorGuideItem[];
  sectionPlan: PageSectionPlanItem[];
  llmSummary: string;
}
