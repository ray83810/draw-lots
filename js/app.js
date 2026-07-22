/**
 * Main Application Controller - Coordinates state, UI events, and animations.
 */

// Global State
let appState = {
  themes: [],
  currentThemeId: '',
  selectedMode: 'slots', // 'slots', 'wheel', 'cards'
  isDrawing: false,
  autoRecord: false
};

// UI Components instances
let luckyWheelInstance = null;
let slotMachineInstance = null;
let cardFlipInstance = null;
let confettiInstance = null;

// Screen Recording Globals
let mediaRecorderInstance = null;
let recordedChunks = [];
let recordingStream = null;

// Constant Storage Keys
const THEMES_STORAGE_KEY = 'cs_lottery_themes';
const ACTIVE_THEME_KEY = 'cs_lottery_current_theme_id';
const MODE_STORAGE_KEY = 'cs_lottery_mode';
const COLOR_SCHEME_KEY = 'cs_lottery_color_scheme';
const AUTO_RECORD_KEY = 'cs_lottery_auto_record';

// Default Themes Mock
const DEFAULT_THEMES = [
  {
    id: 't_default_duty',
    name: '客服輪值抽籤 🧹',
    preventRepeat: true,
    drawnIds: [],
    candidates: [
      { id: 'c1', name: 'Alex Chen', weight: 1, active: true },
      { id: 'c2', name: 'Amber Wang', weight: 1, active: true },
      { id: 'c3', name: 'Evan Liu', weight: 1, active: true },
      { id: 'c4', name: 'Howard Chen', weight: 1, active: true },
      { id: 'c5', name: 'Jacky Lee', weight: 1, active: true },
      { id: 'c6', name: 'Jian Kai Ding', weight: 1, active: true },
      { id: 'c7', name: 'Molly Song', weight: 1, active: true },
      { id: 'c8', name: 'Rex Liao', weight: 1, active: true },
      { id: 'c9', name: 'Sherry Lin', weight: 1, active: true }
    ]
  },
  {
    id: 't_default_lunch',
    name: '客服午餐吃什麼？ 🍕',
    preventRepeat: false,
    drawnIds: [],
    candidates: [
      { id: 'l1', name: '美味排骨便當', weight: 1.5, active: true },
      { id: 'l2', name: '金色拱門麥當勞', weight: 1.2, active: true },
      { id: 'l3', name: '健康舒肥雞胸沙拉', weight: 0.8, active: true },
      { id: 'l4', name: '日式豚骨拉麵', weight: 1, active: true },
      { id: 'l5', name: '台式大腸包小腸/滷肉飯', weight: 1, active: true },
      { id: 'l6', name: '微辣韓式豆腐鍋', weight: 1, active: true },
      { id: 'l7', name: '豪華日式握壽司', weight: 0.5, active: true }
    ]
  }
];

// Document Ready
document.addEventListener('DOMContentLoaded', () => {
  initColorScheme();
  loadData();
  initUIComponents();
  bindEvents();
  renderApp();
  showToast('🎉 系統載入成功', '歡迎使用客服智慧抽籤系統！', 'success');
});

/**
 * Initializes light/dark color scheme.
 */
function initColorScheme() {
  const savedScheme = localStorage.getItem(COLOR_SCHEME_KEY);
  const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  if (savedScheme === 'light' || (!savedScheme && !systemPrefersDark)) {
    document.documentElement.classList.remove('dark');
    document.documentElement.classList.add('light');
  } else {
    document.documentElement.classList.add('dark');
    document.documentElement.classList.remove('light');
  }
}

/**
 * Loads data from localStorage or loads defaults.
 */
function loadData() {
  // Themes
  try {
    const storedThemes = localStorage.getItem(THEMES_STORAGE_KEY);
    if (storedThemes) {
      appState.themes = JSON.parse(storedThemes);
      // Migration to override old default candidates if they exist
      const dutyTheme = appState.themes.find(t => t.id === 't_default_duty');
      if (dutyTheme && (dutyTheme.candidates.length === 0 || dutyTheme.candidates.some(c => c.name.includes('林雅婷')))) {
        dutyTheme.name = '客服輪值抽籤 🧹';
        dutyTheme.candidates = DEFAULT_THEMES[0].candidates;
        dutyTheme.drawnIds = [];
        saveThemesToStorage();
      }
    } else {
      appState.themes = DEFAULT_THEMES;
      saveThemesToStorage();
    }
  } catch (e) {
    console.error('Failed to load themes, resetting to default', e);
    appState.themes = DEFAULT_THEMES;
  }

  // Current selected theme
  const storedActiveId = localStorage.getItem(ACTIVE_THEME_KEY);
  if (storedActiveId && appState.themes.some(t => t.id === storedActiveId)) {
    appState.currentThemeId = storedActiveId;
  } else if (appState.themes.length > 0) {
    appState.currentThemeId = appState.themes[0].id;
  }

  // Auto record setting
  const storedAutoRecord = localStorage.getItem(AUTO_RECORD_KEY);
  appState.autoRecord = (storedAutoRecord === 'true');

  // Selected animation mode (always slots)
  appState.selectedMode = 'slots';
}

/**
 * Saves themes to localStorage.
 */
function saveThemesToStorage() {
  localStorage.setItem(THEMES_STORAGE_KEY, JSON.stringify(appState.themes));
}

/**
 * Initializes animation engine classes.
 */
function initUIComponents() {
  confettiInstance = new ConfettiEffect('confetti-canvas');
  
  slotMachineInstance = new SlotMachine('slots-reel-wrapper', () => {
    onDrawingFinished();
  });
}

