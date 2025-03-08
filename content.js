// Table detection and processing script

let inlineButtonsEnabled = false;

// Function to detect all tables on the page
function detectTables() {
  const tables = document.querySelectorAll('table');
  const tablesInfo = [];
  
  tables.forEach((table, index) => {
    // Get basic table info (dimensions, first few cells for preview)
    const rows = table.rows.length;
    const cols = table.rows[0]?.cells.length || 0;
    const caption = table.caption?.textContent || '';
    let title = '';
    
    // Try to find a title for the table
    const prevElement = table.previousElementSibling;
    if (prevElement && ['H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(prevElement.tagName)) {
      title = prevElement.textContent;
    }
    
    // Generate a preview of the table (first 3 rows and 3 columns)
    const preview = [];
    for (let i = 0; i < Math.min(3, rows); i++) {
      const rowData = [];
      for (let j = 0; j < Math.min(3, cols); j++) {
        if (table.rows[i] && table.rows[i].cells[j]) {
          rowData.push(table.rows[i].cells[j].innerText.trim());
        }
      }
      if (rowData.length > 0) {
        preview.push(rowData);
      }
    }
    
    tablesInfo.push({
      id: index,
      rows,
      cols,
      caption,
      title: title || caption || `Table ${index + 1}`,
      preview
    });
  });
  
  // Update inline buttons if enabled
  if (inlineButtonsEnabled) {
    addInlineExportButtons();
  } else {
    removeInlineExportButtons();
  }
  
  return tablesInfo;
}

// Function to add inline export buttons to tables
function addInlineExportButtons() {
  // First remove any existing buttons to avoid duplicates
  removeInlineExportButtons();
  
  const tables = document.querySelectorAll('table');
  tables.forEach((table, index) => {
    // Position the table relatively if it's not already
    table.classList.add('table-exporter-enabled');
    
    // Create button container
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'table-export-buttons';
    
    // Create Excel button
    const excelButton = document.createElement('button');
    excelButton.className = 'table-export-btn excel-btn';
    excelButton.title = 'Export to Excel';
    excelButton.innerHTML = '📊'; // Unicode icon for spreadsheet
    excelButton.addEventListener('click', (e) => {
      e.stopPropagation();
      handleInlineExport(index, 'excel');
    });
    
    // Create CSV button
    const csvButton = document.createElement('button');
    csvButton.className = 'table-export-btn csv-btn';
    csvButton.title = 'Export to CSV';
    csvButton.innerHTML = '📋'; // Unicode icon for clipboard
    csvButton.addEventListener('click', (e) => {
      e.stopPropagation();
      handleInlineExport(index, 'csv');
    });
    
    // Add buttons to container
    buttonContainer.appendChild(excelButton);
    buttonContainer.appendChild(csvButton);
    
    // Add container to table parent
    if (table.parentNode) {
      // Position the button container relative to the table
      table.parentNode.style.position = 'relative';
      table.parentNode.appendChild(buttonContainer);
    }
  });
}

// Function to remove inline export buttons
function removeInlineExportButtons() {
  // Remove button containers
  document.querySelectorAll('.table-export-buttons').forEach(el => {
    el.remove();
  });
  
  // Remove positioning classes from tables
  document.querySelectorAll('.table-exporter-enabled').forEach(table => {
    table.classList.remove('table-exporter-enabled');
  });
}

// Handle export request from inline button - UPDATED
function handleInlineExport(tableIndex, format) {
  const result = processTable(tableIndex, format);
  if (result) {
    // Show export status indicator
    const statusDiv = document.createElement('div');
    statusDiv.className = 'export-status';
    statusDiv.textContent = `Exporting ${result.title}...`;
    document.body.appendChild(statusDiv);
    
    // Use direct download instead of sending to background script
    if (directDownload(result.data, result.title, format)) {
      statusDiv.textContent = `✓ ${result.title} exported!`;
    } else {
      // Fallback to background script if direct download fails
      chrome.runtime.sendMessage({
        action: 'exportTable',
        data: result.data,
        title: result.title,
        format: format
      }, (response) => {
        if (response && response.success) {
          statusDiv.textContent = `✓ ${result.title} exported!`;
        } else {
          statusDiv.textContent = `❌ Export failed: ${response?.error || 'Unknown error'}`;
        }
      });
    }
    
    // Remove status message after delay
    setTimeout(() => {
      try {
        document.body.removeChild(statusDiv);
      } catch (e) {
        // Ignore if already removed
      }
    }, 3000);
  }
}

// Direct download function - similar to the one in popup.js
function directDownload(data, fileName, format) {
  try {
    if (format === 'csv') {
      // CSV export
      const rows = data.map(row => 
        row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`)
           .join(',')
      );
      const content = rows.join('\n');
      
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
      
      return true;
    } 
    else { // Excel export
      // Try to use XLSX if available in content script context
      if (typeof XLSX !== 'undefined') {
        // Create a worksheet
        const ws = XLSX.utils.aoa_to_sheet(data);
        
        // Create a workbook with the worksheet
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
        
        // Generate XLSX as array buffer
        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        
        // Convert to blob and download
        const blob = new Blob([wbout], { 
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
        });
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
        
        return true;
      }
      else {
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
        
        return true;
      }
    }
  } catch (err) {
    console.error('Download error:', err);
    return false;
  }
}

// Function to process a table for export
function processTable(tableIndex, format) {
  const tables = document.querySelectorAll('table');
  
  if (!tables || !tables.length) {
    console.error('No tables found on the page');
    return null;
  }
  
  const table = tables[tableIndex];
  
  if (!table) {
    console.error('Table index out of range:', tableIndex);
    return null;
  }
  
  // Extract table data
  const data = [];
  try {
    for (let i = 0; i < table.rows.length; i++) {
      const rowData = [];
      for (let j = 0; j < table.rows[i].cells.length; j++) {
        rowData.push(table.rows[i].cells[j].innerText.trim());
      }
      data.push(rowData);
    }
  } catch (err) {
    console.error('Error extracting table data:', err);
    return null;
  }
  
  // Get a better title from the table
  const caption = table.caption?.textContent || '';
  let title = '';
  const prevElement = table.previousElementSibling;
  if (prevElement && ['H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(prevElement.tagName)) {
    title = prevElement.textContent;
  }
  const tableTitle = title || caption || `Table_${tableIndex + 1}`;
  
  return { 
    data: data, 
    title: tableTitle,
    format
  };
}

// Helper function to convert data to CSV format
function convertToCSV(data) {
  return data.map(row => 
    row.map(cell => 
      // Escape quotes and wrap in quotes if the cell contains commas, quotes or newlines
      cell.includes(',') || cell.includes('"') || cell.includes('\n') 
        ? `"${cell.replace(/"/g, '""')}"` 
        : cell
    ).join(',')
  ).join('\n');
}

