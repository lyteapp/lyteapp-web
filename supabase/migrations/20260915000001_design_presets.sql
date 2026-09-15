-- Named snapshots of a store's design/checkout so an owner can save one
-- from a store they like and apply it to other stores/sucursales on
-- demand, instead of an automatic copy tied to creating a sucursal.
create table if not exists design_presets (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null references auth.users(id) on delete cascade,
  name             text not null,
  template         text,
  template_config  jsonb,
  checkout_settings jsonb,
  payment_methods  jsonb,
  created_at       timestamptz not null default now()
);

create index if not exists idx_design_presets_owner on design_presets(owner_id);

alter table design_presets enable row level security;

create policy "owner select" on design_presets for select using (owner_id = auth.uid());
create policy "owner insert" on design_presets for insert with check (owner_id = auth.uid());
create policy "owner delete" on design_presets for delete using (owner_id = auth.uid());
