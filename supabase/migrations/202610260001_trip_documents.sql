create table if not exists public.trip_documents (
  user_id uuid primary key references auth.users(id) on delete cascade,
  document jsonb not null,
  revision integer not null default 1 check (revision > 0),
  updated_at timestamptz not null default now()
);

alter table public.trip_documents enable row level security;

create policy "Users can read their own trip"
on public.trip_documents for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create their own trip"
on public.trip_documents for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their own trip"
on public.trip_documents for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete their own trip"
on public.trip_documents for delete
to authenticated
using ((select auth.uid()) = user_id);

create or replace function public.touch_trip_document_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_trip_document_updated_at on public.trip_documents;
create trigger touch_trip_document_updated_at
before update on public.trip_documents
for each row execute function public.touch_trip_document_updated_at();

alter publication supabase_realtime add table public.trip_documents;


