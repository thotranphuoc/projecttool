#!/usr/bin/env node
/**
 * Reads MS_Digital_2028_Project_Plan_new.json and outputs SQL to delete all tasks
 * and insert tasks from the plan. Run from pm-app: node scripts/generate-task-seed.js
 */
const fs = require('fs');
const path = require('path');

const jsonPath = path.join(__dirname, '..', 'MS_Digital_2028_Project_Plan_new.json');
const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

function escapeSql(str) {
  if (str == null) return 'NULL';
  return "'" + String(str).replace(/'/g, "''") + "'";
}

function parseDate(ddmmyyyy) {
  if (!ddmmyyyy) return null;
  const [d, m, y] = ddmmyyyy.split('/');
  if (!d || !m || !y) return null;
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

const lines = [
  '-- Generated from MS_Digital_2028_Project_Plan_new.json',
  '-- 1. Delete all existing tasks (subtasks, time_logs, task_comments cascade)',
  'DELETE FROM tasks;',
  '',
  '-- 2. Insert tasks from plan (project_id = first project; set your project if needed)',
  'INSERT INTO tasks (project_id, title, description, status, priority, labels, assignees_preview, start_date, due_date, linked_kr_id, contribution_weight)',
  'SELECT p.id, v.title, v.description, v.status, v.priority, v.labels, v.assignees_preview, v.start_date::date, v.due_date::date, v.linked_kr_id, v.contribution_weight',
  'FROM (VALUES',
];

const values = data.map((t, i) => {
  const title = (t['Tên Task'] || '').trim();
  const code = (t['Mã Task'] || '').trim();
  const startDate = parseDate(t['Start Date']);
  const endDate = parseDate(t['End Date']);
  const labels = code ? `ARRAY[${escapeSql(code)}]` : 'ARRAY[]::text[]';
  const titleEsc = escapeSql(title);
  const descEsc = 'NULL';
  const statusEsc = "'todo'";
  const priorityEsc = "'medium'";
  const assigneesEsc = "'{}'::uuid[]";
  const startEsc = startDate ? escapeSql(startDate) : 'NULL';
  const dueEsc = endDate ? escapeSql(endDate) : 'NULL';
  const krEsc = 'NULL::uuid';
  const weightEsc = '1';
  return `  (${titleEsc}, ${descEsc}, ${statusEsc}, ${priorityEsc}, ${labels}, ${assigneesEsc}, ${startEsc}, ${dueEsc}, ${krEsc}, ${weightEsc})`;
});

lines.push(values.join(',\n'));
lines.push(') AS v(title, description, status, priority, labels, assignees_preview, start_date, due_date, linked_kr_id, contribution_weight)');
lines.push('CROSS JOIN (SELECT id FROM projects LIMIT 1) p;');
lines.push('');
lines.push("SELECT 'Tasks seeded from MS_Digital_2028_Project_Plan_new.json' AS result;");

process.stdout.write(lines.join('\n'));