/**
 * Binds UI Event Listeners.
 */
function bindEvents() {
  // Theme name manual edit in header
  const themeInput = document.getElementById('current-theme-input');

  function applyHeaderThemeUpdate(showNotification = false) {
    const theme = getCurrentTheme();
    if (!theme) return;

    let newName = themeInput.value.trim();
    if (!newName) {
      newName = '未命名主題';
      themeInput.value = newName;
    }

    theme.name = newName;
    saveThemesToStorage();
    updateThemeListNamesOnly();

    // Sync slot machine theme display & arena header title
    const machineThemeName = document.getElementById('machine-theme-name');
    if (machineThemeName) {
      machineThemeName.textContent = theme.name;
      machineThemeName.classList.remove('theme-pulse');
      // Trigger glow pulse animation
      void machineThemeName.offsetWidth;
      machineThemeName.classList.add('theme-pulse');
    }
    const arenaTitle = document.getElementById('draw-arena-theme-title');
    if (arenaTitle) arenaTitle.textContent = `🎰 ${theme.name}`;

    if (showNotification) {
      showToast('🎯 主題名稱已更新', `成功更新主題為：${theme.name}`, 'success');
    }
  }

  // Live update while typing
  themeInput.addEventListener('input', () => {
    const theme = getCurrentTheme();
    if (theme) {
      theme.name = themeInput.value;
      saveThemesToStorage();
      updateThemeListNamesOnly();
      const machineThemeName = document.getElementById('machine-theme-name');
      if (machineThemeName) machineThemeName.textContent = theme.name || '未命名主題';
      const arenaTitle = document.getElementById('draw-arena-theme-title');
      if (arenaTitle) arenaTitle.textContent = `🎰 ${theme.name || '未命名主題'}`;
    }
  });

  // Enter key press in theme input
  themeInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      applyHeaderThemeUpdate(true);
      themeInput.blur();
    }
  });

  // Blur event
  themeInput.addEventListener('blur', () => {
    applyHeaderThemeUpdate(false);
  });

  // Dark/Light Theme toggle button
  document.getElementById('theme-toggle-btn').addEventListener('click', () => {
    const isLight = document.documentElement.classList.contains('light');
    if (isLight) {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
      localStorage.setItem(COLOR_SCHEME_KEY, 'dark');
      showToast('🌙 深色模式已開啟', '為您的眼睛提供更好的保護。', 'info');
    } else {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
      localStorage.setItem(COLOR_SCHEME_KEY, 'light');
      showToast('☀️ 淺色模式已開啟', '清晰亮麗的版面設計。', 'info');
    }
  });

  // Navigation tab switching
  const tabs = document.querySelectorAll('.nav-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      const targetId = tab.getAttribute('data-target');
      
      // Toggle active states on buttons
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      // Toggle active states on panes
      document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.classList.remove('active');
      });
      document.getElementById(targetId).classList.add('active');

      // If switching to history tab, refresh history
      if (targetId === 'history-tab') {
        renderHistory();
      }
      // If switching to manage tab, refresh manage list
      if (targetId === 'manage-tab') {
        renderManagePanel();
      }
      // If switching back to draw tab, redraw slots
      if (targetId === 'draw-tab') {
        renderDrawTab();
      }
    });
  });

  // Counter drawing count inputs
  const countInput = document.getElementById('draw-count-input');
  document.getElementById('draw-count-dec').addEventListener('click', () => {
    let val = parseInt(countInput.value) || 1;
    if (val > 1) {
      countInput.value = val - 1;
      slotMachineInstance.reset();
    }
  });
  document.getElementById('draw-count-inc').addEventListener('click', () => {
    let val = parseInt(countInput.value) || 1;
    const maxVal = parseInt(countInput.max) || 50;
    if (val < maxVal) {
      countInput.value = val + 1;
      slotMachineInstance.reset();
    }
  });
  countInput.addEventListener('change', () => {
    let val = parseInt(countInput.value);
    const minVal = parseInt(countInput.min) || 1;
    const maxVal = parseInt(countInput.max) || 50;
    if (isNaN(val) || val < minVal) val = minVal;
    if (val > maxVal) val = maxVal;
    countInput.value = val;
    slotMachineInstance.reset();
  });

  // Prevent repeat toggle
  const repeatToggle = document.getElementById('prevent-repeat-toggle');
  repeatToggle.addEventListener('change', (e) => {
    const theme = getCurrentTheme();
    if (theme) {
      theme.preventRepeat = e.target.checked;
      if (!theme.preventRepeat) {
        theme.drawnIds = []; // clear if turning off
      }
      saveThemesToStorage();
      renderDrawTab();
      showToast('⚙️ 抽取規則已更新', theme.preventRepeat ? '不重複抽籤模式已開啟' : '重複抽籤模式已開啟', 'info');
    }
  });

  // Auto record toggle
  const autoRecordToggle = document.getElementById('auto-record-toggle');
  if (autoRecordToggle) {
    autoRecordToggle.addEventListener('change', (e) => {
      if (e.target.checked && (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia)) {
        showToast('⚠️ 不支援錄影', '目前網頁開啟方式（如 file://）限制了錄影功能。請執行專案目錄下的「run_server.bat」以本地伺服器開啟。', 'danger');
        e.target.checked = false;
        appState.autoRecord = false;
        localStorage.setItem(AUTO_RECORD_KEY, false);
        return;
      }
      appState.autoRecord = e.target.checked;
      localStorage.setItem(AUTO_RECORD_KEY, appState.autoRecord);
      showToast('🎬 錄影設定已更新', appState.autoRecord ? '自動錄影功能已啟用' : '自動錄影功能已停用', 'info');
    });
  }

  // Reset drawing pool button
  document.getElementById('reset-draw-pool-btn').addEventListener('click', () => {
    resetCurrentThemeDrawPool(true);
  });

  async function triggerDrawAction() {
    if (appState.isDrawing) return;

    if (appState.autoRecord) {
      const stream = await requestRecordingPermission();
      if (stream) {
        // Start recording IMMEDIATELY upon clicking "允許"
        startRecordingFromStream(stream);
        showToast('📹 錄影已開啟', '已開始錄製畫面，1.5 秒後啟動抽籤...', 'success');
        setTimeout(() => {
          executeDraw();
        }, 1500);
      } else {
        // User cancelled recording permission, proceed directly
        executeDraw();
      }
    } else {
      executeDraw();
    }
  }

  // START DRAW BUTTON
  document.getElementById('start-draw-btn').addEventListener('click', () => {
    triggerDrawAction();
  });

  // Physical Lever (拉桿)
  const lever = document.getElementById('slot-lever-trigger');
  if (lever) {
    lever.addEventListener('click', () => {
      if (appState.isDrawing) return;
      lever.classList.add('pulled');
      setTimeout(() => { lever.classList.remove('pulled'); }, 800);
      triggerDrawAction();
    });
  }


  // Clear latest results button
  document.getElementById('clear-results-btn').addEventListener('click', () => {
    const list = document.getElementById('latest-results-list');
    list.innerHTML = '<div class="no-results-placeholder">結果已清除，可重新開始抽籤。</div>';
  });

  // Manage Panel: Create theme
  document.getElementById('create-theme-btn').addEventListener('click', () => {
    const input = document.getElementById('new-theme-name');
    const name = input.value.trim();
    if (!name) {
      showToast('⚠️ 欄位空白', '請輸入主題名稱！', 'warning');
      return;
    }
    
    const newTheme = {
      id: 't_' + Math.random().toString(36).substr(2, 9),
      name: name,
      preventRepeat: true,
      drawnIds: [],
      candidates: []
    };

    appState.themes.push(newTheme);
    appState.currentThemeId = newTheme.id;
    saveThemesToStorage();
    
    input.value = '';
    renderApp();
    showToast('📁 主題新增成功', `已建立並切換至「${name}」`, 'success');
  });

  // Manage Panel: Candidate Search
  document.getElementById('candidate-search').addEventListener('input', (e) => {
    renderCandidateTable(e.target.value.trim());
  });

  // Manage Panel: Add Single Candidate
  document.getElementById('add-candidate-btn').addEventListener('click', () => {
    const input = document.getElementById('new-candidate-name');
    const name = input.value.trim();
    if (!name) return;

    const theme = getCurrentTheme();
    if (!theme) return;

    // Check duplicate
    if (theme.candidates.some(c => c.name === name)) {
      showToast('⚠️ 名稱重複', '該候選人已在名單中！', 'warning');
      return;
    }

    const newCandidate = {
      id: DrawEngine.generateId(),
      name: name,
      weight: 1,
      active: true
    };

    theme.candidates.push(newCandidate);
    theme.drawnIds = []; // Reset drawn pool structure since candidates list changed
    saveThemesToStorage();
    
    input.value = '';
    renderManagePanel();
    showToast('👤 候選人已加入', `已成功將「${name}」加入名單`, 'success');
  });

  // Manage Panel: Batch Import Actions
  document.getElementById('batch-import-append-btn').addEventListener('click', () => {
    handleBatchImport(false);
  });
  document.getElementById('batch-import-overwrite-btn').addEventListener('click', () => {
    handleBatchImport(true);
  });

  // Manage Panel: Candidate Quick Actions
  document.getElementById('candidate-toggle-all-on').addEventListener('click', () => {
    modifyAllCandidates(c => c.active = true, '全員啟用');
  });
  document.getElementById('candidate-toggle-all-off').addEventListener('click', () => {
    modifyAllCandidates(c => c.active = false, '全員停用');
  });
  document.getElementById('candidate-reset-weights').addEventListener('click', () => {
    modifyAllCandidates(c => c.weight = 1, '權重已重置為 1');
  });
  document.getElementById('candidate-clear-all').addEventListener('click', () => {
    if (confirm('確定要清空目前主題的所有候選人名單嗎？此操作不可逆。')) {
      const theme = getCurrentTheme();
      if (theme) {
        theme.candidates = [];
        theme.drawnIds = [];
        saveThemesToStorage();
        renderManagePanel();
        showToast('🗑️ 名單已清空', '所有候選人已移除', 'danger');
      }
    }
  });

  // History: Filter by Theme
  document.getElementById('history-filter-theme').addEventListener('change', () => {
    renderHistory();
  });

  // History: Export CSV
  document.getElementById('history-export-csv').addEventListener('click', () => {
    const records = getFilteredHistory();
    if (records.length === 0) {
      showToast('⚠️ 沒有資料', '沒有可匯出的歷史紀錄！', 'warning');
      return;
    }
    HistoryManager.exportToCSV(records);
    showToast('📥 CSV 匯出成功', '已下載歷史紀錄檔案', 'success');
  });


  // History: Clear all history records
  document.getElementById('history-clear-all').addEventListener('click', () => {
    if (confirm('確定要清除所有歷史抽籤紀錄嗎？此動作將刪除所有儲存紀錄。')) {
      HistoryManager.clearAll();
      renderHistory();
      showToast('🗑️ 歷史紀錄已清空', '所有抽籤結果已刪除', 'danger');
    }
  });

  // Celebration Modal close button
  document.getElementById('close-celebration-btn').addEventListener('click', () => {
    const modal = document.getElementById('celebration-modal');
    modal.classList.remove('active');
    confettiInstance.stop();
    // Stop recording and download if running
    stopRecordingAndDownload();
  });
}

