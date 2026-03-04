-- ============================================================
-- REFACTOR PRD SEED: Xóa toàn bộ O/KR; đảm bảo 1V, 3S, 5 KSF, 7 VC, 4 P; insert 11 O, 25 KR
-- Chạy sau: 20260306_refactor_prd_schema.sql
-- ============================================================

-- 1. Xóa toàn bộ key_results và objectives
DELETE FROM key_results;
DELETE FROM objectives;

DO $$
DECLARE
  v_vision_id     UUID;
  v_s1_id         UUID;
  v_s2_id         UUID;
  v_s3_id         UUID;
  v_p_f           UUID;
  v_p_c           UUID;
  v_p_p           UUID;
  v_p_l           UUID;
  v_vc1           UUID;
  v_vc2           UUID;
  v_vc3           UUID;
  v_vc4           UUID;
  v_vc5           UUID;
  v_vc6           UUID;
  v_vc7           UUID;
  v_ksf1          UUID;
  v_ksf2          UUID;
  v_ksf3          UUID;
  v_ksf4          UUID;
  v_ksf5          UUID;
BEGIN
  -- 2. Vision: lấy đầu tiên hoặc tạo mới
  SELECT id INTO v_vision_id FROM visions ORDER BY sort_order, created_at LIMIT 1;
  IF v_vision_id IS NULL THEN
    INSERT INTO visions (title, description, sort_order)
    VALUES ('MS-STRAT-OS 2028', 'Tầm nhìn chiến lược 2028', 1)
    RETURNING id INTO v_vision_id;
  END IF;

  -- 3. Strategies: xóa strategy company-wide của vision này, insert 3 (Dữ liệu, Sản phẩm, Hệ sinh thái)
  DELETE FROM strategies WHERE vision_id = v_vision_id AND project_id IS NULL;
  INSERT INTO strategies (vision_id, project_id, title, description, period_year, period_quarter, sort_order)
  VALUES
    (v_vision_id, NULL, 'Chiến lược Dữ liệu', NULL, 2028, NULL, 1),
    (v_vision_id, NULL, 'Chiến lược Sản phẩm', NULL, 2028, NULL, 2),
    (v_vision_id, NULL, 'Chiến lược Hệ sinh thái', NULL, 2028, NULL, 3);
  SELECT id INTO v_s1_id FROM strategies WHERE vision_id = v_vision_id AND sort_order = 1 LIMIT 1;
  SELECT id INTO v_s2_id FROM strategies WHERE vision_id = v_vision_id AND sort_order = 2 LIMIT 1;
  SELECT id INTO v_s3_id FROM strategies WHERE vision_id = v_vision_id AND sort_order = 3 LIMIT 1;

  -- 4. Perspectives (đã có từ schema migration)
  SELECT id INTO v_p_f FROM perspectives WHERE code = 'F' LIMIT 1;
  SELECT id INTO v_p_c FROM perspectives WHERE code = 'C' LIMIT 1;
  SELECT id INTO v_p_p FROM perspectives WHERE code = 'P' LIMIT 1;
  SELECT id INTO v_p_l FROM perspectives WHERE code = 'L' LIMIT 1;

  -- 5. Value chain (7 giai đoạn)
  SELECT id INTO v_vc1 FROM value_chain_activities WHERE code = 'stage_1_traffic' LIMIT 1;
  SELECT id INTO v_vc2 FROM value_chain_activities WHERE code = 'stage_2_cdp_data' LIMIT 1;
  SELECT id INTO v_vc3 FROM value_chain_activities WHERE code = 'stage_3_adtech' LIMIT 1;
  SELECT id INTO v_vc4 FROM value_chain_activities WHERE code = 'stage_4_performance' LIMIT 1;
  SELECT id INTO v_vc5 FROM value_chain_activities WHERE code = 'stage_5_commercial_sales' LIMIT 1;
  SELECT id INTO v_vc6 FROM value_chain_activities WHERE code = 'stage_5_ecommerce' LIMIT 1;
  SELECT id INTO v_vc7 FROM value_chain_activities WHERE code = 'stage_6_ai_loop' LIMIT 1;

  -- 6. KSF: thay thế bằng 5 KSF theo spec
  DELETE FROM ksfs;
  INSERT INTO ksfs (code, label, sort_order) VALUES
    ('ksf_1', 'Hệ sinh thái khép kín', 1),
    ('ksf_2', 'Dữ liệu định danh & Cookieless', 2),
    ('ksf_3', 'Yield Leadership & Scaling', 3),
    ('ksf_4', 'AI-Centric', 4),
    ('ksf_5', 'Năng lực lõi & Privacy-First', 5);
  SELECT id INTO v_ksf1 FROM ksfs WHERE code = 'ksf_1' LIMIT 1;
  SELECT id INTO v_ksf2 FROM ksfs WHERE code = 'ksf_2' LIMIT 1;
  SELECT id INTO v_ksf3 FROM ksfs WHERE code = 'ksf_3' LIMIT 1;
  SELECT id INTO v_ksf4 FROM ksfs WHERE code = 'ksf_4' LIMIT 1;
  SELECT id INTO v_ksf5 FROM ksfs WHERE code = 'ksf_5' LIMIT 1;

  -- 7. Insert 11 Objectives (F1,F2, C1,C2,C3, P1,P2,P3, L1,L2,L3) — project_id NULL, gắn strategy/perspective/vc/ksf
  INSERT INTO objectives (project_id, title, type, status, progress_percent, strategy_id, value_chain_activity_id, ksf_id, perspective_id) VALUES
    (NULL, 'F1: Tăng trưởng doanh thu bền vững', 'financial', 'on_track', 0, v_s1_id, v_vc1, v_ksf3, v_p_f),
    (NULL, 'F2: Tối ưu chi phí & hiệu quả đầu tư', 'financial', 'on_track', 0, v_s2_id, v_vc4, v_ksf3, v_p_f),
    (NULL, 'C1: Trải nghiệm khách hàng & retention', 'customer', 'on_track', 0, v_s1_id, v_vc2, v_ksf2, v_p_c),
    (NULL, 'C2: Mở rộng thị phần & thương hiệu', 'customer', 'on_track', 0, v_s2_id, v_vc3, v_ksf1, v_p_c),
    (NULL, 'C3: Hài lòng & NPS', 'customer', 'on_track', 0, v_s2_id, v_vc5, v_ksf4, v_p_c),
    (NULL, 'P1: Chuỗi giá trị Data → AdTech', 'internal', 'on_track', 0, v_s1_id, v_vc2, v_ksf2, v_p_p),
    (NULL, 'P2: Performance & Commercial', 'internal', 'on_track', 0, v_s2_id, v_vc5, v_ksf3, v_p_p),
    (NULL, 'P3: Hệ sinh thái & tích hợp', 'internal', 'on_track', 0, v_s3_id, v_vc6, v_ksf1, v_p_p),
    (NULL, 'L1: Năng lực AI & data', 'learning', 'on_track', 0, v_s3_id, v_vc7, v_ksf4, v_p_l),
    (NULL, 'L2: Văn hóa & quản trị', 'learning', 'on_track', 0, v_s3_id, v_vc7, v_ksf5, v_p_l),
    (NULL, 'L3: Đổi mới & thử nghiệm', 'learning', 'on_track', 0, v_s3_id, v_vc7, v_ksf5, v_p_l);
