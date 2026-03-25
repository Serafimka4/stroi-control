-- ============================================
-- Пользователи (пароль для всех: 123456)
-- SHA-256 хеш "123456" = 8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92
-- ============================================

INSERT OR IGNORE INTO users (id, login, password_hash, name, role, engineer_id) VALUES
  (1, 'admin', '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92', 'Директор', 'admin', NULL),
  (2, 'kozlov', '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92', 'Козлов А.В.', 'engineer', 1),
  (3, 'petrova', '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92', 'Петрова Е.М.', 'engineer', 2),
  (4, 'sidorov', '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92', 'Сидоров Д.И.', 'lab', 3),
  (5, 'novikova', '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92', 'Новикова О.С.', 'engineer', 4),
  (6, 'morozova', '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92', 'Морозова Н.А.', 'lab', 6);
