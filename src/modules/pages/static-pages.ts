import type { PageContent } from '../../types/content';

export const staticPages: Record<string, PageContent> = {
  home: {
    slug: 'home',
    eyebrow: 'Business Presentation',
    title: 'Yor International',
    strapline: 'Legacy',
    summary:
      'A premium fragrance-driven direct selling platform built around legacy, entrepreneurship, and shared success.',
    ctaLabel: 'Join Now',
    ctaHref: '/packages',
    stats: [
      { label: 'Official Deck', value: '19 Slides' },
      { label: 'Network Model', value: '8 Ways to Earn' },
      { label: 'Core Promise', value: 'Build Your Legacy' }
    ],
    sections: [
      {
        key: 'vision',
        heading: 'Built to turn aspiration into shared success',
        body: 'Yor presents its opportunity through dark luxury visuals, premium product storytelling, and a public compensation plan built for ambitious entrepreneurs.'
      },
      {
        key: 'invitation',
        heading: 'Products, packages, and opportunity in one polished journey',
        body: 'The public experience should move visitors from the business presentation into vision, mission, products, packages, and the eight ways to earn without losing brand confidence.'
      }
    ]
  },
  vision: {
    slug: 'vision',
    eyebrow: 'Vision',
    title: 'Our Vision',
    summary:
      'To build a global community of empowered entrepreneurs where every member can create a lasting legacy of financial freedom, personal growth, and positive impact.',
    ctaLabel: 'Explore Mission',
    ctaHref: '/mission',
    sections: [
      {
        key: 'north-star',
        heading: 'A future where success is shared',
        body: 'Yor positions its growth story around accessible opportunity, mutual support, and a community that scales without losing its sense of purpose.'
      },
      {
        key: 'human-impact',
        heading: 'Opportunity that reaches beyond the present',
        body: 'The public vision language emphasizes long-term freedom, personal development, and the idea that business can create a legacy for future generations.'
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
    eyebrow: 'Our President / CEO',
    title: 'Mr. Yoren B. Abihay',
    summary:
      'Traditional businessman, trainer, mentor, network builder, and six-time top earner guiding the public face of Yor International.',
    stats: [
      { label: 'Corporate Experience', value: '8 Years' },
      { label: 'Top Earner', value: '6x' },
      { label: 'Degree', value: 'BS Criminology' }
    ],
    sections: [
      {
        key: 'story',
        heading: 'A founder profile rooted in direct-selling credibility',
        body: 'The PDF positions the founder through lived business experience, mentoring, and network-building authority rather than abstract brand language.'
      }
    ]
  },
  'perfume-collection': {
    slug: 'perfume-collection',
    eyebrow: 'Signature Products',
    title: 'The Yor Perfume Collection',
    summary:
      'A men\'s and women\'s fragrance lineup that anchors the Yor business story with recognizable scent references.',
    sections: [
      {
        key: 'catalog',
        heading: 'The scent of legacy',
        body: 'The public deck highlights men\'s and women\'s entries such as Hugo Boss, Swiss Army, Chanel Bleu, Paris Hilton, Bvlgari Amethyste, and VS Bombshell.'
      }
    ]
  },
  packages: {
    slug: 'packages',
    eyebrow: 'Entry Packages',
    title: 'Entry Packages Comparison',
    summary:
      'Five public package tiers create a clear ladder from Basic through VIP, each with its own price point and PV value.',
    sections: [
      {
        key: 'comparison',
        heading: 'Basic to VIP with visible value progression',
        body: 'The public Yor package ladder currently reads Basic, Classic, Standard, Business, and VIP, paired with public values such as PV-5 through PV-300.'
      }
    ]
  },
  register: {
    slug: 'register',
    eyebrow: 'Join the Legacy',
    title: 'Registration & Package Checkout',
    summary:
      'A premium registration path that captures account details, sponsor information, and package selection without losing the luxury brand treatment.',
    sections: [
      {
        key: 'details',
        heading: 'Lead with confidence and low-friction trust',
        body: 'The registration screen should keep the Yor visual tone while clearly collecting legal name, email, phone, sponsor details, and selected package.'
      }
    ]
  },
  'thank-you': {
    slug: 'thank-you',
    eyebrow: 'Next Chapter',
    title: 'Thank You - Start Your Legacy',
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
    eyebrow: '8 Ways to Earn',
    title: '8 Ways to Earn Overview',
    summary:
      'The public Yor deck presents eight distinct ways to earn, from direct selling through global bonus.',
    highlights: [
      { title: 'Direct Selling Bonus', body: 'Earn from immediate product movement.' },
      { title: 'Direct Referral Bonus', body: 'Reward introductions that convert.' },
      { title: 'Salesmatch Bonus', body: 'Benefit from balanced binary growth.' },
      { title: 'Binary Cycle Bonus', body: 'Receive a public cycle-based income layer from wider network flow.' },
      { title: 'Get Yor Five Bonus', body: 'Unlock rewards from five direct signups on the same package.' },
      { title: 'Lifestyle Rewards', body: 'Translate repeat purchase results into prestige experiences.' },
      { title: 'Unilevel Bonus', body: 'Expand across up to ten public levels of percentage income.' },
      { title: 'Global Bonus', body: 'Participate in yearly global sales success.' }
    ],
    sections: [
      {
        key: 'framework',
        heading: 'The public compensation story at a glance',
        body: 'This page should orient the visitor quickly and then let them drill into the details of each public incentive.'
      }
    ]
  },
  'earn/direct-selling': {
    slug: 'earn/direct-selling',
    eyebrow: 'Way 1',
    title: '1. Direct Selling Bonus',
    summary: 'Public materials position direct selling around lifetime discount and retail margin from each package tier.',
    sections: [
      {
        key: 'mechanics',
        heading: 'Sell premium perfume with tier-based retail upside',
        body: 'The deck presents a 40% lifetime discount and package-based direct selling values, making product movement the first visible income stream.'
      }
    ]
  },
  'earn/direct-referral': {
    slug: 'earn/direct-referral',
    eyebrow: 'Way 2',
    title: '2. Direct Referral Bonus',
    summary: 'Referral rewards rise by package tier, from Classic-level entry rewards through the VIP top-end payout.',
    sections: [
      {
        key: 'mechanics',
        heading: 'Personally sponsor and earn package-based bonuses',
        body: 'The PDF shows public referral values such as PHP 200, PHP 1,000, PHP 5,000, PHP 7,000, and PHP 15,000 depending on the package involved.'
      }
    ]
  },
  'earn/salesmatch': {
    slug: 'earn/salesmatch',
    eyebrow: 'Way 3',
    title: '3. Salesmatch Bonus',
    summary:
      'Maximize earnings through matched left and right volume with strong-leg retention, no daily flush-out, and Tuesday encashment / Friday payout language.',
    stats: [
      { label: 'Left Leg', value: '24,000 pts' },
      { label: 'Right Leg', value: '18,000 pts' },
      { label: 'Matching In Progress', value: 'PHP 15,000' }
    ],
    sections: [
      {
        key: 'binary',
        heading: 'Match both legs without losing the strong side',
        body: 'Public salesmatch messaging emphasizes no fifth-pair rule, no two-cycle limit, no side lock, no maintenance, and no daily flush-out.'
      },
      {
        key: 'schedule',
        heading: 'Public payout rhythm is part of the story',
        body: 'Yor presents Tuesday encashment, Friday payout, and a PHP 500 minimum encashment threshold as part of its earnings narrative.'
      }
    ]
  },
  'earn/binary-cycle': {
    slug: 'earn/binary-cycle',
    eyebrow: 'Way 4',
    title: '4. Binary Cycle Bonus',
    summary:
      'The public deck describes a percentage-based bonus layer tied to the salesmatch structure and wider crossline / upline activity.',
    sections: [
      {
        key: 'cycle',
        heading: 'A second layer beyond direct matching',
        body: 'The slide references 2% through 5% public values and frames binary cycle bonus as an added reward stream linked to the broader network.'
      }
    ]
  },
  'earn/get-five': {
    slug: 'earn/get-five',
    eyebrow: 'Way 5',
    title: '5. Get Five Bonus',
    summary: 'Every five direct signups on the same package unlock a public milestone reward under the Get Yor Five mechanic.',
    sections: [
      {
        key: 'milestone',
        heading: 'Unlimited direct sponsor momentum',
        body: 'The public slide ties the bonus to package duplication and presents it as a repeatable milestone rather than a one-time campaign.'
      }
    ]
  },
  'earn/lifestyle-rewards': {
    slug: 'earn/lifestyle-rewards',
    eyebrow: 'Way 6',
    title: '6. Lifestyle Rewards',
    summary:
      'Lifestyle rewards are described as a 3% bonus based on repeat purchase products and account activation rules once potential income is reached.',
    sections: [
      {
        key: 'reward',
        heading: 'Repeat purchase drives prestige rewards',
        body: 'The public page pairs 3% repeat purchase language with public monthly potential examples and a real-time framing of the reward flow.'
      }
    ]
  },
  'earn/unilevel-rank': {
    slug: 'earn/unilevel-rank',
    eyebrow: 'Way 7',
    title: '7. Unilevel Bonus',
    summary: 'Public unilevel percentages extend across ten levels, beginning at 10% and stepping down through deeper generations.',
    sections: [
      {
        key: 'rank',
        heading: 'Ten visible levels of public percentages',
        body: 'The business presentation shows 10%, 8%, 5%, 5%, 3%, 3%, 2%, 1%, 1%, and 1% across ten public levels.'
      }
    ]
  },
  'earn/global': {
    slug: 'earn/global',
    eyebrow: 'Way 8',
    title: '8. Global Bonus',
    summary:
      'The public deck presents a 2% yearly global sales pool tied to repeat purchase, Hall of Fame qualification, and account maintenance.',
    sections: [
      {
        key: 'global',
        heading: 'Yearly global sales participation for top qualifiers',
        body: 'The page should explain that global bonus is reserved for higher-status qualifiers and depends on maintaining the account over time.'
      }
    ]
  },
  'rank-incentives': {
    slug: 'rank-incentives',
    eyebrow: 'Leadership Roadmap',
    title: 'Rank & Incentive System',
    summary:
      'Bronze Director through Hall of Famer ranks are paired with public reward milestones such as cash, gadgets, travel, vehicle, and property incentives.',
    sections: [
      {
        key: 'path',
        heading: 'Recognition grows from director status to hall of fame',
        body: 'The business presentation frames progression through income milestones and incentive markers, culminating in high-prestige rewards and global bonus participation.'
      }
    ]
  }
};
