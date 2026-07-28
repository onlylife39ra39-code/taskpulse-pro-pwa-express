/**
 * TaskPulse Pro - Core Interactive Application Logic
 */
(function () {
  'use strict';

  // API Base Endpoint
  const API_URL = '/api/todos';
  
  // Application State
  let tasks = [];
  let currentFilterStatus = 'all';
  let currentFilterPriority = 'all';
  let currentSelectedTag = null;
  let searchQuery = '';
  let deferredPrompt = null;

  // DOM Elements
  const taskListEl = document.getElementById('taskList');
  const emptyStateEl = document.getElementById('emptyState');
  const searchInput = document.getElementById('searchInput');
  const priorityFilter = document.getElementById('priorityFilter');
  const tagFilterContainer = document.getElementById('tagFilterContainer');
  const clearCompletedBtn = document.getElementById('clearCompletedBtn');
  const offlineBanner = document.getElementById('offlineBanner');
  const installPwaBtn = document.getElementById('installPwaBtn');
  
  // Modal Elements
  const taskModal = document.getElementById('taskModal');
  const taskForm = document.getElementById('taskForm');
  const modalTitle = document.getElementById('modalTitle');
  const openModalBtn = document.getElementById('openModalBtn');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const cancelModalBtn = document.getElementById('cancelModalBtn');
  const taskIdInput = document.getElementById('taskId');
  const formTitle = document.getElementById('formTitle');
  const formDescription = document.getElementById('formDescription');
  const formStatus = document.getElementById('formStatus');
  const formPriority = document.getElementById('formPriority');
  const formTags = document.getElementById('formTags');

  // Stats Elements
  const statTotal = document.getElementById('statTotal');
  const statPending = document.getElementById('statPending');
  const statInProgress = document.getElementById('statInProgress');
  const statCompleted = document.getElementById('statCompleted');
  const statRate = document.getElementById('statRate');
  const statProgressBar = document.getElementById('statProgressBar');

  // Initial Seed Tasks if offline & empty
  const initialSeedTasks = [
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

  // Initialize Application
  document.addEventListener('DOMContentLoaded', () => {
    initOnlineOfflineListeners();
    initPWA();
    initEventListeners();
    loadTasks();
  });

  // Sync Network Status
  function initOnlineOfflineListeners() {
    const updateOnlineStatus = () => {
      if (!navigator.onLine) {
        offlineBanner.classList.remove('hidden');
      } else {
        offlineBanner.classList.add('hidden');
      }
    };
    window.addEventListener('online', () => {
      updateOnlineStatus();
      showToast('オンラインに復帰しました', 'success');
      syncTasksWithBackend();
    });
    window.addEventListener('offline', () => {
      updateOnlineStatus();
      showToast('オフラインに切り替わりました', 'info');
    });
    updateOnlineStatus();
  }

  // Load Tasks from Server with LocalStorage Fallback
  async function loadTasks() {
    if (navigator.onLine) {
      try {
        const res = await fetch(API_URL);
        if (res.ok) {
          tasks = await res.json();
          saveToLocalStorage();
          render();
          return;
        }
      } catch (err) {
        console.warn('Backend unavailable, loading from localStorage:', err);
      }
    }
    
    // Fallback LocalStorage
    const local = localStorage.getItem('taskpulse_tasks');
    if (local) {
      tasks = JSON.parse(local);
    } else {
      tasks = initialSeedTasks;
      saveToLocalStorage();
    }
    render();
  }

  function saveToLocalStorage() {
    localStorage.setItem('taskpulse_tasks', JSON.stringify(tasks));
  }

  async function syncTasksWithBackend() {
    if (!navigator.onLine) return;
    try {
      await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch: tasks })
      });
    } catch (e) {
      console.error('Batch sync error:', e);
    }
  }

  // Event Listeners Registration
  function initEventListeners() {
    // Search
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.toLowerCase();
      render();
    });

    // Status Tab Filters
    document.querySelectorAll('.status-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        document.querySelectorAll('.status-tab').forEach(b => {
          b.classList.remove('active');
          b.classList.add('text-slate-400');
        });
        const button = e.currentTarget;
        button.classList.add('active');
        button.classList.remove('text-slate-400');
        currentFilterStatus = button.getAttribute('data-filter-status');
        render();
      });
    });

    // Priority Filter Dropdown
    priorityFilter.addEventListener('change', (e) => {
      currentFilterPriority = e.target.value;
      render();
    });

    // Modal open/close
    openModalBtn.addEventListener('click', () => openTaskModal());
    closeModalBtn.addEventListener('click', closeTaskModal);
    cancelModalBtn.addEventListener('click', closeTaskModal);
    taskModal.addEventListener('click', (e) => {
      if (e.target === taskModal) closeTaskModal();
    });

    // Task Form Submission
    taskForm.addEventListener('submit', handleFormSubmit);

    // Clear completed
    clearCompletedBtn.addEventListener('click', handleClearCompleted);
  }

  // Modal Handling
  function openTaskModal(task = null) {
    if (task) {
      modalTitle.querySelector('span').textContent = 'タスク編集';
      taskIdInput.value = task.id;
      formTitle.value = task.title;
      formDescription.value = task.description || '';
      formStatus.value = task.status;
      formPriority.value = task.priority;
      formTags.value = task.tags ? task.tags.join(', ') : '';
    } else {
      modalTitle.querySelector('span').textContent = '新規タスク登録';
      taskForm.reset();
      taskIdInput.value = '';
      formStatus.value = 'pending';
      formPriority.value = 'medium';
    }
    taskModal.classList.remove('hidden');
    taskModal.classList.add('flex');
  }

  function closeTaskModal() {
    taskModal.classList.add('hidden');
    taskModal.classList.remove('flex');
  }

  // Handle Create or Update
  async function handleFormSubmit(e) {
    e.preventDefault();
    const id = taskIdInput.value;
    const title = formTitle.value.trim();
    const description = formDescription.value.trim();
    const status = formStatus.value;
    const priority = formPriority.value;
    const tags = formTags.value.split(',').map(t => t.trim()).filter(Boolean);

    if (!title) return;

    const taskData = {
      id: id || 'task-' + Date.now(),
      title,
      description,
      status,
      priority,
      tags,
      updatedAt: new Date().toISOString()
    };

    if (id) {
      const idx = tasks.findIndex(t => t.id === id);
      if (idx !== -1) tasks[idx] = { ...tasks[idx], ...taskData };
      showToast('タスクを更新しました', 'success');
    } else {
      taskData.createdAt = new Date().toISOString();
      tasks.unshift(taskData);
      showToast('新しいタスクを作成しました', 'success');
    }

    saveToLocalStorage();
    render();
    closeTaskModal();

    // Async Backend Sync
    if (navigator.onLine) {
      try {
        if (id) {
          await fetch(`${API_URL}/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(taskData)
          });
        } else {
          await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(taskData)
          });
        }
      } catch (err) {
        console.error('API Sync Error:', err);
      }
    }
  }

  // Handle Task Deletion
  async function deleteTask(id) {
    tasks = tasks.filter(t => t.id !== id);
    saveToLocalStorage();
    render();
    showToast('タスクを削除しました', 'info');

    if (navigator.onLine) {
      try {
        await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
      } catch (err) {
        console.error('API Delete Error:', err);
      }
    }
  }

  // Handle Task Quick Status Toggle
  async function toggleStatus(id) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    
    // Cycle status: pending -> in_progress -> completed -> pending
    if (task.status === 'pending') task.status = 'in_progress';
    else if (task.status === 'in_progress') task.status = 'completed';
    else task.status = 'pending';

    task.updatedAt = new Date().toISOString();
    saveToLocalStorage();
    render();

    if (navigator.onLine) {
      try {
        await fetch(`${API_URL}/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(task)
        });
      } catch (err) { console.error(err); }
    }
  }

  // Clear Completed Tasks
  async function handleClearCompleted() {
    const completedCount = tasks.filter(t => t.status === 'completed').length;
    if (completedCount === 0) {
      showToast('完了済みのタスクはありません', 'info');
      return;
    }
    if (!confirm(`完了済みの${completedCount}件のタスクを削除しますか？`)) return;

    tasks = tasks.filter(t => t.status !== 'completed');
    saveToLocalStorage();
    render();
    showToast('完了済みタスクをクリアしました', 'success');

    if (navigator.onLine) {
      try {
        await fetch(`${API_URL}/completed`, { method: 'DELETE' });
      } catch (e) { console.error(e); }
    }
  }

  // Render App UI
  function render() {
    renderStats();
    renderTagCloud();
    renderTasks();
  }

  // Calculate and Update Stats
  function renderStats() {
    const total = tasks.length;
    const pending = tasks.filter(t => t.status === 'pending').length;
    const inProgress = tasks.filter(t => t.status === 'in_progress').length;
    const completed = tasks.filter(t => t.status === 'completed').length;
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

    statTotal.textContent = total;
    statPending.textContent = pending;
    statInProgress.textContent = inProgress;
    statCompleted.textContent = completed;
    statRate.textContent = `${rate}%`;
    statProgressBar.style.width = `${rate}%`;
  }

  // Render Tag Filters Cloud
  function renderTagCloud() {
    const allTags = new Set();
    tasks.forEach(t => {
      if (t.tags && Array.isArray(t.tags)) {
        t.tags.forEach(tag => allTags.add(tag));
      }
    });

    tagFilterContainer.innerHTML = '';
    if (allTags.size === 0) return;

    allTags.forEach(tag => {
      const isSelected = currentSelectedTag === tag;
      const tagBtn = document.createElement('button');
      tagBtn.className = `px-2.5 py-0.5 rounded-full text-xs font-medium transition cursor-pointer ${isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700'}`;
      tagBtn.innerHTML = `#${tag}`;
      tagBtn.onclick = () => {
        currentSelectedTag = isSelected ? null : tag;
        render();
      };
      tagFilterContainer.appendChild(tagBtn);
    });
  }

  // Render Task Items Card List
  function renderTasks() {
    let filtered = tasks.filter(t => {
      // Status Filter
      if (currentFilterStatus !== 'all' && t.status !== currentFilterStatus) return false;
      // Priority Filter
      if (currentFilterPriority !== 'all' && t.priority !== currentFilterPriority) return false;
      // Tag Filter
      if (currentSelectedTag && (!t.tags || !t.tags.includes(currentSelectedTag))) return false;
      // Search Query
      if (searchQuery) {
        const matchTitle = t.title.toLowerCase().includes(searchQuery);
        const matchDesc = t.description ? t.description.toLowerCase().includes(searchQuery) : false;
        if (!matchTitle && !matchDesc) return false;
      }
      return true;
    });

    taskListEl.innerHTML = '';

    if (filtered.length === 0) {
      emptyStateEl.classList.remove('hidden');
      emptyStateEl.classList.add('flex');
    } else {
      emptyStateEl.classList.add('hidden');
      emptyStateEl.classList.remove('flex');
      
      filtered.forEach(task => {
        const card = document.createElement('div');
        card.className = `bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 transition-all duration-200 hover:border-slate-600 priority-${task.priority} flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm hover:shadow-md`;
        
        // Status Pill Config
        let statusBadgeClass = '';
        let statusText = '';
        if (task.status === 'completed') {
          statusBadgeClass = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
          statusText = '完了';
        } else if (task.status === 'in_progress') {
          statusBadgeClass = 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30';
          statusText = '進行中';
        } else {
          statusBadgeClass = 'bg-amber-500/10 text-amber-400 border-amber-500/30';
          statusText = '未完了';
        }

        // Priority Label
        const priorityMap = { high: '高', medium: '中', low: '低' };
        const priorityText = priorityMap[task.priority] || task.priority;

        // HTML Content
        card.innerHTML = `
          <div class="flex items-start space-x-3.5 flex-1 w-full">
            <button class="toggle-status-btn mt-0.5 text-slate-500 hover:text-indigo-400 transition text-lg flex-shrink-0">
              ${task.status === 'completed' ? '<i class="fa-solid fa-circle-check text-emerald-400"></i>' : '<i class="fa-regular fa-circle"></i>'}
            </button>
            <div class="space-y-1 flex-1 min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <h4 class="text-sm font-semibold ${task.status === 'completed' ? 'line-through text-slate-500' : 'text-slate-100'} truncate">${escapeHtml(task.title)}</h4>
                <span class="px-2 py-0.5 text-[10px] font-medium border rounded-full ${statusBadgeClass}">${statusText}</span>
                <span class="px-2 py-0.5 text-[10px] font-medium rounded-full bg-slate-700/60 text-slate-300">優先度: ${priorityText}</span>
              </div>
              ${task.description ? `<p class="text-xs text-slate-400 line-clamp-2">${escapeHtml(task.description)}</p>` : ''}
              ${task.tags && task.tags.length > 0 ? `
                <div class="flex flex-wrap gap-1 pt-1">
                  ${task.tags.map(t => `<span class="text-[10px] text-indigo-300 bg-indigo-950/50 px-2 py-0.5 rounded border border-indigo-800/40">#${escapeHtml(t)}</span>`).join('')}
                </div>
              ` : ''}
            </div>
          </div>
          <div class="flex items-center space-x-2 self-end sm:self-center border-t sm:border-t-0 border-slate-700/60 pt-2 sm:pt-0 w-full sm:w-auto justify-end">
            <button class="edit-btn px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-slate-700/50 hover:bg-slate-700 hover:text-white transition">
              <i class="fa-solid fa-pen mr-1"></i>編集
            </button>
            <button class="delete-btn px-2.5 py-1.5 rounded-lg text-xs font-medium text-rose-400 bg-rose-950/30 hover:bg-rose-900/50 hover:text-rose-200 transition">
              <i class="fa-solid fa-trash-can mr-1"></i>削除
            </button>
          </div>
        `;

        // Bind action triggers
        card.querySelector('.toggle-status-btn').onclick = () => toggleStatus(task.id);
        card.querySelector('.edit-btn').onclick = () => openTaskModal(task);
        card.querySelector('.delete-btn').onclick = () => deleteTask(task.id);

        taskListEl.appendChild(card);
      });
    }
  }

  // Utility Escape HTML
  function escapeHtml(str) {
    return str.replace(/[&< me'"]/g, (m) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', ' ': ' ', "'": '&#39;', '"': '&quot;'
    }[m] || m));
  }

  // Toast Notification System
  function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    const bg = type === 'success' ? 'bg-emerald-600' : type === 'error' ? 'bg-rose-600' : 'bg-indigo-600';
    toast.className = `${bg} text-white text-xs font-medium px-4 py-2.5 rounded-xl shadow-xl transition-all transform translate-y-2 opacity-0 pointer-events-auto flex items-center gap-2`;
    toast.innerHTML = `<i class="fa-solid fa-circle-info"></i><span>${message}</span>`;
    
    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.remove('translate-y-2', 'opacity-0');
    }, 10);

    setTimeout(() => {
      toast.classList.add('opacity-0');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // Register Service Worker & Handle PWA Installation
  function initPWA() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then(reg => console.log('SW Registered:', reg.scope))
        .catch(err => console.error('SW Registration Failed:', err));
    }

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      installPwaBtn.classList.remove('hidden');
    });

    installPwaBtn.addEventListener('click', async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        installPwaBtn.classList.add('hidden');
      }
      deferredPrompt = null;
    });
  }
})();