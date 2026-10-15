-- ============================================================
-- SlotSathi Recover — PostgreSQL / Supabase Schema Definition
-- Mobile-First Appointment Recovery for Independent Tutors
-- ============================================================

-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "btree_gist";

-- 1. Providers
create table if not exists public.providers (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  title text not null,
  bio text,
  email text not null unique,
  phone text not null,
  whatsapp_number text not null,
  avatar_url text,
  slug text not null unique,
  location text default 'Online / Bengaluru',
  timezone text default 'Asia/Kolkata',
  created_at timestamptz default now()
);

-- 2. Services
create table if not exists public.services (
  id uuid primary key default uuid_generate_v4(),
  provider_id uuid not null references public.providers(id) on delete cascade,
  title text not null,
  subject text not null,
  duration_minutes integer not null default 60,
  price_inr integer not null default 1200,
  color text default '#4F46E5',
  description text,
  created_at timestamptz default now()
);

-- 3. Appointments
create table if not exists public.appointments (
  id uuid primary key default uuid_generate_v4(),
  provider_id uuid not null references public.providers(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete restrict,
  customer_name text not null,
  customer_email text not null,
  customer_phone text not null,
  start_time timestamptz not null,
  end_time timestamptz not null,
  price_inr integer not null,
  status text not null default 'confirmed' check (status in ('confirmed', 'cancelled', 'completed', 'no_show')),
  cancellation_token text not null unique default encode(gen_random_bytes(24), 'hex'),
  cancelled_at timestamptz,
  cancellation_reason text,
  is_replacement boolean not null default false,
  recovered_from_appointment_id uuid references public.appointments(id) on delete set null,
  recovered_at timestamptz,
  is_demo_seed boolean not null default false,
  created_at timestamptz default now(),
  constraint check_end_after_start check (end_time > start_time)
);

-- Database-enforced Overlap Prevention using GiST Exclusion Constraint
-- Prevents any concurrent transactions from inserting overlapping confirmed bookings
-- Uses explicit '[)' half-open bounds to ensure adjacent non-overlapping bookings (e.g., 10:00-11:00 and 11:00-12:00) are permitted
alter table public.appointments drop constraint if exists no_overlapping_confirmed_appointments;
alter table public.appointments
  add constraint no_overlapping_confirmed_appointments
  exclude using gist (
    provider_id with =,
    tstzrange(start_time, end_time, '[)') with &&
  )
  where (status = 'confirmed');

-- Invariant: Exactly one confirmed replacement appointment per original cancelled appointment
create unique index if not exists idx_unique_replacement_per_original
  on public.appointments(recovered_from_appointment_id)
  where (is_replacement = true and status = 'confirmed');

create index if not exists idx_appointments_cancellation_token 
  on public.appointments(cancellation_token);

-- 4. Waitlist Entries
create table if not exists public.waitlist_entries (
  id uuid primary key default uuid_generate_v4(),
  provider_id uuid not null references public.providers(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  customer_name text not null,
  customer_email text not null,
  customer_phone text not null,
  preferred_days text[] default array['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'],
  preferred_time_windows text[] default array['afternoon','evening'], -- 'morning', 'afternoon', 'evening'
  duration_minutes integer not null default 60,
  urgency text not null default 'normal' check (urgency in ('normal', 'high')),
  status text not null default 'waiting' check (status in ('waiting', 'offered', 'matched', 'inactive')),
  notes text,
  is_demo_seed boolean not null default false,
  created_at timestamptz default now()
);

create index if not exists idx_waitlist_provider_status 
  on public.waitlist_entries(provider_id, status);

-- 5. Recovery Offers
create table if not exists public.recovery_offers (
  id uuid primary key default uuid_generate_v4(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  waitlist_entry_id uuid not null references public.waitlist_entries(id) on delete cascade,
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'expired', 'revoked')),
  expires_at timestamptz not null,
  sent_at timestamptz default now(),
  channel text not null default 'whatsapp',
  match_score integer not null default 100,
  match_reasons jsonb not null default '[]'::jsonb,
  whatsapp_url text,
  accepted_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists idx_recovery_offers_token 
  on public.recovery_offers(token);

-- ============================================================
-- 6. Row-Level Security (RLS) & Access Hardening
-- ============================================================

alter table public.providers enable row level security;
alter table public.services enable row level security;
alter table public.appointments enable row level security;
alter table public.waitlist_entries enable row level security;
alter table public.recovery_offers enable row level security;

-- Drop legacy/insecure policies
drop policy if exists "Public providers read" on public.providers;
drop policy if exists "Public services read" on public.services;
drop policy if exists "Public appointments insert" on public.appointments;
drop policy if exists "Public appointment read by token" on public.appointments;
drop policy if exists "Public appointment update by token" on public.appointments;
drop policy if exists "Public waitlist insert" on public.waitlist_entries;
drop policy if exists "Public offer read by token" on public.recovery_offers;

-- Providers: Public can view basic profiles; provider can update own profile
create policy "Public providers read"
  on public.providers for select
  to anon, authenticated
  using (true);

create policy "Provider update own profile"
  on public.providers for update
  to authenticated
  using (auth.uid() = id);

-- Services: Public can view services; provider can manage own services
create policy "Public services read"
  on public.services for select
  to anon, authenticated
  using (true);

create policy "Provider manage own services"
  on public.services for all
  to authenticated
  using (auth.uid() = provider_id)
  with check (auth.uid() = provider_id);

-- Appointments:
-- 1. Public can create a confirmed non-replacement booking
create policy "Public appointments insert"
  on public.appointments for insert
  to anon, authenticated
  with check (status = 'confirmed' and is_replacement = false);

-- 2. Authenticated provider has full access to their own appointments
create policy "Provider own appointments access"
  on public.appointments for all
  to authenticated
  using (auth.uid() = provider_id)
  with check (auth.uid() = provider_id);

-- Waitlist Entries:
-- 1. Public can submit waitlist entries
create policy "Public waitlist insert"
  on public.waitlist_entries for insert
  to anon, authenticated
  with check (status = 'waiting');

-- 2. Only authenticated provider can view or manage their waitlist entries
create policy "Provider own waitlist access"
  on public.waitlist_entries for all
  to authenticated
  using (auth.uid() = provider_id)
  with check (auth.uid() = provider_id);

-- Recovery Offers:
-- 1. Authenticated provider can view/manage recovery offers for their appointments
create policy "Provider own recovery offers access"
  on public.recovery_offers for all
  to authenticated
  using (
    exists (
      select 1 from public.appointments a 
      where a.id = recovery_offers.appointment_id 
        and a.provider_id = auth.uid()
    )
  );

-- ============================================================
-- Security Definer Helper: Public Slot Availability (Zero PII)
-- ============================================================
create or replace function public.get_public_slot_availability(p_provider_id uuid)
returns table (start_time timestamptz, end_time timestamptz)
language sql
security definer
set search_path = public, pg_temp
as $$
  select start_time, end_time
  from public.appointments
  where provider_id = p_provider_id
    and status = 'confirmed';
$$;

-- ============================================================
-- 7. Atomic Stored Procedure: Accept Recovery Offer
-- ============================================================

create or replace function public.accept_recovery_offer_atomic(
  p_offer_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_offer record;
  v_original_appt record;
  v_waitlist record;
  v_conflict_count integer;
  v_existing_repl_count integer;
  v_replacement_appt_id uuid;
begin
  -- 1. Lock and retrieve the offer
  select * into v_offer
  from public.recovery_offers
  where token = p_offer_token
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Invalid recovery offer token');
  end if;

  if v_offer.status != 'pending' then
    return jsonb_build_object('success', false, 'error', 'Offer has already been processed or claimed');
  end if;

  if now() > v_offer.expires_at then
    update public.recovery_offers set status = 'expired' where id = v_offer.id;
    return jsonb_build_object('success', false, 'error', 'This recovery offer has expired');
  end if;

  -- 2. Lock original cancelled appointment
  select * into v_original_appt
  from public.appointments
  where id = v_offer.appointment_id
  for update;

  if not found or v_original_appt.status != 'cancelled' then
    return jsonb_build_object('success', false, 'error', 'Original appointment is not in cancelled state');
  end if;

  -- 3. Invariant Check: Verify no replacement has ALREADY been confirmed for this slot
  select count(*) into v_existing_repl_count
  from public.appointments
  where recovered_from_appointment_id = v_original_appt.id and status = 'confirmed';

  if v_existing_repl_count > 0 then
    update public.recovery_offers set status = 'revoked' where id = v_offer.id;
    return jsonb_build_object('success', false, 'error', 'This slot has already been refilled by another replacement');
  end if;

  -- 4. Check for any overlapping active confirmed appointment (double-booking protection)
  select count(*) into v_conflict_count
  from public.appointments
  where provider_id = v_original_appt.provider_id
    and status = 'confirmed'
    and (start_time, end_time) overlaps (v_original_appt.start_time, v_original_appt.end_time);

  if v_conflict_count > 0 then
    return jsonb_build_object('success', false, 'error', 'Slot conflicts with an existing confirmed appointment');
  end if;

  -- 5. Get waitlist customer details
  select * into v_waitlist
  from public.waitlist_entries
  where id = v_offer.waitlist_entry_id;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Waitlist candidate record not found');
  end if;

  -- 6. Insert separate replacement appointment
  insert into public.appointments (
    provider_id,
    service_id,
    customer_name,
    customer_email,
    customer_phone,
    start_time,
    end_time,
    price_inr,
    status,
    is_replacement,
    recovered_from_appointment_id,
    recovered_at,
    is_demo_seed
  ) values (
    v_original_appt.provider_id,
    v_original_appt.service_id,
    v_waitlist.customer_name,
    v_waitlist.customer_email,
    v_waitlist.customer_phone,
    v_original_appt.start_time,
    v_original_appt.end_time,
    v_original_appt.price_inr,
    'confirmed',
    true,
    v_original_appt.id,
    now(),
    false
  ) returning id into v_replacement_appt_id;

  -- 7. Mark offer accepted
  update public.recovery_offers
  set status = 'accepted', accepted_at = now()
  where id = v_offer.id;

  -- 8. Revoke any competing offers for this slot
  update public.recovery_offers
  set status = 'revoked'
  where appointment_id = v_original_appt.id and id != v_offer.id and status = 'pending';

  -- 9. Mark waitlist entry matched
  update public.waitlist_entries
  set status = 'matched'
  where id = v_waitlist.id;

  return jsonb_build_object(
    'success', true,
    'replacement_appointment_id', v_replacement_appt_id,
    'recovered_at', now(),
    'customer_name', v_waitlist.customer_name,
    'start_time', v_original_appt.start_time,
    'end_time', v_original_appt.end_time,
    'price_inr', v_original_appt.price_inr
  );
end;
$$;
