export type Review = {
  id: string;
  author: string;
  rating: number;
  text: string;
  at: string;
};

const authors = [
  "Kasia W.",
  "Michał P.",
  "Ewa T.",
  "Damian S.",
  "Zofia L.",
  "Kamil R.",
  "Natalia B.",
  "Grzegorz O.",
];

const texts = [
  "Zestaw dokładnie jak w opisie, wszystko umyte i policzone. Polecam!",
  "Szybka wysyłka, świetne pakowanie — klocki nie miały jak się uszkodzić.",
  "Miły kontakt, odpowiedzi w kilka minut. Chętnie kupię ponownie.",
  "Instrukcja w idealnym stanie, naklejki bez zarysowań.",
  "Wszystko ok, drobne rysy na jednym elemencie, ale były opisane.",
  "Solidny sprzedawca, komplet elementów i dobra cena.",
];

const months = ["stycznia", "marca", "kwietnia", "czerwca", "lipca", "sierpnia"];

const hash = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) % 100000;
  return h;
};

/** Deterministyczne opinie prezentacyjne dla profilu sprzedającego. */
export function getReviews(sellerName: string, rating: number, count = 5): Review[] {
  const base = hash(sellerName);
  return Array.from({ length: count }, (_, i) => {
    const n = base + i * 7;
    const stars = Math.min(5, Math.max(3, Math.round(rating + ((n % 3) - 1) * 0.4)));
    return {
      id: `${sellerName}-${i}`,
      author: authors[n % authors.length]!,
      rating: stars,
      text: texts[n % texts.length]!,
      at: `${(n % 27) + 1} ${months[n % months.length]} 2026`,
    };
  });
}
