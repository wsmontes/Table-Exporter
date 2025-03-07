// Variables to keep track of state
let detectedTables = [];
let selectedTableIndex = -1;
let exportFormat = 'excel'; // Changed from 'csv' to 'excel'

// DOM elements
const loadingEl = document.getElementById('loading');
const noTablesEl = document.getElementById('no-tables');
const tablesContainerEl = document.getElementById('tables-container');
const tablesListEl = document.getElementById('tables-list');
const tableCountEl = document.getElementById('table-count');
const exportOptionsEl = document.getElementById('export-options');
const exportSelectedBtn = document.getElementById('export-selected');
const exportAllBtn = document.getElementById('export-all');
const refreshTablesBtn = document.getElementById('refresh-tables');
const exportCsvBtn = document.getElementById('export-csv');
const exportExcelBtn = document.getElementById('export-excel');

// Initialize the popup
document.addEventListener('DOMContentLoaded', () => {
  // Check if XLSX is loaded
  if (typeof XLSX === 'undefined') {
    console.warn('XLSX library not loaded. Excel export will fall back to HTML-based export.');
  }
  
  detectTables();
  setupEventListeners();
  
  // Make sure UI reflects the default export format
  exportCsvBtn.classList.remove('active');
  exportExcelBtn.classList.add('active');
});

// Setup event listeners
function setupEventListeners() {
  refreshTablesBtn.addEventListener('click', detectTables);
  
  exportCsvBtn.addEventListener('click', () => {
    setExportFormat('csv');
  });
  
  exportExcelBtn.addEventListener('click', () => {
    setExportFormat('excel');
  });
  
  exportSelectedBtn.addEventListener('click', () => {
    if (selectedTableIndex >= 0) {
      exportTable(selectedTableIndex);
    }
  });
  
  exportAllBtn.addEventListener('click', exportAllTables);
}

// Set the export format and update UI
function setExportFormat(format) {
  exportFormat = format;
  
  exportCsvBtn.classList.toggle('active', format === 'csv');
  exportExcelBtn.classList.toggle('active', format === 'excel');
}

// Detect tables in the current tab
function detectTables() {
  showLoading();
  
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    chrome.tabs.sendMessage(
      tabs[0].id,
      {action: 'detectTables'},
      (response) => {
        if (chrome.runtime.lastError) {
          showNoTables();
          console.error(chrome.runtime.lastError);
          return;
        }
        
        if (!response || !response.tables || response.tables.length === 0) {
          showNoTables();
          return;
        }
        
        detectedTables = response.tables;
        displayTables(detectedTables);
      }
    );
  });
}

// Display detected tables in the popup
function displayTables(tables) {
  hideLoading();
  noTablesEl.classList.add('hidden');
  tablesContainerEl.classList.remove('hidden');
  exportOptionsEl.classList.remove('hidden');
  
  tableCountEl.textContent = tables.length;
  tablesListEl.innerHTML = '';
  
  tables.forEach((table, index) => {
    const tableItem = document.createElement('div');
    tableItem.className = 'table-item';
    tableItem.dataset.index = index;
    
    tableItem.innerHTML = `
      <div class="table-title">${table.title}</div>
      <div class="table-info">${table.rows} rows × ${table.cols} columns</div>
      <div class="table-preview">
        <table class="preview-table">
          ${table.preview.map(row => 
            `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`
          ).join('')}
        </table>
      </div>
    `;
    
    tableItem.addEventListener('click', () => {
      selectTable(index);
    });
    
    tablesListEl.appendChild(tableItem);
  });
}

// Select a table from the list
function selectTable(index) {
  const tableItems = tablesListEl.querySelectorAll('.table-item');
  tableItems.forEach((item) => {
    item.classList.remove('selected');
  });
  
  if (index >= 0 && index < tableItems.length) {
    tableItems[index].classList.add('selected');
    selectedTableIndex = index;
    exportSelectedBtn.disabled = false;
  }
}

