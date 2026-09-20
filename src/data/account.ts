import { useSyncExternalStore } from "react";
import avatarPlaceholder from "@/assets/avatar-placeholder.svg";
import type { Condition } from "./listings";
import { requireSupabase, supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";

export type ListingStatus = "active" | "hidden" | "draft";

export type MyListing = {
  id: string;
  title: string;
  theme: string;
  price: number;
  condition: Condition | "—";
  image: string;
  status: ListingStatus;
  promoted: boolean;
  views: number;
};

export type Order = {
  id: string;
  kind: "bought" | "sold";
  title: string;
  image: string;
  price: number;
  total: number;
  counterparty: string;
  status: "W realizacji" | "Wysłane" | "Zakończone";
  at: string;
};

export type WalletTx = {
  id: string;
  label: string;
  amount: number;
  at: string;
};

export type Profile = {
  name: string;
  avatar: string;
  bio: string;
  country: string;
  city: string;
  language: string;
  rating: number;
  reviews: number;
  joined: string;
  realName: string;
  gender: "" | "Kobieta" | "Mężczyzna" | "Nie podaję";
  birthDate: string;
  email: string;
  phone: string;
  shippingStreet: string;
  shippingPostcode: string;
  shippingCity: string;
  vacationMode: boolean;
  googleLinked: boolean;
  facebookLinked: boolean;
  showCity: boolean;
  personalisedAds: boolean;
  profileVisible: boolean;
};

type State = {
  profile: Profile;
  myListings: MyListing[];
  orders: Order[];
  wallet: { balance: number; transactions: WalletTx[] };
  loggedIn: boolean;
  authLoading: boolean;
  userId: string | null;
  isAdmin: boolean;
  favorites: string[];
};

let state: State = {
  profile: {
    name: "",
    avatar: avatarPlaceholder,
    bio: "",
    country: "",
    city: "",
    language: "",
    rating: 0,
    reviews: 0,
    joined: "",
    realName: "",
    gender: "",
    birthDate: "",
    email: "",
    phone: "",
    shippingStreet: "",
    shippingPostcode: "",
    shippingCity: "",
    vacationMode: false,
    googleLinked: false,
    facebookLinked: false,
    showCity: true,
    personalisedAds: false,
    profileVisible: true,
  },
  myListings: [],
  orders: [],
  wallet: {
    balance: 0,
    transactions: [],
  },
  loggedIn: false,
  authLoading: Boolean(supabase),
  userId: null,
  isAdmin: false,
  favorites: [],
};
const serverSnapshot = state;

const listeners = new Set<() => void>();
const emit = () => {
  state = { ...state };
  listeners.forEach((l) => l());
};

export function useAccount() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
    () => serverSnapshot,
  );
}

export function updateProfile(patch: Partial<Profile>) {
  state.profile = { ...state.profile, ...patch };
  emit();
}

export async function saveProfile() {
  const client = requireSupabase();
  const { data } = await client.auth.getUser();
  if (!data.user) throw new Error("Zaloguj się, aby zapisać profil.");
  const profile = state.profile;
  const { error } = await client
    .from("profiles")
    .update({
      username: profile.name,
      bio: profile.bio,
      country: profile.country,
      city: profile.city || null,
      language: profile.language,
      vacation_mode: profile.vacationMode,
      show_city: profile.showCity,
      profile_visible: profile.profileVisible,
      personalised_ads: profile.personalisedAds,
    })
    .eq("id", data.user.id);
  if (error) throw error;
  if (profile.vacationMode) {
    const { error: hideError } = await client
      .from("listings")
      .update({ status: "hidden" })
      .eq("seller_id", data.user.id)
      .eq("status", "active");
    if (hideError) throw hideError;
  }
  const { error: privateError } = await client.from("private_profiles").upsert({
    user_id: data.user.id,
    full_name: profile.realName || null,
    phone: profile.phone || null,
    birth_date: profile.birthDate || null,
    gender: profile.gender || null,
    shipping_street: profile.shippingStreet || null,
    shipping_postcode: profile.shippingPostcode || null,
    shipping_city: profile.shippingCity || null,
    updated_at: new Date().toISOString(),
  });
  if (privateError) throw privateError;
  const emailChangeRequested = Boolean(profile.email && profile.email !== data.user.email);
  if (emailChangeRequested) {
    const { error: emailError } = await client.auth.updateUser({ email: profile.email });
    if (emailError) throw emailError;
  }
  return { emailChangeRequested };
}

