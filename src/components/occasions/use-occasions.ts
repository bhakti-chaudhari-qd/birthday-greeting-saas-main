"use client";

import { useEffect, useState } from "react";

import { fetchOrganizationOccasions } from "@/lib/client/organization-reference-data";

export type OccasionOption = {
  id: string;
  name: string;
  isSystem: boolean;
};

/** Shared occasion list for dropdowns/filters across the app, Birthday first. */
export function useOccasions(): {
  occasions: OccasionOption[];
  loading: boolean;
} {
  const [occasions, setOccasions] = useState<OccasionOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      function apply(data: OccasionOption[]) {
        setOccasions(data);
        setLoading(false);
      }

      try {
        const data = await fetchOrganizationOccasions();
        if (!cancelled) {
          apply(data);
        }
      } catch {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { occasions, loading };
}
