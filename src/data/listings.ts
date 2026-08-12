import space from "@/assets/set-space.jpg";
import bulk from "@/assets/set-bulk.jpg";
import city from "@/assets/set-city.jpg";
import minifigs from "@/assets/set-minifigs.jpg";
import technic from "@/assets/set-technic.jpg";
import castle from "@/assets/set-castle.jpg";

export type Condition = "Nowy w pudełku" | "Bardzo dobry" | "Dobry" | "Używany";

export type Listing = {
  id: string;
  title: string;
  setNumber: string;
  theme: string;
  price: number;
  original?: number;
  condition: Condition;
  pieces: number;
  year: number;
  complete: boolean;
  instructions: boolean;
  box: boolean;
  image: string;
  city: string;
  seller: { name: string; rating: number; sales: number };
  description: string;
  promoted?: boolean;
};

// Pełna lista oficjalnych serii LEGO dostępnych jako motyw oferty
export const legoSeries = [
  "Architecture",
  "Art",
  "Artykuły szkolne",
  "Avatar",
  "Batman",
  "Batman Movie",
  "Bluey",
  "BrickHeadz",
  "Botanicals",
  "City",
  "Classic",
  "Creator",
  "DC Super Hero Girls",
  "Disney",
  "Disney Princess (Księżniczki Disneya)",
  "DOTS",
  "DREAMZzz",
  "DUPLO",
  "Editions Formula 1",
  "Editions Football",
  "Elves (Elfy)",
  "Exclusive",
  "Fortnite",
  "Friends",
  "Gabby's Dollhouse",
  "Harry Potter",
  "Hidden Side",
  "Ideas",
  "Indiana Jones",
  "Jurassic World",
  "Lord of the Rings (Władca Pierścieni)",
  "Marvel",
  "Minecraft",
  "Minifigures (Minifigurki)",
  "Minions (Minionki)",
  "Mixels",
  "Movie (Przygoda)",
  "Movie 2 (Przygoda 2)",
  "Nexo Knights",
  "Ninjago",
  "One Piece",
  "Overwatch",
  "Płytki budowlane (konstrukcyjne)",
  "Pokemon",
  "Recruitment Bags (Woreczki)",
  "Sonic",
  "Speed Champions",
  "Star Wars",
  "Super Heroes",
  "Super Mario",
  "Technic",
  "Trolls World Tour",
  "Toy Story",
  "Trains (Pociągi)",
  "Wednesday",
  "Wicked",
  "Agents (Ultra Agents)",
  "Castle",
  "Space",
  "Klocki luzem",
];

// Szybkie filtry nad listą ofert
export const themes = [
  "Wszystkie",
  "City",
  "Star Wars",
  "Technic",
  "Harry Potter",
  "Ninjago",
  "Castle",
  "Space",
  "Klocki luzem",
];

export const listings: Listing[] = [
  {
    id: "1",
    title: "Remiza strażacka – modularny budynek",
    setNumber: "60215",
    theme: "City",
    price: 249,
    original: 399,
    condition: "Bardzo dobry",
    pieces: 1842,
    year: 2019,
    complete: true,
    instructions: true,
    box: false,
    image: city,
    city: "Warszawa",
    seller: { name: "Marta K.", rating: 4.9, sales: 214 },
    description:
      "Kompletna remiza, złożona raz i trzymana w witrynie. Wszystkie części sprawdzone i przemyte, instrukcja w idealnym stanie. Wysyłka w kartonie z wypełnieniem.",
    promoted: true,
  },
  {
    id: "2",
    title: "Żuraw gąsienicowy – zestaw techniczny",
    setNumber: "42108",
    theme: "Technic",
    price: 319,
    condition: "Nowy w pudełku",
    pieces: 1292,
    year: 2020,
    complete: true,
    instructions: true,
    box: true,
    image: technic,
    city: "Kraków",
    seller: { name: "Bricks&Co", rating: 5, sales: 1043 },
    description:
      "Zestaw nowy, folie nieotwierane. Pudełko z lekkim wgięciem narożnika – widoczne na ostatnim zdjęciu.",
  },
  {
    id: "3",
    title: "Zamek rycerski z chorągwiami",
    setNumber: "6081",
    theme: "Castle",
    price: 540,
    original: 690,
    condition: "Dobry",
    pieces: 674,
    year: 1990,
    complete: false,
    instructions: true,
    box: false,
    image: castle,
    city: "Poznań",
    seller: { name: "Tomasz W.", rating: 4.7, sales: 87 },
    description:
      "Klasyk z lat 90. Brakuje 3 elementów dekoracyjnych (lista w opisie zdjęć). Chorągwie oryginalne, lekko wyblakłe.",
    promoted: true,
  },
  {
    id: "4",
    title: "Stacja kosmiczna – moduł badawczy",
    setNumber: "6985",
    theme: "Space",
    price: 189,
    condition: "Używany",
    pieces: 312,
    year: 1993,
    complete: true,
    instructions: false,
    box: false,
    image: space,
    city: "Gdańsk",
    seller: { name: "Anna S.", rating: 4.8, sales: 56 },
    description:
      "Rozłożony, spakowany w woreczkach według kolorów. Bez instrukcji – dostępna online. Minifigurka w komplecie.",
  },
  {
    id: "5",
    title: "Zestaw 5 minifigurek kolekcjonerskich",
    setNumber: "—",
    theme: "Minifigures (Minifigurki)",
    price: 129,
    condition: "Bardzo dobry",
    pieces: 5,
    year: 2016,
    complete: true,
    instructions: false,
    box: false,
    image: minifigs,
    city: "Wrocław",
    seller: { name: "MinifigLab", rating: 4.9, sales: 402 },
    description:
      "Pięć figurek z akcesoriami, bez śladów użytkowania. Nadruki bez przetarć, sprawdzone pod lampą.",
    promoted: true,
  },
  {
    id: "6",
    title: "Klocki luzem – mix 500 g",
    setNumber: "—",
    theme: "Klocki luzem",
    price: 45,
    condition: "Dobry",
    pieces: 400,
    year: 2010,
    complete: true,
    instructions: false,
    box: false,
    image: bulk,
    city: "Łódź",
    seller: { name: "Piotr N.", rating: 4.6, sales: 133 },
    description:
      "Mieszanka podstawowych klocków i płytek, umyta i wysuszona. Idealna na start budowania MOC.",
  },
];

export const getListing = (id: string) => listings.find((l) => l.id === id);
