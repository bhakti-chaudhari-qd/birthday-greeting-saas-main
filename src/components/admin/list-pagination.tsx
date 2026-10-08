"use client";

import { secondaryButtonClass } from "@/components/ui/page";
import type { AdminListControlsDict } from "@/lib/i18n/dictionaries/admin-list-controls";

export const ADMIN_LIST_PAGE_SIZE = 20;

/** The slice of `items` for a 1-based page, and how many pages there are. */
export function paginate<T>(
  items: T[],
  page: number,
  pageSize: number = ADMIN_LIST_PAGE_SIZE,
): { pageItems: T[]; totalPages: number; currentPage: number } {
  const totalPages = Math.max(Math.ceil(items.length / pageSize), 1);
  const currentPage = Math.min(Math.max(page, 1), totalPages);
  const start = (currentPage - 1) * pageSize;
  return {
    pageItems: items.slice(start, start + pageSize),
    totalPages,
    currentPage,
  };
}

type ListPaginationProps = {
  dict: AdminListControlsDict;
  page: number;
  totalPages: number;
  shownCount: number;
  totalCount: number;
  onPageChange: (page: number) => void;
};

/** Count line plus Previous / Next, shown under a Platform Admin table. */
export function ListPagination({
  dict,
  page,
  totalPages,
  shownCount,
  totalCount,
  onPageChange,
}: ListPaginationProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 px-4 py-3 text-sm text-stone-600">
      <span>{dict.showing(shownCount, totalCount)}</span>
      {totalPages > 1 ? (
        <div className="flex items-center gap-3">
          <button
            type="button"
            className={secondaryButtonClass}
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            {dict.previous}
          </button>
          <span>{dict.pageOf(page, totalPages)}</span>
          <button
            type="button"
            className={secondaryButtonClass}
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            {dict.next}
          </button>
        </div>
      ) : null}
    </div>
  );
}
