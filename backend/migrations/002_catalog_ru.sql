BEGIN;
INSERT INTO muscle_groups(name, body_region) VALUES
    ('Грудные мышцы', 'Грудь'), ('Квадрицепсы', 'Ноги'),
    ('Широчайшие мышцы спины', 'Спина'), ('Бицепсы', 'Руки')
ON CONFLICT (name) DO NOTHING;

WITH catalog(key, name, description, difficulty, equipment, muscle) AS (
    VALUES
      ('squat', 'Приседания', 'Приседания с собственным весом.', 'beginner', 'Собственный вес', 'Квадрицепсы'),
      ('push-up', 'Отжимания', 'Разгибание рук в упоре лёжа.', 'beginner', 'Собственный вес', 'Грудные мышцы'),
      ('bench-press', 'Жим штанги лёжа', 'Жим штанги на горизонтальной скамье.', 'intermediate', 'Штанга', 'Грудные мышцы'),
      ('row', 'Тяга гантели в наклоне', 'Тяга одной рукой с опорой на скамью.', 'intermediate', 'Гантели', 'Широчайшие мышцы спины'),
      ('curl', 'Сгибание рук с гантелями', 'Сгибание рук в локтях стоя.', 'beginner', 'Гантели', 'Бицепсы')
), saved AS (
    INSERT INTO exercises (source, source_key, name, description, difficulty, equipment, goals)
    SELECT 'local', key, name, description, difficulty, ARRAY[equipment], ARRAY['Сила']
    FROM catalog
    ON CONFLICT (source, source_key) DO UPDATE SET name = EXCLUDED.name,
      description = EXCLUDED.description, difficulty = EXCLUDED.difficulty,
      equipment = EXCLUDED.equipment, goals = EXCLUDED.goals
    RETURNING id, source_key
)
INSERT INTO exercise_muscles(exercise_id, muscle_id)
SELECT saved.id, muscle_groups.id FROM saved
JOIN catalog ON catalog.key = saved.source_key
JOIN muscle_groups ON muscle_groups.name = catalog.muscle
ON CONFLICT DO NOTHING;
COMMIT;
