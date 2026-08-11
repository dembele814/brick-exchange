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
};

export const themes = [
  "Wszystkie",
  "City",
  "Technic",
  "Castle",
  "Space",
  "Minifigurki",
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
    theme: "Minifigurki",
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
