import { create } from "zustand";
import {
  parseOrganizationOptions,
  type OrganizationOption,
} from "@/lib/organizations";
import {
  apiErrorMessage,
  readResponseJson,
  requestErrorMessage,
} from "@/lib/request-errors";

type OrganizationsState = {
  organizations: OrganizationOption[];
  organizationsError: string | null;
  organizationsLoaded: boolean;
  organizationsLoading: boolean;
  loadOrganizations: (force?: boolean) => Promise<void>;
};

let activeLoad: Promise<void> | null = null;

export const useOrganizationsStore = create<OrganizationsState>((set, get) => ({
  organizations: [],
  organizationsError: null,
  organizationsLoaded: false,
  organizationsLoading: false,

  loadOrganizations: async (force = false) => {
    if (!force && get().organizationsLoaded) {
      return;
    }
    if (activeLoad) {
      return activeLoad;
    }

    const load = async () => {
      set({ organizationsError: null, organizationsLoading: true });
      try {
        const response = await fetch("/api/organizations", {
          cache: "no-store",
        });
        const data = await readResponseJson(response);
        if (!response.ok) {
          throw new Error(
            apiErrorMessage(data, "Failed to load organizations."),
          );
        }

        set({
          organizations: parseOrganizationOptions(data),
          organizationsLoaded: true,
        });
      } catch (error) {
        set({
          organizationsError: requestErrorMessage(
            error,
            "Failed to load organizations. Please try again.",
          ),
          organizationsLoaded: false,
        });
      } finally {
        set({ organizationsLoading: false });
      }
    };

    activeLoad = load();
    try {
      await activeLoad;
    } finally {
      activeLoad = null;
    }
  },
}));
