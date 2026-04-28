insert into roles (code, name) values
  ('super_admin', 'Super Admin'),
  ('faculty', 'Faculty'),
  ('program_head', 'Program Head'),
  ('admin', 'Admin')
on conflict (code) do nothing;
