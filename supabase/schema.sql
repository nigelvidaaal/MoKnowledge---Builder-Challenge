-- MoKnowledge: Supabase
-- Every save writes an immutable JSONB snapshot to knowledge_versions; companies point at the
-- live one. Searchable values are pulled into real columns. RLS limits rows to org members.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Accounts
-- ---------------------------------------------------------------------------
-- A MoFlo customer account; the top-level owner of data.
create table organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now()
);

-- Which users belong to which org, with a role. Read by is_member() / is_admin().
create table organization_members (
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  role            text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at      timestamptz not null default now(),
  primary key (organization_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Companies and their knowledge
-- ---------------------------------------------------------------------------
-- One business being tracked, pointing at its current knowledge version.
create table companies (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null references organizations(id) on delete cascade,
  domain             text not null,                       -- "beecavedrilling.com"
  name               text,
  current_version_id uuid,                                -- FK added below (circular reference)
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (organization_id, domain)
);

-- One row per scrape: status, timing, pages read, warnings.
create table scrape_runs (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references companies(id) on delete cascade,
  start_url     text not null,
  status        text not null default 'running' check (status in ('running', 'succeeded', 'failed')),
  pages_read    int not null default 0,
  warnings      jsonb not null default '[]',
  error         text,
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  created_by    uuid references auth.users(id)
);

-- Index of raw HTML in Supabase Storage, so extractors can re-run without re-crawling.
create table scraped_pages (
  id            uuid primary key default gen_random_uuid(),
  scrape_run_id uuid not null references scrape_runs(id) on delete cascade,
  url           text not null,
  http_status   int,
  content_hash  text,                                     -- skip unchanged pages on re-scrape
  storage_path  text,                                     -- e.g. "raw-html/<run>/<hash>.html"
  fetched_at    timestamptz not null default now()
);

-- Append-only JSONB snapshot per save; nothing is overwritten, so you can diff or roll back.
create table knowledge_versions (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references companies(id) on delete cascade,
  version        int not null,
  scrape_run_id  uuid references scrape_runs(id) on delete set null,
  status         text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  data           jsonb not null,                          -- the full KnowledgeBase JSON (see src/types/knowledge.ts)
  completeness   int not null check (completeness between 0 and 100),
  change_note    text,                                    -- "Re-scraped", "Edited pitch", "AI fill (mock)"
  created_by     uuid references auth.users(id),
  created_at     timestamptz not null default now(),
  -- Pulled out of JSONB for filtering and sorting in the library view.
  industry       text generated always as (data #>> '{foundation,industry}') stored,
  search         tsvector generated always as (
                   to_tsvector('english',
                     coalesce(data #>> '{foundation,name}', '') || ' ' ||
                     coalesce(data #>> '{foundation,overview}', '') || ' ' ||
                     coalesce(data #>> '{foundation,industry}', ''))
                 ) stored,
  unique (company_id, version)
);

alter table companies
  add constraint companies_current_version_fk
  foreign key (current_version_id) references knowledge_versions(id) on delete set null;

-- Who or what set each field and when: a queryable copy of the JSON's sources map.
create table field_provenance (
  version_id   uuid not null references knowledge_versions(id) on delete cascade,
  field_path   text not null,                             -- "foundation.yearFounded"
  method       text not null check (method in ('json-ld','meta','html','pattern','css','derived','ai_mock','llm','user')),
  confidence   text not null check (confidence in ('high','medium','low')),
  source_url   text,
  primary key (version_id, field_path)
);

create index on companies (organization_id);
create index on scrape_runs (company_id, started_at desc);
create index on knowledge_versions (company_id, version desc);
create index on knowledge_versions using gin (search);
create index on knowledge_versions using gin (data jsonb_path_ops);

-- Next version number for a company, used when saving.
create or replace function next_knowledge_version(p_company uuid)
returns int language sql stable as $$
  select coalesce(max(version), 0) + 1 from knowledge_versions where company_id = p_company;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
-- True if the current user belongs to the org (used by most policies).
create or replace function is_member(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from organization_members
    where organization_id = p_org and user_id = auth.uid()
  );
$$;

-- True if the current user is an org admin (deletes, members, version status).
create or replace function is_admin(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from organization_members
    where organization_id = p_org and user_id = auth.uid() and role in ('owner', 'admin')
  );
$$;

alter table organizations        enable row level security;
alter table organization_members enable row level security;
alter table companies            enable row level security;
alter table scrape_runs          enable row level security;
alter table scraped_pages        enable row level security;
alter table knowledge_versions   enable row level security;
alter table field_provenance     enable row level security;

create policy "members read their org" on organizations
  for select using (is_member(id));

create policy "members see their teammates" on organization_members
  for select using (is_member(organization_id));
create policy "admins manage members" on organization_members
  for all using (is_admin(organization_id)) with check (is_admin(organization_id));

create policy "members read companies" on companies
  for select using (is_member(organization_id));
create policy "members add and edit companies" on companies
  for insert with check (is_member(organization_id));
create policy "members update companies" on companies
  for update using (is_member(organization_id)) with check (is_member(organization_id));
create policy "admins delete companies" on companies
  for delete using (is_admin(organization_id));

create policy "members read scrape runs" on scrape_runs
  for select using (is_member((select organization_id from companies c where c.id = company_id)));
create policy "members start scrape runs" on scrape_runs
  for insert with check (is_member((select organization_id from companies c where c.id = company_id)));

create policy "members read scraped pages" on scraped_pages
  for select using (is_member((
    select c.organization_id from scrape_runs r join companies c on c.id = r.company_id where r.id = scrape_run_id
  )));

-- Versions are append-only; only status may change (draft -> published -> archived).
create policy "members read versions" on knowledge_versions
  for select using (is_member((select organization_id from companies c where c.id = company_id)));
create policy "members add versions" on knowledge_versions
  for insert with check (is_member((select organization_id from companies c where c.id = company_id)));
create policy "admins change version status" on knowledge_versions
  for update using (is_admin((select organization_id from companies c where c.id = company_id)));

-- Enforce that at the database level: UPDATE is allowed on the status column only.
revoke update on knowledge_versions from authenticated;
grant update (status) on knowledge_versions to authenticated;

create policy "members read provenance" on field_provenance
  for select using (is_member((
    select c.organization_id from knowledge_versions v join companies c on c.id = v.company_id where v.id = version_id
  )));
create policy "members add provenance" on field_provenance
  for insert with check (is_member((
    select c.organization_id from knowledge_versions v join companies c on c.id = v.company_id where v.id = version_id
  )));

-- The scraper uses the service role key server-side (bypasses RLS); it never reaches the browser.
