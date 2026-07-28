const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// In-memory data store for server backend
let todos = [
  {
    id: 'task-1',
    title: '要件定義ドキュメントの確認',
    description: '次期プロジェクトのPWA設計書をレビューする',
    status: 'in_progress',
    priority: 'high',
    tags: ['Work', 'Important'],
    createdAt: new Date().toISOString()
  },
  {
    id: 'task-2',
    title: 'フロントエンドコンポーネント実装',
    description: 'Tailwind CSSを利用したレスポンシブなToDo一覧画面の構築',
    status: 'completed',
    priority: 'medium',
    tags: ['Frontend', 'PWA'],
    createdAt: new Date().toISOString()
  }
];

// GET /api/todos - Fetch all tasks
app.get('/api/todos', (req, res) => {
  const { status, priority, search } = req.query;
  let filtered = [...todos];

  if (status && status !== 'all') {
    filtered = filtered.filter(t => t.status === status);
  }
  if (priority && priority !== 'all') {
    filtered = filtered.filter(t => t.priority === priority);
  }
  if (search) {
    const query = search.toLowerCase();
    filtered = filtered.filter(t => t.title.toLowerCase().includes(query) || (t.description && t.description.toLowerCase().includes(query)));
  }

  res.json(filtered);
});

// POST /api/todos - Create new task or Batch Sync
app.post('/api/todos', (req, res) => {
  if (req.body.batch && Array.isArray(req.body.batch)) {
    todos = req.body.batch;
    return res.status(200).json({ message: 'Batch synced', count: todos.length });
  }

  const { title, description, status = 'pending', priority = 'medium', tags = [] } = req.body;
  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }

  const newTodo = {
    id: req.body.id || 'task-' + Date.now(),
    title,
    description: description || '',
    status,
    priority,
    tags,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  todos.unshift(newTodo);
  res.status(201).json(newTodo);
});

// PUT /api/todos/:id - Update existing task
app.put('/api/todos/:id', (req, res) => {
  const { id } = req.params;
  const idx = todos.findIndex(t => t.id === id);

  if (idx === -1) {
    return res.status(404).json({ error: 'Task not found' });
  }

  todos[idx] = {
    ...todos[idx],
    ...req.body,
    updatedAt: new Date().toISOString()
  };

  res.json(todos[idx]);
});

// DELETE /api/todos/completed - Clear completed tasks
app.delete('/api/todos/completed', (req, res) => {
  const initialCount = todos.length;
  todos = todos.filter(t => t.status !== 'completed');
  res.json({ message: 'Completed tasks removed', removed: initialCount - todos.length });
});

// DELETE /api/todos/:id - Delete single task
app.delete('/api/todos/:id', (req, res) => {
  const { id } = req.params;
  todos = todos.filter(t => t.id !== id);
  res.json({ message: 'Task deleted successfully', id });
});

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// SPA Catch-all Route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});