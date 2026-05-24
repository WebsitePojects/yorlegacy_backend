import { getSupabaseClient } from '../../lib/supabase';
import type { PageContent } from '../../types/content';
import { staticPages } from './static-pages';

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

export async function getPageBySlug(slug: string): Promise<PageContent | null> {
  const supabase = getSupabaseClient();

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

  return {
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
  };
}
