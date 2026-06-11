alter table public.class_session_students
add column if not exists fatigue_level smallint,
add column if not exists concentration_level smallint,
add column if not exists motivation_level smallint,
add column if not exists emotional_wellbeing_level smallint;

alter table public.class_session_students
drop constraint if exists class_session_students_fatigue_level_check,
add constraint class_session_students_fatigue_level_check
  check (fatigue_level between 0 and 5),
drop constraint if exists class_session_students_concentration_level_check,
add constraint class_session_students_concentration_level_check
  check (concentration_level between 0 and 5),
drop constraint if exists class_session_students_motivation_level_check,
add constraint class_session_students_motivation_level_check
  check (motivation_level between 0 and 5),
drop constraint if exists class_session_students_emotional_wellbeing_level_check,
add constraint class_session_students_emotional_wellbeing_level_check
  check (emotional_wellbeing_level between 0 and 5);
