alter table items
  add column if not exists leads integer default 0;
