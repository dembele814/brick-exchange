# Co zrobić, gdy GitHub wróci

## 1. Wysłać i zsynchronizować kod

1. Wykonać `git push upstream HEAD:main` bez przepisywania historii.
2. Sprawdzić, czy Lovable pobrał wszystkie oczekujące commity.
3. Uruchomić podgląd Lovable i sprawdzić, czy kompilacja zakończyła się poprawnie.

Oczekujące zmiany obejmują dokumenty prawne, deklarację prywatnego sprzedawcy, produkcyjną obsługę InPost oraz zabezpieczenia uruchomieniowe.

## 2. Zaktualizować bazę Supabase

Przed publikacją nowej wersji wykonać kolejno brakujące migracje:

1. `20260912_stripe_live_mode.sql`
2. `20260913_private_seller_declaration.sql`
3. `20260914_production_shipping.sql`
4. kolejne migracje utworzone po tym dokumencie

Każdą migrację wykonać tylko w projekcie `wrgrjnduppjagdmflnan` i sprawdzić komunikat powodzenia przed przejściem dalej.

## 3. Dodać sekrety serwerowe

- Stripe: właściwy tryb, klucz tajny i sekret webhooka.
- InPost: token, ID organizacji i sekret HMAC właściwego środowiska.
- Supabase: klucz service role zapisany pod obsługiwaną nazwą sekretu Lovable.

Żadnego sekretu nie wolno wpisywać w kodzie, wiadomości ani zmiennej z prefiksem `VITE_`.

## 4. Skonfigurować webhooki

- Stripe: `https://bricklane-market.lovable.app/api/webhooks/stripe`
- InPost: `https://bricklane-market.lovable.app/api/webhooks/inpost`, temat `Shipment.Tracking`

Po zapisaniu wysłać zdarzenie testowe i potwierdzić odpowiedź HTTP 200.

## 5. Opublikować i wykonać test końcowy

1. Najpierw pełny zakup w trybie testowym.
2. Sprawdzić rezerwację oferty, prowizję `1 zł + 5%`, wiadomości i zamówienie.
3. Utworzyć przesyłkę InPost, pobrać PDF i odebrać aktualizację śledzenia.
4. Sprawdzić anulowanie, zgłoszenie problemu, zwrot i transfer sprzedającego.
5. Dopiero potem włączyć produkcyjne flagi Stripe i InPost.
6. Wykonać jeden kontrolowany zakup produkcyjny za 1 zł z udziałem operatora i udokumentować wynik.

## Co można robić bez GitHuba

- rozwijać i testować kod lokalnie,
- przygotowywać migracje i instrukcje,
- poprawiać bezpieczeństwo, panel administratora i obsługę błędów,
- przygotować testy uruchomieniowe oraz checklistę publikacji.

Bez połączenia z GitHubem nie da się zsynchronizować zmian z Lovable ani opublikować nowej wersji strony. Bez danych umownych InPost nie da się utworzyć prawdziwej etykiety.
