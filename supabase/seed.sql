insert into site_pages (slug, title, eyebrow, strapline, summary, stats, highlights, cta_label, cta_href)
values
  (
    'home',
    'Yor Legacy',
    'Prestige in Motion',
    'Legacy',
    'A premium direct selling experience shaped by aspiration, craftsmanship, and generational ambition.',
    '[{"label":"Premium Positioning","value":"Luxury-first"},{"label":"Network Model","value":"8 Ways to Earn"},{"label":"Core Promise","value":"Build Your Legacy"}]'::jsonb,
    '[{"title":"Atmospheric Branding","body":"Deep charcoal canvases, copper gradients, and amber glow create an exclusive visual identity."},{"title":"Structured Opportunity","body":"Every route in the experience is designed to move visitors from intrigue to confidence to action."}]'::jsonb,
    'Join Now',
    '/packages'
  ),
  (
    'vision',
    'Our Vision',
    'Future State',
    null,
    'To shape a legacy-led business ecosystem where elegance, entrepreneurship, and enduring wealth-building move together.',
    '[]'::jsonb,
    '[{"title":"Aspirational Identity","body":"Everything from typography to motion reinforces refinement, confidence, and long-term value."},{"title":"Community With Gravity","body":"The experience positions every partner as part of a serious and elevated movement rather than a disposable campaign."}]'::jsonb,
    'Explore Mission',
    '/mission'
  ),
  (
    'mission',
    'Mission',
    'Building Foundations',
    null,
    'We connect and equip aspiring entrepreneurs with high-quality products, proven business tools, and a supportive network that foster both individual achievement and collective success.',
    '[]'::jsonb,
    '[{"title":"Connect","body":"Open access to a trustworthy and premium ecosystem."},{"title":"Equip","body":"Provide products, systems, and guidance that support action."},{"title":"Empower","body":"Create the conditions for sustainable momentum and long-range impact."}]'::jsonb,
    'Meet the Founder',
    '/founder'
  ),
  (
    'founder',
    'Meet the Founder',
    'Founding Presence',
    null,
    'A leadership story framed around vision, discipline, and a premium standard of opportunity-building.',
    '[{"label":"Leadership Standard","value":"High Trust"},{"label":"Visual Tone","value":"Executive"},{"label":"Brand Posture","value":"Prestigious"}]'::jsonb,
    '[]'::jsonb,
    'View Collection',
    '/perfume-collection'
  ),
  (
    'perfume-collection',
    'The Yor Perfume Collection',
    'Signature Products',
    null,
    'A fragrance lineup positioned as both premium product and prestige anchor for the brand story.',
    '[]'::jsonb,
    '[{"title":"Luxury Framing","body":"Product cards should feel curated, luminous, and tactile with glass panels and controlled glow."},{"title":"Commercial Clarity","body":"Descriptions should be elegant while still supporting practical product understanding."}]'::jsonb,
    'Compare Packages',
    '/packages'
  ),
  (
    'packages',
    'Entry Packages Comparison',
    'Choose Your Entry',
    null,
    'A side-by-side package decision screen that makes joining feel premium, clear, and confidence-building.',
    '[{"label":"Format","value":"Comparison Grid"},{"label":"Tone","value":"Decisive"},{"label":"Primary Action","value":"Join Now"}]'::jsonb,
    '[]'::jsonb,
    'Register',
    '/register'
  ),
  (
    'register',
    'Registration & Package Checkout',
    'Join the Legacy',
    null,
    'A polished onboarding path for capturing commitment without losing the elevated visual language.',
    '[]'::jsonb,
    '[]'::jsonb,
    'Start Your Legacy',
    '/thank-you'
  ),
  (
    'thank-you',
    'Thank You — Start Your Legacy',
    'Next Chapter',
    null,
    'A premium confirmation state that closes the loop and points the user toward their next meaningful action.',
    '[]'::jsonb,
    '[]'::jsonb,
    'Explore 8 Ways to Earn',
    '/earn'
  ),
  (
    'earn',
    '8 Ways to Earn Overview',
    'Compensation Story',
    null,
    'Discover a rewards ecosystem designed for the modern architect of legacy. From direct sales to global dividends, every action builds your empire.',
    '[]'::jsonb,
    '[{"title":"Direct Selling Bonus","body":"Earn from immediate product movement."},{"title":"Direct Referral Bonus","body":"Reward introductions that convert."},{"title":"Salesmatch Bonus","body":"Benefit from balanced binary growth."},{"title":"Leadership Bonus","body":"Monetize team development and influence."},{"title":"Get Five Bonus","body":"Unlock rewards from key duplication."},{"title":"Lifestyle Rewards","body":"Translate milestones into prestige experiences."},{"title":"Unilevel Rank Bonus","body":"Sustain higher ranks with broad depth."},{"title":"Global Bonus","body":"Participate in larger shared success."}]'::jsonb,
    'View Direct Selling Bonus',
    '/earn/direct-selling'
  ),
  (
    'earn/direct-selling',
    '1. Direct Selling Bonus',
    'Way 1',
    null,
    'Earn directly from sales activity with a clear premium explanation of value and conversion.',
    '[]'::jsonb,
    '[]'::jsonb,
    null,
    null
  ),
  (
    'earn/direct-referral',
    '2. Direct Referral Bonus',
    'Way 2',
    null,
    'Reward trusted introductions with a clean, easy-to-explain payout narrative.',
    '[]'::jsonb,
    '[]'::jsonb,
    null,
    null
  ),
  (
    'earn/salesmatch',
    '3. Salesmatch Bonus',
    'Way 3',
    null,
    'Maximize earnings through a binary-style structure designed for momentum, matching, and retained strength.',
    '[{"label":"Left Leg","value":"24,000 pts"},{"label":"Right Leg","value":"18,000 pts"},{"label":"Matching In Progress","value":"PHP 15,000"}]'::jsonb,
    '[]'::jsonb,
    null,
    null
  ),
  (
    'earn/leadership',
    '4. Leadership Bonus',
    'Way 4',
    null,
    'Monetize mentorship, development, and influence across the organization.',
    '[]'::jsonb,
    '[]'::jsonb,
    null,
    null
  ),
  (
    'earn/get-five',
    '5. Get Five Bonus',
    'Way 5',
    null,
    'A milestone-based reward that celebrates focused duplication and disciplined activation.',
    '[]'::jsonb,
    '[]'::jsonb,
    null,
    null
  ),
  (
    'earn/lifestyle-rewards',
    '6. Lifestyle Rewards',
    'Way 6',
    null,
    'Translate milestone performance into elevated experiences and status-driven rewards.',
    '[]'::jsonb,
    '[]'::jsonb,
    null,
    null
  ),
  (
    'earn/unilevel-rank',
    '7. Unilevel Rank Bonus',
    'Way 7',
    null,
    'Build sustainable rank-based earnings through breadth, depth, and consistency.',
    '[]'::jsonb,
    '[]'::jsonb,
    null,
    null
  ),
  (
    'earn/global',
    '8. Global Bonus',
    'Way 8',
    null,
    'Participate in the upside of the larger system through a high-prestige shared pool narrative.',
    '[]'::jsonb,
    '[]'::jsonb,
    null,
    null
  ),
  (
    'rank-incentives',
    'Rank & Incentive System',
    'Leadership Roadmap',
    null,
    'A structured path that maps rank progression and the prestige markers associated with each stage.',
    '[]'::jsonb,
    '[]'::jsonb,
    null,
    null
  )
