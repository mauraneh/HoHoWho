-- Migration + Row Level Security tests.
-- Run with scripts/test-db.sh against a throwaway PostgreSQL database
-- (supabase_stub.sql and the migrations are applied first).
\set ON_ERROR_STOP 1
\o /dev/null

create schema tests;
grant usage on schema tests to anon, authenticated, service_role;

create function tests.assert(condition boolean, message text) returns void language plpgsql as $$
begin
  if condition is distinct from true then
    raise exception 'ASSERTION FAILED: %', message;
  end if;
end;
$$;

-- Runs a statement and asserts that it fails (permission error, RLS violation or raised exception).
create function tests.expect_error(statement text, message text) returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when others then
    raise notice 'ok (expected error) %: %', message, sqlerrm;
    return;
  end;
  raise exception 'EXPECTED ERROR: % (statement succeeded: %)', message, statement;
end;
$$;

-- Runs a statement and returns the number of affected rows.
create function tests.affected(statement text) returns integer language plpgsql as $$
declare
  n integer;
begin
  execute statement;
  get diagnostics n = row_count;
  return n;
end;
$$;

grant execute on all functions in schema tests to anon, authenticated, service_role;

create table tests.ctx (key text primary key, value text);
grant all on tests.ctx to anon, authenticated, service_role;

-- Users -------------------------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'alice@example.com', '{"display_name":"Alice"}'),
  ('00000000-0000-0000-0000-00000000000b', 'bob@example.com', '{"display_name":"Bob"}'),
  ('00000000-0000-0000-0000-00000000000c', 'carol@example.com', '{}'),
  ('00000000-0000-0000-0000-00000000000d', 'dave@example.com', '{"display_name":"Dave"}'),
  ('00000000-0000-0000-0000-00000000000e', 'eve@example.com', '{"display_name":"Eve"}');

select tests.assert((select count(*) from public.profiles) = 5, 'profiles created by trigger');
select tests.assert((select display_name from public.profiles
                     where id = '00000000-0000-0000-0000-00000000000c') = 'carol',
                    'display name falls back to e-mail local part');

-- Anonymous users get nothing ---------------------------------------------------------------------
set role anon;
select tests.expect_error('select * from public.events', 'anon cannot read events');
select tests.expect_error($$select public.create_event('x')$$, 'anon cannot create events');
reset role;

-- Alice creates an event ----------------------------------------------------------------------------
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
insert into tests.ctx values ('event', public.create_event('Family Christmas', 'Cosy evening', '2026-12-24', 20, 40, 'eur')::text);
select tests.assert((select count(*) from public.events) = 1, 'owner sees the event');
select tests.assert((select currency from public.events) = 'EUR', 'currency is normalised');
select tests.assert((select count(*) from public.participants) = 1, 'owner is a participant');
select tests.expect_error($$insert into public.events (owner_id, name) values (auth.uid(), 'Direct')$$,
                          'events cannot be inserted directly');
select tests.expect_error($$update public.events set status = 'drawn'$$, 'status cannot be updated by clients');
select tests.assert(tests.affected($$update public.events set budget_max = 50$$) = 1, 'owner updates budget');
select tests.expect_error($$select public.create_event('')$$, 'empty event name rejected');

insert into tests.ctx select 'token', token from public.create_invitation((select value::uuid from tests.ctx where key = 'event'));
select tests.assert((select count(*) from public.invitations) = 1, 'owner sees the invitation');
select tests.assert((select length(value) from tests.ctx where key = 'token') = 64, 'token has 64 hex chars');
select tests.assert((select token_hash from public.invitations) = sha256(convert_to((select value from tests.ctx where key = 'token'), 'UTF8')),
                    'only the token hash is stored');

-- Anonymous visitors with the link can preview the invitation, but not join -----------------------
reset role;
set role anon;
select tests.assert((select event_name from public.preview_invitation((select value from tests.ctx where key = 'token'))) = 'Family Christmas',
                    'anonymous invitation preview');
select tests.expect_error($$select public.accept_invitation((select value from tests.ctx where key = 'token'))$$,
                          'anonymous visitors cannot join');
