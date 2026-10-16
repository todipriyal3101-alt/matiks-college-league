-- =============================================================
-- Shared test runner, loaded by scripts/db-test.sh before each <migration>.test.sql.
-- Personas use the fixed user ids below; seed them in <migration>.seed.sql.
-- =============================================================

create schema t;
create table t.results (n serial, area text, persona text, test text, expected text, got text, pass boolean);

create function t.claims(p text) returns text language sql immutable as $$
  select case p
    when 'anon'     then '{"role":"anon"}'
    when 'service'  then '{"role":"service_role"}'
    when 'admin'    then '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000000a1","email":"admin@matiks.test"}'
    when 'viewer'   then '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000000a2","email":"viewer@matiks.test"}'
    when 'poc'      then '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000000a3","email":"poc@iitb.test"}'
    when 'invited'  then '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000000a4","email":"invited@iitb.test"}'
    when 'other'    then '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000000a5","email":"poc@nitt.test"}'
    when 'stranger' then '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000000a6","email":"stranger@gmail.test"}'
    else ''
  end;
$$;

create function t.pgrole(p text) returns text language sql immutable as $$
  select case p when 'anon' then 'anon' when 'service' then 'service_role' when 'postgres' then 'postgres' else 'authenticated' end;
$$;

-- p_sql must return one value (use count(*) for row counts); p_check runs afterwards as postgres.
create function t.run(p_area text, p_persona text, p_test text, p_sql text, p_expect text, p_check text default null)
returns void language plpgsql as $$
declare
  v text;
  v_check text;
  v_got text;
begin
  begin
    perform set_config('request.jwt.claims', t.claims(p_persona), true);
    perform set_config('role', t.pgrole(p_persona), true);
    execute p_sql into v;
    perform set_config('role', 'postgres', true);
    perform set_config('request.jwt.claims', '', true);
    v := coalesce(v, 'null');
    if p_check is not null then
      execute p_check into v_check;
      v := v || ' / ' || coalesce(v_check, 'null');
    end if;
    raise exception using errcode = 'P0099', message = v;   -- roll back this test's changes
  exception
    when sqlstate 'P0099' then v_got := sqlerrm;
    when others then v_got := 'ERROR ' || sqlstate || ': ' || sqlerrm;
  end;
  insert into t.results (area, persona, test, expected, got, pass)
  values (p_area, p_persona, p_test, p_expect, v_got,
          case when p_expect like 'ERROR%' then v_got like p_expect || '%' else v_got = p_expect end);
end;
$$;

