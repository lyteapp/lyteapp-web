-- Enable realtime events on deliveries and include all columns in UPDATE payloads
alter table deliveries replica identity full;
alter publication supabase_realtime add table deliveries;