export async function sendPasswordReset() {
  const client = requireSupabase();
  const { data } = await client.auth.getUser();
  if (!data.user?.email) throw new Error("Nie znaleźliśmy adresu e-mail tego konta.");
  return sendPasswordResetForEmail(data.user.email);
}

export async function sendPasswordResetForEmail(email: string) {
  const value = email.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(value)) throw new Error("Wpisz prawidłowy adres e-mail.");
  const { error } = await requireSupabase().auth.resetPasswordForEmail(value, {
    redirectTo: `${window.location.origin}/reset-hasla`,
  });
  if (error) throw error;
}

export async function setRecoveredPassword(password: string) {
  if (password.length < 8) throw new Error("Nowe hasło musi mieć co najmniej 8 znaków.");
  const client = requireSupabase();
  const { data } = await client.auth.getSession();
  if (!data.session) throw new Error("Link wygasł. Wyślij nowy link resetowania hasła.");
  const { error } = await client.auth.updateUser({ password });
  if (error) throw error;
}

export async function uploadAvatar(file: File) {
  const client = requireSupabase();
  const { data } = await client.auth.getUser();
  if (!data.user) throw new Error("Zaloguj się, aby zmienić zdjęcie.");
  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${data.user.id}/avatar.${extension}`;
  const { error: uploadError } = await client.storage
    .from("avatars")
    .upload(path, file, { upsert: true });
  if (uploadError) throw uploadError;
  const avatar = client.storage.from("avatars").getPublicUrl(path).data.publicUrl;
  const { error } = await client
    .from("profiles")
    .update({ avatar_path: avatar })
    .eq("id", data.user.id);
  if (error) throw error;
  updateProfile({ avatar });
}

export function setListingStatus(id: string, status: ListingStatus) {
  state.myListings = state.myListings.map((l) => (l.id === id ? { ...l, status } : l));
  emit();
}

export function promoteListing(id: string) {
  const cost = 9.99;
  const target = state.myListings.find((l) => l.id === id);
  if (!target || target.promoted) return { ok: false, reason: "Oferta jest już wyróżniona." };
  if (state.wallet.balance < cost)
    return { ok: false, reason: "Za mało środków w portfelu. Wpłać pieniądze i spróbuj ponownie." };
  state.myListings = state.myListings.map((l) => (l.id === id ? { ...l, promoted: true } : l));
  state.wallet = {
    balance: Math.round((state.wallet.balance - cost) * 100) / 100,
    transactions: [
      { id: `t${Date.now()}`, label: `Podbicie: ${target.title}`, amount: -cost, at: "dziś" },
      ...state.wallet.transactions,
    ],
  };
  emit();
  return { ok: true, reason: "Oferta wyróżniona na 7 dni." };
}

export function topUpWallet(amount: number) {
  if (!(amount > 0)) return;
  state.wallet = {
    balance: Math.round((state.wallet.balance + amount) * 100) / 100,
    transactions: [
      { id: `t${Date.now()}`, label: "Wpłata do portfela", amount, at: "dziś" },
      ...state.wallet.transactions,
    ],
  };
  emit();
}

export function logout() {
  return requireSupabase().auth.signOut();
}

export async function login(email: string, password: string) {
  const { data, error } = await requireSupabase().auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export type RegistrationProfile = {
  name: string;
  country: string;
  city: string;
  language: string;
  bio: string;
};

const pendingRegistrationKey = "klockogram.pending-registration-profile";

function normaliseRegistrationProfile(input: RegistrationProfile): RegistrationProfile {
  const result = {
    name: input.name.trim(),
    country: input.country.trim(),
    city: input.city.trim(),
    language: input.language.trim(),
    bio: input.bio.trim(),
  };
  if (!/^[a-zA-Z0-9_.-]{3,40}$/.test(result.name))
    throw new Error(
      "Nick musi mieć 3–40 znaków i może zawierać litery, cyfry, kropkę, myślnik lub podkreślenie.",
    );
  if (!result.country) throw new Error("Wybierz kraj.");
  if (!result.city) throw new Error("Wpisz swoje miasto.");
  if (!result.language) throw new Error("Wybierz język.");
  if (result.bio.length > 500) throw new Error("Opis może mieć maksymalnie 500 znaków.");
  return result;
}

export async function loginWithGoogle(registrationProfile?: RegistrationProfile) {
  if (registrationProfile) {
    const profile = normaliseRegistrationProfile(registrationProfile);
    sessionStorage.setItem(
      pendingRegistrationKey,
      JSON.stringify({ ...profile, createdAt: Date.now() }),
    );
  }
  const { data, error } = await requireSupabase().auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/profil`,
      scopes: "https://www.googleapis.com/auth/userinfo.email",
      queryParams: { prompt: "select_account" },
    },
  });
  if (error) throw error;
  return data;
}

