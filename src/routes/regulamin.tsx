import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/legal-page";

export const Route = createFileRoute("/regulamin")({
  head: () => ({
    meta: [
      { title: "Regulamin — Klockownia" },
      { name: "description", content: "Zasady korzystania z wersji testowej Klockowni." },
    ],
  }),
  component: Terms,
});

function Terms() {
  return (
    <LegalPage title="Regulamin wersji testowej" updated="9 września 2026">
      <section>
        <h2>1. Serwis</h2>
        <p>
          Klockownia jest internetowym serwisem testowym do wystawiania, przeglądania i kupowania
          używanych zestawów, minifigurek oraz klocków. Kontakt z operatorem:{" "}
          <a href="mailto:feelip.awf@gmail.com">feelip.awf@gmail.com</a>.
        </p>
      </section>

      <section>
        <h2>2. Charakter testowy</h2>
        <p>
          Serwis korzysta obecnie wyłącznie z trybu testowego Stripe. Żadne płatności, zwroty ani
          transfery widoczne w serwisie nie dotyczą prawdziwych pieniędzy. Zamówienia testowe nie
          tworzą obowiązku wysłania przedmiotu ani zapłaty ceny. Przed uruchomieniem sprzedaży za
          prawdziwe pieniądze regulamin zostanie zastąpiony wersją produkcyjną.
        </p>
      </section>

      <section>
        <h2>3. Konto</h2>
        <ul>
          <li>konto może utworzyć osoba, która ukończyła 18 lat;</li>
          <li>użytkownik podaje prawdziwy adres e-mail i chroni dostęp do konta;</li>
          <li>jedna osoba nie może podszywać się pod innego użytkownika;</li>
          <li>operator może ograniczyć konto używane do nadużyć lub naruszeń bezpieczeństwa.</li>
        </ul>
      </section>

      <section>
        <h2>4. Ogłoszenia i wiadomości</h2>
        <p>
          Sprzedający odpowiada za zgodność opisu i zdjęć z rzeczywistym stanem przedmiotu. Nie
          wolno publikować treści bezprawnych, cudzych danych, spamu ani ofert niezwiązanych z
          zakresem Klockowni. Wiadomości i propozycje cen służą uzgodnieniom dotyczącym ogłoszenia.
        </p>
      </section>

      <section>
        <h2>5. Testowe zamówienia i spory</h2>
        <p>
          Cena testowego zamówienia może wynikać z ogłoszenia albo zaakceptowanej propozycji.
          Statusy płatności, wysyłki, odbioru, zwrotu i transferu symulują przyszły proces
          sprzedaży. Problemy można zgłaszać w zamówieniu, a administrator może je zamknąć, ukryć
          zgłoszoną ofertę lub wykonać zwrot testowy.
        </p>
      </section>

      <section>
        <h2>6. Zasady bezpieczeństwa</h2>
        <p>
          Nie wolno próbować uzyskać dostępu do cudzego konta, omijać zabezpieczeń, zakłócać
          działania serwisu ani używać go do oszustwa. Błędy należy zgłaszać operatorowi bez
          wykorzystywania ich przeciw użytkownikom lub serwisowi.
        </p>
      </section>

      <section>
        <h2>7. Dostępność i odpowiedzialność</h2>
        <p>
          Wersja testowa może być zmieniana, czasowo niedostępna lub zawierać błędy. Operator nie
          gwarantuje ciągłości działania ani zachowania danych testowych. Ograniczenie nie wyłącza
          odpowiedzialności, której nie można wyłączyć na mocy prawa.
        </p>
      </section>

      <section>
        <h2>8. Zmiany i zakończenie testów</h2>
        <p>
          O istotnych zmianach zasad użytkownicy zostaną poinformowani w serwisie. Użytkownik może
          zaprzestać korzystania z Klockowni i zażądać usunięcia konta. Prawo polskie stosuje się w
          zakresie dozwolonym przez bezwzględnie obowiązujące przepisy.
        </p>
      </section>
    </LegalPage>
  );
}
