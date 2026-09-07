"use client";

export type OrganizationOccasion = {
  id: string;
  name: string;
  isSystem: boolean;
};

export type OrganizationCategory = {
  id: string;
  name: string;
};

type CachedValue<T> = {
  data: T;
  expiresAt: number;
};

const CACHE_TTL_MS = 5 * 60 * 1000;

let occasionsCache: CachedValue<OrganizationOccasion[]> | null = null;
let occasionsRequest: Promise<OrganizationOccasion[]> | null = null;
let categoriesCache: CachedValue<OrganizationCategory[]> | null = null;
let categoriesRequest: Promise<OrganizationCategory[]> | null = null;

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  const body = await response.json();
  if (!response.ok) {
    throw new Error(`Could not load ${url}`);
  }
  return body.data as T;
}

export function fetchOrganizationOccasions(): Promise<OrganizationOccasion[]> {
  if (occasionsCache && occasionsCache.expiresAt > Date.now()) {
    return Promise.resolve(occasionsCache.data);
  }
  if (occasionsRequest) {
    return occasionsRequest;
  }

  occasionsRequest = fetchJson<OrganizationOccasion[]>("/api/v1/occasions")
    .then((data) => {
      occasionsCache = { data, expiresAt: Date.now() + CACHE_TTL_MS };
      return data;
    })
    .finally(() => {
      occasionsRequest = null;
    });

  return occasionsRequest;
}

export function fetchOrganizationCategories(): Promise<OrganizationCategory[]> {
  if (categoriesCache && categoriesCache.expiresAt > Date.now()) {
    return Promise.resolve(categoriesCache.data);
  }
  if (categoriesRequest) {
    return categoriesRequest;
  }

  categoriesRequest = fetchJson<OrganizationCategory[]>(
    "/api/v1/contact-categories",
  )
    .then((data) => {
      categoriesCache = { data, expiresAt: Date.now() + CACHE_TTL_MS };
      return data;
    })
    .finally(() => {
      categoriesRequest = null;
    });

  return categoriesRequest;
}

export function invalidateOrganizationOccasions() {
  occasionsCache = null;
}

export function invalidateOrganizationCategories() {
  categoriesCache = null;
}
