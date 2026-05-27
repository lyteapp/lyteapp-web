alter table delivery_drivers
  add column if not exists vehicle text,
  add column if not exists rating numeric default 5.0;
