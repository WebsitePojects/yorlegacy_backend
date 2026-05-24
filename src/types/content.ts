export type PageStat = {
  label: string;
  value: string;
};

export type PageHighlight = {
  title: string;
  body: string;
};

export type PageSection = {
  key: string;
  heading: string;
  body: string;
};

export type PageContent = {
  slug: string;
  title: string;
  eyebrow: string;
  strapline?: string;
  summary: string;
  ctaLabel?: string;
  ctaHref?: string;
  stats?: PageStat[];
  highlights?: PageHighlight[];
  sections: PageSection[];
};
