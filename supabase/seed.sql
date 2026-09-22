-- Sample charities (fictional). Run after schema.sql.
insert into public.charities (slug, name, category, description, featured, events) values
('open-classroom', 'Open Classroom', 'Education',
 'Funds school supplies, tutors and evening study rooms for children in under-resourced neighbourhoods. Every ₹2,000 keeps one learner in class for a term.',
 true,
 '[{"title":"Charity Golf Day","date":"2026-11-08","location":"Hyderabad"},{"title":"Tutor Appreciation Evening","date":"2026-12-02","location":"Online"}]'),
('clean-river-trust', 'Clean River Trust', 'Environment',
 'Community-led river clean-ups and water testing. Volunteers pull tonnes of waste from waterways every year and restore banks with native planting.',
 false,
 '[{"title":"Riverbank Restoration Day","date":"2026-10-18","location":"Musi River, Hyderabad"}]'),
('second-wind', 'Second Wind', 'Health',
 'Mental health counselling and peer-support groups, free of charge, for people who cannot afford therapy.',
 false, '[]'),
('meals-on-wheels-india', 'Meals That Travel', 'Community',
 'Hot, nutritious meals delivered to elderly people living alone. Volunteers stay for a chat, because company matters as much as food.',
 false,
 '[{"title":"Volunteer Drive","date":"2026-10-25","location":"Secunderabad"}]'),
('fair-start-youth', 'Fair Start Youth Sport', 'Youth',
 'Free coaching and equipment for young athletes who would otherwise never get to try a sport.',
 false,
 '[{"title":"Junior Golf Clinic","date":"2026-11-15","location":"Gachibowli"}]')
on conflict (slug) do nothing;
