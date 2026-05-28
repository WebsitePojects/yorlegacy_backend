insert into site_pages (slug, title, eyebrow, strapline, summary, stats, highlights, cta_label, cta_href)
values
  (
    'home',
    'Yor International',
    'Business Presentation',
    'Legacy',
    'A premium fragrance-driven direct selling platform built around legacy, entrepreneurship, and shared success.',
    '[{"label":"Official Deck","value":"19 Slides"},{"label":"Network Model","value":"8 Ways to Earn"},{"label":"Core Promise","value":"Build Your Legacy"}]'::jsonb,
    '[{"title":"Luxury Presentation","body":"Dark graphite canvases, copper accents, and editorial typography create the Yor International brand impression."},{"title":"Structured Opportunity","body":"The journey moves from business presentation to products, packages, and the public eight ways to earn."}]'::jsonb,
    'Join Now',
    '/packages'
  ),
  (
    'vision',
    'Our Vision',
    'Vision',
    null,
    'To build a global community of empowered entrepreneurs where every member can create a lasting legacy of financial freedom, personal growth, and positive impact.',
    '[]'::jsonb,
    '[{"title":"Aspirational Identity","body":"Everything from typography to motion reinforces refinement, confidence, and long-term value."},{"title":"Shared Success","body":"Yor describes a global community where opportunity is accessible, success is shared, and support remains central."}]'::jsonb,
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
    'Mr. Yoren B. Abihay',
    'Our President / CEO',
    null,
    'Traditional businessman, trainer, mentor, network builder, and six-time top earner guiding the public face of Yor International.',
    '[{"label":"Corporate Experience","value":"8 Years"},{"label":"Top Earner","value":"6x"},{"label":"Degree","value":"BS Criminology"}]'::jsonb,
    '[]'::jsonb,
    'View Collection',
    '/perfume-collection'
  ),
  (
    'perfume-collection',
    'The Yor Perfume Collection',
    'Signature Products',
    null,
    'A men''s and women''s fragrance lineup that anchors the Yor business story with recognizable scent references.',
    '[]'::jsonb,
    '[{"title":"Luxury Framing","body":"Product cards should feel curated, luminous, and tactile with glass panels and controlled glow."},{"title":"Commercial Clarity","body":"The public deck names men''s and women''s scents directly, so the coded lineup should stay legible for presentation and selling confidence."}]'::jsonb,
    'Compare Packages',
    '/packages'
  ),
  (
    'packages',
    'Entry Packages Comparison',
    'Entry Packages',
    null,
    'Five public package tiers create a clear ladder from Basic through VIP, each with its own price point and PV value.',
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
    'A premium registration path that captures account details, sponsor information, and package selection without losing the luxury brand treatment.',
    '[]'::jsonb,
    '[]'::jsonb,
    'Start Your Legacy',
    '/thank-you'
  ),
  (
    'thank-you',
    'Thank You - Start Your Legacy',
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
    '8 Ways to Earn',
    null,
    'The public Yor deck presents eight distinct ways to earn, from direct selling through global bonus.',
    '[]'::jsonb,
    '[{"title":"Direct Selling Bonus","body":"Earn from immediate product movement."},{"title":"Direct Referral Bonus","body":"Reward introductions that convert."},{"title":"Salesmatch Bonus","body":"Benefit from balanced binary growth."},{"title":"Binary Cycle Bonus","body":"Receive a public cycle-based income layer from wider network flow."},{"title":"Get Yor Five Bonus","body":"Unlock rewards from five direct signups on the same package."},{"title":"Lifestyle Rewards","body":"Translate repeat purchase results into prestige experiences."},{"title":"Unilevel Bonus","body":"Expand across up to ten public levels of percentage income."},{"title":"Global Bonus","body":"Participate in yearly global sales success."}]'::jsonb,
    'View Direct Selling Bonus',
    '/earn/direct-selling'
  ),
  (
    'earn/direct-selling',
    '1. Direct Selling Bonus',
    'Way 1',
    null,
    'Public materials position direct selling around lifetime discount and retail margin from each package tier.',
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
    'Referral rewards rise by package tier, from Classic-level entry rewards through the VIP top-end payout.',
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
    'Maximize earnings through matched left and right volume with strong-leg retention, no daily flush-out, and Tuesday encashment / Friday payout language.',
    '[{"label":"Left Leg","value":"24,000 pts"},{"label":"Right Leg","value":"18,000 pts"},{"label":"Matching In Progress","value":"PHP 15,000"}]'::jsonb,
    '[]'::jsonb,
    null,
    null
  ),
  (
    'earn/binary-cycle',
    '4. Binary Cycle Bonus',
    'Way 4',
    null,
    'The public deck describes a percentage-based bonus layer tied to the salesmatch structure and wider crossline / upline activity.',
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
    'Every five direct signups on the same package unlock a public milestone reward under the Get Yor Five mechanic.',
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
    'Lifestyle rewards are described as a 3% bonus based on repeat purchase products and account activation rules once potential income is reached.',
    '[]'::jsonb,
    '[]'::jsonb,
    null,
    null
  ),
  (
    'earn/unilevel-rank',
    '7. Unilevel Bonus',
    'Way 7',
    null,
    'Public unilevel percentages extend across ten levels, beginning at 10% and stepping down through deeper generations.',
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
    'The public deck presents a 2% yearly global sales pool tied to repeat purchase, Hall of Fame qualification, and account maintenance.',
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
    'Bronze Director through Hall of Famer ranks are paired with public reward milestones such as cash, gadgets, travel, vehicle, and property incentives.',
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
  ('home', 'vision', 'Built to turn aspiration into shared success', 'Yor presents its opportunity through dark luxury visuals, premium product storytelling, and a public compensation plan built for ambitious entrepreneurs.', 1),
  ('home', 'invitation', 'Products, packages, and opportunity in one polished journey', 'The public experience should move visitors from the business presentation into vision, mission, products, packages, and the eight ways to earn without losing brand confidence.', 2),
  ('vision', 'north-star', 'A future where success is shared', 'Yor positions its growth story around accessible opportunity, mutual support, and a community that scales without losing its sense of purpose.', 1),
  ('vision', 'human-impact', 'Opportunity that reaches beyond the present', 'The public vision language emphasizes long-term freedom, personal development, and the idea that business can create a legacy for future generations.', 2),
  ('mission', 'ethics', 'Ethical practices and transparent leadership', 'The mission emphasizes credibility, honest opportunity, and support structures that respect both distributor and customer.', 1),
  ('mission', 'legacy', 'A legacy that extends beyond the present', 'The aim is not only business growth, but a durable improvement in lives, communities, and future generations.', 2),
  ('founder', 'story', 'A founder profile rooted in direct-selling credibility', 'The PDF positions the founder through lived business experience, mentoring, and network-building authority rather than abstract brand language.', 1),
  ('perfume-collection', 'catalog', 'The scent of legacy', 'The public deck highlights men''s and women''s entries such as Hugo Boss, Swiss Army, Chanel Bleu, Paris Hilton, Bvlgari Amethyste, and VS Bombshell.', 1),
  ('packages', 'comparison', 'Basic to VIP with visible value progression', 'The public Yor package ladder currently reads Basic, Classic, Standard, Business, and VIP, paired with public values such as PV-5 through PV-300.', 1),
  ('register', 'details', 'Lead with confidence and low-friction trust', 'The registration screen should keep the Yor visual tone while clearly collecting legal name, email, phone, sponsor details, and selected package.', 1),
  ('thank-you', 'confirmation', 'A calm and elevated confirmation experience', 'The thank-you page should reward commitment with clarity, warmth, and a next-step pathway.', 1),
  ('earn', 'framework', 'The public compensation story at a glance', 'This page should orient the visitor quickly and then let them drill into the details of each public incentive.', 1),
  ('earn/direct-selling', 'mechanics', 'Sell premium perfume with tier-based retail upside', 'The deck presents a 40% lifetime discount and package-based direct selling values, making product movement the first visible income stream.', 1),
  ('earn/direct-referral', 'mechanics', 'Personally sponsor and earn package-based bonuses', 'The PDF shows public referral values such as PHP 200, PHP 1,000, PHP 5,000, PHP 7,000, and PHP 15,000 depending on the package involved.', 1),
  ('earn/salesmatch', 'binary', 'Match both legs without losing the strong side', 'Public salesmatch messaging emphasizes no fifth-pair rule, no two-cycle limit, no side lock, no maintenance, and no daily flush-out.', 1),
  ('earn/salesmatch', 'schedule', 'Public payout rhythm is part of the story', 'Yor presents Tuesday encashment, Friday payout, and a PHP 500 minimum encashment threshold as part of its earnings narrative.', 2),
  ('earn/binary-cycle', 'cycle', 'A second layer beyond direct matching', 'The slide references 2% through 5% public values and frames binary cycle bonus as an added reward stream linked to the broader network.', 1),
  ('earn/get-five', 'milestone', 'Unlimited direct sponsor momentum', 'The public slide ties the bonus to package duplication and presents it as a repeatable milestone rather than a one-time campaign.', 1),
  ('earn/lifestyle-rewards', 'reward', 'Repeat purchase drives prestige rewards', 'The public page pairs 3% repeat purchase language with public monthly potential examples and a real-time framing of the reward flow.', 1),
  ('earn/unilevel-rank', 'rank', 'Ten visible levels of public percentages', 'The business presentation shows 10%, 8%, 5%, 5%, 3%, 3%, 2%, 1%, 1%, and 1% across ten public levels.', 1),
  ('earn/global', 'global', 'Yearly global sales participation for top qualifiers', 'The page should explain that global bonus is reserved for higher-status qualifiers and depends on maintaining the account over time.', 1),
  ('rank-incentives', 'path', 'Recognition grows from director status to hall of fame', 'The business presentation frames progression through income milestones and incentive markers, culminating in high-prestige rewards and global bonus participation.', 1);

insert into app_users (email, display_name, role, status, password_hash, password_salt)
values
  (
    'member@yor.local',
    'Yor Member',
    'member',
    'active',
    '4496c246a0354cebf0ed2589b71ba3fd4f5eee7626cc0d93e6fcfcbb55be53d6b2005fa6f3c8eddce625bfb8ecc59e34407cb78fe1a15d779ae42eee434c0253',
    'yor-member-salt-v1'
  ),
  (
    'admin@yor.local',
    'Yor Admin',
    'admin',
    'active',
    'f40d9facef59241c5e2043d5962ce8a2e49e6515f17f520e016c9c311a50510be726d5f910d4c10107892eef1970544077aec9430963e5343d3677695bf42f48',
    'yor-admin-salt-v1'
  )
on conflict (email) do update
set
  display_name = excluded.display_name,
  role = excluded.role,
  status = excluded.status,
  password_hash = excluded.password_hash,
  password_salt = excluded.password_salt;

insert into member_profiles (user_id, referral_code, sponsor_code, package_tier, account_status)
select id, 'YOR-MEMBER-001', 'YOR-SPONSOR-001', 'Standard', 'active'
from app_users
where email = 'member@yor.local'
on conflict (user_id) do update
set
  referral_code = excluded.referral_code,
  sponsor_code = excluded.sponsor_code,
  package_tier = excluded.package_tier,
  account_status = excluded.account_status;

insert into admin_profiles (user_id, access_scope, office_title)
select id, 'platform', 'Operations Admin'
from app_users
where email = 'admin@yor.local'
on conflict (user_id) do update
set
  access_scope = excluded.access_scope,
  office_title = excluded.office_title;
