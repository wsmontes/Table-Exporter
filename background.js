// Background script for Table Exporter Pro

// Convert data to CSV format
function convertToCSV(tableData) {
  const rows = tableData.map(row => 
    row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`)
       .join(',')
  );
  return rows.join('\n');
}

// Convert data to Excel format using base64 + simple XML
function convertToExcel(tableData, title) {
  // In a real implementation, we'd use a library like SheetJS/xlsx
  // For demonstration purposes, we'll create a simple HTML table that Excel can open
  let html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">';
  html += '<head><meta http-equiv="content-type" content="application/vnd.ms-excel; charset=UTF-8"></head><body>';
  html += '<table border="1">';
  
  tableData.forEach(row => {
    html += '<tr>';
    row.forEach(cell => {
      html += `<td>${cell || ''}</td>`;
    });
    html += '</tr>';
  });
  
  html += '</table></body></html>';
  
  return html;
}

// Handle downloading the exported file
function downloadFile(data, filename, type) {
  try {
    const blob = new Blob([data], { type });
    const url = URL.createObjectURL(blob);
    
    console.log('Downloading file:', filename, 'Type:', type, 'URL:', url);
    
    chrome.downloads.download({
      url: url,
      filename: filename,
      saveAs: true
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        console.error('Download failed:', chrome.runtime.lastError);
        return;
      }
      
      console.log('Download initiated with ID:', downloadId);
      
      // Clean up the blob URL after a short delay to ensure download starts
      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 1000);
    });
  } catch (err) {
    console.error('Error creating download:', err);
  }
}

// Listen for export requests from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'exportTable') {
    console.log('Export request received:', request);
    const { data, title, format } = request;
    
    try {
      if (format === 'csv') {
        console.log('Exporting as CSV:', title);
        const csv = convertToCSV(data);
        downloadFile(csv, `${title}.csv`, 'text/csv');
        sendResponse({ success: true });
      } 
      else if (format === 'excel') {
        console.log('Exporting as Excel:', title);
        const excel = convertToExcel(data, title);
        downloadFile(excel, `${title}.xls`, 'application/vnd.ms-excel');
        sendResponse({ success: true });
      }
      else {
        console.error('Unsupported export format:', format);
        sendResponse({ success: false, error: 'Unsupported format' });
      }
    } catch (err) {
      console.error('Error in export process:', err);
      sendResponse({ success: false, error: err.message });
    }
  }
  return true; // Keep the message channel open for async response
});