select tests.expect_error($$select * from public.preview_invitation('wrong')$$, 'wrong token rejected for anon');
reset role;
set role authenticated;

-- Eve (outsider) sees nothing and cannot use a bad token -----------------------------------------
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000e';
select tests.assert((select count(*) from public.events) = 0, 'outsider cannot read the event');
select tests.assert((select count(*) from public.participants) = 0, 'outsider cannot read participants');
select tests.assert((select count(*) from public.invitations) = 0, 'outsider cannot read invitations');
select tests.expect_error($$select public.accept_invitation('not-a-token')$$, 'invalid token rejected');
select tests.expect_error($$select public.create_invitation((select value::uuid from tests.ctx where key = 'event'))$$,
                          'outsider cannot create invitations');
select tests.expect_error($$insert into public.participants (event_id, user_id, display_name)
                           values ((select value::uuid from tests.ctx where key = 'event'), auth.uid(), 'Eve')$$,
                          'participants cannot be inserted directly');

-- Bob, Carol and Dave join with the invitation ------------------------------------------------------
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select tests.assert((select event_name from public.preview_invitation((select value from tests.ctx where key = 'token'))) = 'Family Christmas',
                    'invitation preview');
select tests.assert(public.accept_invitation((select value from tests.ctx where key = 'token')) = (select value::uuid from tests.ctx where key = 'event'),
                    'bob joins');
select tests.assert(public.accept_invitation((select value from tests.ctx where key = 'token')) is not null, 'joining twice is idempotent');
select tests.expect_error($$select public.create_invitation((select value::uuid from tests.ctx where key = 'event'))$$,
                          'non-owner cannot create invitations');
select tests.assert((select count(*) from public.invitations) = 0, 'non-owner cannot read invitations');
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select public.accept_invitation((select value from tests.ctx where key = 'token'));
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
select public.accept_invitation((select value from tests.ctx where key = 'token'));
select tests.assert((select count(*) from public.participants) = 4, 'members see all participants');
select tests.assert(tests.affected($$delete from public.participants where display_name = 'Alice'$$) = 0,
                    'participants cannot remove the owner');
select tests.assert(tests.affected($$delete from public.participants where display_name = 'Bob'$$) = 0,
                    'participants cannot remove others');
select tests.assert(tests.affected($$update public.events set name = 'Hijacked'$$) = 0, 'non-owner cannot update the event');
select tests.assert(tests.affected($$delete from public.events$$) = 0, 'non-owner cannot delete the event');
reset role;

insert into tests.ctx select lower(display_name), id::text from public.participants;

-- Phases: exclusions are only possible once the list is closed ---------------------------------
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select tests.expect_error($$select public.submit_exclusions((select value::uuid from tests.ctx where key = 'event'), '{}')$$,
                          'no exclusions while the list is open');
select tests.expect_error($$select public.close_registrations((select value::uuid from tests.ctx where key = 'event'))$$,
                          'only the organiser closes the list');
select tests.expect_error($$select * from public.participant_emails((select value::uuid from tests.ctx where key = 'event'))$$,
                          'only the organiser sees e-mail addresses');
select tests.expect_error($$insert into public.exclusions (event_id, giver_id, excluded_id)
                           values ((select value::uuid from tests.ctx where key = 'event'),
                                   (select value::uuid from tests.ctx where key = 'bob'),
                                   (select value::uuid from tests.ctx where key = 'alice'))$$,
                          'exclusions cannot be written directly');
select tests.expect_error($$update public.participants set exclusions_confirmed_at = now()$$,
                          'progress flags cannot be faked');
select tests.expect_error($$select public.apply_draw((select value::uuid from tests.ctx where key = 'event'), '[]')$$,
                          'clients cannot apply a draw');
select tests.expect_error($$insert into public.assignments (event_id, giver_id, receiver_id)
                           values ((select value::uuid from tests.ctx where key = 'event'),
                                   (select value::uuid from tests.ctx where key = 'bob'),
                                   (select value::uuid from tests.ctx where key = 'alice'))$$,
                          'clients cannot write assignments');

