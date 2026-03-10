-- Đặt độ ưu tiên cao nhất (critical) cho 15 task ưu tiên theo Mã Task
-- Chạy sau khi đã seed tasks từ MS_Digital_2028_Project_Plan_new.json

UPDATE tasks
SET priority = 'critical', updated_at = now()
WHERE labels && ARRAY[
  'L2.3.1', 'L2.1.1', 'P1.1.1', 'P1.2.1', 'L1.1.1', 'F1.1.1', 'L1.2.1',
  'P2.1.1', 'L3.1.1', 'L3.2.1', 'P1.3.1', 'P3.1.1', 'L1.4.1', 'F1.4.1', 'L2.5.1'
]::text[];
