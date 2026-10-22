-- Each purchase line can go to its own warehouse; the purchase's warehouse
-- is the default for lines that don't say.
alter table inv_purchase_items add column if not exists warehouse_id uuid references inv_warehouses(id);

create or replace function inv_register_purchase(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_store uuid := (p->>'store_id')::uuid;
  v_wh uuid := (p->>'warehouse_id')::uuid;
  v_line_wh uuid;
  v_date date := coalesce((p->>'date')::date, current_date);
  v_id uuid;
  v_line jsonb;
  v_item inv_items;
  v_qty numeric; v_base numeric; v_cost numeric; v_total numeric := 0; v_line_total numeric;
  v_pay jsonb := p->'payment';
  v_paid numeric := 0;
  v_entry uuid;
  v_supplier text;
begin
  if not exists (select 1 from stores where id = v_store and owner_id = auth.uid()) then
    raise exception 'No autorizado';
  end if;
  if not exists (select 1 from inv_warehouses where id = v_wh and store_id = v_store) then
    raise exception 'Almacén inválido';
  end if;
  if jsonb_array_length(coalesce(p->'lines', '[]'::jsonb)) = 0 then
    raise exception 'La compra no tiene artículos';
  end if;

  insert into inv_purchases (store_id, supplier_id, warehouse_id, date, invoice_number, invoice_path, notes, due_date)
  values (v_store, nullif(p->>'supplier_id', '')::uuid, v_wh, v_date, nullif(p->>'invoice_number', ''),
          nullif(p->>'invoice_path', ''), nullif(p->>'notes', ''), nullif(p->>'due_date', '')::date)
  returning id into v_id;

  for v_line in select * from jsonb_array_elements(p->'lines') loop
    select * into v_item from inv_items where id = (v_line->>'item_id')::uuid and store_id = v_store;
    if v_item.id is null then raise exception 'Artículo inválido'; end if;
    v_line_wh := coalesce(nullif(v_line->>'warehouse_id', '')::uuid, v_wh);
    if not exists (select 1 from inv_warehouses where id = v_line_wh and store_id = v_store) then
      raise exception 'Almacén inválido para %', v_item.name;
    end if;
    v_qty := (v_line->>'qty')::numeric;
    v_cost := (v_line->>'unit_cost')::numeric;
    if v_qty is null or v_qty <= 0 or v_cost is null or v_cost < 0 then
      raise exception 'Revisa cantidad y costo de %', v_item.name;
    end if;
    v_base := case when v_line->>'unit_kind' = 'purchase' then v_qty * greatest(v_item.purchase_factor, 0.0001) else v_qty end;
    v_line_total := round(v_qty * v_cost, 2);
    v_total := v_total + v_line_total;
    insert into inv_purchase_items (store_id, purchase_id, item_id, qty, unit_kind, base_qty, unit_cost, total, warehouse_id)
    values (v_store, v_id, v_item.id, v_qty, coalesce(v_line->>'unit_kind', 'base'), v_base, v_cost, v_line_total, v_line_wh);
    perform inv_apply_movement(v_store, v_item.id, v_line_wh, 'purchase', v_base,
      case when v_base > 0 then v_line_total / v_base else v_cost end,
      null, 'purchase', v_id);
  end loop;

  select name into v_supplier from inv_suppliers where id = nullif(p->>'supplier_id', '')::uuid;

  if v_pay is not null and coalesce((v_pay->>'amount_usd')::numeric, 0) > 0 then
    v_paid := least((v_pay->>'amount_usd')::numeric, v_total);
    insert into fin_entries (store_id, date, direction, method_id, amount, amount_usd, concept, category, source, source_id)
    values (v_store, v_date, 'salida', v_pay->>'method_id', (v_pay->>'amount')::numeric, v_paid,
            'Compra' || coalesce(' a ' || v_supplier, '') || coalesce(' · factura ' || nullif(p->>'invoice_number', ''), ''),
            'Proveedores', 'purchase', v_id)
    returning id into v_entry;
    insert into inv_purchase_payments (store_id, purchase_id, date, method_id, amount, amount_usd, rate, fin_entry_id)
    values (v_store, v_id, v_date, v_pay->>'method_id', (v_pay->>'amount')::numeric, v_paid,
            nullif(v_pay->>'rate', '')::numeric, v_entry);
  end if;

  update inv_purchases set total_usd = v_total, paid_usd = v_paid,
    status = case when v_paid >= v_total then 'paid' when v_paid > 0 then 'partial' else 'credit' end
  where id = v_id;
  return v_id;
end $$;
