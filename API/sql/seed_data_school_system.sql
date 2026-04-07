-- =========================================
-- USERS (simulés)
-- =========================================
-- user A (propriétaire)
-- user B (membre org)
-- ⚠️ ici on simule juste avec UUID fixes

-- =========================================
-- ORGANIZATION
-- =========================================
INSERT INTO organizations (id, name)
VALUES ('11111111-1111-1111-1111-111111111111', 'Ecole Demo');

-- =========================================
-- MEMBERS
-- =========================================
INSERT INTO organization_members (organization_id, user_id, role)
VALUES 
('11111111-1111-1111-1111-111111111111', '915d9ffa-06ec-4c87-bc0c-264c7a44fa57', 'admin'),
('11111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'member');

-- =========================================
-- SCHOOL
-- =========================================
INSERT INTO schools (
  id, name, city, owner_id, organization_id, is_shared_with_org
)
VALUES (
  '22222222-2222-2222-2222-222222222222',
  'Athénée Royal Test',
  'Charleroi',
  '915d9ffa-06ec-4c87-bc0c-264c7a44fa57',
  '11111111-1111-1111-1111-111111111111',
  true
);

-- =========================================
-- TEACHER
-- =========================================
INSERT INTO teachers (
  id, school_id, first_name, last_name,
  owner_id, organization_id, is_shared_with_org
)
VALUES (
  '33333333-3333-3333-3333-333333333333',
  '22222222-2222-2222-2222-222222222222',
  'Jean',
  'Dupont',
  '915d9ffa-06ec-4c87-bc0c-264c7a44fa57',
  '11111111-1111-1111-1111-111111111111',
  true
);

-- =========================================
-- PERSON
-- =========================================
INSERT INTO persons (
  id, first_name, last_name, owner_id
)
VALUES (
  '44444444-4444-4444-4444-444444444444',
  'Lucas',
  'Martin',
  '915d9ffa-06ec-4c87-bc0c-264c7a44fa57'
);

-- =========================================
-- SCHOOL YEAR
-- =========================================
INSERT INTO school_years (id, label)
VALUES (
  '55555555-5555-5555-5555-555555555555',
  '2024-2025'
);

-- =========================================
-- STUDENT ENROLLMENT (PARTAGÉ)
-- =========================================
INSERT INTO student_enrollments (
  id,
  person_id,
  school_year_id,
  class,
  owner_id,
  organization_id,
  is_shared_with_org
)
VALUES (
  '66666666-6666-6666-6666-666666666666',
  '44444444-4444-4444-4444-444444444444',
  '55555555-5555-5555-5555-555555555555',
  '5e secondaire',
  '915d9ffa-06ec-4c87-bc0c-264c7a44fa57',
  '11111111-1111-1111-1111-111111111111',
  true
);

-- =========================================
-- SCHOOL HISTORY
-- =========================================
INSERT INTO student_school_history (
  student_enrollment_id,
  school_id,
  start_date
)
VALUES (
  '66666666-6666-6666-6666-666666666666',
  '22222222-2222-2222-2222-222222222222',
  '2024-09-01'
);

-- =========================================
-- STUDENT ↔ TEACHER
-- =========================================
INSERT INTO student_teachers (
  student_enrollment_id,
  teacher_id,
  role
)
VALUES (
  '66666666-6666-6666-6666-666666666666',
  '33333333-3333-3333-3333-333333333333',
  'math'
);

INSERT INTO sections (code, level, type, label) VALUES

-- GENERAL
('1G', 1, 'G', '1re année général'),
('2G', 2, 'G', '2e année général'),
('3G', 3, 'G', '3e année général'),
('4G', 4, 'G', '4e année général'),
('5G', 5, 'G', '5e année général'),
('6G', 6, 'G', '6e année général'),

-- TECHNIQUE TRANSITION
('3TT', 3, 'TT', '3e technique de transition'),
('4TT', 4, 'TT', '4e technique de transition'),
('5TT', 5, 'TT', '5e technique de transition'),
('6TT', 6, 'TT', '6e technique de transition'),

-- TECHNIQUE QUALIFICATION
('3TQ', 3, 'TQ', '3e technique de qualification'),
('4TQ', 4, 'TQ', '4e technique de qualification'),
('5TQ', 5, 'TQ', '5e technique de qualification'),
('6TQ', 6, 'TQ', '6e technique de qualification'),

-- PROFESSIONNEL
('3P', 3, 'P', '3e année professionnel'),
('4P', 4, 'P', '4e année professionnel'),
('5P', 5, 'P', '5e année professionnel'),
('6P', 6, 'P', '6e année professionnel'),
('7P', 7, 'P', '7e année professionnel');