/**
 * Returns current selected theme object.
 * @returns {Object|null}
 */
function getCurrentTheme() {
  return appState.themes.find(t => t.id === appState.currentThemeId) || null;
}

/**
 * Updates side bar theme list text names in Manage panel and history dropdown.
 */
function updateThemeListNamesOnly() {
  renderThemeDropdowns();
  
  const activeSidebarItem = document.querySelector('.theme-list-item.active .theme-item-name');
  const currentTheme = getCurrentTheme();
  if (activeSidebarItem && currentTheme) {
    activeSidebarItem.innerText = currentTheme.name;
  }
}

/**
 * Resets current theme draw pool.
 * @param {boolean} notify - Show toast notification if true.
 */
function resetCurrentThemeDrawPool(notify) {
  const theme = getCurrentTheme();
  if (theme) {
    theme.drawnIds = [];
    saveThemesToStorage();
    renderDrawTab();
    if (notify) {
      showToast('🔄 抽籤池已重置', '不重複名單的累計狀態已重置為初始狀態。', 'success');
    }
  }
}

/**
 * Performs modifications on all candidates of active theme.
 * @param {Function} modifier - Modifier callback.
 * @param {string} msg - Message for toast.
 */
function modifyAllCandidates(modifier, msg) {
  const theme = getCurrentTheme();
  if (theme && theme.candidates.length > 0) {
    theme.candidates.forEach(modifier);
    theme.drawnIds = []; // Reset drawn state
    saveThemesToStorage();
    renderManagePanel();
    showToast('⚙️ 快速操作成功', msg, 'success');
  }
}

