-- Assertion helpers for the disposable scratch database. Each passing check
-- emits a NOTICE starting with "ok - "; any failure raises and aborts psql.

create schema qassa_test;
grant usage on schema qassa_test to anon, authenticated;

create function qassa_test.ok(p_condition boolean, p_label text)
returns void
language plpgsql
as $$
begin
  if p_condition is distinct from true then
    raise exception 'not ok - %', p_label;
  end if;
  raise notice 'ok - %', p_label;
end;
$$;

create function qassa_test.throws(p_sql text, p_sqlstate text, p_label text)
returns void
language plpgsql
as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlstate = p_sqlstate then
      raise notice 'ok - %', p_label;
      return;
    end if;
    raise exception 'not ok - %: expected SQLSTATE %, got % (%)',
      p_label, p_sqlstate, sqlstate, sqlerrm;
  end;
  raise exception 'not ok - %: expected SQLSTATE %, but the statement succeeded',
    p_label, p_sqlstate;
end;
$$;

grant execute on all functions in schema qassa_test to anon, authenticated;