// Simplified direct download function based on working index.html code
function directDownload(data, fileName, format) {
  try {
    // Status indicator
    const statusDiv = document.createElement('div');
    statusDiv.className = 'export-status';
    statusDiv.textContent = `Exporting ${fileName}...`;
    document.querySelector('.container').appendChild(statusDiv);
    
    if (format === 'csv') {
      // CSV export - unchanged
      const rows = data.map(row => 
        row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`)
           .join(',')
      );
      content = rows.join('\n');
      
      // Create and trigger download
      const blob = new Blob([content], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `${fileName}.csv`;
      
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
      
      // Show success message
      statusDiv.textContent = `✓ ${fileName}.csv exported!`;
    } 
    else { // Excel export
      // First check if we can use the XLSX library
      if (typeof XLSX !== 'undefined') {
        console.log('Using SheetJS library for XLSX export');
        
        // Create a worksheet
        const ws = XLSX.utils.aoa_to_sheet(data);
        
        // Create a workbook with the worksheet
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
        
        // Generate XLSX as array buffer
        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        
        // Convert to blob and download
        const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `${fileName}.xlsx`;
        
        document.body.appendChild(a);
        a.click();
        
        // Clean up
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 100);
        
        // Show success message
        statusDiv.textContent = `✓ ${fileName}.xlsx exported!`;
      }
      else {
        console.warn('XLSX library not available, falling back to HTML-based export');
        
        // Fall back to HTML-based Excel (xls format)
        let html = '<html><head><meta charset="UTF-8"></head><body><table>';
        data.forEach(row => {
          html += '<tr>';
          row.forEach(cell => {
            html += `<td>${cell || ''}</td>`;
          });
          html += '</tr>';
        });
        html += '</table></body></html>';
        
        // Create and trigger download
        const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `${fileName}.xls`;  // Note: .xls, not .xlsx for HTML-based Excel
        
        document.body.appendChild(a);
        a.click();
        
        // Clean up
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 100);
        
        // Show success message but note it's XLS format
        statusDiv.textContent = `✓ ${fileName}.xls exported! (XLSX unavailable)`;
      }
    }
    
    // Remove status message after delay
    setTimeout(() => {
      try {
        document.querySelector('.container').removeChild(statusDiv);
      } catch (e) {
        // Ignore if already removed
      }
    }, 3000);
    
    return true;
  } catch (err) {
    console.error('Download error:', err);
    alert(`Error exporting table: ${err.message}`);
    return false;
  }
}

// Export a specific table
function exportTable(index) {
  console.log('Starting export for table index:', index);
  
  // Show some visual feedback
  const tableItems = tablesListEl.querySelectorAll('.table-item');
  if (index >= 0 && index < tableItems.length) {
    tableItems[index].style.opacity = '0.7';
  }
  
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    if (!tabs || !tabs[0] || !tabs[0].id) {
      console.error('Could not get active tab');
      alert('Could not get active tab');
      return;
    }
    
    console.log('Sending processTable message to content script');
    chrome.tabs.sendMessage(
      tabs[0].id,
      {
        action: 'processTable',
        tableIndex: index,
        format: exportFormat
      },
      (response) => {
        // Reset visual feedback
        if (index >= 0 && index < tableItems.length) {
          tableItems[index].style.opacity = '1';
        }
        
        if (chrome.runtime.lastError) {
          console.error('Error processing table:', chrome.runtime.lastError);
          alert('Error connecting to page. Please refresh and try again.');
          return;
        }
        
        if (!response || !response.result) {
          console.error('Invalid response from content script');
          alert('Could not process table data');
          return;
        }
        
        const { data, title } = response.result;
        
        if (!data || !Array.isArray(data) || !data.length) {
          console.error('Invalid table data received');
          alert('Invalid table data received');
          return;
        }
        
        const fileName = title || `Table_${index + 1}`;
        
        // Use direct download only - bypassing the background script
        if (directDownload(data, fileName, exportFormat)) {
          console.log('Direct download successful');
        } else {
          console.error('Download failed');
        }
      }
    );
  });
}

// Export all detected tables
function exportAllTables() {
  if (!detectedTables || !detectedTables.length) {
    console.error('No tables to export');
    return;
  }
  
  // Visual feedback
  exportAllBtn.disabled = true;
  exportAllBtn.textContent = 'Exporting...';
  
  // Export each table with a small delay to avoid overwhelming the browser
  let exported = 0;
  
  detectedTables.forEach((_, index) => {
    setTimeout(() => {
      exportTable(index);
      exported++;
      
      // Reset button when all exports are initiated
      if (exported === detectedTables.length) {
        setTimeout(() => {
          exportAllBtn.disabled = false;
          exportAllBtn.textContent = 'Export All Tables';
        }, 1000);
      }
    }, index * 500); // 500ms delay between each export
  });
}

// Show loading state
function showLoading() {
  loadingEl.classList.remove('hidden');
  noTablesEl.classList.add('hidden');
  tablesContainerEl.classList.add('hidden');
  exportOptionsEl.classList.add('hidden');
}

// Hide loading state
function hideLoading() {
  loadingEl.classList.add('hidden');
}

// Show "no tables" message
function showNoTables() {
  hideLoading();
  noTablesEl.classList.remove('hidden');
  tablesContainerEl.classList.add('hidden');
  exportOptionsEl.classList.add('hidden');
}
