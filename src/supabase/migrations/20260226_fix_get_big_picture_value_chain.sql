-- Đảm bảo get_big_picture() trả về value_chain_activity_id / label để tab Chuỗi giá trị hiển thị đúng
CREATE OR REPLACE FUNCTION get_big_picture()
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE result JSON;
BEGIN
  SELECT json_agg(obj_data ORDER BY obj_data->>'type', (obj_data->>'progress_percent')::numeric DESC)
  INTO result
  FROM (
    SELECT jsonb_build_object(
      'id',                         o.id,
      'title',                      o.title,
      'type',                       o.type,
      'status',                     o.status,
      'progress_percent',           o.progress_percent,
      'project_id',                 o.project_id,
      'strategy_id',                o.strategy_id,
      'strategy_title',             s.title,
      'strategy_period',            CASE
        WHEN s.period_quarter IS NOT NULL THEN (s.period_year::text || '-Q' || s.period_quarter::text)
        ELSE s.period_year::text
      END,
      'vision_id',                  v.id,
      'vision_title',               v.title,
      'value_chain_activity_id',    o.value_chain_activity_id,
      'value_chain_activity_code',  vca.code,
      'value_chain_activity_label', vca.label,
      'value_chain_activity_sort_order', vca.sort_order,
      'key_results', (
        SELECT COALESCE(json_agg(kr_data ORDER BY (kr_data->>'weight')::numeric DESC), '[]'::json)
        FROM (
          SELECT jsonb_build_object(
            'id',               kr.id,
            'title',            kr.title,
            'type',             kr.type,
            'progress_percent', kr.progress_percent,
            'weight',           kr.weight,
            'target_value',     kr.target_value,
            'current_value',    kr.current_value,
            'unit',             kr.unit,
            'tasks', (
              SELECT COALESCE(json_agg(
                jsonb_build_object(
                  'id',                  t.id,
                  'title',               t.title,
                  'status',              t.status,
                  'priority',            t.priority,
                  'project_id',         t.project_id,
                  'contribution_weight', t.contribution_weight,
                  'assignees_preview',   t.assignees_preview,
                  'due_date',            t.due_date
                ) ORDER BY t.status, t.updated_at DESC
              ), '[]'::json)
              FROM tasks t
              WHERE t.linked_kr_id = kr.id
                AND t.status IN ('in_progress', 'review')
            )
          ) kr_data
          FROM key_results kr WHERE kr.objective_id = o.id
        ) sub_kr
      )
    ) obj_data
    FROM objectives o
    LEFT JOIN strategies s ON s.id = o.strategy_id
    LEFT JOIN visions v ON v.id = s.vision_id
    LEFT JOIN value_chain_activities vca ON vca.id = o.value_chain_activity_id
  ) sub_obj;

  RETURN COALESCE(result, '[]'::json);
END;
$$;

GRANT EXECUTE ON FUNCTION get_big_picture() TO authenticated;
