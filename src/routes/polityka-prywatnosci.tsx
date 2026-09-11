import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/legal-page";

export const Route = createFileRoute("/polityka-prywatnosci")({
  head: () => ({
    meta: [
      { title: "Polityka prywatności — Klockogram" },
      { name: "description", content: "Jak Klockogram wykorzystuje i chroni dane osobowe." },
    ],
  }),
  component: PrivacyPolicy,
});

const Contact = () => <a href="mailto:feelip.wojcik@gmail.com">feelip.wojcik@gmail.com</a>;

function PrivacyPolicy() {
  return (
    <LegalPage title="Polityka prywatności Klockogramu" updated="10 września 2026">
      <section>
        <h2>1. Administrator</h2>
        <p>
          Administratorem danych jest Anna Wójcik, działalność nierejestrowana, ul. Sybiraków 20/19,
          15-204 Białystok. NIP nie został nadany. Kontakt: <Contact />. Nie wyznaczono inspektora
          ochrony danych.
        </p>
      </section>
      <section>
        <h2>2. Dane, cele i podstawy prawne</h2>
        <ul>
          <li>
            konto, profil i logowanie: e-mail, nazwa, zdjęcie, identyfikator i ustawienia —
            wykonanie umowy o korzystanie z serwisu;
          </li>
          <li>
            oferty, zdjęcia, wiadomości, propozycje cen i opinie — wykonanie umowy i publikacja na
            żądanie użytkownika;
          </li>
          <li>
            zamówienia i dostawa: imię, nazwisko, telefon, punkt odbioru, status i historia —
            obsługa transakcji;
          </li>
          <li>
            płatności i wypłaty: identyfikatory Stripe, kwoty, prowizje, zwroty i konto Connect —
            wykonanie umowy i obowiązki prawne; nie zapisujemy pełnego numeru karty;
          </li>
          <li>
            zgłoszenia, spory, adres IP i dane techniczne — uzasadniony interes w bezpieczeństwie,
            zapobieganiu nadużyciom i ochronie roszczeń;
          </li>
          <li>
            dane identyfikacyjne i transakcje sprzedającego — obowiązki podatkowe, księgowe oraz
            obowiązki operatora platformy, w tym DAC7;
          </li>
          <li>funkcje dobrowolne oparte na zgodzie — do jej wycofania.</li>
        </ul>
      </section>
      <section>
        <h2>3. Źródła danych</h2>
        <p>
          Dane otrzymujemy od użytkownika, drugiej strony transakcji oraz dostawców logowania,
          płatności i dostawy. Przy logowaniu Google otrzymujemy podstawowe dane pokazane na ekranie
          zgody, zwykle e-mail, nazwę i zdjęcie. Nie otrzymujemy hasła Google.
        </p>
      </section>
      <section>
        <h2>4. Odbiorcy</h2>
        <p>
          Dane otrzymują w potrzebnym zakresie: Supabase (baza, logowanie i pliki), Google
          (logowanie), Stripe (płatności, weryfikacja i wypłaty), Lovable i dostawcy hostingu oraz
          wybrany przewoźnik. Dane odbiorcy przesyłki udostępniamy sprzedającemu tylko do realizacji
          zamówienia. Dane mogą otrzymać organy publiczne, jeśli wymagają tego przepisy.
        </p>
      </section>
      <section>
        <h2>5. Dane poza EOG</h2>
        <p>
          Dostawcy mogą przetwarzać dane poza Europejskim Obszarem Gospodarczym na podstawie
          mechanizmu zgodnego z RODO, w szczególności decyzji o odpowiednim poziomie ochrony albo
          standardowych klauzul umownych. Informację o właściwym mechanizmie można uzyskać e-mailem.
        </p>
      </section>
      <section>
        <h2>6. Okres przechowywania</h2>
        <ul>
          <li>dane konta — przez okres posiadania konta;</li>
          <li>oferty i wiadomości — przez korzystanie z usługi, później do 3 lat;</li>
          <li>
            zamówienia, płatności, prowizje i dane podatkowe — przez okres wymagany prawem,
            zasadniczo 5 lat od końca właściwego roku rozliczeniowego;
          </li>
          <li>spory i dowody — do przedawnienia roszczeń;</li>
          <li>logi bezpieczeństwa — co do zasady do 12 miesięcy;</li>
          <li>kopie zapasowe — do 90 dni od usunięcia z systemu głównego.</li>
        </ul>
      </section>
      <section>
        <h2>7. Prawa</h2>
        <p>
          Możesz żądać dostępu, kopii, sprostowania, usunięcia, ograniczenia i przeniesienia danych
          oraz wnieść sprzeciw wobec przetwarzania opartego na uzasadnionym interesie. Zgodę można
          wycofać bez wpływu na wcześniejsze działania. Napisz na <Contact />; możemy poprosić o
          potwierdzenie tożsamości. Możesz też złożyć skargę do Prezesa Urzędu Ochrony Danych
          Osobowych.
        </p>
      </section>
      <section>
        <h2>8. Czy dane są obowiązkowe</h2>
        <p>
          Dane wymagane są potrzebne do konta lub transakcji; bez nich dana funkcja nie zadziała.
          Dodatkowe dane profilu są dobrowolne. Sprzedający musi przekazać dane wymagane przez
          Stripe i przepisy o platformach, a ich brak może uniemożliwić sprzedaż lub wypłatę.
        </p>
      </section>
      <section>
        <h2>9. Automatyczne decyzje</h2>
        <p>
          Klockogram nie podejmuje decyzji wywołujących skutki prawne wyłącznie automatycznie i nie
          profiluje reklamowo. Stripe może prowadzić własną automatyczną ocenę ryzyka płatności
          zgodnie ze swoją polityką.
        </p>
      </section>
      <section>
        <h2>10. Pliki cookie i bezpieczeństwo</h2>
        <p>
          Używamy danych lokalnych i plików cookie koniecznych do logowania, bezpieczeństwa i sesji.
          Obecnie nie używamy reklamowych cookie ani zewnętrznej analityki marketingowej. Stosujemy
          szyfrowanie połączeń, ograniczenia dostępu i reguły bezpieczeństwa bazy. Incydent należy
          zgłosić na <Contact />.
        </p>
      </section>
      <section>
        <h2>11. Zmiany</h2>
        <p>
          Polityka obowiązuje od uruchomienia płatności produkcyjnych. Jeśli zmienią się cele,
          dostawcy lub zakres danych, zaktualizujemy dokument i poinformujemy o istotnej zmianie w
          serwisie albo e-mailem.
        </p>
      </section>
    </LegalPage>
  );
}
