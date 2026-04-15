-- Chat inquiries from chatbot
create table public.chat_inquiries (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  phone text not null,
  message text,
  created_at timestamptz default now()
);

alter table public.chat_inquiries enable row level security;

-- Only admins can read inquiries
create policy "Admins can view inquiries" on public.chat_inquiries
  for select using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Anyone can submit an inquiry
create policy "Anyone can submit inquiry" on public.chat_inquiries
  for insert with check (true);
