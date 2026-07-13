/**
 * HistoryManager - Manages drawing records in LocalStorage, filtering, and export.
 */
class HistoryManager {
  static STORAGE_KEY = 'cs_lottery_history';

  /**
   * Saves a new drawing record.
   * @param {string} themeName - Theme name.
   * @param {string} themeId - Theme ID.
   * @param {string} mode - Animation mode used.
   * @param {Array} winners - Array of winning candidates.
   * @param {Array} candidatesPool - Full active candidates pool at the time of drawing.
   * @returns {Object} Saved record.
   */
  static saveRecord(themeName, themeId, mode, winners, candidatesPool) {
    const records = this.getRecords();
    
    // Map mode name to Chinese display
    const modeNames = {
      'slots': '🎰 老虎機',
      'wheel': '🎡 幸運轉盤',
      'cards': '🃏 卡牌翻轉'
    };

    const newRecord = {
      id: 'h_' + Math.random().toString(36).substr(2, 9),
      timestamp: Date.now(),
      themeId,
      themeName,
      mode: modeNames[mode] || mode,
      winners: winners.map(w => w.name),
      candidatesPool: candidatesPool.map(c => `${c.name}(w:${c.weight})`)
    };

    records.unshift(newRecord); // Add to beginning (descending order)
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(records));
    return newRecord;
  }

  /**
   * Retrieves all records.
   * @returns {Array} List of records.
   */
  static getRecords() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error('Failed to parse drawing history:', e);
      return [];
    }
  }

  /**
   * Deletes a specific record.
   * @param {string} id - Record ID.
   */
  static deleteRecord(id) {
    let records = this.getRecords();
    records = records.filter(r => r.id !== id);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(records));
  }

  /**
   * Clears all history.
   */
  static clearAll() {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify([]));
  }

  /**
   * Formats timestamp to YYYY-MM-DD HH:mm:ss.
   * @param {number} timestamp 
   * @returns {string} Formatted string.
   */
  static formatDate(timestamp) {
    const d = new Date(timestamp);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  /**
   * Downloads data as file in browser.
   * @param {string} content - File content.
   * @param {string} filename - Output file name.
   * @param {string} mimeType - MIME type.
   */
  static downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Exports history records to CSV file.
   * Supports Chinese characters by prepending UTF-8 BOM.
   * @param {Array} records - Records to export.
   */
  static exportToCSV(records) {
    if (records.length === 0) return;

    // CSV header columns
    const headers = ['抽籤時間', '主題名稱', '抽中結果', '當時啟用候選名單'];
    
    const rows = records.map(r => [
      this.formatDate(r.timestamp),
      `"${r.themeName.replace(/"/g, '""')}"`,
      `"${r.winners.join(', ').replace(/"/g, '""')}"`,
      `"${r.candidatesPool.join(', ').replace(/"/g, '""')}"`
    ]);

    // Prepend UTF-8 BOM (\ufeff) to make Excel read Chinese characters properly
    const csvContent = '\ufeff' + [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const filename = `cs_draw_history_${new Date().toISOString().split('T')[0]}.csv`;
    
    this.downloadFile(csvContent, filename, 'text/csv;charset=utf-8;');
  }
}

// Export for browser
window.HistoryManager = HistoryManager;
