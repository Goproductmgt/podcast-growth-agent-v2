import type { BrandKit } from './types';

export const REDESIGNING_HEALTH_HOME_BRAND_KIT: BrandKit = {
  id: 'redesigning-health-home',
  showName: 'Redesigning Health & Home',
  siteSlug: 'redesigning-health-home',
  imageAlt: 'Redesigning Health & Home podcast artwork',
  voice: [
    'conversational',
    'trusted friend with experience'
  ],
  wordsUseOften: [
    'gentle',
    'intentional',
    'reset',
    'encourage',
    'redesign'
  ],
  wordsAvoid: [
    'hustle',
    'grind',
    'perfect'
  ],
  colors: {
    primary: '#215a65',
    background: '#FBF7F2',
    text: '#333333',
    accent: '#9FBDB6',
    secondaryAccent: '#D6B8A6',
    palette: [
      '#d6b06f',
      '#316d33',
      '#bfced8',
      '#dde6d5',
      '#51bdb0',
      '#2a3f74'
    ]
  },
  fonts: {
    display: 'Playfair Display',
    body: 'Raleway',
    accent: 'Cormorant Garamond'
  }
};

export function mergeBrandKit(input?: Partial<BrandKit>): BrandKit {
  if (!input) return REDESIGNING_HEALTH_HOME_BRAND_KIT;

  return {
    ...REDESIGNING_HEALTH_HOME_BRAND_KIT,
    ...input,
    colors: {
      ...REDESIGNING_HEALTH_HOME_BRAND_KIT.colors,
      ...(input.colors || {})
    },
    fonts: {
      ...REDESIGNING_HEALTH_HOME_BRAND_KIT.fonts,
      ...(input.fonts || {})
    },
    voice: input.voice || REDESIGNING_HEALTH_HOME_BRAND_KIT.voice,
    wordsUseOften: input.wordsUseOften || REDESIGNING_HEALTH_HOME_BRAND_KIT.wordsUseOften,
    wordsAvoid: input.wordsAvoid || REDESIGNING_HEALTH_HOME_BRAND_KIT.wordsAvoid
  };
}
