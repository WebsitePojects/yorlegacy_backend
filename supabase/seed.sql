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
    'A visionary leader dedicated to building a sustainable financial legacy for families across the globe through strategic innovation, ethical leadership, and direct-selling excellence.',
    '[{"label":"Corporate Experience","value":"8 Years"},{"label":"Top Earner","value":"6x"},{"label":"Degree","value":"BS Criminology"}]'::jsonb,
    '[]'::jsonb,
    'View Collection',
    '/perfume-collection'
  ),
  (
    'perfume-collection',
    'Yor Product Collection',
    'Signature Products',
    null,
    'A public product page that separates the fragrance collection from featured non-fragrance products such as Yor Vision.',
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
    'Five public package tiers create a clear ladder from Classic through VIP, each with its own price point and PV value.',
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
    '5. Get Yor Five Bonus',
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
    'Manager through Hall of Famer ranks are paired with public reward milestones such as cash, gadgets, travel, vehicle, and property incentives.',
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
  ('perfume-collection', 'catalog', 'Fragrance collection and featured product story', 'The public deck highlights men''s and women''s fragrance entries such as Hugo Boss, Swiss Army, Chanel Bleu, Paris Hilton, Bvlgari Amethyste, and VS Bombshell, while Yor Vision should be presented separately as its own product feature.', 1),
  ('packages', 'comparison', 'Basic to VIP with visible value progression', 'The public Yor package ladder currently reads Basic, Classic, Standard, Business, and VIP, paired with public values such as PV-5 through PV-300.', 1),
  ('register', 'details', 'Lead with confidence and low-friction trust', 'The registration screen should keep the Yor visual tone while clearly collecting legal name, email, phone, sponsor details, and selected package.', 1),
  ('thank-you', 'confirmation', 'A calm and elevated confirmation experience', 'The thank-you page should reward commitment with clarity, warmth, and a next-step pathway.', 1),
  ('earn', 'framework', 'The public compensation story at a glance', 'This page should orient the visitor quickly and then let them drill into the details of each public incentive.', 1),
  ('earn/direct-selling', 'mechanics', 'Sell premium perfume with tier-based retail upside', 'The deck presents a 40% lifetime discount and package-based direct selling values, making product movement the first visible income stream.', 1),
  ('earn/direct-referral', 'mechanics', 'Personally sponsor and earn package-based bonuses', 'The PDF shows public referral values such as Basic: PHP 200, Classic: PHP 1,000, Standard: PHP 5,000, Business: PHP 7,000, and VIP: PHP 15,000.', 1),
  ('earn/salesmatch', 'binary', 'Match both legs without losing the strong side', 'Public salesmatch messaging emphasizes no fifth-pair rule, no two-cycle limit, no side lock, no maintenance, and no daily flush-out.', 1),
  ('earn/salesmatch', 'schedule', 'Public payout rhythm is part of the story', 'Yor presents Tuesday encashment, Friday payout, and a PHP 500 minimum encashment threshold as part of its earnings narrative.', 2),
  ('earn/binary-cycle', 'cycle', 'A second layer beyond direct matching', 'The slide references 2% through 5% public values and frames binary cycle bonus as an added reward stream linked to the broader network.', 1),
  ('earn/get-five', 'milestone', 'Unlimited direct sponsor momentum', 'The public slide ties the bonus to package duplication and presents it as a repeatable milestone rather than a one-time campaign.', 1),
  ('earn/get-five', 'product-led', 'Built around repeatable package and fragrance momentum', 'Get Yor Five works best when the member can present a clear product story, move the same-tier package confidently, and repeat the milestone through real retail and sponsorship energy.', 2),
  ('earn/lifestyle-rewards', 'reward', 'Repeat purchase drives prestige rewards', 'The public page pairs 3% repeat purchase language with public monthly potential examples and a real-time framing of the reward flow.', 1),
  ('earn/unilevel-rank', 'rank', 'Ten visible levels of public percentages', 'The business presentation shows 10%, 8%, 5%, 5%, 3%, 3%, 2%, 1%, 1%, and 1% across ten public levels.', 1),
  ('earn/global', 'global', 'Yearly global sales participation for top qualifiers', 'The page should explain that global bonus is reserved for higher-status qualifiers and depends on maintaining the account over time.', 1),
  ('rank-incentives', 'path', 'Recognition grows from manager status to hall-of-famer prestige', 'The business presentation frames progression through income milestones and incentive markers, culminating in high-prestige rewards and global bonus participation.', 1);

insert into package_catalog (
  legacy_account_type,
  package_code,
  package_name,
  display_order,
  package_price,
  pv,
  binary_points,
  direct_referral_bonus,
  notes
)
values
  (10, 'BASIC', 'Basic', 1, 1998.00, 5, 250, 200.00, 'Yor compensation PDF public price/PV normalized to the published Yor package ladder.'),
  (20, 'CLASSIC', 'Classic', 2, 5998.00, 10, 500, 1000.00, 'Yor compensation PDF public price/PV normalized to the published Yor package ladder.'),
  (30, 'STANDARD', 'Standard', 3, 25998.00, 50, 2500, 5000.00, 'Yor compensation PDF public price/PV; legacy account code retained only for migration parity.'),
  (40, 'BUSINESS', 'Business', 4, 50998.00, 100, 5000, 7000.00, 'Yor compensation PDF public price/PV; legacy account code retained only for migration parity.'),
  (60, 'VIP', 'VIP', 5, 159998.00, 300, 15000, 15000.00, 'Yor compensation PDF public price/PV; legacy account code retained only for migration parity.')
on conflict (legacy_account_type) do update
set
  package_code = excluded.package_code,
  package_name = excluded.package_name,
  display_order = excluded.display_order,
  package_price = excluded.package_price,
  pv = excluded.pv,
  binary_points = excluded.binary_points,
  direct_referral_bonus = excluded.direct_referral_bonus,
  notes = excluded.notes;

insert into legacy_access_accounts (
  legacy_access_id,
  legacy_uid,
  username,
  display_name,
  rights,
  is_active
)
values
  (1, 1, 'yoradminseed', 'Yor International', 1, true),
  (2, 2, 'yorcashierseed', 'Yor Cashier', 2, true),
  (3, 3, 'yorbodseed', 'Yoren Abihay - BOD', 3, true)
on conflict (legacy_access_id) do update
set
  legacy_uid = excluded.legacy_uid,
  username = excluded.username,
  display_name = excluded.display_name,
  rights = excluded.rights,
  is_active = excluded.is_active;

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
  ),
  (
    'cashier@yor.local',
    'Yor Cashier',
    'cashier',
    'active',
    '8c94fad3a3be56f2aa6806a37de356b21f8698048438e643b87142c437bfbce8a21a03683eedec34ad30cebedf41421976bc6d2e15629e9faf28f83017bcbeb9',
    'yor-cashier-salt-v1'
  ),
  (
    'bod@yor.local',
    'Yoren Abihay - BOD',
    'bod',
    'active',
    '12de81ad1af00f92092567bc1938f48beffbe5dac3f38cd3a7256ca55fe6bee747fc82aa16c3a9e1981d1a90b0b5a8fc5c2eb04be05a7514f9b71b98cb047d4f',
    'yor-bod-salt-v1'
  ),
  (
    'yoradmin@gmail.com',
    'Yor Super Admin',
    'superadmin',
    'active',
    '75fb89cbafbaee3c6392ed2d4727d307d6feb20316dfe0d2f69ed7f5f22e6d9717598a0561163daece6058b66ecb0749184f7822d114113aafcd88dd212e87dd',
    'yor-superadmin-salt-v1'
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

insert into app_users (email, display_name, role, status, password_hash, password_salt)
values
  (
    'yormember@gmail.com',
    'Yor International Member',
    'member',
    'active',
    '350b7acbb995f01722ebc31614cfcfd4e6a7dcd11b518f63b437301426f7f9b2bec307ef55a890ebd8315eaf1b38d8614026e19949a6da58d3a7fcda60d5d3b9',
    'yor-member-salt-v2'
  ),
  (
    'yorcashier@gmail.com',
    'Yor International Cashier',
    'cashier',
    'active',
    'ab1eb4b0cbe9d89ccda6921dc0332479550a2a730aafa6f2bec0c54c79df7b27a0176ddab6c49d9eac15294312ab1e3f3a51370f0dd648b74f6d6d30d2aac2a3',
    'yor-cashier-salt-v2'
  ),
  (
    'yorbod@gmail.com',
    'Yor International BOD',
    'bod',
    'active',
    'd194b4cabd66c8745dca0d5b61a7f4d957f94830da7c3d368df65f781a29d5cfe7d879dd22db4dbf5279b35a2c94cfe87aac8a87a13b6b24c5aef3a2867bad73',
    'yor-bod-salt-v2'
  )
on conflict (email) do update
set
  display_name = excluded.display_name,
  role = excluded.role,
  status = excluded.status,
  password_hash = excluded.password_hash,
  password_salt = excluded.password_salt;

insert into member_profiles (
  user_id,
  username,
  referral_code,
  sponsor_code,
  package_tier,
  account_status,
  first_name,
  last_name,
  payout_method,
  payout_identifier
)
select id, 'YORMEMBER01', 'YOR-MEMBER-002', 'YOR-SPONSOR-001', 'Standard', 'active', 'Yor', 'Member', 'GCash', 'masked-demo'
from app_users
where email = 'yormember@gmail.com'
on conflict (user_id) do update
set
  username = excluded.username,
  referral_code = excluded.referral_code,
  sponsor_code = excluded.sponsor_code,
  package_tier = excluded.package_tier,
  account_status = excluded.account_status,
  first_name = excluded.first_name,
  last_name = excluded.last_name,
  payout_method = excluded.payout_method,
  payout_identifier = excluded.payout_identifier;

insert into member_profiles (
  user_id,
  username,
  referral_code,
  sponsor_code,
  package_tier,
  account_status,
  first_name,
  last_name,
  payout_method,
  payout_identifier
)
select id, 'YORCASHIER01', 'YOR-CASHIER-001', 'YOR-MEMBER-002', 'Business', 'active', 'Yor', 'Cashier', 'GCash', 'masked-demo'
from app_users
where email = 'yorcashier@gmail.com'
on conflict (user_id) do update
set
  username = excluded.username,
  referral_code = excluded.referral_code,
  sponsor_code = excluded.sponsor_code,
  package_tier = excluded.package_tier,
  account_status = excluded.account_status,
  first_name = excluded.first_name,
  last_name = excluded.last_name,
  payout_method = excluded.payout_method,
  payout_identifier = excluded.payout_identifier;

insert into member_profiles (
  user_id,
  username,
  referral_code,
  sponsor_code,
  package_tier,
  account_status,
  first_name,
  last_name,
  payout_method,
  payout_identifier
)
select id, 'YORBOD01', 'YOR-BOD-001', 'YOR-MEMBER-002', 'VIP', 'active', 'Yor', 'BOD', 'GCash', 'masked-demo'
from app_users
where email = 'yorbod@gmail.com'
on conflict (user_id) do update
set
  username = excluded.username,
  referral_code = excluded.referral_code,
  sponsor_code = excluded.sponsor_code,
  package_tier = excluded.package_tier,
  account_status = excluded.account_status,
  first_name = excluded.first_name,
  last_name = excluded.last_name,
  payout_method = excluded.payout_method,
  payout_identifier = excluded.payout_identifier;

insert into network_accounts (
  user_id,
  sponsor_user_id,
  direct_referrer_user_id,
  placement_parent_user_id,
  main_account_user_id,
  account_type_code,
  current_account_type_code,
  package_catalog_id,
  binary_points,
  direct_referral_value,
  registration_status,
  placement_position,
  registered_at
)
select
  users.id,
  sponsor.id,
  sponsor.id,
  sponsor.id,
  sponsor.id,
  30,
  30,
  packages.id,
  1000,
  5000,
  'active',
  1,
  now()
from app_users users
cross join lateral (
  select id from app_users where email = 'member@yor.local'
) sponsor
join package_catalog packages
  on packages.legacy_account_type = 30
where users.email = 'yormember@gmail.com'
on conflict (user_id) do update
set
  sponsor_user_id = excluded.sponsor_user_id,
  direct_referrer_user_id = excluded.direct_referrer_user_id,
  placement_parent_user_id = excluded.placement_parent_user_id,
  main_account_user_id = excluded.main_account_user_id,
  account_type_code = excluded.account_type_code,
  current_account_type_code = excluded.current_account_type_code,
  package_catalog_id = excluded.package_catalog_id,
  binary_points = excluded.binary_points,
  direct_referral_value = excluded.direct_referral_value,
  registration_status = excluded.registration_status,
  placement_position = excluded.placement_position,
  registered_at = excluded.registered_at;

insert into network_accounts (
  user_id,
  sponsor_user_id,
  direct_referrer_user_id,
  placement_parent_user_id,
  main_account_user_id,
  account_type_code,
  current_account_type_code,
  package_catalog_id,
  binary_points,
  direct_referral_value,
  registration_status,
  placement_position,
  registered_at
)
select
  users.id,
  sponsor.id,
  sponsor.id,
  sponsor.id,
  sponsor.id,
  40,
  40,
  packages.id,
  2500,
  7000,
  'active',
  1,
  now()
from app_users users
cross join lateral (
  select id from app_users where email = 'yormember@gmail.com'
) sponsor
join package_catalog packages
  on packages.legacy_account_type = 40
where users.email = 'yorcashier@gmail.com'
on conflict (user_id) do update
set
  sponsor_user_id = excluded.sponsor_user_id,
  direct_referrer_user_id = excluded.direct_referrer_user_id,
  placement_parent_user_id = excluded.placement_parent_user_id,
  main_account_user_id = excluded.main_account_user_id,
  account_type_code = excluded.account_type_code,
  current_account_type_code = excluded.current_account_type_code,
  package_catalog_id = excluded.package_catalog_id,
  binary_points = excluded.binary_points,
  direct_referral_value = excluded.direct_referral_value,
  registration_status = excluded.registration_status,
  placement_position = excluded.placement_position,
  registered_at = excluded.registered_at;

insert into network_accounts (
  user_id,
  sponsor_user_id,
  direct_referrer_user_id,
  placement_parent_user_id,
  main_account_user_id,
  account_type_code,
  current_account_type_code,
  package_catalog_id,
  binary_points,
  direct_referral_value,
  registration_status,
  placement_position,
  registered_at
)
select
  users.id,
  sponsor.id,
  sponsor.id,
  sponsor.id,
  sponsor.id,
  60,
  60,
  packages.id,
  15000,
  15000,
  'active',
  1,
  now()
from app_users users
cross join lateral (
  select id from app_users where email = 'yormember@gmail.com'
) sponsor
join package_catalog packages
  on packages.legacy_account_type = 60
where users.email = 'yorbod@gmail.com'
on conflict (user_id) do update
set
  sponsor_user_id = excluded.sponsor_user_id,
  direct_referrer_user_id = excluded.direct_referrer_user_id,
  placement_parent_user_id = excluded.placement_parent_user_id,
  main_account_user_id = excluded.main_account_user_id,
  account_type_code = excluded.account_type_code,
  current_account_type_code = excluded.current_account_type_code,
  package_catalog_id = excluded.package_catalog_id,
  binary_points = excluded.binary_points,
  direct_referral_value = excluded.direct_referral_value,
  registration_status = excluded.registration_status,
  placement_position = excluded.placement_position,
  registered_at = excluded.registered_at;

insert into app_users (email, display_name, role, status, password_hash, password_salt)
values
  (
    'alyssa.cruz@example.test',
    'Alyssa Cruz',
    'member',
    'disabled',
    '4496c246a0354cebf0ed2589b71ba3fd4f5eee7626cc0d93e6fcfcbb55be53d6b2005fa6f3c8eddce625bfb8ecc59e34407cb78fe1a15d779ae42eee434c0253',
    'yor-member-salt-v1'
  ),
  (
    'marco.reyes@example.test',
    'Marco Reyes',
    'member',
    'disabled',
    '4496c246a0354cebf0ed2589b71ba3fd4f5eee7626cc0d93e6fcfcbb55be53d6b2005fa6f3c8eddce625bfb8ecc59e34407cb78fe1a15d779ae42eee434c0253',
    'yor-member-salt-v1'
  ),
  (
    'nica.santos@example.test',
    'Nica Santos',
    'member',
    'disabled',
    '4496c246a0354cebf0ed2589b71ba3fd4f5eee7626cc0d93e6fcfcbb55be53d6b2005fa6f3c8eddce625bfb8ecc59e34407cb78fe1a15d779ae42eee434c0253',
    'yor-member-salt-v1'
  ),
  (
    'ramon.dc@example.test',
    'Ramon Dela Cruz',
    'member',
    'disabled',
    '4496c246a0354cebf0ed2589b71ba3fd4f5eee7626cc0d93e6fcfcbb55be53d6b2005fa6f3c8eddce625bfb8ecc59e34407cb78fe1a15d779ae42eee434c0253',
    'yor-member-salt-v1'
  )
on conflict (email) do update
set
  display_name = excluded.display_name,
  role = excluded.role,
  status = excluded.status,
  password_hash = excluded.password_hash,
  password_salt = excluded.password_salt;

insert into member_profiles (user_id, username, referral_code, sponsor_code, package_tier, account_status, first_name, last_name, payout_method, payout_identifier)
select id, 'YOR0002', 'YOR-ALYSSA', 'YOR-MEMBER-001', 'Business', 'active', 'Alyssa', 'Cruz', 'GCash', 'masked-demo'
from app_users
where email = 'alyssa.cruz@example.test'
on conflict (user_id) do update
set
  username = excluded.username,
  referral_code = excluded.referral_code,
  sponsor_code = excluded.sponsor_code,
  package_tier = excluded.package_tier,
  account_status = excluded.account_status,
  first_name = excluded.first_name,
  last_name = excluded.last_name,
  payout_method = excluded.payout_method,
  payout_identifier = excluded.payout_identifier;

insert into member_profiles (user_id, username, referral_code, sponsor_code, package_tier, account_status, first_name, last_name, payout_method, payout_identifier)
select id, 'YOR0003', 'YOR-MARCO', 'YOR-MEMBER-001', 'VIP', 'active', 'Marco', 'Reyes', 'Bank', 'masked-demo'
from app_users
where email = 'marco.reyes@example.test'
on conflict (user_id) do update
set
  username = excluded.username,
  referral_code = excluded.referral_code,
  sponsor_code = excluded.sponsor_code,
  package_tier = excluded.package_tier,
  account_status = excluded.account_status,
  first_name = excluded.first_name,
  last_name = excluded.last_name,
  payout_method = excluded.payout_method,
  payout_identifier = excluded.payout_identifier;

insert into member_profiles (user_id, username, referral_code, sponsor_code, package_tier, account_status, first_name, last_name, payout_method, payout_identifier)
select id, 'YOR0004', 'YOR-NICA', 'YOR-ALYSSA', 'Classic', 'pending', 'Nica', 'Santos', 'GCash', 'masked-demo'
from app_users
where email = 'nica.santos@example.test'
on conflict (user_id) do update
set
  username = excluded.username,
  referral_code = excluded.referral_code,
  sponsor_code = excluded.sponsor_code,
  package_tier = excluded.package_tier,
  account_status = excluded.account_status,
  first_name = excluded.first_name,
  last_name = excluded.last_name,
  payout_method = excluded.payout_method,
  payout_identifier = excluded.payout_identifier;

insert into member_profiles (user_id, username, referral_code, sponsor_code, package_tier, account_status, first_name, last_name, payout_method, payout_identifier)
select id, 'YOR0005', 'YOR-RAMON', 'YOR-MARCO', 'Basic', 'active', 'Ramon', 'Dela Cruz', 'GCash', 'masked-demo'
from app_users
where email = 'ramon.dc@example.test'
on conflict (user_id) do update
set
  username = excluded.username,
  referral_code = excluded.referral_code,
  sponsor_code = excluded.sponsor_code,
  package_tier = excluded.package_tier,
  account_status = excluded.account_status,
  first_name = excluded.first_name,
  last_name = excluded.last_name,
  payout_method = excluded.payout_method,
  payout_identifier = excluded.payout_identifier;

insert into network_accounts (
  user_id,
  account_type_code,
  current_account_type_code,
  package_catalog_id,
  binary_points,
  direct_referral_value,
  incentive_points,
  cd_amount,
  cd_total,
  cd_status,
  registration_status,
  placement_position,
  registered_at
)
select
  users.id,
  30,
  30,
  packages.id,
  1000,
  5000,
  0,
  0,
  0,
  0,
  'active',
  1,
  now()
from app_users users
join package_catalog packages
  on packages.legacy_account_type = 30
where users.email = 'member@yor.local'
on conflict (user_id) do update
set
  account_type_code = excluded.account_type_code,
  current_account_type_code = excluded.current_account_type_code,
  package_catalog_id = excluded.package_catalog_id,
  binary_points = excluded.binary_points,
  direct_referral_value = excluded.direct_referral_value,
  registration_status = excluded.registration_status;

insert into activation_codes (legacy_code_id, code, assigned_user_id, generated_at, process_id, status)
select 1001, 'YOR-ACT-1001', id, now() - interval '8 days', 'seed-code-1001', 'used'
from app_users
where email = 'member@yor.local'
on conflict (code) do update
set
  assigned_user_id = excluded.assigned_user_id,
  generated_at = excluded.generated_at,
  process_id = excluded.process_id,
  status = excluded.status;

insert into activation_codes (legacy_code_id, code, assigned_user_id, generated_at, process_id, status)
select 1002, 'YOR-ACT-1002', id, now() - interval '7 days', 'seed-code-1002', 'used'
from app_users
where email = 'alyssa.cruz@example.test'
on conflict (code) do update
set
  assigned_user_id = excluded.assigned_user_id,
  generated_at = excluded.generated_at,
  process_id = excluded.process_id,
  status = excluded.status;

insert into activation_codes (legacy_code_id, code, assigned_user_id, generated_at, process_id, status)
values (1003, 'YOR-ACT-1003', null, now(), 'seed-code-1003', 'available')
on conflict (code) do update
set
  assigned_user_id = excluded.assigned_user_id,
  generated_at = excluded.generated_at,
  process_id = excluded.process_id,
  status = excluded.status;

delete from wallet_ledger
where process_id in ('seed-wallet-001', 'seed-wallet-002', 'seed-wallet-003');

insert into wallet_ledger (user_id, entry_type, source_reference, credit_amount, debit_amount, balance_after, notes, process_id, occurred_at)
select id, 'direct_referral', 'YOR-ALYSSA', 5000, 0, 15200.75, 'Report-first seed mirrors direct sponsor credit visibility.', 'seed-wallet-001', now()
from app_users
where email = 'member@yor.local'
union all
select id, 'salesmatch', 'YOR0001 L/R match', 7500, 0, 10200.75, 'Report-first seed mirrors binary salesmatch visibility.', 'seed-wallet-002', now() - interval '1 day'
from app_users
where email = 'member@yor.local'
union all
select id, 'encashment_fee', 'ENC-20260524-001', 0, 100, 2700.75, 'Report-first seed shows fee deduction; write operations remain gated.', 'seed-wallet-003', now() - interval '4 days'
from app_users
where email = 'member@yor.local';

insert into pairing_snapshots (user_id, snapshot_date, week_number, total_left_points, total_right_points, matched_points, total_binary_pay)
select id, current_date, 22, 24000, 18000, 18000, 15000
from app_users
where email = 'member@yor.local'
on conflict (user_id, snapshot_date) do update
set
  week_number = excluded.week_number,
  total_left_points = excluded.total_left_points,
  total_right_points = excluded.total_right_points,
  matched_points = excluded.matched_points,
  total_binary_pay = excluded.total_binary_pay;

insert into payout_transactions (
  legacy_payout_id,
  user_id,
  beginning_balance,
  ending_balance,
  cash_balance,
  encashment_breakdown,
  encashment_fee,
  cd_deduction,
  cash_status,
  payment_option,
  payment_details,
  transaction_created_at,
  process_id
)
select
  2001,
  id,
  15200.75,
  7300.75,
  7900,
  '{"gross":"PHP 8,000.00","net":"PHP 7,900.00"}'::jsonb,
  100,
  0,
  1,
  'GCash',
  'masked-demo',
  now() - interval '4 days',
  'seed-encash-001'
from app_users
where email = 'member@yor.local'
on conflict (legacy_payout_id) do update
set
  beginning_balance = excluded.beginning_balance,
  ending_balance = excluded.ending_balance,
  cash_balance = excluded.cash_balance,
  encashment_breakdown = excluded.encashment_breakdown,
  encashment_fee = excluded.encashment_fee,
  cd_deduction = excluded.cd_deduction,
  cash_status = excluded.cash_status,
  payment_option = excluded.payment_option,
  payment_details = excluded.payment_details,
  transaction_created_at = excluded.transaction_created_at,
  process_id = excluded.process_id;

insert into admin_profiles (user_id, access_scope, office_title)
select id, 'platform', 'Operations Admin'
from app_users
where email = 'admin@yor.local'
on conflict (user_id) do update
set
  access_scope = excluded.access_scope,
  office_title = excluded.office_title;

insert into admin_profiles (user_id, access_scope, office_title)
select id, 'cashier', 'Cashier Office'
from app_users
where email = 'cashier@yor.local'
on conflict (user_id) do update
set
  access_scope = excluded.access_scope,
  office_title = excluded.office_title;

insert into admin_profiles (user_id, access_scope, office_title)
select id, 'bod', 'Board Office'
from app_users
where email = 'bod@yor.local'
on conflict (user_id) do update
set
  access_scope = excluded.access_scope,
  office_title = excluded.office_title;

insert into admin_profiles (user_id, access_scope, office_title)
select id, 'cashier', 'Cashier Office'
from app_users
where email = 'yorcashier@gmail.com'
on conflict (user_id) do update
set
  access_scope = excluded.access_scope,
  office_title = excluded.office_title;

insert into admin_profiles (user_id, access_scope, office_title)
select id, 'bod', 'Board Office'
from app_users
where email = 'yorbod@gmail.com'
on conflict (user_id) do update
set
  access_scope = excluded.access_scope,
  office_title = excluded.office_title;

insert into admin_profiles (user_id, access_scope, office_title, is_superadmin)
select id, 'superadmin', 'Super Admin', true
from app_users
where email = 'yoradmin@gmail.com'
on conflict (user_id) do update
set
  access_scope = excluded.access_scope,
  office_title = excluded.office_title,
  is_superadmin = excluded.is_superadmin;

insert into compensation_policies (
  policy_key,
  mode,
  title,
  source_references,
  unresolved_decisions,
  is_active
)
values (
  'yor-mvp-gated-simulation',
  'gated-simulation',
  'Yor MVP Gated Simulation Policy',
  '["docs/YOR International Compensation Plan.pdf","docs/yor_international.pdf","docs/reference/yor-legacy-operations-parity.md","legacy node references"]'::jsonb,
  '["Final shadow-account activation and earning eligibility policy","Final duplicate-prevention process keys per income stream","Final payout/encashment approval workflow","Final tax, fee, CD, and maintenance deductions","Final global bonus pool close and Hall of Fame eligibility process"]'::jsonb,
  true
)
on conflict (policy_key) do update
set
  mode = excluded.mode,
  title = excluded.title,
  source_references = excluded.source_references,
  unresolved_decisions = excluded.unresolved_decisions,
  is_active = excluded.is_active,
  updated_at = now();

with active_policy as (
  select id
  from compensation_policies
  where policy_key = 'yor-mvp-gated-simulation'
)
insert into earning_stream_policies (
  policy_id,
  stream_key,
  label,
  basis,
  write_status,
  unresolved_decisions,
  sort_order
)
select
  active_policy.id,
  stream.stream_key,
  stream.label,
  stream.basis,
  'gated',
  stream.unresolved_decisions::jsonb,
  stream.sort_order
from active_policy
cross join (
  values
    ('direct-selling', 'Direct Selling', 'Package retail margin and lifetime discount surface from the Yor compensation PDF.', '["Final product SKU inventory and retail transaction ledger"]', 1),
    ('direct-referral', 'Direct Referral', 'Package-based sponsor bonus from the Yor compensation PDF.', '["Final sponsor eligibility and duplicate process key"]', 2),
    ('salesmatch', 'Salesmatch Bonus', 'Binary left/right matching with package values and caps from the Yor compensation PDF.', '["Final strong-leg retention, cap, and payout release process"]', 3),
    ('binary-cycle', 'Binary Cycle Bonus', 'Percentage-based cycle layer tied to binary activity.', '["Final source volume eligibility and cycle close schedule"]', 4),
    ('get-five', 'Get Yor Five Bonus', 'Five direct signups on the same package tier unlock a milestone bonus.', '["Final grouping reset, repeatability, and same-package audit rule"]', 5),
    ('lifestyle-rewards', 'Lifestyle Rewards', 'Repeat-purchase based lifestyle reward with public 3% language.', '["Final threshold, monthly cap, and reward release workflow"]', 6),
    ('unilevel', 'Unilevel Bonus / Rank', 'Ten-level percentage ladder and rank progress surface.', '["Final qualification ladder and compression behavior"]', 7),
    ('global', 'Global Bonus', 'Yearly global sales pool and Hall of Fame eligibility surface.', '["Final pool close date, qualifier list, and account-maintenance evidence"]', 8)
) as stream(stream_key, label, basis, unresolved_decisions, sort_order)
on conflict (policy_id, stream_key) do update
set
  label = excluded.label,
  basis = excluded.basis,
  write_status = excluded.write_status,
  unresolved_decisions = excluded.unresolved_decisions,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into shadow_accounts (
  owner_user_id,
  shadow_code,
  state,
  placement,
  wallet_enabled,
  unilevel_enabled,
  binary_cycle_enabled,
  notes
)
select
  users.id,
  shadow.shadow_code,
  shadow.state,
  shadow.placement,
  shadow.wallet_enabled,
  shadow.unilevel_enabled,
  shadow.binary_cycle_enabled,
  shadow.notes
from app_users users
cross join (
  values
    ('YOR0001-L', 'reserved_shadow', 'left', false, false, false, 'Reserved shadow account. Non-earning until activation policy is finalized.'),
    ('YOR0001-R', 'activated_shadow', 'right', true, false, true, 'Activated shadow account for simulation only. Real value release remains gated.'),
    ('YOR0001-FULL', 'converted_full', 'left', true, true, true, 'Converted full account example for admin review and audit tracing.')
) as shadow(shadow_code, state, placement, wallet_enabled, unilevel_enabled, binary_cycle_enabled, notes)
where users.email = 'member@yor.local'
on conflict (shadow_code) do update
set
  state = excluded.state,
  placement = excluded.placement,
  wallet_enabled = excluded.wallet_enabled,
  unilevel_enabled = excluded.unilevel_enabled,
  binary_cycle_enabled = excluded.binary_cycle_enabled,
  notes = excluded.notes,
  updated_at = now();

insert into income_simulation_runs (
  user_id,
  stream_key,
  simulated_gross,
  simulated_net,
  cap_applied,
  calculation_trace,
  required_evidence,
  process_id
)
select
  users.id,
  simulation.stream_key,
  simulation.simulated_gross,
  simulation.simulated_net,
  simulation.cap_applied,
  simulation.calculation_trace::jsonb,
  simulation.required_evidence::jsonb,
  simulation.process_id
from app_users users
cross join (
  values
    ('direct-referral', 5000.00, 5000.00, false, '["Sponsor: YOR-MEMBER-001","Package: Standard","PDF public bonus: PHP 5,000","Write mode: gated simulation"]', '["Final sponsor duplicate process key","Admin approval trace","Append-only ledger write test"]', 'seed-sim-direct-referral-001'),
    ('salesmatch', 15000.00, 15000.00, false, '["Left volume: 24,000","Right volume: 18,000","Matched volume: 18,000","Write mode: gated simulation"]', '["Final cap policy","Strong-leg retention test","Tuesday encashment and Friday payout approval flow"]', 'seed-sim-salesmatch-001'),
    ('lifestyle-rewards', 3000.00, 3000.00, true, '["Repeat purchase basis: demo PHP 100,000","Public language: 3% lifestyle reward","Cap surfaced for review","Write mode: gated simulation"]', '["Final repeat purchase ledger","Monthly threshold/cap approval","Reward release audit"]', 'seed-sim-lifestyle-001')
) as simulation(stream_key, simulated_gross, simulated_net, cap_applied, calculation_trace, required_evidence, process_id)
where users.email = 'member@yor.local'
on conflict (process_id) do update
set
  stream_key = excluded.stream_key,
  simulated_gross = excluded.simulated_gross,
  simulated_net = excluded.simulated_net,
  cap_applied = excluded.cap_applied,
  calculation_trace = excluded.calculation_trace,
  required_evidence = excluded.required_evidence;

insert into admin_review_actions (
  actor_user_id,
  action_key,
  target_reference,
  status,
  money_mode,
  reason
)
select
  users.id,
  'approve-payout',
  'ENC-20260524-001',
  'blocked',
  'gated-simulation',
  'MVP blocks real payout approval until final payout policy, ledger balancing, duplicate-prevention tests, and audit workflow are approved.'
from app_users users
where users.email = 'yoradmin@gmail.com'
  and not exists (
    select 1
    from admin_review_actions existing
    where existing.action_key = 'approve-payout'
      and existing.target_reference = 'ENC-20260524-001'
      and existing.money_mode = 'gated-simulation'
  );
