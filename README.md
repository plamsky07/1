# Med Link

## Development

```bash
npm install
npm run dev
```

## Supabase setup

1. Copy `.env.example` to `.env` and fill:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

2. In Supabase SQL Editor run:
- `supabase/schema.sql`

3. Insert doctors data in table `public.doctors`.

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

## Fallback behavior

If Supabase env vars are missing or request fails, the app uses local demo data from `src/data/doctorsData.js`.
