create table if not exists public.observation_categories (
  id text primary key,
  label text not null,
  position int not null
);

create table if not exists public.observation_levels (
  id text primary key,
  label text not null,
  tone text not null check (tone in ('positive', 'mixed', 'difficulty', 'warning')),
  position int not null
);

create table if not exists public.observation_items (
  id text primary key,
  category_id text not null references public.observation_categories(id) on delete cascade,
  level_id text not null references public.observation_levels(id) on delete cascade,
  label text not null,
  position int not null
);

create table if not exists public.class_session_student_observations (
  session_id uuid not null,
  student_enrollment_id uuid not null,
  observation_item_id text not null references public.observation_items(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (session_id, student_enrollment_id, observation_item_id),
  foreign key (session_id, student_enrollment_id)
    references public.class_session_students(session_id, student_enrollment_id)
    on delete cascade
);

create index if not exists idx_session_student_observations_student
on public.class_session_student_observations(student_enrollment_id);

create index if not exists idx_session_student_observations_item
on public.class_session_student_observations(observation_item_id);

insert into public.observation_categories (id, label, position) values
  ('learning', 'Apprentissage et acquisition des compétences', 1),
  ('work_attitude', 'Attitude face au travail', 2),
  ('attention', 'Concentration et attention', 3),
  ('organization', 'Organisation et autonomie', 4),
  ('participation', 'Participation et communication', 5),
  ('fatigue', 'État physique et fatigue', 6),
  ('emotion', 'État émotionnel et moral', 7),
  ('social', 'Relations sociales', 8)
on conflict (id) do update set label = excluded.label, position = excluded.position;

insert into public.observation_levels (id, label, tone, position) values
  ('very_positive', 'Très positif', 'positive', 1),
  ('positive', 'Positif', 'positive', 1),
  ('mixed', 'Mitigé', 'mixed', 2),
  ('difficulty', 'Difficultés', 'difficulty', 3),
  ('light_fatigue', 'Fatigue légère', 'warning', 1),
  ('heavy_fatigue', 'Fatigue importante', 'difficulty', 2),
  ('emotional_fragility', 'Fragilité émotionnelle', 'warning', 2)
on conflict (id) do update set label = excluded.label, tone = excluded.tone, position = excluded.position;

insert into public.observation_items (id, category_id, level_id, label, position) values
  ('learning_vp_1','learning','very_positive','Assimile rapidement les nouvelles notions.',1),
  ('learning_vp_2','learning','very_positive','Réinvestit efficacement les apprentissages dans de nouvelles situations.',2),
  ('learning_vp_3','learning','very_positive','Fait preuve d’autonomie dans la réalisation des tâches.',3),
  ('learning_vp_4','learning','very_positive','Progresse de manière constante.',4),
  ('learning_vp_5','learning','very_positive','Mobilise les acquis avec pertinence.',5),
  ('learning_vp_6','learning','very_positive','Comprend rapidement les consignes et les applique correctement.',6),
  ('learning_vp_7','learning','very_positive','Développe des stratégies de résolution adaptées.',7),
  ('learning_m_1','learning','mixed','Les apprentissages sont en cours d’acquisition.',1),
  ('learning_m_2','learning','mixed','Nécessite encore des guidances ponctuelles.',2),
  ('learning_m_3','learning','mixed','Réinvestit les notions avec un accompagnement.',3),
  ('learning_m_4','learning','mixed','Les acquis restent fragiles dans certaines situations.',4),
  ('learning_m_5','learning','mixed','A besoin de temps pour s’approprier les nouvelles notions.',5),
  ('learning_m_6','learning','mixed','Progresse à son rythme malgré certaines difficultés.',6),
  ('learning_d_1','learning','difficulty','Éprouve des difficultés à mobiliser les notions travaillées.',1),
  ('learning_d_2','learning','difficulty','Les apprentissages nécessitent de nombreuses répétitions.',2),
  ('learning_d_3','learning','difficulty','Rencontre des difficultés de compréhension des consignes.',3),
  ('learning_d_4','learning','difficulty','Les acquis ne sont pas encore stabilisés.',4),
  ('learning_d_5','learning','difficulty','A besoin d’un accompagnement important pour réaliser les tâches demandées.',5),
  ('learning_d_6','learning','difficulty','Présente des lacunes qui freinent la progression.',6),
  ('work_vp_1','work_attitude','very_positive','S’investit activement dans les activités proposées.',1),
  ('work_vp_2','work_attitude','very_positive','Fait preuve de sérieux et de persévérance.',2),
  ('work_vp_3','work_attitude','very_positive','Travaille avec soin et rigueur.',3),
  ('work_vp_4','work_attitude','very_positive','Montre une réelle motivation pour les apprentissages.',4),
  ('work_vp_5','work_attitude','very_positive','S’implique dans les tâches demandées.',5),
  ('work_vp_6','work_attitude','very_positive','Accepte volontiers les remarques constructives.',6),
  ('work_vp_7','work_attitude','very_positive','Recherche des solutions face aux difficultés rencontrées.',7),
  ('work_m_1','work_attitude','mixed','L’investissement varie selon les activités proposées.',1),
  ('work_m_2','work_attitude','mixed','Travaille de manière irrégulière.',2),
  ('work_m_3','work_attitude','mixed','A besoin d’être encouragé pour maintenir son engagement.',3),
  ('work_m_4','work_attitude','mixed','Peut se montrer passif lors de certaines activités.',4),
  ('work_m_5','work_attitude','mixed','L’attention fluctue au cours des séances.',5),
  ('work_d_1','work_attitude','difficulty','S’investit peu dans les activités proposées.',1),
  ('work_d_2','work_attitude','difficulty','Renonce rapidement face à la difficulté.',2),
  ('work_d_3','work_attitude','difficulty','Manque de persévérance dans la réalisation des tâches.',3),
  ('work_d_4','work_attitude','difficulty','Évite certaines activités demandant un effort important.',4),
  ('work_d_5','work_attitude','difficulty','Nécessite des relances fréquentes pour rester au travail.',5),
  ('work_d_6','work_attitude','difficulty','Se mobilise difficilement dans les apprentissages.',6),
  ('attention_p_1','attention','positive','Maintient son attention durant l’ensemble de l’activité.',1),
  ('attention_p_2','attention','positive','Reste concentré malgré les distractions.',2),
  ('attention_p_3','attention','positive','Écoute attentivement les explications.',3),
  ('attention_p_4','attention','positive','Fait preuve d’une bonne capacité d’attention.',4),
  ('attention_d_1','attention','difficulty','Son attention est fluctuante.',1),
  ('attention_d_2','attention','difficulty','Se laisse facilement distraire par l’environnement.',2),
  ('attention_d_3','attention','difficulty','Nécessite des rappels réguliers pour se recentrer.',3),
  ('attention_d_4','attention','difficulty','Éprouve des difficultés à maintenir sa concentration sur une longue période.',4),
  ('organization_p_1','organization','positive','Organise efficacement son travail.',1),
  ('organization_p_2','organization','positive','Gère son matériel de manière autonome.',2),
  ('organization_p_3','organization','positive','Planifie correctement les différentes étapes d’une tâche.',3),
  ('organization_p_4','organization','positive','Prend des initiatives adaptées.',4),
  ('organization_d_1','organization','difficulty','A besoin d’aide pour organiser son travail.',1),
  ('organization_d_2','organization','difficulty','Oublie régulièrement son matériel.',2),
  ('organization_d_3','organization','difficulty','Éprouve des difficultés à planifier les tâches.',3),
  ('organization_d_4','organization','difficulty','Nécessite un encadrement pour mener une activité à son terme.',4),
  ('participation_p_1','participation','positive','Participe activement aux échanges.',1),
  ('participation_p_2','participation','positive','Pose des questions pertinentes.',2),
  ('participation_p_3','participation','positive','Ose demander de l’aide lorsque nécessaire.',3),
  ('participation_p_4','participation','positive','Communique facilement avec les adultes et les pairs.',4),
  ('participation_d_1','participation','difficulty','Participe peu aux échanges.',1),
  ('participation_d_2','participation','difficulty','Hésite à demander de l’aide.',2),
  ('participation_d_3','participation','difficulty','Manque de confiance dans ses interventions.',3),
  ('participation_d_4','participation','difficulty','Peut se montrer réservé lors des activités collectives.',4),
  ('fatigue_l_1','fatigue','light_fatigue','Semble plus fatigué que d’habitude.',1),
  ('fatigue_l_2','fatigue','light_fatigue','Présente une baisse d’énergie en fin de séance.',2),
  ('fatigue_l_3','fatigue','light_fatigue','A besoin de pauses régulières pour maintenir son attention.',3),
  ('fatigue_l_4','fatigue','light_fatigue','La fatigue influence ponctuellement son efficacité.',4),
  ('fatigue_h_1','fatigue','heavy_fatigue','Présente des signes marqués de fatigue.',1),
  ('fatigue_h_2','fatigue','heavy_fatigue','La fatigue impacte significativement les apprentissages.',2),
  ('fatigue_h_3','fatigue','heavy_fatigue','Nécessite des temps de récupération fréquents.',3),
  ('fatigue_h_4','fatigue','heavy_fatigue','Les capacités d’attention et de mémorisation sont diminuées.',4),
  ('emotion_p_1','emotion','positive','Se montre serein et disponible pour les apprentissages.',1),
  ('emotion_p_2','emotion','positive','Fait preuve d’une attitude positive.',2),
  ('emotion_p_3','emotion','positive','Accepte les difficultés avec recul.',3),
  ('emotion_f_1','emotion','emotional_fragility','Semble préoccupé par certains événements extérieurs.',1),
  ('emotion_f_2','emotion','emotional_fragility','Présente une sensibilité émotionnelle accrue.',2),
  ('emotion_f_3','emotion','emotional_fragility','Peut se décourager facilement face aux difficultés.',3),
  ('emotion_f_4','emotion','emotional_fragility','Manque momentanément de confiance en ses capacités.',4),
  ('emotion_f_5','emotion','emotional_fragility','Son état émotionnel influence parfois son investissement scolaire.',5),
  ('social_p_1','social','positive','Entretient des relations respectueuses avec les autres.',1),
  ('social_p_2','social','positive','Collabore volontiers avec ses camarades.',2),
  ('social_p_3','social','positive','S’intègre facilement dans les activités de groupe.',3),
  ('social_p_4','social','positive','Adopte une attitude bienveillante envers les autres.',4),
  ('social_d_1','social','difficulty','Éprouve parfois des difficultés dans les interactions sociales.',1),
  ('social_d_2','social','difficulty','Préfère travailler seul.',2),
  ('social_d_3','social','difficulty','Peut se montrer réservé dans les activités collectives.',3),
  ('social_d_4','social','difficulty','Nécessite un accompagnement dans la gestion de certains conflits.',4)
on conflict (id) do update set
  category_id = excluded.category_id,
  level_id = excluded.level_id,
  label = excluded.label,
  position = excluded.position;
