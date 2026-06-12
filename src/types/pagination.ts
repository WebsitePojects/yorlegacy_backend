export type PageRequest = { page: number; pageSize: number };

export type PageResult<T> = {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export const MAX_PAGE_SIZE = 100;
export const DEFAULT_PAGE_SIZE = 25;

export function normalizePageRequest(query: { page?: unknown; pageSize?: unknown }): PageRequest {
  const page = Math.max(1, Math.trunc(Number(query.page) || 1));
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.trunc(Number(query.pageSize) || DEFAULT_PAGE_SIZE)));
  return { page, pageSize };
}

export function buildPageResult<T>(items: T[], totalItems: number, request: PageRequest): PageResult<T> {
  return {
    items,
    page: request.page,
    pageSize: request.pageSize,
    totalItems,
    totalPages: Math.max(1, Math.ceil(totalItems / request.pageSize))
  };
}
