# E-maile transakcyjne Klockowni

## Usługa

Wysyłkę realizuje Resend. Każde ważne powiadomienie o płatności, przesyłce, odbiorze,
zwrocie lub działaniu administratora trafia najpierw do tabeli `email_outbox`. Worker
blokuje rekord, wysyła wiadomość z kluczem idempotencji i ponawia ją najwyżej pięć razy.

## Bezpieczne uruchomienie

1. Utwórz konto Resend dla operatora platformy.
2. Dodaj subdomenę, np. `send.klockownia.pl`, i skopiuj rekordy DNS SPF oraz DKIM.
3. Poczekaj na status `Verified` w Resend.
4. Utwórz klucz API wyłącznie do wysyłki.
5. W Lovable ustaw najpierw:

   ```ini
   EMAIL_ENABLED=true
   EMAIL_MODE=test
   EMAIL_LIVE_ENABLED=false
   RESEND_API_KEY=re_...
   EMAIL_FROM=Klockownia <powiadomienia@send.klockownia.pl>
   EMAIL_TEST_RECIPIENT=feelip.wojcik@gmail.com
   ```

6. Wykonuj `POST https://bricklane-market.lovable.app/api/cron/emails` co minutę z
   nagłówkiem `Authorization: Bearer ...`. Użyj `EMAIL_WORKER_SECRET` albo istniejącego
   `RECONCILIATION_SECRET`.
7. Wykonaj zakup testowy i sprawdź treść wiadomości oraz link.
8. Po udanym teście ustaw `EMAIL_MODE=live` i `EMAIL_LIVE_ENABLED=true`. Od tej chwili
   wiadomości trafiają na adres e-mail przypisany do konta odbiorcy.

Sekretów nie zapisuj w repozytorium ani w zmiennych zaczynających się od `VITE_`.
