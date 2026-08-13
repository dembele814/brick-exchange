import { useEffect, useState } from "react";
import avatarMe from "@/assets/avatar-me.jpg";
import { listings, type Condition } from "./listings";

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
  gender: "Kobieta" | "Mężczyzna" | "Nie podaję";
  birthDate: string;
  email: string;
  phone: string;
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
};

const pick = (i: number) => listings[i % listings.length]!;

let state: State = {
  profile: {
    name: "klockowy_maks",
    avatar: avatarMe,
    bio: "Zbieram klasyczne zestawy Castle i Space od 15 lat. Wszystko myte, sprawdzone i pakowane z głową. Chętnie wymienię się częściami.",
    country: "Polska",
    city: "Wrocław",
    language: "Polski",
    rating: 4.6,
    reviews: 128,
    joined: "marzec 2021",
    realName: "Maksymilian Nowak",
    gender: "Mężczyzna",
    birthDate: "1994-06-12",
    email: "maks@example.com",
    phone: "+48 600 100 200",
    vacationMode: false,
    googleLinked: true,
    facebookLinked: false,
    showCity: true,
    personalisedAds: false,
    profileVisible: true,
  },
  myListings: [
    ...[0, 2, 4].map((i, n) => {
      const l = pick(i);
      return {
        id: `my-a${n}`,
        title: l.title,
        theme: l.theme,
        price: l.price,
        condition: l.condition,
        image: l.image,
        status: "active" as ListingStatus,
        promoted: n === 0,
        views: 320 - n * 74,
      };
    }),
    {
      id: "my-h0",
      title: "Pociąg towarowy – zestaw z torami",
      theme: "Trains (Pociągi)",
      price: 410,
      condition: "Bardzo dobry",
      image: pick(1).image,
      status: "hidden",
      promoted: false,
      views: 96,
    },
    {
      id: "my-d0",
      title: "Minifigurki – seria 21 (szkic)",
      theme: "Minifigures (Minifigurki)",
      price: 0,
      condition: "—",
      image: pick(3).image,
      status: "draft",
      promoted: false,
      views: 0,
    },
    {
      id: "my-d1",
      title: "Klocki luzem 2 kg (szkic)",
      theme: "Klocki luzem",
      price: 0,
      condition: "—",
      image: pick(5).image,
      status: "draft",
      promoted: false,
      views: 0,
    },
  ],
  orders: [
    {
      id: "o1",
      kind: "bought",
      title: pick(1).title,
      image: pick(1).image,
      price: 319,
      total: 336.95,
      counterparty: "Bricks&Co",
      status: "Wysłane",
      at: "5 sierpnia 2026",
    },
    {
      id: "o2",
      kind: "bought",
      title: pick(4).title,
      image: pick(4).image,
      price: 129,
      total: 136.45,
      counterparty: "MinifigLab",
      status: "Zakończone",
      at: "18 lipca 2026",
    },
    {
      id: "o3",
      kind: "sold",
      title: pick(2).title,
      image: pick(2).image,
      price: 540,
      total: 540,
      counterparty: "Kamil R.",
      status: "W realizacji",
      at: "9 sierpnia 2026",
    },
    {
      id: "o4",
      kind: "sold",
      title: pick(5).title,
      image: pick(5).image,
      price: 45,
      total: 45,
      counterparty: "Ewa T.",
      status: "Zakończone",
      at: "2 lipca 2026",
    },
  ],
  wallet: {
    balance: 268.4,
    transactions: [
      { id: "t1", label: "Sprzedaż: Klocki luzem – mix 500 g", amount: 45, at: "2 lipca 2026" },
      { id: "t2", label: "Wpłata kartą", amount: 300, at: "12 lipca 2026" },
      { id: "t3", label: "Zakup: Zestaw 5 minifigurek", amount: -136.45, at: "18 lipca 2026" },
      { id: "t4", label: "Podbicie oferty", amount: -9.99, at: "1 sierpnia 2026" },
    ],
  },
  loggedIn: true,
};

const listeners = new Set<() => void>();
const emit = () => {
  state = { ...state };
  listeners.forEach((l) => l());
};

export function useAccount() {
  const [snap, setSnap] = useState(state);
  useEffect(() => {
    const l = () => setSnap(state);
    listeners.add(l);
    l();
    return () => {
      listeners.delete(l);
    };
  }, []);
  return snap;
}

export function updateProfile(patch: Partial<Profile>) {
  state.profile = { ...state.profile, ...patch };
  emit();
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
  state.loggedIn = false;
  emit();
}

export function login() {
  state.loggedIn = true;
  emit();
}

export const PROMOTE_COST = 9.99;
