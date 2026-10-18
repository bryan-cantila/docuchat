-- DocuChat schema: documents + pgvector chunks for RAG retrieval.
-- Run this in the Supabase SQL editor (or via the Supabase CLI).

-- 1. pgvector extension for embeddings (text-embedding-3-small = 1536 dims)
create extension if not exists vector;

-- 2. Uploaded documents (one row per file)
create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  filename text not null,
  char_count int not null default 0,
  chunk_count int not null default 0,
  status text not null default 'ready',
  created_at timestamptz not null default now()
);

-- 3. Text chunks with embeddings (one row per chunk)
create table if not exists document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents (id) on delete cascade,
  user_id uuid references auth.users (id) on delete cascade,
  chunk_index int not null,
  content text not null,
  embedding vector(1536)
);

-- 4. Fast cosine-similarity search over chunk embeddings
create index if not exists document_chunks_embedding_hnsw
  on document_chunks using hnsw (embedding vector_cosine_ops);

create index if not exists documents_user_id_idx on documents (user_id);
create index if not exists document_chunks_document_id_idx on document_chunks (document_id);
create index if not exists document_chunks_user_id_idx on document_chunks (user_id);

-- 5. Retrieval function: top-K chunks for a user, ordered by similarity (0..1)
create or replace function match_documents(
  query_embedding vector(1536),
  match_user uuid,
  match_count int default 6
)
returns table (
  chunk_id uuid,
  document_id uuid,
  filename text,
  content text,
  similarity float
)
language sql stable
as $$
  select
    c.id as chunk_id,
    c.document_id,
    d.filename,
    c.content,
    1 - (c.embedding <=> query_embedding) as similarity
  from document_chunks c
  join documents d on d.id = c.document_id
  where c.user_id = match_user
    and c.embedding is not null
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

-- 6. Row Level Security: users only ever see their own rows.
-- The API routes use the SERVICE ROLE key (server-side only) which bypasses
-- RLS, but every query is explicitly filtered by the authenticated user's id,
-- so the RLS policies below are a second line of defense for direct client use.
alter table documents enable row level security;
alter table document_chunks enable row level security;

drop policy if exists documents_owner on documents;
create policy documents_owner on documents
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists document_chunks_owner on document_chunks;
create policy document_chunks_owner on document_chunks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
