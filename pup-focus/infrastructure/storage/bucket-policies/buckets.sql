insert into storage.buckets (id, name, public)
values ('compliance-private', 'compliance-private', false)
on conflict (id) do nothing;

-- submission-previews: derived preview artifacts.
-- review-attachments: evaluator file remarks.
-- exports-private: generated report exports.
