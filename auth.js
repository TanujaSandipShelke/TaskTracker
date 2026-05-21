const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDB } = require('../database');
const { JWT_SECRET, authenticate } = require('../middleware/auth');

const router = express.Router();

router.post('/signup', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Name, email, and password are required' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Invalid email format' });
    if (!email.endsWith('@ethara.ai')) return res.status(400).json({ error: 'Only @ethara.ai email addresses are allowed' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

    const db = await getDB();
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const hashedPassword = bcrypt.hashSync(password, 10);
    const colors = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1'];
    const avatarColor = colors[Math.floor(Math.random() * colors.length)];
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    const userRole = userCount === 0 ? 'admin' : (role === 'admin' ? 'admin' : 'member');

    // Automatically verify users immediately
    const result = db.prepare('INSERT INTO users (name, email, password, role, avatar_color, is_verified) VALUES (?, ?, ?, ?, ?, 1)').run(name, email, hashedPassword, userRole, avatarColor);
    const token = jwt.sign({ id: result.lastInsertRowid }, JWT_SECRET, { expiresIn: '7d' });
    db.save();

    res.status(201).json({ 
      token, 
      user: { 
        id: result.lastInsertRowid, 
        name, 
        email, 
        role: userRole, 
        avatar_color: avatarColor, 
        is_verified: 1
      }
    });
  } catch (err) { console.error('Signup error:', err); res.status(500).json({ error: 'Server error' }); }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
    const db = await getDB();
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user || !bcrypt.compareSync(password, user.password)) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, avatar_color: user.avatar_color, is_verified: 1 } });
  } catch (err) { console.error('Login error:', err); res.status(500).json({ error: 'Server error' }); }
});

router.get('/me', authenticate, (req, res) => { res.json({ user: req.user }); });

router.get('/users', authenticate, async (req, res) => {
  try {
    const db = await getDB();
    const users = db.prepare('SELECT id, name, email, role, avatar_color FROM users ORDER BY name').all();
    res.json({ users });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

router.delete('/users/:id', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const userIdToDelete = parseInt(req.params.id);
    const adminId = req.user.id;

    if (adminId === userIdToDelete) {
      return res.status(400).json({ error: 'You cannot remove yourself' });
    }

    const db = await getDB();
    const userExists = db.prepare('SELECT id FROM users WHERE id = ?').get(userIdToDelete);
    if (!userExists) {
      return res.status(404).json({ error: 'User not found' });
    }

    // 1. Remove from project members
    db.prepare('DELETE FROM project_members WHERE user_id = ?').run(userIdToDelete);

    // 2. Unassign tasks
    db.prepare('UPDATE tasks SET assigned_to = NULL WHERE assigned_to = ?').run(userIdToDelete);

    // 3. Re-assign tasks created by them to the current admin
    db.prepare('UPDATE tasks SET created_by = ? WHERE created_by = ?').run(adminId, userIdToDelete);

    // 4. Re-assign projects created by them to the current admin
    db.prepare('UPDATE projects SET created_by = ? WHERE created_by = ?').run(adminId, userIdToDelete);

    // 5. Delete the user
    db.prepare('DELETE FROM users WHERE id = ?').run(userIdToDelete);

    db.save();
    res.json({ message: 'User removed successfully' });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