/**
 * Renders the entire application.
 */
function renderApp() {
  renderThemeDropdowns();
  renderDrawTab();
}

/**
 * Renders themes options.
 */
function renderThemeDropdowns() {
  const historyFilter = document.getElementById('history-filter-theme');
  if (!historyFilter) return;

  // Save current filter value
  const prevFilterVal = historyFilter.value;

  historyFilter.innerHTML = '<option value="all">所有主題</option>';

  appState.themes.forEach(t => {
    // Populate history filter selector
    const opt2 = document.createElement('option');
    opt2.value = t.id;
    opt2.innerText = t.name;
    historyFilter.appendChild(opt2);
  });

  // Restore history filter value
  if (appState.themes.some(t => t.id === prevFilterVal)) {
    historyFilter.value = prevFilterVal;
  }
}

/**
 * Renders Draw Tab views.
 */
function renderDrawTab() {
  const theme = getCurrentTheme();
  const countInput = document.getElementById('draw-count-input');
  const repeatToggle = document.getElementById('prevent-repeat-toggle');
  const maxTip = document.getElementById('draw-count-max-tip');
  const themeInput = document.getElementById('current-theme-input');
  
  if (!theme) {
    if (themeInput) themeInput.value = '尚未選擇任何主題';
    return;
  }

  // Update theme input value in header if not focused
  if (themeInput && document.activeElement !== themeInput) {
    themeInput.value = theme.name;
  }

  repeatToggle.checked = theme.preventRepeat;

  const autoRecordToggle = document.getElementById('auto-record-toggle');
  if (autoRecordToggle) {
    autoRecordToggle.checked = appState.autoRecord;
  }

  // Active candidates pool calculations
  const activeCandidates = theme.candidates.filter(c => c.active);
  const eligibleCandidates = activeCandidates.filter(c => !theme.preventRepeat || !theme.drawnIds.includes(c.id));

  // Max draw limit setup
  const totalEligible = eligibleCandidates.length;
  const totalActive = activeCandidates.length;

  maxTip.innerText = `目前可用候選人：${totalEligible} 人 (總啟用：${totalActive} 人)`;
  
  // Set limits for count input
  countInput.max = Math.max(1, totalActive); // Max can draw up to total active in repeat mode, or total eligible
  if (parseInt(countInput.value) > totalActive && totalActive > 0) {
    countInput.value = totalActive;
  }

  // Update Pool progress display
  const progressBox = document.getElementById('pool-progress-box');
  const fill = document.getElementById('pool-progress-fill');
  const remainingCount = document.getElementById('pool-remaining-count');
  const totalCount = document.getElementById('pool-total-count');

  if (theme.preventRepeat && totalActive > 0) {
    progressBox.classList.remove('hide');
    remainingCount.innerText = totalEligible;
    totalCount.innerText = totalActive;
    const percentage = (totalEligible / totalActive) * 100;
    fill.style.width = `${percentage}%`;
    
    // Set color based on remaining percentage
    if (percentage < 30) {
      fill.style.backgroundColor = 'var(--danger)';
    } else if (percentage < 60) {
      fill.style.backgroundColor = 'var(--accent)';
    } else {
      fill.style.backgroundColor = 'var(--success)';
    }
  } else {
    progressBox.classList.add('hide');
  }

  // Update Summary Indicators
  document.getElementById('summary-total').innerText = theme.candidates.length;
  document.getElementById('summary-active').innerText = totalActive;
  document.getElementById('summary-excluded').innerText = theme.candidates.filter(c => !c.active).length + (theme.preventRepeat ? theme.drawnIds.length : 0);

  // Update arena header info
  const arenaTitle = document.getElementById('draw-arena-theme-title');
  if (arenaTitle) arenaTitle.textContent = `🎰 ${theme.name}`;

  // Update in-machine theme display (large, centered above reels)
  const machineThemeName = document.getElementById('machine-theme-name');
  if (machineThemeName) machineThemeName.textContent = theme.name;

  const arenaPoolStatus = document.getElementById('arena-pool-status');
  if (arenaPoolStatus) {
    if (theme.preventRepeat && totalActive > 0) {
      arenaPoolStatus.textContent = `抽籤池：${totalEligible} / ${totalActive} 人可用`;
    } else {
      arenaPoolStatus.textContent = `候選人：${totalActive} 人`;
    }
  }

  // Initialize/Redraw animation element
  slotMachineInstance.reset();
}