export async function linkGoogleAccount() {
  const { data, error } = await requireSupabase().auth.linkIdentity({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/ustawienia`,
      scopes: "https://www.googleapis.com/auth/userinfo.email",
      queryParams: { prompt: "select_account" },
    },
  });
  if (error) throw error;
  return data;
}

export async function register(input: RegistrationProfile & { email: string; password: string }) {
  const profile = normaliseRegistrationProfile(input);
  const { data, error } = await requireSupabase().auth.signUp({
    email: input.email.trim().toLowerCase(),
    password: input.password,
    options: {
      data: {
        username: profile.name,
        country: profile.country,
        city: profile.city,
        language: profile.language,
        bio: profile.bio,
      },
    },
  });
  if (error) throw error;
  return data;
}

export function isFavorite(id: string) {
  return state.favorites.includes(id);
}

export function toggleFavorite(id: string) {
  const wasFavorite = state.favorites.includes(id);
  state.favorites = wasFavorite
    ? state.favorites.filter((f) => f !== id)
    : [...state.favorites, id];
  emit();
  void (async () => {
    if (!supabase) return;
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    const result = wasFavorite
      ? await supabase.from("favorites").delete().eq("user_id", data.user.id).eq("listing_id", id)
      : await supabase.from("favorites").insert({ user_id: data.user.id, listing_id: id });
    if (result.error) {
      state.favorites = wasFavorite
        ? [...state.favorites, id]
        : state.favorites.filter((favorite) => favorite !== id);
      emit();
    }
  })();
}

export const PROMOTE_COST = 9.99;

let sessionRevision = 0;
let profileTimer: ReturnType<typeof setTimeout> | undefined;

// Publish the actual session immediately; profile queries must not gate login.
function acceptSession(session: Session | null) {
  const revision = ++sessionRevision;
  state.loggedIn = Boolean(session);
  state.authLoading = false;
  state.userId = session?.user.id ?? null;
  state.isAdmin = session?.user.app_metadata?.["klockownia_admin"] === true;
  if (!session) state.favorites = [];
  emit();
  if (profileTimer) clearTimeout(profileTimer);
  if (session) {
    profileTimer = setTimeout(() => {
      void syncSession(session, revision).catch(() => {
        // An unavailable profile does not invalidate an authenticated session.
      });
    }, 0);
  }
}

async function syncSession(session: Session, revision: number) {
  if (!supabase) return;
  const user = session.user;
  if (user) {
    const [{ data: profile }, { data: privateProfile }, { data: receivedReviews }] =
      await Promise.all([
        supabase
          .from("profiles")
          .select(
            "username,avatar_path,bio,country,city,language,profile_visible,vacation_mode,show_city,personalised_ads,created_at",
          )
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("private_profiles")
          .select(
            "full_name,phone,birth_date,gender,shipping_street,shipping_postcode,shipping_city",
          )
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase.from("reviews").select("rating").eq("seller_id", user.id),
      ]);
    if (revision !== sessionRevision) return;
    let resolvedProfile = profile;
    const pendingRaw = sessionStorage.getItem(pendingRegistrationKey);
    if (pendingRaw) {
      try {
        const pending = JSON.parse(pendingRaw) as RegistrationProfile & { createdAt?: number };
        const isRecentRegistration =
          Date.now() - new Date(user.created_at).getTime() < 15 * 60 * 1000 &&
          Date.now() - Number(pending.createdAt ?? 0) < 30 * 60 * 1000;
        if (isRecentRegistration) {
          const registration = normaliseRegistrationProfile(pending);
          const { error: registrationError } = await supabase
            .from("profiles")
            .update({
              username: registration.name,
              country: registration.country,
              city: registration.city,
              language: registration.language,
              bio: registration.bio || null,
            })
            .eq("id", user.id);
          if (!registrationError)
            resolvedProfile = {
              ...profile,
              username: registration.name,
              country: registration.country,
              city: registration.city,
              language: registration.language,
              bio: registration.bio,
            };
        }
      } finally {
        sessionStorage.removeItem(pendingRegistrationKey);
      }
    }
    const reviewValues = (receivedReviews ?? []).map((review) => review.rating);
    state.profile = {
      ...state.profile,
      name: resolvedProfile?.username ?? "",
      avatar: resolvedProfile?.avatar_path ?? state.profile.avatar,
      bio: resolvedProfile?.bio ?? "",
      country: resolvedProfile?.country ?? "",
      city: resolvedProfile?.city ?? "",
      language: resolvedProfile?.language === "pl" ? "Polski" : (resolvedProfile?.language ?? ""),
      profileVisible: resolvedProfile?.profile_visible ?? state.profile.profileVisible,
      vacationMode: resolvedProfile?.vacation_mode ?? state.profile.vacationMode,
      showCity: resolvedProfile?.show_city ?? state.profile.showCity,
      personalisedAds: resolvedProfile?.personalised_ads ?? state.profile.personalisedAds,
      email: user.email ?? state.profile.email,
      rating: reviewValues.length
        ? Math.round(
            (reviewValues.reduce((sum, rating) => sum + rating, 0) / reviewValues.length) * 10,
          ) / 10
        : 0,
      reviews: reviewValues.length,
      joined: profile?.created_at
        ? new Intl.DateTimeFormat("pl-PL", { month: "long", year: "numeric" }).format(
            new Date(profile.created_at),
          )
        : state.profile.joined,
      realName: privateProfile?.full_name ?? "",
      phone: privateProfile?.phone ?? "",
      shippingStreet: privateProfile?.shipping_street ?? "",
      shippingPostcode: privateProfile?.shipping_postcode ?? "",
      shippingCity: privateProfile?.shipping_city ?? "",
      birthDate: privateProfile?.birth_date ?? "",
      gender:
        privateProfile?.gender === "Kobieta" ||
        privateProfile?.gender === "Mężczyzna" ||
        privateProfile?.gender === "Nie podaję"
          ? privateProfile.gender
          : "",
    };
    const { data: favorites } = await supabase
      .from("favorites")
      .select("listing_id")
      .eq("user_id", user.id);
    if (revision !== sessionRevision) return;
    state.favorites = (favorites ?? []).map((favorite) => favorite.listing_id);
  } else {
    state.favorites = [];
  }
  emit();
}

if (typeof window !== "undefined" && supabase) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => acceptSession(session));
  if (import.meta.hot)
    import.meta.hot.dispose(() => {
      data.subscription.unsubscribe();
      if (profileTimer) clearTimeout(profileTimer);
      sessionRevision++;
    });
}
