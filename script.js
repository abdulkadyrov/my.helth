/*
 * Основная логика приложения My.Helth
 * Здесь реализовано хранение лекарств в localStorage, генерация чек‑листа на сегодня,
 * управление уведомлениями и взаимодействие с интерфейсом.
 */

(function() {
  // Состояния приложения
  let medications = [];
  let editId = null;

  // Элементы DOM
  const medForm = document.getElementById('med-form');
  const medListEl = document.getElementById('med-list');
  const todayListEl = document.getElementById('today-list');
  const cancelEditBtn = document.getElementById('cancelEdit');
  const saveBtn = document.getElementById('saveBtn');

  /**
   * Получить строку с текущей датой в формате YYYY-MM-DD.
   * @returns {string}
   */
  function todayDateString() {
    const d = new Date();
    return d.toISOString().split('T')[0];
  }

  /**
   * Загрузить список лекарств из localStorage.
   */
  function loadMedications() {
    try {
      const stored = localStorage.getItem('medications');
      medications = stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error('Не удалось загрузить лекарства', e);
      medications = [];
    }
  }

  /**
   * Сохранить список лекарств в localStorage.
   */
  function saveMedications() {
    localStorage.setItem('medications', JSON.stringify(medications));
  }

  /**
   * Сформировать задачи (напоминания) на сегодня на основе лекарств.
   * @returns {Array<{medId:string,medName:string,dose:string,time:string,done:boolean}>}
   */
  function generateTodayTasks() {
    const date = todayDateString();
    const tasks = [];
    medications.forEach(med => {
      // Если период приема указан, проверяем вхождение текущей даты
      const startOK = !med.startDate || date >= med.startDate;
      const endOK = !med.endDate || date <= med.endDate;
      if (startOK && endOK) {
        med.times.forEach(time => {
          tasks.push({ medId: med.id, medName: med.name, dose: med.dose, time: time, done: false });
        });
      }
    });
    // Сортировка по времени
    tasks.sort((a, b) => a.time.localeCompare(b.time));
    return tasks;
  }

  /**
   * Рендеринг списка лекарств.
   */
  function renderMedications() {
    medListEl.innerHTML = '';
    medications.forEach(med => {
      const li = document.createElement('li');
      li.className = 'med-card';
      li.innerHTML = `
        <div>
          <strong>${med.name}</strong> (${med.dose})<br>
          <small>Время: ${med.times.join(', ')}</small><br>
          <small>Период: ${med.startDate || '-'} – ${med.endDate || '∞'}</small>
        </div>
        <div class="actions">
          <button class="edit-btn" data-id="${med.id}" title="Редактировать">✏️</button>
          <button class="delete-btn" data-id="${med.id}" title="Удалить">🗑️</button>
        </div>
      `;
      medListEl.appendChild(li);
    });
  }

  /**
   * Рендеринг чек‑листа на сегодня. Если список задач на сегодня отсутствует в
   * localStorage, он будет создан.
   */
  function renderTodayChecklist() {
    const key = `tasks_${todayDateString()}`;
    let tasks;
    try {
      tasks = localStorage.getItem(key);
      tasks = tasks ? JSON.parse(tasks) : null;
    } catch (e) {
      tasks = null;
    }
    if (!tasks) {
      tasks = generateTodayTasks();
      localStorage.setItem(key, JSON.stringify(tasks));
    }
    todayListEl.innerHTML = '';
    tasks.forEach((task, idx) => {
      const li = document.createElement('li');
      li.className = 'task-item';
      li.innerHTML = `
        <label>
          <input type="checkbox" data-index="${idx}" ${task.done ? 'checked' : ''}> 
          <span>${task.time} – ${task.medName} (${task.dose})</span>
        </label>
      `;
      todayListEl.appendChild(li);
    });
  }

  /**
   * Планирование уведомлений на сегодня. Сначала отменяются предыдущие
   * планировщики, затем создаются новые.
   */
  function scheduleNotifications() {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    // Очистить предыдущие тайм‑ауты
    if (window.scheduledNotifs) {
      window.scheduledNotifs.forEach(id => clearTimeout(id));
    }
    window.scheduledNotifs = [];
    const now = new Date();
    const tasks = JSON.parse(localStorage.getItem(`tasks_${todayDateString()}`) || '[]');
    tasks.forEach(task => {
      if (task.done) return;
      const [hour, minute] = task.time.split(':').map(t => parseInt(t, 10));
      const triggerTime = new Date();
      triggerTime.setHours(hour, minute, 0, 0);
      const delay = triggerTime - now;
      if (delay < 0) return; // уже прошло
      const id = setTimeout(() => {
        navigator.serviceWorker.getRegistration().then(reg => {
          if (reg) {
            reg.showNotification(`Пора принять: ${task.medName}`, {
              body: `Примите ${task.medName} (${task.dose})`,
              icon: 'icons/icon-192.png',
              badge: 'icons/icon-192.png',
              vibrate: [200, 100, 200],
            });
          }
        });
      }, delay);
      window.scheduledNotifs.push(id);
    });
  }

  /**
   * Запрос разрешения на отправку уведомлений.
   */
  function requestNotificationPermission() {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
      Notification.requestPermission().then(result => {
        if (result === 'granted') {
          scheduleNotifications();
        }
      });
    }
  }

  /**
   * Сброс полей формы и режима редактирования.
   */
  function resetForm() {
    medForm.reset();
    editId = null;
    cancelEditBtn.style.display = 'none';
    saveBtn.textContent = 'Сохранить';
  }

  /**
   * Инициализация событий интерфейса.
   */
  function initEventListeners() {
    // Отправка формы
    medForm.addEventListener('submit', function(e) {
      e.preventDefault();
      const name = document.getElementById('medName').value.trim();
      const dose = document.getElementById('medDose').value.trim();
      const timesInput = document.getElementById('medTimes').value.trim();
      const startDate = document.getElementById('startDate').value;
      const endDate = document.getElementById('endDate').value;
      if (!name || !dose || !timesInput || !startDate) {
        alert('Пожалуйста, заполните все обязательные поля.');
        return;
      }
      const times = timesInput.split(',').map(t => t.trim()).filter(t => t);
      if (times.some(t => !/^\d{2}:\d{2}$/.test(t))) {
        alert('Время приёма должно быть в формате HH:MM через запятую.');
        return;
      }
      if (editId) {
        // Обновление существующей записи
        const idx = medications.findIndex(m => m.id === editId);
        if (idx !== -1) {
          medications[idx] = { id: editId, name, dose, times, startDate, endDate };
        }
      } else {
        // Добавление новой записи
        const newMed = {
          id: Date.now().toString(),
          name,
          dose,
          times,
          startDate,
          endDate,
        };
        medications.push(newMed);
      }
      saveMedications();
      renderMedications();
      // Обновить чек‑лист и перепланировать уведомления
      localStorage.removeItem(`tasks_${todayDateString()}`);
      renderTodayChecklist();
      scheduleNotifications();
      resetForm();
    });

    // Обработка нажатий на кнопки редактирования и удаления
    medListEl.addEventListener('click', function(e) {
      const btn = e.target.closest('button');
      if (!btn) return;
      const id = btn.getAttribute('data-id');
      if (btn.classList.contains('edit-btn')) {
        // Режим редактирования
        const med = medications.find(m => m.id === id);
        if (med) {
          editId = id;
          document.getElementById('medName').value = med.name;
          document.getElementById('medDose').value = med.dose;
          document.getElementById('medTimes').value = med.times.join(', ');
          document.getElementById('startDate').value = med.startDate;
          document.getElementById('endDate').value = med.endDate || '';
          cancelEditBtn.style.display = 'inline-block';
          saveBtn.textContent = 'Обновить';
        }
      } else if (btn.classList.contains('delete-btn')) {
        if (confirm('Удалить это лекарство?')) {
          medications = medications.filter(m => m.id !== id);
          saveMedications();
          renderMedications();
          // При удалении пересоздаем список задач на сегодня
          localStorage.removeItem(`tasks_${todayDateString()}`);
          renderTodayChecklist();
          scheduleNotifications();
        }
      }
    });

    // Отмена редактирования
    cancelEditBtn.addEventListener('click', function() {
      resetForm();
    });

    // Обработка чек‑листа: отметка выполнения
    todayListEl.addEventListener('change', function(e) {
      if (e.target && e.target.matches('input[type="checkbox"]')) {
        const idx = parseInt(e.target.getAttribute('data-index'), 10);
        const key = `tasks_${todayDateString()}`;
        let tasks = JSON.parse(localStorage.getItem(key) || '[]');
        if (tasks[idx]) {
          tasks[idx].done = e.target.checked;
          localStorage.setItem(key, JSON.stringify(tasks));
          // Пересчёт уведомлений: убираем напоминание, если задача отмечена как выполненная
          scheduleNotifications();
        }
      }
    });
  }

  /**
   * Регистрация service worker.
   */
  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', function() {
        navigator.serviceWorker.register('service-worker.js').then(() => {
          console.log('Service Worker зарегистрирован');
        }).catch(err => {
          console.warn('Ошибка регистрации Service Worker:', err);
        });
      });
    }
  }

  // Инициализация при загрузке DOM
  document.addEventListener('DOMContentLoaded', function() {
    loadMedications();
    renderMedications();
    renderTodayChecklist();
    initEventListeners();
    registerServiceWorker();
    requestNotificationPermission();
    scheduleNotifications();
  });

})();