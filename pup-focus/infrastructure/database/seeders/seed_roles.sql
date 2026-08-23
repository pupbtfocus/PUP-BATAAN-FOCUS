insert into roles (code, name) values
  ('super_admin', 'Super Admin'),
  ('faculty', 'Faculty'),
  ('admin', 'Admin')
on conflict (code) do nothing;

