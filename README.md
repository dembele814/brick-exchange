# Klockogram

stwórz nowoczesną aplikację webową marketplace poświęconą wyłącznie produktom LEGO. Design zainspirowany prostotą i użytecznością Vinted, ale bez kopiowania brandingu, grafiki czy zastrzeżonych elementów.

This project was built with [Lovable](https://lovable.dev).

## Payments and seller payouts

See [the Stripe integration plan, review, and setup instructions](docs/stripe-integration-review.md).
Checkout is opt-in and test-only until Connect and production money operations
are implemented. Apply the payment-safety migration before enabling test payments.
Run `npm run test:payments` with Node 24 for local payment and database tests that
do not require API keys.

Production InPost labels and tracking are described in
[the InPost activation guide](docs/inpost-production.md).

For the complete local test suite, run `npm test`. Use `npm run lint` to check
the source code and `npm run build` to verify the production build.

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/2af864e3-7f9a-4bc9-aded-174a3621b839).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
