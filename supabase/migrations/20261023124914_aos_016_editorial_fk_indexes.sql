-- FK indexes keep staff offboarding and auth-user deletion bounded.
-- Each index covers one ON DELETE SET NULL reference.
create index editorial_weeks_created_by_idx
  on public.editorial_weeks(created_by);
create index editorial_weeks_updated_by_idx
  on public.editorial_weeks(updated_by);
create index editorial_weeks_published_by_idx
  on public.editorial_weeks(published_by);