/**
 * Renders Candidate Management Panel.
 */
function renderManagePanel() {
  // Theme list panel on left
  const themeListPanel = document.getElementById('theme-list-panel');
  themeListPanel.innerHTML = '';

  appState.themes.forEach(t => {
    const item = document.createElement('div');
    item.className = `theme-list-item ${t.id === appState.currentThemeId ? 'active' : ''}`;
    
    const nameSpan = document.createElement('span');
    nameSpan.className = 'theme-item-name';
    nameSpan.innerText = t.name;
    nameSpan.addEventListener('click', () => {
      appState.currentThemeId = t.id;
      localStorage.setItem(ACTIVE_THEME_KEY, t.id);
      renderApp();
      renderManagePanel();
    });

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'theme-item-actions';

    // Rename Button
    const renameBtn = document.createElement('button');
    renameBtn.title = '重新命名主題';
    renameBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
      </svg>
    `;
    renameBtn.addEventListener('click', () => {
      const newName = prompt('請輸入新的主題名稱：', t.name);
      if (newName && newName.trim()) {
        t.name = newName.trim();
        saveThemesToStorage();
        renderApp();
        renderManagePanel();
        showToast('📝 主題已重新命名', `已更新為「${t.name}」`, 'success');
      }
    });

    // Delete Button (Disable default themes deletion if you want, but allow it for full user control)
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'theme-delete-btn';
    deleteBtn.title = '刪除主題';
    deleteBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="3 6 5 6 21 6"/>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
      </svg>
    `;
    deleteBtn.addEventListener('click', () => {
      if (appState.themes.length <= 1) {
        showToast('⚠️ 無法刪除', '系統至少需要保留一個主題！', 'warning');
        return;
      }
      if (confirm(`確定要刪除主題「${t.name}」嗎？所有候選人資料都將遺失。`)) {
        appState.themes = appState.themes.filter(th => th.id !== t.id);
        if (appState.currentThemeId === t.id) {
          appState.currentThemeId = appState.themes[0].id;
          localStorage.setItem(ACTIVE_THEME_KEY, appState.currentThemeId);
        }
        saveThemesToStorage();
        renderApp();
        renderManagePanel();
        showToast('🗑️ 主題已刪除', `主體「${t.name}」已被移除`, 'danger');
      }
    });

    actionsDiv.appendChild(renameBtn);
    actionsDiv.appendChild(deleteBtn);
    item.appendChild(nameSpan);
    item.appendChild(actionsDiv);
    themeListPanel.appendChild(item);
  });

  // Render Table
  renderCandidateTable();
}

/**
 * Renders Candidate list table with optional search filter.
 * @param {string} searchKeyword 
 */
