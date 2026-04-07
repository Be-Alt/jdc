CREATE TABLE dys_types (
    id SERIAL PRIMARY KEY,
    code TEXT NOT NULL,
    nom TEXT NOT NULL,
    description TEXT
);

CREATE TABLE accommodations (
    id SERIAL PRIMARY KEY,
    dys_id INT REFERENCES dys_types(id) ON DELETE CASCADE,
    amenagement TEXT NOT NULL
);

CREATE TABLE student_dys (
    student_id UUID,
    dys_id INT,
    PRIMARY KEY (student_id, dys_id)
);

INSERT INTO dys_types (id, code, nom, description) VALUES
(1, 'DYSLEXIE', 'Dyslexie', 'Trouble spécifique de la lecture'),
(2, 'DYSPHASIE', 'Dysphasie', 'Trouble du langage oral'),
(3, 'DYSPRAXIE', 'Dyspraxie', 'Trouble de la coordination motrice'),
(4, 'DYSCALCULIE', 'Dyscalculie', 'Trouble du raisonnement mathématique'),
(5, 'DYSGRAPHIE', 'Dysgraphie', 'Trouble de l’écriture'),
(6, 'DYSORTHO', 'Dysorthographie', 'Trouble de l’orthographe'),
(7, 'TDAH', 'TDAH', 'Trouble de l’attention avec ou sans hyperactivité');

INSERT INTO accommodations (id, dys_id, amenagement) VALUES
-- Dyslexie
(1, 1, 'Police adaptée (OpenDyslexic, Arial)'),
(2, 1, 'Texte aéré, interligne augmenté'),
(3, 1, 'Lecture des consignes à voix haute'),
(4, 1, 'Support audio des textes'),
(5, 1, 'Réduction de la quantité de lecture'),

-- Dysphasie
(6, 2, 'Reformulation orale des consignes'),
(7, 2, 'Temps supplémentaire à l’oral'),
(8, 2, 'Support visuel (schémas, pictogrammes)'),

-- Dyspraxie
(9, 3, 'Utilisation d’un ordinateur'),
(10, 3, 'Réduction de l’écriture manuscrite'),
(11, 3, 'Supports structurés étape par étape'),

-- Dyscalculie
(12, 4, 'Utilisation de la calculatrice'),
(13, 4, 'Tableaux et formules autorisés'),
(14, 4, 'Consignes simplifiées'),

-- Dysgraphie
(15, 5, 'Écriture au clavier privilégiée'),
(16, 5, 'Pas de pénalisation de l’écriture'),

-- Dysorthographie
(17, 6, 'Correction adaptée (sens prioritaire sur la forme)'),
(18, 6, 'Dictée aménagée'),
(19, 6, 'Utilisation de correcteurs orthographiques'),

-- TDAH
(20, 7, 'Temps supplémentaire'),
(21, 7, 'Fractionnement des tâches'),
(22, 7, 'Environnement calme'),
(23, 7, 'Consignes courtes et claires');