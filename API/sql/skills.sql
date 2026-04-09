-- =========================
-- EXTENSION
-- =========================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =========================
-- NETWORKS
-- =========================
CREATE TABLE networks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  url TEXT
);

-- =========================
-- MATIÈRES
-- =========================
CREATE TABLE subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL
);

-- =========================
-- SECTIONS
-- =========================
CREATE TABLE sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  level INT NOT NULL,
  type TEXT NOT NULL,
  label TEXT NOT NULL,
  valid_from DATE,
  valid_to DATE,
  created_at TIMESTAMP DEFAULT now()
);

-- =========================
-- TYPES DE PROCESSUS
-- =========================
CREATE TABLE process_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL
);

-- =========================
-- PROGRAMS (clé centrale)
-- =========================
CREATE TABLE programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
  section_id UUID REFERENCES sections(id) ON DELETE CASCADE,
  network_id UUID REFERENCES networks(id) ON DELETE CASCADE,

  hours INT NOT NULL,
  name TEXT,

  valid_from DATE,
  valid_to DATE,

  UNIQUE(subject_id, section_id, network_id, hours)
);

-- =========================
-- UAA
-- =========================
CREATE TABLE uaa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID REFERENCES programs(id) ON DELETE CASCADE,

  code TEXT NOT NULL,
  name TEXT NOT NULL,
);

-- =========================
-- COMPÉTENCES (Processus)
-- =========================
CREATE TABLE skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uaa_id UUID REFERENCES uaa(id) ON DELETE CASCADE,
  process_type_id UUID REFERENCES process_types(id),
  description TEXT NOT NULL
);

-- =========================
-- RESSOURCES (Savoirs)
-- =========================
CREATE TABLE resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uaa_id UUID REFERENCES uaa(id) ON DELETE CASCADE,
  description TEXT NOT NULL
);

-- =========================
-- COMPÉTENCES À DÉVELOPPER
-- =========================
CREATE TABLE uaa_competences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uaa_id UUID REFERENCES uaa(id) ON DELETE CASCADE,
  description TEXT NOT NULL
);

-- =========================
-- STRATÉGIES TRANSVERSALES
-- =========================
CREATE TABLE uaa_strategies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uaa_id UUID REFERENCES uaa(id) ON DELETE CASCADE,
  description TEXT NOT NULL
);
