const express = require('express');
const { getDB } = require('../database');
const { authenticate, requireProjectAccess } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/', authenticate, async (req, res) => {
  try {
    const db = await getDB();
    const { status, priority, project_id } = req.query;
    let conditions = [], params = [];
    if (req.user.role !== 'admin') { conditions.push('(t.assigned_to = ? OR t.created_by = ?)'); params.push(req.user.id, req.user.id); }
    if (status) { conditions.push('t.status = ?'); params.push(status); }
    if (priority) { conditions.push('t.priority = ?'); params.push(priority); }
    if (project_id) { conditions.push('t.project_id = ?'); params.push(project_id); }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const tasks = db.prepare(`SELECT t.*, p.name as project_name, u.name as assignee_name, u.email as assignee_email, u.avatar_color as assignee_color, c.name as creator_name FROM tasks t LEFT JOIN projects p ON t.project_id = p.id LEFT JOIN users u ON t.assigned_to = u.id LEFT JOIN users c ON t.created_by = c.id ${where} ORDER BY t.created_at DESC`).all(...params);
    res.json({ tasks });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

router.post('/project/:projectId', authenticate, requireProjectAccess, async (req, res) => {
  try {
    const { title, description, assigned_to, priority, due_date, status } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ error: 'Task title is required' });
    const db = await getDB();

    let resolvedAssigneeId = null;
    if (assigned_to) {
      const emailStr = String(assigned_to).trim();
      if (emailStr.includes('@')) {
        const user = db.prepare('SELECT id FROM users WHERE email = ?').get(emailStr);
        if (!user) return res.status(400).json({ error: `User with email "${emailStr}" not found` });
        resolvedAssigneeId = user.id;
      } else {
        resolvedAssigneeId = parseInt(assigned_to) || null;
      }
    }

    if (resolvedAssigneeId) {
      // Auto-join project if not a member
      const member = db.prepare('SELECT * FROM project_members WHERE project_id = ? AND user_id = ?').get(req.params.projectId, resolvedAssigneeId);
      if (!member) {
        db.prepare('INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, \'member\')').run(req.params.projectId, resolvedAssigneeId);
      }
    }

    const result = db.prepare('INSERT INTO tasks (title, description, project_id, assigned_to, created_by, priority, due_date, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(title.trim(), description || '', req.params.projectId, resolvedAssigneeId, req.user.id, priority || 'medium', due_date || null, status || 'todo');
    db.prepare('UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(req.params.projectId);
    const task = db.prepare('SELECT t.*, u.name as assignee_name, u.email as assignee_email, u.avatar_color as assignee_color, p.name as project_name FROM tasks t LEFT JOIN users u ON t.assigned_to = u.id LEFT JOIN projects p ON t.project_id = p.id WHERE t.id = ?').get(result.lastInsertRowid);
    db.save();
    res.status(201).json({ task });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

router.put('/:id', authenticate, async (req, res) => {
  try {
    const db = await getDB();
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    const { title, description, assigned_to, status, priority, due_date } = req.body;

    let resolvedAssigneeId = undefined;
    if (assigned_to !== undefined) {
      if (assigned_to) {
        const emailStr = String(assigned_to).trim();
        if (emailStr.includes('@')) {
          const user = db.prepare('SELECT id FROM users WHERE email = ?').get(emailStr);
          if (!user) return res.status(400).json({ error: `User with email "${emailStr}" not found` });
          resolvedAssigneeId = user.id;
        } else {
          resolvedAssigneeId = parseInt(assigned_to) || null;
        }
      } else {
        resolvedAssigneeId = null;
      }

      if (resolvedAssigneeId) {
        // Auto-join project if not a member
        const member = db.prepare('SELECT * FROM project_members WHERE project_id = ? AND user_id = ?').get(task.project_id, resolvedAssigneeId);
        if (!member) {
          db.prepare('INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, \'member\')').run(task.project_id, resolvedAssigneeId);
        }
      }
    }

    db.prepare('UPDATE tasks SET title = COALESCE(?, title), description = COALESCE(?, description), assigned_to = ?, status = COALESCE(?, status), priority = COALESCE(?, priority), due_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(title, description, resolvedAssigneeId !== undefined ? resolvedAssigneeId : task.assigned_to, status, priority, due_date !== undefined ? due_date : task.due_date, req.params.id);
    db.prepare('UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(task.project_id);
    const updated = db.prepare('SELECT t.*, u.name as assignee_name, u.email as assignee_email, u.avatar_color as assignee_color, p.name as project_name FROM tasks t LEFT JOIN users u ON t.assigned_to = u.id LEFT JOIN projects p ON t.project_id = p.id WHERE t.id = ?').get(req.params.id);
    db.save();
    res.json({ task: updated });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const db = await getDB();
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
    db.save();
    res.json({ message: 'Task deleted' });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;