END $$;

-- Return IDs for next insert (DO block can't pass to outer INSERT). Use temp table or insert in same DO.
-- We'll do 11 INSERT ... RETURNING and then 25 INSERT into key_results in a second DO that selects objective ids by title pattern.
DO $$
DECLARE
  o_f1 UUID; o_f2 UUID; o_c1 UUID; o_c2 UUID; o_c3 UUID;
  o_p1 UUID; o_p2 UUID; o_p3 UUID; o_l1 UUID; o_l2 UUID; o_l3 UUID;
BEGIN
  SELECT id INTO o_f1 FROM objectives WHERE title LIKE 'F1:%' LIMIT 1;
  SELECT id INTO o_f2 FROM objectives WHERE title LIKE 'F2:%' LIMIT 1;
  SELECT id INTO o_c1 FROM objectives WHERE title LIKE 'C1:%' LIMIT 1;
  SELECT id INTO o_c2 FROM objectives WHERE title LIKE 'C2:%' LIMIT 1;
  SELECT id INTO o_c3 FROM objectives WHERE title LIKE 'C3:%' LIMIT 1;
  SELECT id INTO o_p1 FROM objectives WHERE title LIKE 'P1:%' LIMIT 1;
  SELECT id INTO o_p2 FROM objectives WHERE title LIKE 'P2:%' LIMIT 1;
  SELECT id INTO o_p3 FROM objectives WHERE title LIKE 'P3:%' LIMIT 1;
  SELECT id INTO o_l1 FROM objectives WHERE title LIKE 'L1:%' LIMIT 1;
  SELECT id INTO o_l2 FROM objectives WHERE title LIKE 'L2:%' LIMIT 1;
  SELECT id INTO o_l3 FROM objectives WHERE title LIKE 'L3:%' LIMIT 1;

  -- 8. Insert 25 Key Results (weight ≤ 1, type metric)
  INSERT INTO key_results (objective_id, title, type, target_value, current_value, unit, weight, progress_percent) VALUES
    (o_f1, 'KR F1.1: Doanh thu mục tiêu 2028', 'metric', 100, 0, '%', 0.5, 0),
    (o_f1, 'KR F1.2: Tăng trưởng YoY', 'metric', 20, 0, '%', 0.5, 0),
    (o_f2, 'KR F2.1: Giảm chi phí vận hành', 'metric', 15, 0, '%', 0.6, 0),
    (o_f2, 'KR F2.2: ROI campaign', 'metric', 120, 0, '%', 0.4, 0),
    (o_c1, 'KR C1.1: Retention rate', 'metric', 85, 0, '%', 0.5, 0),
    (o_c1, 'KR C1.2: CLV cải thiện', 'metric', 25, 0, '%', 0.5, 0),
    (o_c2, 'KR C2.1: Thị phần', 'metric', 18, 0, '%', 0.4, 0),
    (o_c2, 'KR C2.2: Brand awareness', 'metric', 70, 0, '%', 0.3, 0),
    (o_c2, 'KR C2.3: Acquisition cost', 'metric', -10, 0, '%', 0.3, 0),
    (o_c3, 'KR C3.1: NPS score', 'metric', 50, 0, 'điểm', 0.5, 0),
    (o_c3, 'KR C3.2: CSAT', 'metric', 90, 0, '%', 0.5, 0),
    (o_p1, 'KR P1.1: Data pipeline coverage', 'metric', 95, 0, '%', 0.5, 0),
    (o_p1, 'KR P1.2: AdTech yield', 'metric', 30, 0, '%', 0.5, 0),
    (o_p2, 'KR P2.1: Conversion rate', 'metric', 5, 0, '%', 0.5, 0),
    (o_p2, 'KR P2.2: Commercial GMV', 'metric', 100, 0, '%', 0.5, 0),
    (o_p3, 'KR P3.1: Đối tác tích hợp', 'metric', 20, 0, 'đối tác', 0.5, 0),
    (o_p3, 'KR P3.2: API adoption', 'metric', 80, 0, '%', 0.5, 0),
    (o_l1, 'KR L1.1: AI use cases triển khai', 'metric', 10, 0, 'use case', 0.35, 0),
    (o_l1, 'KR L1.2: Data literacy', 'metric', 90, 0, '%', 0.35, 0),
    (o_l1, 'KR L1.3: Automation rate', 'metric', 60, 0, '%', 0.3, 0),
    (o_l2, 'KR L2.1: Chương trình đào tạo', 'metric', 100, 0, '%', 0.5, 0),
    (o_l2, 'KR L2.2: Governance score', 'metric', 85, 0, '%', 0.5, 0),
    (o_l3, 'KR L3.1: Sáng kiến POC', 'metric', 15, 0, 'POC', 0.35, 0),
    (o_l3, 'KR L3.2: Time-to-market', 'metric', -20, 0, '%', 0.35, 0),
    (o_l3, 'KR L3.3: Innovation index', 'metric', 75, 0, '%', 0.3, 0);
END $$;