function renderCandidateTable(searchKeyword = '') {
  const theme = getCurrentTheme();
  const tableBody = document.getElementById('candidates-table-body');
  const emptyMsg = document.getElementById('empty-candidates-msg');
  
  tableBody.innerHTML = '';
  
  if (!theme || theme.candidates.length === 0) {
    emptyMsg.classList.remove('hide');
    document.getElementById('active-candidates-count').innerText = 0;
    document.getElementById('total-weight-value').innerText = 0;
    return;
  }
  
  emptyMsg.classList.add('hide');

  // Filter candidates based on search
  const filtered = theme.candidates.filter(c => {
    return c.name.toLowerCase().includes(searchKeyword.toLowerCase());
  });

  // Calculate probabilities
  const { probabilities, totalWeight, eligibleCount } = DrawEngine.calculateProbabilities(
    theme.candidates,
    theme.drawnIds,
    theme.preventRepeat
  );

  filtered.forEach(c => {
    const row = document.createElement('tr');
    
    // Status Checkbox Column
    const statusTd = document.createElement('td');
    statusTd.className = 'checkbox-cell';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'custom-checkbox';
    checkbox.checked = c.active;
    checkbox.addEventListener('change', (e) => {
      c.active = e.target.checked;
      theme.drawnIds = []; // Reset pool progress when configuration changes
      saveThemesToStorage();
      renderManagePanel();
      renderDrawTab();
    });
    statusTd.appendChild(checkbox);

    // Name Column
    const nameTd = document.createElement('td');
    nameTd.className = 'candidate-name-cell';
    nameTd.innerText = c.name;
    if (!c.active) {
      nameTd.classList.add('text-muted');
      nameTd.style.textDecoration = 'line-through';
    }

    // Weight Input Column
    const weightTd = document.createElement('td');
    weightTd.className = 'weight-input-cell';
    const weightInput = document.createElement('input');
    weightInput.type = 'number';
    weightInput.className = 'form-input';
    weightInput.value = c.weight || 1;
    weightInput.min = '0.1';
    weightInput.max = '10';
    weightInput.step = '0.1';
    weightInput.disabled = !c.active;
    weightInput.addEventListener('change', (e) => {
      let val = parseFloat(e.target.value);
      if (isNaN(val) || val < 0.1) val = 0.1;
      if (val > 10) val = 10;
      c.weight = val;
      theme.drawnIds = []; // Reset pool progress when configuration changes
      saveThemesToStorage();
      renderManagePanel();
      renderDrawTab();
    });
    weightTd.appendChild(weightInput);

    // Probability Column
    const probTd = document.createElement('td');
    const probVal = probabilities[c.id] || 0;
    const badge = document.createElement('span');
    badge.className = 'probability-badge';
    badge.innerText = `${probVal.toFixed(1)}%`;
    if (!c.active) {
      badge.style.opacity = '0.4';
      badge.innerText = '0.0%';
    }
    probTd.appendChild(badge);

    // Actions Column
    const actionTd = document.createElement('td');
    const delBtn = document.createElement('button');
    delBtn.className = 'row-action-btn';
    delBtn.title = '刪除此候選人';
    delBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="3 6 5 6 21 6"/>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
      </svg>
    `;
    delBtn.addEventListener('click', () => {
      theme.candidates = theme.candidates.filter(cand => cand.id !== c.id);
      theme.drawnIds = []; // Reset pool
      saveThemesToStorage();
      renderManagePanel();
      renderDrawTab();
      showToast('🗑&nbsp; 候選人已刪除', `已移除 ${c.name}`, 'info');
    });
    actionTd.appendChild(delBtn);

    row.appendChild(statusTd);
    row.appendChild(nameTd);
    row.appendChild(weightTd);
    row.appendChild(probTd);
    row.appendChild(actionTd);
    tableBody.appendChild(row);
  });

  // Footer indicators
  const activeCount = theme.candidates.filter(c => c.active).length;
  document.getElementById('active-candidates-count').innerText = activeCount;
  document.getElementById('total-weight-value').innerText = totalWeight.toFixed(1);
}

/**
 * Handles batch importing of candidates.
 * @param {boolean} overwrite - Replace list if true, append if false.
 */
function handleBatchImport(overwrite) {
  const textarea = document.getElementById('batch-import-textarea');
  const text = textarea.value.trim();
  if (!text) {
    showToast('⚠️ 輸入為空', '請先輸入候選人名單文字！', 'warning');
    return;
  }

  const theme = getCurrentTheme();
  if (!theme) return;

  // Parsing: Split by comma (half/full width), spaces, or newlines
  const rawNames = text.split(/[\n,，\s]+/);
  const cleanNames = rawNames
    .map(name => name.trim())
    .filter(name => name.length > 0);

  if (cleanNames.length === 0) {
    showToast('⚠️ 解析失敗', '無效的名單內容，請確認格式！', 'warning');
    return;
  }

  // Convert to Candidate structures
  const importCandidates = [];
  cleanNames.forEach(name => {
    // Avoid duplicates within the import list itself
    if (!importCandidates.some(ic => ic.name === name)) {
      importCandidates.push({
        id: DrawEngine.generateId(),
        name: name,
        weight: 1,
        active: true
      });
    }
  });

  if (overwrite) {
    theme.candidates = importCandidates;
  } else {
    // Append but avoid duplicates against existing list
    importCandidates.forEach(ic => {
      if (!theme.candidates.some(c => c.name === ic.name)) {
        theme.candidates.push(ic);
      }
    });
  }

  theme.drawnIds = []; // Reset drawing progress
  saveThemesToStorage();
  textarea.value = ''; // Clear textarea
  renderManagePanel();
  renderDrawTab();
  
  showToast(
    '📥 批次匯入成功', 
    overwrite ? `名單已重新覆蓋為 ${cleanNames.length} 人。` : `已成功追加 ${importCandidates.length} 人。`,
    'success'
  );
}

/**
 * Gathers history logs filtered by current selected filter theme.
 * @returns {Array} List of filtered records.
 */
function getFilteredHistory() {
  const filterVal = document.getElementById('history-filter-theme').value;
  const allRecords = HistoryManager.getRecords();

  if (filterVal === 'all') {
    return allRecords;
  } else {
    return allRecords.filter(r => r.themeId === filterVal);
  }
}

/**
 * Renders History tab list.
 */
function renderHistory() {
  const container = document.getElementById('history-list-body');
  const emptyMsg = document.getElementById('empty-history-msg');
  const filtered = getFilteredHistory();

  container.innerHTML = '';
  
  if (filtered.length === 0) {
    emptyMsg.classList.remove('hide');
    return;
  }
  
  emptyMsg.classList.add('hide');

  filtered.forEach(r => {
    const row = document.createElement('div');
    row.className = 'history-row';

    const timeCol = document.createElement('div');
    timeCol.className = 'col-time';
    timeCol.innerText = HistoryManager.formatDate(r.timestamp);

    const themeCol = document.createElement('div');
    themeCol.className = 'col-theme';
    themeCol.innerText = r.themeName;

    const resultCol = document.createElement('div');
    resultCol.className = 'col-results';
    resultCol.innerText = r.winners.join(', ');
    resultCol.title = `當時啟用候選人: ${r.candidatesPool.join(', ')}`;

    const actionCol = document.createElement('div');
    actionCol.className = 'col-actions';
    
    const delBtn = document.createElement('button');
    delBtn.className = 'row-action-btn';
    delBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="3 6 5 6 21 6"/>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
      </svg>
    `;
    delBtn.title = '刪除此紀錄';
    delBtn.addEventListener('click', () => {
      HistoryManager.deleteRecord(r.id);
      renderHistory();
      showToast('🗑️ 紀錄已刪除', '該筆抽籤歷史已移除。', 'info');
    });
    actionCol.appendChild(delBtn);

    row.appendChild(timeCol);
    row.appendChild(themeCol);
    row.appendChild(resultCol);
    row.appendChild(actionCol);
    container.appendChild(row);
  });
}