// Helper function to convert data to JSON format
function convertToJSON(data) {
  // If we have header row, use it for property names
  if (data.length > 1) {
    const headers = data[0];
    const jsonData = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rowObject = {};
      
      for (let j = 0; j < headers.length; j++) {
        if (j < row.length) {
          rowObject[headers[j]] = row[j];
        }
      }
      
      jsonData.push(rowObject);
    }
    
    return JSON.stringify(jsonData, null, 2);
  }
  
  // Fallback if we can't determine headers
  return JSON.stringify(data, null, 2);
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'detectTables') {
    // Update inline buttons setting if provided
    if (request.inlineButtonsEnabled !== undefined) {
      inlineButtonsEnabled = request.inlineButtonsEnabled;
    }
    
    const tables = detectTables();
    sendResponse({ tables });
  } else if (request.action === 'processTable') {
    const result = processTable(request.tableIndex, request.format);
    sendResponse({ result });
  } else if (request.action === 'toggleInlineButtons') {
    inlineButtonsEnabled = request.enabled;
    
    if (inlineButtonsEnabled) {
      addInlineExportButtons();
    } else {
      removeInlineExportButtons();
    }
    
    sendResponse({ success: true });
  }
  return true; // Keeps the message channel open for async response
});

// Check if inline buttons should be enabled on page load
chrome.storage.sync.get(['inlineButtonsEnabled'], (result) => {
  if (result.inlineButtonsEnabled !== undefined) {
    inlineButtonsEnabled = result.inlineButtonsEnabled;
    
    // Add inline buttons if enabled
    if (inlineButtonsEnabled) {
      // Small delay to ensure the page is fully loaded
      setTimeout(() => {
        addInlineExportButtons();
      }, 500);
    }
  }
});

// Try to load the XLSX library for direct Excel export from content script
function loadXLSXLibrary() {
  if (typeof XLSX === 'undefined') {
    chrome.runtime.sendMessage({ action: 'getXLSXUrl' }, (response) => {
      if (response && response.url) {
        const script = document.createElement('script');
        script.src = response.url;
        script.onload = () => {
          console.log('XLSX library loaded in content script');
        };
        script.onerror = (err) => {
          console.error('Failed to load XLSX library in content script:', err);
        };
        document.head.appendChild(script);
      }
    });
  }
}

// Try to load the XLSX library when the content script runs
loadXLSXLibrary();
