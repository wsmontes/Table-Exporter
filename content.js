// Table detection and processing script

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
  
  return tablesInfo;
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
    const tables = detectTables();
    sendResponse({ tables });
  } else if (request.action === 'processTable') {
    const result = processTable(request.tableIndex, request.format);
    sendResponse({ result });
  }
  return true; // Keeps the message channel open for async response
});
