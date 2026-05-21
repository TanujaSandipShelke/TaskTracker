const express = require('express');
const { getDB } = require('../database');
const { authenticate, requireProjectAccess, requireProjectAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/', authenticate, async (req, res) => {
  try {
    const db = await getDB();
    let projects;
    if (req.user.role === 'admin') {
      projects = db.prepare(`SELECT p.*, u.name as creator_name,
        (SELECT COUNT(*) FROM project_members WHERE project_id = p.id) as member_count,
        (SELECT COUNT(*) FROM tasks WHERE project_id = p.id) as task_count,
        (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND status = 'done') as completed_tasks
        FROM projects p LEFT JOIN users u ON p.created_by = u.id ORDER BY p.updated_at DESC`).all();
    } else {
      projects = db.prepare(`SELECT p.*, u.name as creator_name,
        (SELECT COUNT(*) FROM project_members WHERE project_id = p.id) as member_count,
        (SELECT COUNT(*) FROM tasks WHERE project_id = p.id) as task_count,
        (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND status = 'done') as completed_tasks
        FROM projects p LEFT JOIN users u ON p.created_by = u.id
        INNER JOIN project_members pm ON p.id = pm.project_id AND pm.user_id = ?
        ORDER BY p.updated_at DESC`).all(req.user.id);
    }
    res.json({ projects });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Project name is required' });
    const db = await getDB();
    const result = db.prepare('INSERT INTO projects (name, description, created_by) VALUES (?, ?, ?)').run(name.trim(), description || '', req.user.id);
    db.prepare('INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)').run(result.lastInsertRowid, req.user.id, 'admin');
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(result.lastInsertRowid);
    db.save();
    res.status(201).json({ project });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

router.get('/:id', authenticate, requireProjectAccess, async (req, res) => {
  try {
    const db = await getDB();
    const project = db.prepare('SELECT p.*, u.name as creator_name FROM projects p LEFT JOIN users u ON p.created_by = u.id WHERE p.id = ?').get(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const members = db.prepare('SELECT u.id, u.name, u.email, u.avatar_color, pm.role, pm.joined_at FROM project_members pm JOIN users u ON pm.user_id = u.id WHERE pm.project_id = ?').all(req.params.id);
    const tasks = db.prepare(`SELECT t.*, u.name as assignee_name, u.email as assignee_email, u.avatar_color as assignee_color FROM tasks t LEFT JOIN users u ON t.assigned_to = u.id WHERE t.project_id = ? ORDER BY CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, t.created_at DESC`).all(req.params.id);
    res.json({ project, members, tasks });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

router.put('/:id', authenticate, requireProjectAccess, requireProjectAdmin, async (req, res) => {
  try {
    const { name, description, status } = req.body;
    const db = await getDB();
    db.prepare('UPDATE projects SET name = COALESCE(?, name), description = COALESCE(?, description), status = COALESCE(?, status), updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(name, description, status, req.params.id);
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
    db.save();
    res.json({ project });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

router.delete('/:id', authenticate, requireProjectAccess, requireProjectAdmin, async (req, res) => {
  try {
    const db = await getDB();
    db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
    db.save();
    res.json({ message: 'Project deleted' });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

router.post('/:id/members', authenticate, requireProjectAccess, requireProjectAdmin, async (req, res) => {
  try {
    const { user_id, email, role } = req.body;
    const db = await getDB();
    let targetUserId = user_id;

    if (email) {
      const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email.trim());
      if (!existingUser) {
        // Simulate inviting user by email
        return res.status(200).json({ invited: true, email, message: `Invitation sent to ${email}!` });
      }
      targetUserId = existingUser.id;
    }

    if (!targetUserId) return res.status(400).json({ error: 'User ID or Email is required' });
    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(targetUserId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const existing = db.prepare('SELECT id FROM project_members WHERE project_id = ? AND user_id = ?').get(req.params.id, targetUserId);
    if (existing) return res.status(409).json({ error: 'User is already a member' });
    db.prepare('INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)').run(req.params.id, targetUserId, role || 'member');
    const members = db.prepare('SELECT u.id, u.name, u.email, u.avatar_color, pm.role, pm.joined_at FROM project_members pm JOIN users u ON pm.user_id = u.id WHERE pm.project_id = ?').all(req.params.id);
    db.save();
    res.status(201).json({ members });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

router.put('/:id/members/:userId', authenticate, requireProjectAccess, requireProjectAdmin, async (req, res) => {
  try {
    const { role } = req.body;
    if (!role) return res.status(400).json({ error: 'Role is required' });
    const db = await getDB();
    db.prepare('UPDATE project_members SET role = ? WHERE project_id = ? AND user_id = ?').run(role, req.params.id, req.params.userId);
    const members = db.prepare('SELECT u.id, u.name, u.email, u.avatar_color, pm.role, pm.joined_at FROM project_members pm JOIN users u ON pm.user_id = u.id WHERE pm.project_id = ?').all(req.params.id);
    db.save();
    res.json({ members });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

router.delete('/:id/members/:userId', authenticate, requireProjectAccess, requireProjectAdmin, async (req, res) => {
  try {
    const db = await getDB();
    db.prepare('DELETE FROM project_members WHERE project_id = ? AND user_id = ?').run(req.params.id, req.params.userId);
    db.prepare('UPDATE tasks SET assigned_to = NULL WHERE project_id = ? AND assigned_to = ?').run(req.params.id, req.params.userId);
    db.save();
    res.json({ message: 'Member removed' });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;
