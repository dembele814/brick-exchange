-- Live inbox updates for authenticated conversation participants.
-- The block is idempotent: Supabase may already have these tables in its publication.
do $$
begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.conversation_participants;
exception when duplicate_object then null;
end $$;
