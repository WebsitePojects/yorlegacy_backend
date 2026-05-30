import { getSupabasePublicClient } from '../../lib/supabase.js';
import type { PageContent } from '../../types/content';
import { staticPages } from './static-pages.js';

type PageRow = {
  slug: string;
  title: string;
  eyebrow: string | null;
  strapline: string | null;
  summary: string;
  stats: PageContent['stats'];
  highlights: PageContent['highlights'];
  cta_label: string | null;
  cta_href: string | null;
};

type PageSectionRow = {
  section_key: string;
  heading: string;
  body: string;
  sort_order: number;
};

function overlayCanonicalSections(current: PageContent['sections'], canonical: PageContent['sections']) {
  const canonicalByKey = new Map(canonical.map((section) => [section.key, section]));

  return current.map((section) => {
    const canonicalSection = canonicalByKey.get(section.key);

    return canonicalSection
      ? {
          ...section,
          heading: canonicalSection.heading,
          body: canonicalSection.body
        }
      : section;
  });
}

function normalizePageContent(page: PageContent): PageContent {
  const canonical = staticPages[page.slug];

  if (!canonical) {
    return page;
  }

  switch (page.slug) {
    case 'founder':
      return {
        ...page,
        summary: canonical.summary
      };
    case 'packages':
    case 'earn/direct-referral':
    case 'rank-incentives':
      return {
        ...page,
        summary: canonical.summary,
        sections: overlayCanonicalSections(page.sections, canonical.sections)
      };
    default:
      return page;
  }
}

export async function getPageBySlug(slug: string): Promise<PageContent | null> {
  const supabase = getSupabasePublicClient();

  if (!supabase) {
    return staticPages[slug] ?? null;
  }

  const { data: page, error: pageError } = await supabase
    .from('site_pages')
    .select('slug,title,eyebrow,strapline,summary,stats,highlights,cta_label,cta_href')
    .eq('slug', slug)
    .single<PageRow>();

  if (pageError || !page) {
    return staticPages[slug] ?? null;
  }

  const { data: sections, error: sectionsError } = await supabase
    .from('page_sections')
    .select('section_key,heading,body,sort_order')
    .eq('page_slug', slug)
    .order('sort_order', { ascending: true })
    .returns<PageSectionRow[]>();

  if (sectionsError || !sections) {
    return staticPages[slug] ?? null;
  }

  return normalizePageContent({
    slug: page.slug,
    title: page.title,
    eyebrow: page.eyebrow ?? '',
    strapline: page.strapline ?? undefined,
    summary: page.summary,
    stats: page.stats ?? [],
    highlights: page.highlights ?? [],
    ctaLabel: page.cta_label ?? undefined,
    ctaHref: page.cta_href ?? undefined,
    sections: sections.map((section) => ({
      key: section.section_key,
      heading: section.heading,
      body: section.body
    }))
  });
}
