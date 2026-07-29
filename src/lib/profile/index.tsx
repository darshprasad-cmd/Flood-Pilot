"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { DEFAULT_PROFILE, isUsable, type UserProfile } from "./types";

const STORAGE_KEY = "disha.profile.v1";

interface ProfileValue {
  profile: UserProfile;
  /** Merge a partial update and persist it. */
  update: (patch: Partial<UserProfile>) => void;
  /** Replace the whole profile — used when onboarding finishes. */
  replace: (next: UserProfile) => void;
  reset: () => void;
  /** True once localStorage has been read. Render nothing profile-dependent
   *  before this, or the first frame shows onboarding to a returning user. */
  hydrated: boolean;
  ready: boolean;
}

const ProfileContext = createContext<ProfileValue | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as UserProfile;
        // A profile written by an older version is discarded rather than
        // patched. Guessing at a missing field here would mean guessing at
        // somebody's vehicle, and the failure mode of that guess is a car in
        // water it cannot cross.
        if (parsed?.version === DEFAULT_PROFILE.version) {
          setProfile({ ...DEFAULT_PROFILE, ...parsed });
        }
      }
    } catch {
      // Private browsing, quota, or corrupt JSON. Onboarding runs again, which
      // is a mild annoyance rather than a failure.
    }
    setHydrated(true);
  }, []);

  const persist = useCallback((next: UserProfile) => {
    setProfile(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // The session still works; the answers just will not survive a reload.
    }
  }, []);

  const update = useCallback(
    (patch: Partial<UserProfile>) =>
      setProfile((current) => {
        const next = { ...current, ...patch };
        try {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          /* see above */
        }
        return next;
      }),
    [],
  );

  const reset = useCallback(() => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* nothing to clean up */
    }
    setProfile(DEFAULT_PROFILE);
  }, []);

  const value = useMemo<ProfileValue>(
    () => ({
      profile,
      update,
      replace: persist,
      reset,
      hydrated,
      ready: hydrated && isUsable(profile),
    }),
    [profile, update, persist, reset, hydrated],
  );

  return (
    <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
  );
}

export function useProfile(): ProfileValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) {
    throw new Error("useProfile must be used inside <ProfileProvider>");
  }
  return ctx;
}

export { DEFAULT_PROFILE, DEMO_PROFILE, COMMUTE_MODES, isUsable } from "./types";
export type { UserProfile, CommuteMode, DetailMode } from "./types";
