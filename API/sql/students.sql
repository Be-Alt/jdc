-- =========================================
-- EXTENSIONS
-- =========================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =========================================
-- ORGANIZATIONS
-- =========================================
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT now()
);

-- =========================================
-- ORGANIZATION MEMBERS
-- =========================================
CREATE TABLE organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,

  role TEXT DEFAULT 'member', -- admin | member

  created_at TIMESTAMP DEFAULT now(),

  UNIQUE(organization_id, user_id)
);

-- =========================================
-- SCHOOLS
-- =========================================
CREATE TABLE schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'Belgique',
  website TEXT,

  owner_id UUID NOT NULL,
  organization_id UUID REFERENCES organizations(id),
  is_shared_with_org BOOLEAN DEFAULT false,

  created_at TIMESTAMP DEFAULT now(),

  UNIQUE(name, city),

  -- 🔐 cohérence partage
  CHECK (
    is_shared_with_org = false
    OR organization_id IS NOT NULL
  )
);

-- =========================================
-- TEACHERS
-- =========================================
CREATE TABLE teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,

  first_name TEXT,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  subject TEXT,

  owner_id UUID NOT NULL,
  organization_id UUID REFERENCES organizations(id),
  is_shared_with_org BOOLEAN DEFAULT false,

  created_at TIMESTAMP DEFAULT now(),

  -- 🔐 cohérence partage
  CHECK (
    is_shared_with_org = false
    OR organization_id IS NOT NULL
  )
);

-- =========================================
-- PERSONS (identité)
-- =========================================
CREATE TABLE persons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  birth_date DATE,

  owner_id UUID NOT NULL,

  created_at TIMESTAMP DEFAULT now()
);

-- =========================================
-- SCHOOL YEARS
-- =========================================
CREATE TABLE school_years (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  label TEXT UNIQUE NOT NULL,
  start_date DATE,
  end_date DATE
);

-- =========================================
-- STUDENT ENROLLMENTS (COEUR)
-- =========================================
CREATE TABLE student_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  person_id UUID REFERENCES persons(id) ON DELETE CASCADE,
  school_year_id UUID REFERENCES school_years(id),

  status TEXT DEFAULT 'active',

  owner_id UUID NOT NULL,
  organization_id UUID REFERENCES organizations(id),
  is_shared_with_org BOOLEAN DEFAULT false,

  created_at TIMESTAMP DEFAULT now(),

  UNIQUE(person_id, school_year_id),

  -- 🔐 cohérence partage
  CHECK (
    is_shared_with_org = false
    OR organization_id IS NOT NULL
  )
);

-- =========================================
-- SCHOOL HISTORY
-- =========================================
CREATE TABLE student_school_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  student_enrollment_id UUID REFERENCES student_enrollments(id) ON DELETE CASCADE,
  school_id UUID REFERENCES schools(id),

  start_date DATE NOT NULL,
  end_date DATE,

  created_at TIMESTAMP DEFAULT now()
);

-- ⚠️ UNE seule école active
CREATE UNIQUE INDEX one_active_school_per_student
ON student_school_history(student_enrollment_id)
WHERE end_date IS NULL;

-- =========================================
-- STUDENT ↔ TEACHERS
-- =========================================
CREATE TABLE student_teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  student_enrollment_id UUID REFERENCES student_enrollments(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES teachers(id) ON DELETE CASCADE,

  role TEXT,

  UNIQUE(student_enrollment_id, teacher_id)
);

-- =========================================
-- INDEX UTILES
-- =========================================
CREATE INDEX idx_student_enrollments_person
ON student_enrollments(person_id);

CREATE INDEX idx_student_enrollments_owner
ON student_enrollments(owner_id);

CREATE INDEX idx_student_enrollments_org
ON student_enrollments(organization_id);

CREATE INDEX idx_schools_owner
ON schools(owner_id);

CREATE INDEX idx_schools_org
ON schools(organization_id);

CREATE INDEX idx_teachers_owner
ON teachers(owner_id);

CREATE INDEX idx_teachers_org
ON teachers(organization_id);

CREATE INDEX idx_school_history_enrollment
ON student_school_history(student_enrollment_id);

CREATE INDEX idx_teachers_school
ON teachers(school_id);

CREATE INDEX idx_org_members_user
ON organization_members(user_id);

CREATE TABLE sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  code TEXT UNIQUE NOT NULL,      -- ex: 5P
  level INT NOT NULL,             -- ex: 5
  type TEXT NOT NULL,             -- G, TT, TQ, P
  label TEXT NOT NULL,            -- ex: 5e année professionnel

  created_at TIMESTAMP DEFAULT now()
);

ALTER TABLE student_enrollments
ADD COLUMN section_id UUID REFERENCES sections(id);


ALTER TABLE student_enrollments
ADD CONSTRAINT fk_student_enrollments_section
FOREIGN KEY (section_id)
REFERENCES sections(id)
ON DELETE SET NULL;