-- Questionnaire and wishlist before the draw: private to their author --------------------------
insert into public.questionnaires (participant_id, interests, gift_styles, avoid, notes)
values ((select value::uuid from tests.ctx where key = 'bob'), '{coffee,books}', '{practical}', '{alcohol}', 'Loves blue');
insert into public.wishlist_items (participant_id, title, url, price)
values ((select value::uuid from tests.ctx where key = 'bob'), 'Pour-over kettle', 'https://example.com/kettle', 35);
select tests.expect_error($$insert into public.wishlist_items (participant_id, title, url)
                           values ((select value::uuid from tests.ctx where key = 'bob'), 'Bad', 'javascript:alert(1)')$$,
                          'non-http wishlist URL rejected');
select tests.expect_error($$insert into public.wishlist_items (participant_id, title)
                           values ((select value::uuid from tests.ctx where key = 'carol'), 'Not mine')$$,
                          'cannot add to someone else''s wishlist');
select tests.assert(tests.affected($$update public.questionnaires set notes = 'Updated'$$) = 1, 'author updates questionnaire');
select tests.assert((select profile_completed_at is not null from public.participants where display_name = 'Bob'),
                    'saving the questionnaire marks the wishes as completed');
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select tests.assert((select count(*) from public.questionnaires) = 0, 'questionnaire private before draw');
select tests.assert((select count(*) from public.wishlist_items) = 0, 'wishlist private before draw');
select tests.expect_error($$insert into public.messages (event_id, receiver_id, from_santa, body)
                           values ((select value::uuid from tests.ctx where key = 'event'),
                                   (select value::uuid from tests.ctx where key = 'bob'), true, 'Hi')$$,
                          'no messages before the draw');
reset role;

-- Draw cannot happen while the list is open --------------------------------------------------------
set role service_role;
select tests.expect_error($$select public.apply_draw((select value::uuid from tests.ctx where key = 'event'), '[]')$$,
                          'draw requires a closed list');
reset role;

-- Organiser closes the list; everyone chooses exclusions -------------------------------------------
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select public.close_registrations((select value::uuid from tests.ctx where key = 'event'));
select tests.assert((select status from public.events) = 'exclusions', 'list closed');
select tests.assert((select count(*) from public.participant_emails((select value::uuid from tests.ctx where key = 'event'))) = 4,
                    'organiser sees participant e-mails');
select tests.expect_error($$select public.close_registrations((select value::uuid from tests.ctx where key = 'event'))$$,
                          'closing twice rejected');

set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000e';
select tests.expect_error($$select * from public.preview_invitation((select value from tests.ctx where key = 'token'))$$,
                          'invitation unusable once the list is closed');
select tests.expect_error($$select public.submit_exclusions((select value::uuid from tests.ctx where key = 'event'), '{}')$$,
                          'outsider cannot submit exclusions');

set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select tests.expect_error(format($$select public.submit_exclusions(%L, %L)$$,
  (select value from tests.ctx where key = 'event'),
  array[(select value from tests.ctx where key = 'bob')]::text),
  'cannot exclude yourself');
select tests.expect_error(format($$select public.submit_exclusions(%L, %L)$$,
  (select value from tests.ctx where key = 'event'),
  array[(select value from tests.ctx where key = 'alice'), (select value from tests.ctx where key = 'carol'),
        (select value from tests.ctx where key = 'dave')]::text),
  'must leave at least one possible giftee');
select tests.assert(public.submit_exclusions((select value::uuid from tests.ctx where key = 'event'),
                                             array[(select value::uuid from tests.ctx where key = 'carol')]) = false,
                    'bob validates; others still pending');
select tests.assert((select count(*) from public.exclusions) = 1, 'bob reads his exclusion');

set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select tests.assert((select count(*) from public.exclusions) = 0, 'exclusions are private, even to the organiser');
select public.reopen_registrations((select value::uuid from tests.ctx where key = 'event'));
select tests.assert((select status from public.events) = 'open', 'list reopened');
select tests.assert((select count(*) from public.participants where exclusions_confirmed_at is not null) = 0,
                    'reopening resets validations');
