alter table items
  add column if not exists revenue numeric default 0;
