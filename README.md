# Med Link

## Development

```bash
npm install
npm run server
npm run dev
```

## Supabase setup

1. Copy `.env.example` to `.env` and fill:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_API_URL`
- `VITE_SOCKET_URL`
- `VITE_ADMIN_EMAILS`

2. Copy `server/.env.example` to `server/.env` and fill:
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CLIENT_URL`
- `ADMIN_EMAILS`

3. In Supabase SQL Editor run:
- `supabase/schema.sql`

4. Insert doctors data in table `public.doctors`.

Required columns:
- `id` (text, primary key)
- `name` (text)
- `specialty` (text)
- `city` (text)
- `clinic_id` (text)
- `clinic_name` (text)
- `online` (boolean)
- `bio` (text)
- `services` (jsonb array)
- `slots` (jsonb array)

Example row:

```json
{
  "id": "1",
  "name": "Д-р Иван Петров",
  "specialty": "Кардиология",
  "city": "София",
  "clinic_id": "mc-heart-plus",
  "clinic_name": "МЦ Сърце+",
  "online": true,
  "bio": "Специалист...",
  "services": ["Кардиологичен преглед", "ЕКГ", "Ехокардиография"],
  "slots": ["09:00", "09:30", "10:00"]
}
```

## New modules

- `Socket.IO chat`: route `/chat`, realtime нишки между пациент и admin/support.
- `Admin dashboard`: route `/admin`, Mermaid KPI диаграми за appointments, subscriptions и chat activity.
- `Stripe billing`: Checkout през `/checkout`, webhook sync към `public.subscriptions`, billing portal от профила.

## Stripe webhook setup

1. In Stripe Dashboard create a webhook endpoint to:
- `http://localhost:4242/api/stripe/webhook`

2. Select these events:
- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

3. Copy the generated secret to:
- `server/.env` -> `STRIPE_WEBHOOK_SECRET`

4. Start both apps:
- `npm run server`
- `npm run dev`

## Fallback behavior

If Supabase env vars are missing or request fails, the doctors pages still use local demo data from `src/data/doctorsData.js`. Chat and admin analytics need the backend plus the new schema tables from `supabase/schema.sql`.
