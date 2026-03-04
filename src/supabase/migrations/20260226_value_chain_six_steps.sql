-- Cập nhật value_chain_activities về đúng 6 giai đoạn: Traffic → CDP/Data → AdTech → Performance → eCommerce → AI & Loop
-- Chạy sau migration vision_strategy_value_chain. Các objective đang gắn mắt xích cũ sẽ bị bỏ liên kết (SET NULL).

INSERT INTO value_chain_activities (code, label, sort_order) VALUES
  ('stage_1_traffic',    'Giai đoạn 1: Traffic',         1),
  ('stage_2_cdp_data',   'Giai đoạn 2: CDP/Data',        2),
  ('stage_3_adtech',     'Giai đoạn 3: AdTech',           3),
  ('stage_4_performance','Giai đoạn 4: Performance',      4),
  ('stage_5_ecommerce',  'Giai đoạn 5: eCommerce',        5),
  ('stage_6_ai_loop',    'Giai đoạn 6: AI & Loop',        6)
ON CONFLICT (code) DO UPDATE SET
  label      = EXCLUDED.label,
  sort_order = EXCLUDED.sort_order;

-- Xóa các mắt xích cũ (code khác 6 bước trên). objectives.value_chain_activity_id sẽ thành NULL (FK ON DELETE SET NULL)
DELETE FROM value_chain_activities
WHERE code NOT IN (
  'stage_1_traffic', 'stage_2_cdp_data', 'stage_3_adtech',
  'stage_4_performance', 'stage_5_ecommerce', 'stage_6_ai_loop'
);
