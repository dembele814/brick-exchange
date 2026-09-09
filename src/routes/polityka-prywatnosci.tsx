import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/legal-page";

export const Route = createFileRoute("/polityka-prywatnosci")({
  head: () => ({
    meta: [
      { title: "Polityka prywatności — Klockownia" },
      {
        name: "description",
        content: "Informacje o przetwarzaniu danych osobowych w serwisie Klockownia.",
      },
    ],
  }),
  component: PrivacyPolicy,
});

function PrivacyPolicy() {
  return (
    <LegalPage title="Polityka prywatności" updated="9 września 2026">
      <section>
        <h2>1. Administrator i kontakt</h2>
        <p>
          Administratorem danych jest operator serwisu Klockownia. W sprawach prywatności, dostępu
          do danych lub usunięcia konta napisz na{" "}
          <a href="mailto:feelip.awf@gmail.com">feelip.awf@gmail.com</a>.
        </p>
        <p>
          Klockownia działa obecnie jako wersja testowa. Płatności Stripe, transfery i zwroty nie
          obejmują prawdziwych pieniędzy.
        </p>
      </section>

      <section>
        <h2>2. Jakie dane przetwarzamy</h2>
        <ul>
          <li>dane konta: e-mail, nazwa użytkownika i identyfikator użytkownika;</li>
          <li>dobrowolne dane profilu: zdjęcie, opis, miasto, kraj i ustawienia prywatności;</li>
          <li>dane potrzebne do obsługi zamówienia: imię, nazwisko, telefon i punkt odbioru;</li>
          <li>ogłoszenia, zdjęcia, wiadomości, propozycje cen, opinie i zgłoszenia;</li>
          <li>techniczne dane sesji, bezpieczeństwa i zdarzeń związanych z płatnością testową.</li>
        </ul>
        <p>
          Po zalogowaniu przez Google otrzymujemy podstawowe dane wybrane na ekranie zgody: adres
          e-mail, nazwę i zdjęcie profilowe. Nie otrzymujemy hasła do konta Google.
        </p>
      </section>

      <section>
        <h2>3. Cele i podstawy przetwarzania</h2>
        <ul>
          <li>utworzenie i obsługa konta oraz realizacja funkcji serwisu — wykonanie umowy;</li>
          <li>
            bezpieczeństwo, przeciwdziałanie nadużyciom i rozpatrywanie zgłoszeń — uzasadniony
            interes;
          </li>
          <li>wykonanie obowiązków prawnych, jeśli mają zastosowanie — obowiązek prawny;</li>
          <li>ustawienia opcjonalne, takie jak personalizacja — zgoda, którą można wycofać.</li>
        </ul>
      </section>

      <section>
        <h2>4. Dostawcy</h2>
        <p>
          Dane mogą być przetwarzane przez Supabase (baza danych i logowanie), Google (logowanie),
          Stripe (płatności i wypłaty testowe) oraz dostawców hostingu projektu. Każdy dostawca
          przetwarza dane w zakresie potrzebnym do wykonania swojej usługi i stosuje własne
          zabezpieczenia oraz warunki.
        </p>
        <p>
          Dane mogą być przetwarzane poza Europejskim Obszarem Gospodarczym, jeżeli dostawca stosuje
          mechanizm transferu wymagany przez prawo, na przykład standardowe klauzule umowne.
        </p>
      </section>

      <section>
        <h2>5. Okres przechowywania</h2>
        <p>
          Dane konta przechowujemy przez czas korzystania z serwisu. Po usunięciu konta dane są
          usuwane lub anonimizowane, chyba że dalsze przechowanie jest potrzebne do ochrony przed
          nadużyciami, ustalenia roszczeń albo wykonania obowiązku prawnego. Kopie zapasowe mogą być
          przechowywane przez ograniczony czas techniczny.
        </p>
      </section>

      <section>
        <h2>6. Twoje prawa</h2>
        <p>
          Możesz żądać dostępu do danych, ich sprostowania, usunięcia, ograniczenia przetwarzania i
          przeniesienia. Możesz też wnieść sprzeciw lub wycofać zgodę. Masz prawo złożyć skargę do
          Prezesa Urzędu Ochrony Danych Osobowych. Zakres prawa zależy od podstawy i celu
          przetwarzania.
        </p>
      </section>

      <section>
        <h2>7. Bezpieczeństwo i pliki cookie</h2>
        <p>
          Stosujemy kontrolę dostępu, prywatne reguły bazy danych i szyfrowane połączenia. Serwis
          zapisuje dane techniczne niezbędne do utrzymania sesji logowania. Obecnie nie używamy
          zewnętrznych reklamowych plików cookie ani analityki marketingowej.
        </p>
      </section>
    </LegalPage>
  );
}
