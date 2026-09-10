# Włączenie wysyłek InPost

Kod obsługuje ShipX PL: weryfikację punktu, utworzenie przesyłki, etykietę A6 PDF oraz podpisane webhooki śledzenia. Tryb produkcyjny pozostaje zablokowany, dopóki operator nie ma aktywnej umowy logistycznej i danych API od InPost.

## Dane od InPost

Operator platformy powinien uzyskać od InPost:

- token ShipX i identyfikator organizacji dla środowiska produkcyjnego,
- osobne dane do sandboxa,
- wspólny sekret HMAC dla webhooka,
- potwierdzenie, czy podpis obejmuje `timestamp.body`, czy samo surowe body.

Adres webhooka produkcyjnego:

`https://bricklane-market.lovable.app/api/webhooks/inpost`

Temat: `Shipment.Tracking`. Nie wysyłaj żadnego klucza w czacie ani w kodzie. Wszystkie wartości wpisz jako sekrety serwerowe Lovable.

## Kolejność uruchomienia

1. Wykonaj migrację `20260914_production_shipping.sql` w Supabase.
2. Dodaj sekrety `INPOST_STAGE_*` z `.env.example` i pozostaw `INPOST_MODE=stage`.
3. Utwórz testową przesyłkę, pobierz etykietę i sprawdź webhook.
4. Dodaj osobne sekrety `INPOST_LIVE_*`.
5. Ustaw `INPOST_MODE=live` i dopiero po końcowym teście ustaw `INPOST_LIVE_ENABLED=true`.

Pozostali przewoźnicy nadal używają numeru przesyłki wpisywanego ręcznie. Ich etykiety wymagają oddzielnych umów i integracji API.
