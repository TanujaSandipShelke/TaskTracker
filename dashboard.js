const express = require('express');
const { getDB } = require('../database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/', authenticate, async (req, res) => {
  try {
    const db = await getDB();
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';

    const projectCount = isAdmin
      ? db.prepare('SELECT COUNT(*) as count FROM projects').get().count
      : db.prepare('SELECT COUNT(DISTINCT p.id) as count FROM projects p INNER JOIN project_members pm ON p.id = pm.project_id WHERE pm.user_id = ?').get(userId).count;

    const taskBase = isAdmin ? '' : 'AND (t.assigned_to = ? OR t.created_by = ?)';
    const tp = isAdmin ? [] : [userId, userId];

    const totalTasks = db.prepare(`SELECT COUNT(*) as count FROM tasks t WHERE 1=1 ${taskBase}`).get(...tp).count;
    const backlogTasks = db.prepare(`SELECT COUNT(*) as count FROM tasks t WHERE t.status = 'backlog' ${taskBase}`).get(...tp).count;
    const todoTasks = db.prepare(`SELECT COUNT(*) as count FROM tasks t WHERE t.status = 'todo' ${taskBase}`).get(...tp).count;
    const inProgressTasks = db.prepare(`SELECT COUNT(*) as count FROM tasks t WHERE t.status = 'in-progress' ${taskBase}`).get(...tp).count;
    const reviewTasks = db.prepare(`SELECT COUNT(*) as count FROM tasks t WHERE t.status = 'review' ${taskBase}`).get(...tp).count;
    const doneTasks = db.prepare(`SELECT COUNT(*) as count FROM tasks t WHERE t.status = 'done' ${taskBase}`).get(...tp).count;

    const overdueTasks = db.prepare(`SELECT t.*, p.name as project_name, u.name as assignee_name, u.email as assignee_email, u.avatar_color as assignee_color FROM tasks t LEFT JOIN projects p ON t.project_id = p.id LEFT JOIN users u ON t.assigned_to = u.id WHERE t.due_date < date('now') AND t.status != 'done' ${taskBase} ORDER BY t.due_date ASC LIMIT 10`).all(...tp);
    const upcomingTasks = db.prepare(`SELECT t.*, p.name as project_name, u.name as assignee_name, u.email as assignee_email, u.avatar_color as assignee_color FROM tasks t LEFT JOIN projects p ON t.project_id = p.id LEFT JOIN users u ON t.assigned_to = u.id WHERE t.due_date >= date('now') AND t.status != 'done' ${taskBase} ORDER BY t.due_date ASC LIMIT 10`).all(...tp);
    const recentTasks = db.prepare(`SELECT t.*, p.name as project_name, u.name as assignee_name, u.email as assignee_email, u.avatar_color as assignee_color FROM tasks t LEFT JOIN projects p ON t.project_id = p.id LEFT JOIN users u ON t.assigned_to = u.id WHERE 1=1 ${taskBase} ORDER BY t.updated_at DESC LIMIT 8`).all(...tp);
    const teamCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;

    const heatmap = db.prepare(`
      SELECT date(t.updated_at) as date, COUNT(*) as count 
      FROM tasks t 
      WHERE t.updated_at >= date('now', '-84 days') ${taskBase}
      GROUP BY date(t.updated_at)
    `).all(...tp);

    res.json({
      stats: { projects: projectCount, totalTasks, backlogTasks, todoTasks, inProgressTasks, reviewTasks, doneTasks, teamMembers: teamCount },
      overdueTasks, upcomingTasks, recentTasks, heatmap
    });
  } catch (err) { console.error('Dashboard error:', err); res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;
