-- DocuChat demo seed rows.
--
-- NOTE: these are documents-table rows ONLY. Chunk rows are intentionally NOT
-- seeded because their `embedding vector(1536)` values can only be produced by
-- calling the OpenAI embeddings API at ingest time (see POST /api/documents).
-- Committing fake vectors would misrepresent how the retrieval works.
--
-- To use: replace '00000000-0000-0000-0000-000000000000' with your real
-- auth.users id (sign up in the app first, then copy the id from
-- Authentication > Users in the Supabase dashboard), then run in the SQL editor.

insert into documents (user_id, filename, char_count, chunk_count, status)
values
  ('00000000-0000-0000-0000-000000000000', 'demo-getting-started.txt', 1240, 2, 'ready'),
  ('00000000-0000-0000-0000-000000000000', 'demo-faq.txt', 980, 1, 'ready')
on conflict do nothing;