select public.close_registrations((select value::uuid from tests.ctx where key = 'event'));
select tests.assert(public.submit_exclusions((select value::uuid from tests.ctx where key = 'event'), '{}') = false,
                    'alice validates');

set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select tests.assert((select count(*) from public.exclusions) = 0, 'reopening cleared bob''s exclusions');
select public.submit_exclusions((select value::uuid from tests.ctx where key = 'event'),
                                array[(select value::uuid from tests.ctx where key = 'carol')]);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select public.submit_exclusions((select value::uuid from tests.ctx where key = 'event'), '{}');
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
select tests.assert(public.submit_exclusions((select value::uuid from tests.ctx where key = 'event'), null) = true,
                    'last validation reports everyone is ready');
reset role;

-- Draw (service role) ----------------------------------------------------------------------------
set role service_role;
select tests.expect_error(format($$select public.apply_draw(%L, %L)$$,
  (select value from tests.ctx where key = 'event'),
  jsonb_build_array(
    jsonb_build_object('giverId', (select value from tests.ctx where key = 'alice'), 'receiverId', (select value from tests.ctx where key = 'alice')),
    jsonb_build_object('giverId', (select value from tests.ctx where key = 'bob'), 'receiverId', (select value from tests.ctx where key = 'dave')),
    jsonb_build_object('giverId', (select value from tests.ctx where key = 'dave'), 'receiverId', (select value from tests.ctx where key = 'carol')),
    jsonb_build_object('giverId', (select value from tests.ctx where key = 'carol'), 'receiverId', (select value from tests.ctx where key = 'bob')))),
  'self-assignment rejected');
select tests.expect_error(format($$select public.apply_draw(%L, %L)$$,
  (select value from tests.ctx where key = 'event'),
  jsonb_build_array(
    jsonb_build_object('giverId', (select value from tests.ctx where key = 'alice'), 'receiverId', (select value from tests.ctx where key = 'dave')),
    jsonb_build_object('giverId', (select value from tests.ctx where key = 'bob'), 'receiverId', (select value from tests.ctx where key = 'carol')),
    jsonb_build_object('giverId', (select value from tests.ctx where key = 'dave'), 'receiverId', (select value from tests.ctx where key = 'alice')),
    jsonb_build_object('giverId', (select value from tests.ctx where key = 'carol'), 'receiverId', (select value from tests.ctx where key = 'bob')))),
  'exclusion violation rejected');
select tests.expect_error(format($$select public.apply_draw(%L, %L)$$,
  (select value from tests.ctx where key = 'event'),
  jsonb_build_array(
    jsonb_build_object('giverId', (select value from tests.ctx where key = 'alice'), 'receiverId', (select value from tests.ctx where key = 'bob')),
    jsonb_build_object('giverId', (select value from tests.ctx where key = 'bob'), 'receiverId', (select value from tests.ctx where key = 'alice')))),
  'incomplete draw rejected');
select public.apply_draw((select value::uuid from tests.ctx where key = 'event'),
  jsonb_build_array(
    jsonb_build_object('giverId', (select value from tests.ctx where key = 'alice'), 'receiverId', (select value from tests.ctx where key = 'bob')),
    jsonb_build_object('giverId', (select value from tests.ctx where key = 'bob'), 'receiverId', (select value from tests.ctx where key = 'dave')),
    jsonb_build_object('giverId', (select value from tests.ctx where key = 'dave'), 'receiverId', (select value from tests.ctx where key = 'carol')),
    jsonb_build_object('giverId', (select value from tests.ctx where key = 'carol'), 'receiverId', (select value from tests.ctx where key = 'alice'))));
select tests.assert((select status from public.events) = 'drawn', 'event marked as drawn');
select tests.expect_error($$select public.apply_draw((select value::uuid from tests.ctx where key = 'event'), '[]')$$,
                          'drawing twice rejected');
reset role;

