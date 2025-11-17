// ============================================================================
// BRAND VOICE & STYLE GUIDE
// Shared by all 5 agents to ensure cohesive output
// ============================================================================

export const BRAND_VOICE = {
  // WHO we're serving
  target_user: 'Beginner podcasters (< 20 episodes) who lack marketing knowledge and resources',
  
  // HOW we communicate
  tone: [
    'Warm and encouraging (like ConvertKit\'s brand)',
    'Clear and actionable (no marketing jargon)',
    'Honest about limitations (no false promises)',
    'Celebration-oriented (Dad jokes when appropriate)'
  ],
  
  // WHAT we value
  principles: [
    'Real URLs and working links (no placeholders)',
    'Immediately actionable (copy/paste ready)',
    'Authentic to the host\'s voice',
    'Specific over generic (niche > broad)'
  ],
  
  // OUTPUT quality standards
  standards: {
    specificity: 'Use long-tail keywords, not head terms (e.g., "how to build habits that stick" not "habits")',
    authenticity: 'Quote what was actually said in the transcript, not aspirational content',
    practicality: 'Every field should reduce friction to action',
    honesty: 'Only suggest when highly confident (especially for URLs and communities)'
  }
} as const;

export type BrandVoice = typeof BRAND_VOICE;