on conflict (slug) do update
set
  title = excluded.title,
  eyebrow = excluded.eyebrow,
  strapline = excluded.strapline,
  summary = excluded.summary,
  stats = excluded.stats,
  highlights = excluded.highlights,
  cta_label = excluded.cta_label,
  cta_href = excluded.cta_href;

delete from page_sections;

insert into page_sections (page_slug, section_key, heading, body, sort_order)
values
  ('home', 'vision', 'A private-club standard for digital direct selling', 'Yor Legacy presents opportunity with the tone of a luxury house: poised, deliberate, and unmistakably premium.', 1),
  ('home', 'invitation', 'Built for ambitious entrepreneurs', 'The platform guides distributors and prospects through products, packages, and the compensation story with polished clarity.', 2),
  ('vision', 'north-star', 'Lead with prestige and permanence', 'Yor Legacy envisions a future where network-building feels as curated and credible as a heritage brand.', 1),
  ('vision', 'human-impact', 'Translate aspiration into upward mobility', 'The platform is designed to help people elevate their income, presence, and sense of possibility through structured opportunity.', 2),
  ('mission', 'ethics', 'Ethical practices and transparent leadership', 'The mission emphasizes credibility, honest opportunity, and support structures that respect both distributor and customer.', 1),
  ('mission', 'legacy', 'A legacy that extends beyond the present', 'The aim is not only business growth, but a durable improvement in lives, communities, and future generations.', 2),
  ('founder', 'story', 'A founder narrative with executive polish', 'The founder page should feel cinematic and deeply intentional, combining a strong portrait treatment with clear statements of belief and purpose.', 1),
  ('perfume-collection', 'catalog', 'Products presented like a luxury line', 'Use focused imagery, restrained copy, and elevated hierarchy to make each item feel premium.', 1),
  ('packages', 'comparison', 'Structured for high-confidence decisions', 'Packages should be easy to compare through clear price anchors, highlighted benefits, and elegant visual emphasis.', 1),
  ('register', 'details', 'Capture only what matters first', 'The first registration pass should gather the essential lead and package information without overwhelming the user.', 1),
  ('thank-you', 'confirmation', 'A calm and elevated confirmation experience', 'The thank-you page should reward commitment with clarity, warmth, and a next-step pathway.', 1),
  ('earn', 'framework', 'The business model explained with elegance', 'This page should orient the visitor quickly and then let them drill into the details of each incentive.', 1),
  ('earn/direct-selling', 'mechanics', 'Reward product movement immediately', 'This incentive demonstrates how revenue can begin from direct customer engagement.', 1),
  ('earn/direct-referral', 'mechanics', 'Turn introductions into meaningful return', 'The page should explain the straightforward benefit of sponsoring new members into the network.', 1),
  ('earn/salesmatch', 'binary', 'A visual system for balanced growth', 'The Salesmatch page benefits from a strong diagram or card layout that shows two legs, matching volume, and retained strong-leg value.', 1),
  ('earn/leadership', 'leadership', 'Leadership becomes visible value', 'The page should connect team-building effort with elevated compensation and long-term leverage.', 1),
  ('earn/get-five', 'milestone', 'Small focused wins with visible prestige', 'This route should feel celebratory while still being structured and easy to understand.', 1),
  ('earn/lifestyle-rewards', 'reward', 'Business results reflected in lifestyle', 'The route should feel especially luxurious, with reward framing that reinforces ambition and aspiration.', 1),
  ('earn/unilevel-rank', 'rank', 'Climb with structure and stability', 'This page should explain advancement and bonus logic with confidence and restraint.', 1),
  ('earn/global', 'global', 'Shared success at the highest tier', 'This page should signal that this bonus sits at the most expansive and aspirational end of the compensation story.', 1),
  ('rank-incentives', 'path', 'See the climb clearly', 'This page should present progression as both disciplined and desirable, with clear thresholds and elevated visual rhythm.', 1);