-- After the draw ------------------------------------------------------------------------------------
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select tests.assert((select count(*) from public.assignments) = 1, 'alice sees exactly one assignment');
select tests.assert((select receiver_id::text from public.assignments) = (select value from tests.ctx where key = 'bob'),
                    'alice sees her own assignment');
select tests.assert((select count(*) from public.questionnaires) = 1, 'santa reads giftee questionnaire');
select tests.assert((select count(*) from public.wishlist_items) = 1, 'santa reads giftee wishlist');
select tests.assert(tests.affected($$update public.questionnaires set notes = 'Tampered'$$) = 0, 'santa cannot edit giftee answers');
select tests.assert(tests.affected($$delete from public.wishlist_items$$) = 0, 'santa cannot delete giftee wishlist');
select tests.expect_error($$select public.create_invitation((select value::uuid from tests.ctx where key = 'event'))$$,
                          'no invitations after the draw');
select tests.assert(tests.affected($$delete from public.participants where display_name = 'Dave'$$) = 0,
                    'participants cannot be removed after the draw');
select tests.expect_error($$select public.submit_exclusions((select value::uuid from tests.ctx where key = 'event'), '{}')$$,
                          'exclusions frozen after the draw');
insert into public.messages (event_id, receiver_id, from_santa, body)
values ((select value::uuid from tests.ctx where key = 'event'), (select value::uuid from tests.ctx where key = 'bob'), true, 'Ho ho ho!');
select tests.expect_error($$insert into public.messages (event_id, receiver_id, from_santa, body)
                           values ((select value::uuid from tests.ctx where key = 'event'),
                                   (select value::uuid from tests.ctx where key = 'dave'), true, 'Pretending')$$,
                          'only the real santa can write as santa');
select tests.expect_error($$insert into public.messages (event_id, receiver_id, from_santa, body)
                           values ((select value::uuid from tests.ctx where key = 'event'),
                                   (select value::uuid from tests.ctx where key = 'bob'), false, 'Pretending to be Bob')$$,
                          'only the receiver can reply in their thread');

set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select tests.assert((select count(*) from public.assignments) = 1, 'bob sees only his assignment');
select tests.assert((select receiver_id::text from public.assignments) = (select value from tests.ctx where key = 'dave'),
                    'bob cannot discover his santa');
select tests.assert((select count(*) from public.messages where receiver_id::text = (select value from tests.ctx where key = 'bob')) = 1,
                    'bob reads messages from his santa');
insert into public.messages (event_id, receiver_id, from_santa, body)
values ((select value::uuid from tests.ctx where key = 'event'), (select value::uuid from tests.ctx where key = 'bob'), false, 'Thank you!');

set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select tests.assert((select count(*) from public.messages) = 0, 'other participants cannot read the thread');
select tests.assert((select count(*) from public.questionnaires) = 0, 'other participants cannot read bob''s answers');

set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000e';
select tests.assert((select count(*) from public.messages) = 0, 'outsider reads no messages');
select tests.expect_error($$select * from public.preview_invitation((select value from tests.ctx where key = 'token'))$$,
                          'invitation unusable after the draw');

-- Organiser role --------------------------------------------------------------------------------
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000e';
select tests.assert(public.can_organize(), 'anyone organises while the organiser list is empty');
select tests.expect_error($$select * from public.organizers$$, 'organiser list is not readable by clients');
reset role;
insert into public.organizers (email) values ('alice@example.com');
set role authenticated;
select tests.assert(not public.can_organize(), 'non-organiser cannot organise');
select tests.expect_error($$select public.create_event('Not allowed')$$, 'non-organiser cannot create events');
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select tests.assert(public.can_organize(), 'listed organiser can organise');

-- Owner deletes the event: everything cascades ------------------------------------------------------
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select tests.assert(tests.affected($$delete from public.events$$) = 1, 'owner deletes the event');
reset role;
select tests.assert((select count(*) from public.messages) + (select count(*) from public.assignments)
                    + (select count(*) from public.participants) = 0, 'event data cascades on delete');

\o
\echo 'All database tests passed.'
