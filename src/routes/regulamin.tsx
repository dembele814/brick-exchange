import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/legal-page";

export const Route = createFileRoute("/regulamin")({
  head: () => ({
    meta: [
      { title: "Regulamin — Klockogram" },
      { name: "description", content: "Zasady sprzedaży, płatności i korzystania z Klockogramu." },
    ],
  }),
  component: Terms,
});

const Contact = () => <a href="mailto:feelip.wojcik@gmail.com">feelip.wojcik@gmail.com</a>;

function Terms() {
  return (
    <LegalPage title="Regulamin Klockogramu" updated="10 września 2026">
      <section>
        <h2>1. Operator i usługa</h2>
        <p>
          Operatorem Klockogramu jest Anna Wójcik, prowadząca działalność nierejestrowaną pod adresem
          ul. Sybiraków 20/19, 15-204 Białystok. NIP nie został nadany. Kontakt: <Contact />.
        </p>
        <p>
          Klockogram udostępnia serwis do publikowania ofert LEGO, rozmów, płatności i obsługi
          przesyłek. Operator jest pośrednikiem technicznym. Umowę sprzedaży zawierają bezpośrednio
          kupujący i sprzedający.
        </p>
      </section>
      <section>
        <h2>2. Konta i sprzedający</h2>
        <ul>
          <li>konto może założyć osoba pełnoletnia mająca pełną zdolność do czynności prawnych;</li>
          <li>użytkownik podaje prawdziwe dane, zabezpiecza konto i nie udostępnia go innym;</li>
          <li>na starcie sprzedawać mogą wyłącznie osoby prywatne niedziałające zawodowo;</li>
          <li>
            osoba, której sprzedaż nabiera charakteru zawodowego, wstrzymuje oferty i kontaktuje się
            z operatorem przed dalszą sprzedażą;
          </li>
          <li>sprzedający przechodzi weryfikację Stripe Connect potrzebną do wypłaty.</li>
        </ul>
      </section>
      <section>
        <h2>3. Oferty i umowa</h2>
        <p>
          Sprzedający odpowiada za zgodny z prawdą opis stanu i kompletności, własne zdjęcia, cenę,
          prawo do sprzedaży i legalność przedmiotu. Zabronione są podróbki, rzeczy kradzione lub
          niebezpieczne oraz treści naruszające cudze prawa. Kupujący może zapłacić cenę oferty albo
          cenę zaakceptowaną w rozmowie. Umowa sprzedaży zostaje zawarta po potwierdzeniu płatności
          przez Stripe.
        </p>
      </section>
      <section>
        <h2>4. Płatność i prowizja</h2>
        <ul>
          <li>ceny są podawane w złotych, a płatności i zwroty obsługuje Stripe;</li>
          <li>kupujący widzi cenę i dostawę przed zatwierdzeniem zakupu;</li>
          <li>
            prowizja operatora obciążająca sprzedającego wynosi 1 zł plus 5% ceny przedmiotu i jest
            zaokrąglana do pełnych groszy;
          </li>
          <li>prowizja nie przekroczy ceny i jest potrącana z kwoty dla sprzedającego.</li>
        </ul>
      </section>
      <section>
        <h2>5. Wysyłka i wypłata</h2>
        <p>
          Sprzedający prawidłowo pakuje rzecz, wysyła ją bez zbędnej zwłoki i podaje numer
          śledzenia. Kupujący sprawdza przesyłkę i potwierdza prawidłowy odbiór. Wtedy operator
          zleca na zweryfikowane konto Stripe sprzedającego transfer ceny pomniejszonej o prowizję.
          Weryfikacja, ograniczenie konta, spór lub kontrola bezpieczeństwa mogą opóźnić wypłatę.
        </p>
      </section>
      <section>
        <h2>6. Anulowanie, zwroty i reklamacje rzeczy</h2>
        <p>
          Przed wysyłką kupujący może anulować opłacone zamówienie w serwisie; pełna płatność jest
          zwracana tą samą metodą. Po wysyłce korzysta z procedury sporu. Czas zaksięgowania zależy
          od Stripe i banku.
        </p>
        <p>
          Sprzedający jest osobą prywatną. Do sprzedaży nie stosuje się konsumenckiego prawa do
          odstąpienia w ciągu 14 dni ani zasad reklamacji konsumenckiej wobec przedsiębiorcy. Nie
          wyłącza to odpowiedzialności prywatnego sprzedającego wynikającej z prawa ani możliwości
          dobrowolnego uzgodnienia zwrotu.
        </p>
      </section>
      <section>
        <h2>7. Spory</h2>
        <ol>
          <li>Kupujący zgłasza problem w zamówieniu przed potwierdzeniem odbioru.</li>
          <li>Opisuje problem i zachowuje zdjęcia rzeczy oraz opakowania.</li>
          <li>Wypłata może zostać wstrzymana na czas wyjaśniania.</li>
          <li>Strony uzgadniają zwrot rzeczy, obniżenie ceny albo odrzucenie zgłoszenia.</li>
          <li>
            Operator może poprosić o dowody, ułatwić rozmowę, zwrócić płatność lub cofnąć transfer,
            jeżeli pozwala na to stan środków i zasady Stripe.
          </li>
        </ol>
        <p>
          Operator nie jest sądem ani stroną sprzedaży. Decyzja techniczna o środkach nie odbiera
          stronom prawa do dochodzenia roszczeń.
        </p>
      </section>
      <section>
        <h2>8. Podatki i dane sprzedającego</h2>
        <p>
          Sprzedający sam wykonuje swoje obowiązki podatkowe. Operator może gromadzić, weryfikować i
          przekazywać organom wymagane prawem dane i informacje o transakcjach, w tym w ramach DAC7.
          Brak wymaganych danych może skutkować wstrzymaniem wypłaty lub sprzedaży.
        </p>
      </section>
      <section>
        <h2>9. Treści i moderacja</h2>
        <p>
          Bezprawną ofertę lub treść można zgłosić przy ofercie albo na <Contact />, wskazując
          treść, powód i dane kontaktowe. Operator może ograniczyć treść lub konto. Od decyzji można
          odwołać się e-mailem w ciągu 6 miesięcy. Decyzje o usunięciu treści nie są podejmowane
          wyłącznie automatycznie.
        </p>
      </section>
      <section>
        <h2>10. Bezpieczeństwo i odpowiedzialność</h2>
        <p>
          Nie wolno podszywać się pod inne osoby, obchodzić zabezpieczeń, wyłudzać płatności ani
          używać serwisu bezprawnie. Operator odpowiada za własną usługę zgodnie z prawem, lecz nie
          gwarantuje jakości rzeczy sprzedawanych przez użytkowników ani ciągłej dostępności usług
          zewnętrznych. Nie wyłącza to odpowiedzialności, której prawo nie pozwala wyłączyć.
        </p>
      </section>
      <section>
        <h2>11. Reklamacje Klockogramu</h2>
        <p>
          Reklamację działania platformy, prowizji lub wypłaty należy wysłać na <Contact />, podając
          konto, zamówienie i opis problemu. Operator odpowie w ciągu 14 dni. Roszczenia dotyczące
          przedmiotu kupujący kieruje do sprzedającego.
        </p>
      </section>
      <section>
        <h2>12. Obowiązywanie i zmiany</h2>
        <p>
          Regulamin obowiązuje od uruchomienia płatności produkcyjnych. O istotnej zmianie operator
          poinformuje z wyprzedzeniem w serwisie lub e-mailem. Do wcześniejszej transakcji stosuje
          się wersję z dnia zakupu. Konto można usunąć po rozliczeniu otwartych transakcji. Stosuje
          się prawo polskie z zachowaniem bezwzględnej ochrony konsumenta.
        </p>
      </section>
    </LegalPage>
  );
}