/**
 * Handles executing a drawing.
 * @param {MediaStream|null} preAcquiredStream - Pre-acquired recording stream from user gesture, or null.
 */
function executeDraw(preAcquiredStream) {
  if (appState.isDrawing) return;

  const theme = getCurrentTheme();
  if (!theme) {
    showToast('⚠️ 無法抽籤', '未選擇任何主題！', 'warning');
    if (preAcquiredStream) preAcquiredStream.getTracks().forEach(t => t.stop());
    return;
  }

  const activeCandidates = theme.candidates.filter(c => c.active);
  if (activeCandidates.length === 0) {
    showToast('⚠️ 名單為空', '請先在設定頁面中加入並啟用候選人！', 'warning');
    if (preAcquiredStream) preAcquiredStream.getTracks().forEach(t => t.stop());
    return;
  }

  const countInput = document.getElementById('draw-count-input');
  const count = parseInt(countInput.value) || 1;

  // If in preventRepeat mode, check if we need to warn about auto-reset
  const eligibleCandidates = activeCandidates.filter(c => !theme.preventRepeat || !theme.drawnIds.includes(c.id));
  
  if (theme.preventRepeat && eligibleCandidates.length === 0) {
    showToast('🔄 抽籤池重置', '名單內所有人皆已抽過，即將重置抽籤池！', 'warning');
  }

  // Pre-calculate the result instantly via DrawEngine
  const drawResult = DrawEngine.drawMultiple(
    theme.candidates,
    count,
    theme.preventRepeat,
    theme.drawnIds
  );

  if (drawResult.winners.length === 0) {
    showToast('⚠️ 錯誤', '無法完成抽籤，請檢查候選人狀態。', 'danger');
    if (preAcquiredStream) preAcquiredStream.getTracks().forEach(t => t.stop());
    return;
  }

  // Start MediaRecorder if preAcquiredStream is passed and not already recording
  if (preAcquiredStream && (!mediaRecorderInstance || mediaRecorderInstance.state === "inactive")) {
    startRecordingFromStream(preAcquiredStream);
  }

  // Disable controls during draw animation
  toggleDrawControls(false);
  appState.isDrawing = true;

  // Save the new drawnIds back to state
  theme.drawnIds = drawResult.updatedDrawnIds;
  saveThemesToStorage();

  // Execute slots roll animation
  slotMachineInstance.roll(activeCandidates, drawResult.winners);
  
  appState.pendingWinners = drawResult.winners;
  appState.poolResetOccurred = drawResult.poolResetOccurred;
}

/**
 * Enables or disables drawing interaction buttons.
 * @param {boolean} enable 
 */
function toggleDrawControls(enable) {
  document.getElementById('start-draw-btn').disabled = !enable;
  
  const themeInput = document.getElementById('current-theme-input');
  if (themeInput) themeInput.disabled = !enable;

  document.getElementById('draw-count-input').disabled = !enable;
  document.getElementById('draw-count-dec').disabled = !enable;
  document.getElementById('draw-count-inc').disabled = !enable;
  document.getElementById('prevent-repeat-toggle').disabled = !enable;
  document.getElementById('reset-draw-pool-btn').disabled = !enable;
}

/**
 * Callback when the draw animation completes.
 */
function onDrawingFinished() {
  appState.isDrawing = false;
  toggleDrawControls(true);
  
  const winners = appState.pendingWinners || [];
  const poolResetOccurred = appState.poolResetOccurred || false;
  const theme = getCurrentTheme();

  // Save to history records
  const activeCandidates = theme.candidates.filter(c => c.active);
  HistoryManager.saveRecord(theme.name, theme.id, appState.selectedMode, winners, activeCandidates);

  // Update Draw Arena Info
  renderDrawTab();

  // Display results list on main page
  const latestResultsList = document.getElementById('latest-results-list');
  latestResultsList.innerHTML = '';
  
  winners.forEach((winner, i) => {
    const tag = document.createElement('div');
    tag.className = 'result-tag';
    
    const rank = document.createElement('span');
    rank.className = 'result-tag-rank';
    rank.innerText = i + 1;
    
    const name = document.createElement('span');
    name.innerText = winner.name;
    
    tag.appendChild(rank);
    tag.appendChild(name);
    latestResultsList.appendChild(tag);
  });

  // Render Celebration Modal Content
  const modalThemeText = document.getElementById('celebration-theme-name');
  const nowStr = HistoryManager.formatDate(Date.now());
  modalThemeText.innerHTML = `主題：<strong>${theme.name}</strong> (${theme.preventRepeat ? '不重複抽取' : '重複抽取'})<br><span class="celebration-time-label" style="font-size: 0.9rem; opacity: 0.85; margin-top: 6px; display: inline-block; font-weight: normal;">抽籤時間：${nowStr}</span>`;
  
  const winnersGrid = document.getElementById('winners-display-grid');
  winnersGrid.innerHTML = '';
  
  // Set layout class based on count
  winnersGrid.className = 'winners-display-grid'; // Reset classes
  if (winners.length === 1) {
    winnersGrid.classList.add('layout-single');
  } else if (winners.length === 2) {
    winnersGrid.classList.add('layout-double');
  } else if (winners.length <= 4) {
    winnersGrid.classList.add('layout-grid-2');
  } else {
    winnersGrid.classList.add('layout-grid-3');
  }

  winners.forEach((winner, i) => {
    const card = document.createElement('div');
    card.className = 'winner-item-card';
    
    const name = document.createElement('h4');
    name.innerText = winner.name;
    
    const rank = document.createElement('span');
    rank.innerText = winners.length > 1 ? `第 ${i + 1} 順位` : '中籤成員';

    card.appendChild(rank);
    card.appendChild(name);
    winnersGrid.appendChild(card);
  });

  // Open Modal & Start Confetti
  const modal = document.getElementById('celebration-modal');
  modal.classList.add('active');
  confettiInstance.start();

  // Toast notices
  showToast('🏆 抽籤完成！', `已抽出 ${winners.length} 位人員`, 'success');
  if (poolResetOccurred) {
    showToast('🔄 抽籤池循環', '所有候選人均已抽過一輪，抽籤池自動重置！', 'warning');
  }

  // Clear states
  delete appState.pendingWinners;
  delete appState.poolResetOccurred;
}

