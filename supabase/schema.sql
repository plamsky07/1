create table if not exists public.doctors (
  id text primary key,
  name text not null,
  specialty text not null,
  city text not null,
  clinic_id text not null,
  clinic_name text not null,
  online boolean not null default false,
  bio text not null default '',
  services jsonb not null default '[]'::jsonb,
  slots jsonb not null default '[]'::jsonb
);

alter table public.doctors enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'doctors'
      and policyname = 'Public read doctors'
  ) then
    create policy "Public read doctors"
      on public.doctors
      for select
      to anon
      using (true);
  end if;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null default '',
  last_name text not null default '',
  phone text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create or replace function public.set_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_profiles_updated_at();

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'Users can read own profile'
  ) then
    create policy "Users can read own profile"
      on public.profiles
      for select
      to authenticated
      using (auth.uid() = id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'Users can insert own profile'
  ) then
    create policy "Users can insert own profile"
      on public.profiles
      for insert
      to authenticated
      with check (auth.uid() = id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'Users can update own profile'
  ) then
    create policy "Users can update own profile"
      on public.profiles
      for update
      to authenticated
      using (auth.uid() = id)
      with check (auth.uid() = id);
  end if;
end $$;

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, first_name, last_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'first_name', ''),
    coalesce(new.raw_user_meta_data ->> 'last_name', ''),
    coalesce(new.raw_user_meta_data ->> 'phone', '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row
execute function public.handle_new_user_profile();

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  doctor_id text not null,
  doctor_name text not null,
  specialty text not null,
  clinic_name text not null,
  appointment_date date not null,
  appointment_time text not null,
  service text not null,
  notes text not null default '',
  status text not null default 'booked',
  created_at timestamptz not null default now()
);

create index if not exists idx_appointments_user_id on public.appointments(user_id);
create index if not exists idx_appointments_date on public.appointments(appointment_date);

alter table public.appointments enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'appointments'
      and policyname = 'Users can read own appointments'
  ) then
    create policy "Users can read own appointments"
      on public.appointments
      for select
      to authenticated
      using (auth.uid() = user_id);
  end if;
end $$;

create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free',
  status text not null default 'inactive',
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at_timestamp()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists subscriptions_set_updated_at on public.subscriptions;
create trigger subscriptions_set_updated_at
before update on public.subscriptions
for each row
execute function public.set_updated_at_timestamp();

alter table public.subscriptions enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'subscriptions'
      and policyname = 'Users can read own subscriptions'
  ) then
    create policy "Users can read own subscriptions"
      on public.subscriptions
      for select
      to authenticated
      using (auth.uid() = user_id);
  end if;
end $$;

create table if not exists public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  subject text not null default 'Нова консултация',
  status text not null default 'open',
  priority text not null default 'normal',
  category text not null default 'support',
  created_by uuid not null references auth.users(id) on delete cascade,
  assigned_admin_id uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

create index if not exists idx_chat_threads_last_message_at
  on public.chat_threads(last_message_at desc);

drop trigger if exists chat_threads_set_updated_at on public.chat_threads;
create trigger chat_threads_set_updated_at
before update on public.chat_threads
for each row
execute function public.set_updated_at_timestamp();

alter table public.chat_threads enable row level security;

create table if not exists public.chat_participants (
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'patient',
  joined_at timestamptz not null default now(),
  primary key (thread_id, user_id)
);

create index if not exists idx_chat_participants_user_id
  on public.chat_participants(user_id);

alter table public.chat_participants enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'chat_participants'
      and policyname = 'Users can read own chat participants'
  ) then
    create policy "Users can read own chat participants"
      on public.chat_participants
      for select
      to authenticated
      using (
        auth.uid() = user_id
        or exists (
          select 1
          from public.chat_threads ct
          where ct.id = thread_id
            and ct.created_by = auth.uid()
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'chat_threads'
      and policyname = 'Users can read own chat threads'
  ) then
    create policy "Users can read own chat threads"
      on public.chat_threads
      for select
      to authenticated
      using (
        auth.uid() = created_by
        or exists (
          select 1
          from public.chat_participants cp
          where cp.thread_id = id
            and cp.user_id = auth.uid()
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'chat_threads'
      and policyname = 'Users can create own chat threads'
  ) then
    create policy "Users can create own chat threads"
      on public.chat_threads
      for insert
      to authenticated
      with check (auth.uid() = created_by);
  end if;
end $$;

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  sender_name text not null default '',
  sender_role text not null default 'patient',
  body text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_chat_messages_thread_id
  on public.chat_messages(thread_id, created_at asc);

alter table public.chat_messages enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'chat_messages'
      and policyname = 'Users can read own chat messages'
  ) then
    create policy "Users can read own chat messages"
      on public.chat_messages
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.chat_participants cp
          where cp.thread_id = thread_id
            and cp.user_id = auth.uid()
        )
        or exists (
          select 1
          from public.chat_threads ct
          where ct.id = thread_id
            and ct.created_by = auth.uid()
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'chat_messages'
      and policyname = 'Users can insert own chat messages'
  ) then
    create policy "Users can insert own chat messages"
      on public.chat_messages
      for insert
      to authenticated
      with check (
        auth.uid() = sender_id
        and (
          exists (
            select 1
            from public.chat_participants cp
            where cp.thread_id = thread_id
              and cp.user_id = auth.uid()
          )
          or exists (
            select 1
            from public.chat_threads ct
            where ct.id = thread_id
              and ct.created_by = auth.uid()
          )
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'appointments'
      and policyname = 'Users can insert own appointments'
  ) then
    create policy "Users can insert own appointments"
      on public.appointments
      for insert
      to authenticated
      with check (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'appointments'
      and policyname = 'Users can update own appointments'
  ) then
    create policy "Users can update own appointments"
      on public.appointments
      for update
      to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'appointments'
      and policyname = 'Users can delete own appointments'
  ) then
    create policy "Users can delete own appointments"
      on public.appointments
      for delete
      to authenticated
      using (auth.uid() = user_id);
  end if;
end $$;
