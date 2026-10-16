-- GPS accuracy (meters) of each driver position, so the maps can tell a
-- precise fix from a coarse cell/wifi one.
alter table driver_locations add column if not exists accuracy double precision;