/**
 * Toast Notifications System.
 * @param {string} title - Heading message.
 * @param {string} message - Content message.
 * @param {string} type - 'success', 'warning', 'danger', 'info'.
 */
function showToast(title, message, type = 'info') {
  const container = document.getElementById('toast-container');
  
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  const icons = {
    'success': '🟢',
    'warning': '🟡',
    'danger': '🔴',
    'info': '🔵'
  };

  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || '🔔'}</span>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      <div class="toast-message">${message}</div>
    </div>
    <button class="toast-close">&times;</button>
    <div class="toast-progress"></div>
  `;

  container.appendChild(toast);

  // Close click event
  toast.querySelector('.toast-close').addEventListener('click', () => {
    removeToast(toast);
  });

  // Auto remove
  const timer = setTimeout(() => {
    removeToast(toast);
  }, 4000);

  // Stop auto-remove if hovered
  toast.addEventListener('mouseenter', () => {
    clearTimeout(timer);
    const progress = toast.querySelector('.toast-progress');
    if (progress) progress.style.animationPlayState = 'paused';
  });
}

/**
 * Removes a toast element with animation.
 * @param {HTMLElement} toast 
 */
function removeToast(toast) {
  toast.classList.add('removing');
  toast.addEventListener('animationend', (e) => {
    if (e.animationName === 'toastOut') {
      toast.remove();
    }
  });
}

/**
 * Screen Recording: Requests screen capture permission.
 * MUST be called directly inside a user gesture (click handler) to preserve transient activation.
 * @returns {Promise<MediaStream|null>} The captured stream, or null if denied/error.
 */
async function requestRecordingPermission() {
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        displaySurface: "browser"
      },
      audio: false,
      preferCurrentTab: true
    });
    return stream;
  } catch (err) {
    console.warn("Screen capture permission denied or error:", err);
    showToast('⚠️ 錄影授權取消', '未授予錄影權限，將不錄影直接抽籤。', 'warning');
    return null;
  }
}

/**
 * Screen Recording: Starts MediaRecorder from an already-acquired stream.
 * @param {MediaStream} stream - The stream from getDisplayMedia.
 */
function startRecordingFromStream(stream) {
  recordedChunks = [];
  recordingStream = stream;

  try {
    mediaRecorderInstance = new MediaRecorder(stream, {
      mimeType: 'video/webm;codecs=vp9,opus'
    });
  } catch (err) {
    try {
      mediaRecorderInstance = new MediaRecorder(stream, {
        mimeType: 'video/webm'
      });
    } catch (fallbackErr) {
      console.error("Failed to create MediaRecorder", fallbackErr);
      showToast('⚠️ 錄影初始化失敗', '瀏覽器不支援錄製格式。', 'danger');
      stream.getTracks().forEach(track => track.stop());
      recordingStream = null;
      return;
    }
  }

  mediaRecorderInstance.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) {
      recordedChunks.push(event.data);
    }
  };

  mediaRecorderInstance.start();
}

/**
 * Screen Recording: Stops capturing and downloads WebM file
 */
function stopRecordingAndDownload() {
  if (!mediaRecorderInstance || mediaRecorderInstance.state === "inactive") return;

  mediaRecorderInstance.onstop = () => {
    try {
      const blob = new Blob(recordedChunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      const theme = getCurrentTheme();
      const themeName = theme ? theme.name.replace(/[^\u4e00-\u9fa5a-zA-Z0-9_-]/g, '') : 'draw';
      const now = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const timeStr = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
      
      a.download = `cs_draw_${themeName}_${timeStr}.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('💾 影片下載成功', '抽籤存證錄影檔已自動下載！', 'success');
    } catch (err) {
      console.error("Failed to download video", err);
      showToast('⚠️ 影片下載失敗', '無法儲存錄影檔案。', 'danger');
    } finally {
      if (recordingStream) {
        recordingStream.getTracks().forEach(track => track.stop());
        recordingStream = null;
      }
      mediaRecorderInstance = null;
    }
  };

  mediaRecorderInstance.stop();
}
