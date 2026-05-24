import type { PageContent } from '../../types/content';

export const staticPages: Record<string, PageContent> = {
  home: {
    slug: 'home',
    eyebrow: 'Prestige in Motion',
    title: 'Yor Legacy',
    strapline: 'Legacy',
    summary:
      'A premium direct selling experience shaped by aspiration, craftsmanship, and generational ambition.',
    ctaLabel: 'Join Now',
    ctaHref: '/packages',
    stats: [
      { label: 'Premium Positioning', value: 'Luxury-first' },
      { label: 'Network Model', value: '8 Ways to Earn' },
      { label: 'Core Promise', value: 'Build Your Legacy' }
    ],
    sections: [
      {
        key: 'vision',
        heading: 'A private-club standard for digital direct selling',
        body: 'Yor Legacy presents opportunity with the tone of a luxury house: poised, deliberate, and unmistakably premium.'
      },
      {
        key: 'invitation',
        heading: 'Built for ambitious entrepreneurs',
        body: 'The platform guides distributors and prospects through products, packages, and the compensation story with polished clarity.'
      }
    ]
  },
  vision: {
    slug: 'vision',
    eyebrow: 'Future State',
    title: 'Our Vision',
    summary:
      'To shape a legacy-led business ecosystem where elegance, entrepreneurship, and enduring wealth-building move together.',
    ctaLabel: 'Explore Mission',
    ctaHref: '/mission',
    sections: [
      {
        key: 'north-star',
        heading: 'Lead with prestige and permanence',
        body: 'Yor Legacy envisions a future where network-building feels as curated and credible as a heritage brand.'
      },
      {
        key: 'human-impact',
        heading: 'Translate aspiration into upward mobility',
        body: 'The platform is designed to help people elevate their income, presence, and sense of possibility through structured opportunity.'
      }
    ]
  },
  mission: {
    slug: 'mission',
    eyebrow: 'Building Foundations',
    title: 'Mission',
    summary:
      'We connect and equip aspiring entrepreneurs with high-quality products, proven business tools, and a supportive network that foster both individual achievement and collective success.',
    ctaLabel: 'Meet the Founder',
    ctaHref: '/founder',
    highlights: [
      { title: 'Connect', body: 'Open access to a trustworthy and premium ecosystem.' },
      { title: 'Equip', body: 'Provide products, systems, and guidance that support action.' },
      { title: 'Empower', body: 'Create the conditions for sustainable momentum and long-range impact.' }
    ],
    sections: [
      {
        key: 'ethics',
        heading: 'Ethical practices and transparent leadership',
        body: 'The mission emphasizes credibility, honest opportunity, and support structures that respect both distributor and customer.'
      },
      {
        key: 'legacy',
        heading: 'A legacy that extends beyond the present',
        body: 'The aim is not only business growth, but a durable improvement in lives, communities, and future generations.'
      }
    ]
  },
  founder: {
    slug: 'founder',
    eyebrow: 'Founding Presence',
    title: 'Meet the Founder',
    summary:
      'A leadership story framed around vision, discipline, and a premium standard of opportunity-building.',
    stats: [
      { label: 'Leadership Standard', value: 'High Trust' },
      { label: 'Visual Tone', value: 'Executive' },
      { label: 'Brand Posture', value: 'Prestigious' }
    ],
    sections: [
      {
        key: 'story',
        heading: 'A founder narrative with executive polish',
        body: 'The founder page should feel cinematic and deeply intentional, combining a strong portrait treatment with clear statements of belief and purpose.'
      }
    ]
  },
  'perfume-collection': {
    slug: 'perfume-collection',
    eyebrow: 'Signature Products',
    title: 'The Yor Perfume Collection',
    summary:
      'A fragrance lineup positioned as both premium product and prestige anchor for the brand story.',
    sections: [
      {
        key: 'catalog',
        heading: 'Products presented like a luxury line',
        body: 'Use focused imagery, restrained copy, and elevated hierarchy to make each item feel premium.'
      }
    ]
  },
  packages: {
    slug: 'packages',
    eyebrow: 'Choose Your Entry',
    title: 'Entry Packages Comparison',
    summary:
      'A side-by-side package decision screen that makes joining feel premium, clear, and confidence-building.',
    sections: [
      {
        key: 'comparison',
        heading: 'Structured for high-confidence decisions',
        body: 'Packages should be easy to compare through clear price anchors, highlighted benefits, and elegant visual emphasis.'
      }
    ]
  },
  register: {
    slug: 'register',
    eyebrow: 'Join the Legacy',
    title: 'Registration & Package Checkout',
    summary:
      'A polished onboarding path for capturing commitment without losing the elevated visual language.',
    sections: [
      {
        key: 'details',
        heading: 'Capture only what matters first',
        body: 'The first registration pass should gather the essential lead and package information without overwhelming the user.'
      }
    ]
  },
  'thank-you': {
    slug: 'thank-you',
    eyebrow: 'Next Chapter',
    title: 'Thank You — Start Your Legacy',
    summary:
      'A premium confirmation state that closes the loop and points the user toward the next meaningful action.',
    sections: [
      {
        key: 'confirmation',
        heading: 'A calm and elevated confirmation experience',
        body: 'The thank-you page should reward commitment with clarity, warmth, and a next-step pathway.'
      }
    ]
  },
  earn: {
    slug: 'earn',
    eyebrow: 'Compensation Story',
    title: '8 Ways to Earn Overview',
    summary:
      'An overview route that introduces the compensation framework and links into each bonus page.',
    highlights: [
      { title: 'Direct Selling Bonus', body: 'Earn from immediate product movement.' },
      { title: 'Direct Referral Bonus', body: 'Reward introductions that convert.' },
      { title: 'Salesmatch Bonus', body: 'Benefit from balanced binary growth.' },
      { title: 'Leadership Bonus', body: 'Monetize team development and influence.' },
      { title: 'Get Five Bonus', body: 'Unlock rewards from key duplication.' },
      { title: 'Lifestyle Rewards', body: 'Translate milestones into prestige experiences.' },
      { title: 'Unilevel Rank Bonus', body: 'Sustain higher ranks with broad depth.' },
      { title: 'Global Bonus', body: 'Participate in larger shared success.' }
    ],
    sections: [
      {
        key: 'framework',
        heading: 'The business model explained with elegance',
        body: 'This page should orient the visitor quickly and then let them drill into the details of each incentive.'
      }
    ]
  },
  'earn/direct-selling': {
    slug: 'earn/direct-selling',
    eyebrow: 'Way 1',
    title: '1. Direct Selling Bonus',
    summary: 'Earn directly from sales activity with a clear premium explanation of value and conversion.',
    sections: [
      {
        key: 'mechanics',
        heading: 'Reward product movement immediately',
        body: 'This incentive demonstrates how revenue can begin from direct customer engagement.'
      }
    ]
  },
  'earn/direct-referral': {
    slug: 'earn/direct-referral',
    eyebrow: 'Way 2',
    title: '2. Direct Referral Bonus',
    summary: 'Reward trusted introductions with a clean, easy-to-explain payout narrative.',
    sections: [
      {
        key: 'mechanics',
        heading: 'Turn introductions into meaningful return',
        body: 'The page should explain the straightforward benefit of sponsoring new members into the network.'
      }
    ]
  },
  'earn/salesmatch': {
    slug: 'earn/salesmatch',
    eyebrow: 'Way 3',
    title: '3. Salesmatch Bonus',
    summary:
      'Maximize earnings through a binary-style structure designed for momentum, matching, and retained strength.',
    stats: [
      { label: 'Left Leg', value: '24,000 pts' },
      { label: 'Right Leg', value: '18,000 pts' },
      { label: 'Matching In Progress', value: 'PHP 15,000' }
    ],
    sections: [
      {
        key: 'binary',
        heading: 'A visual system for balanced growth',
        body: 'The Salesmatch page benefits from a strong diagram or card layout that shows two legs, matching volume, and retained strong-leg value.'
      }
    ]
  },
  'earn/leadership': {
    slug: 'earn/leadership',
    eyebrow: 'Way 4',
    title: '4. Leadership Bonus',
    summary: 'Monetize mentorship, development, and influence across the organization.',
    sections: [
      {
        key: 'leadership',
        heading: 'Leadership becomes visible value',
        body: 'The page should connect team-building effort with elevated compensation and long-term leverage.'
      }
    ]
  },
  'earn/get-five': {
    slug: 'earn/get-five',
    eyebrow: 'Way 5',
    title: '5. Get Five Bonus',
    summary: 'A milestone-based reward that celebrates focused duplication and disciplined activation.',
    sections: [
      {
        key: 'milestone',
        heading: 'Small focused wins with visible prestige',
        body: 'This route should feel celebratory while still being structured and easy to understand.'
      }
    ]
  },
  'earn/lifestyle-rewards': {
    slug: 'earn/lifestyle-rewards',
    eyebrow: 'Way 6',
    title: '6. Lifestyle Rewards',
    summary: 'Translate milestone performance into elevated experiences and status-driven rewards.',
    sections: [
      {
        key: 'reward',
        heading: 'Business results reflected in lifestyle',
        body: 'The route should feel especially luxurious, with reward framing that reinforces ambition and aspiration.'
      }
    ]
  },
  'earn/unilevel-rank': {
    slug: 'earn/unilevel-rank',
    eyebrow: 'Way 7',
    title: '7. Unilevel Rank Bonus',
    summary: 'Build sustainable rank-based earnings through breadth, depth, and consistency.',
    sections: [
      {
        key: 'rank',
        heading: 'Climb with structure and stability',
        body: 'This page should explain advancement and bonus logic with confidence and restraint.'
      }
    ]
  },
  'earn/global': {
    slug: 'earn/global',
    eyebrow: 'Way 8',
    title: '8. Global Bonus',
    summary: 'Participate in the upside of the larger system through a high-prestige shared pool narrative.',
    sections: [
      {
        key: 'global',
        heading: 'Shared success at the highest tier',
        body: 'The page should signal that this bonus sits at the most expansive and aspirational end of the compensation story.'
      }
    ]
  },
  'rank-incentives': {
    slug: 'rank-incentives',
    eyebrow: 'Leadership Roadmap',
    title: 'Rank & Incentive System',
    summary: 'A structured path that maps rank progression and the prestige markers associated with each stage.',
    sections: [
      {
        key: 'path',
        heading: 'See the climb clearly',
        body: 'This page should present progression as both disciplined and desirable, with clear thresholds and elevated visual rhythm.'
      }
    ]
  }
};
