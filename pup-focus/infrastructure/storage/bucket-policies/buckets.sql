insert into storage.buckets (id, name, public)
values ('profile-pictures', 'profile-pictures', false)
on conflict (id) do nothing;

-- submission-previews: derived preview artifacts.
-- review-attachments: evaluator file remarks.
-- exports-private: generated report exports.
