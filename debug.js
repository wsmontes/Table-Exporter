console.log('Debug utilities loaded');

// Simple direct download test based on the working code from index.html
function testDownload() {
  try {
    // Create simple test data
    const content = "Column1,Column2\nValue1,Value2\nValue3,Value4";
    const blob = new Blob([content], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    
    // Create and trigger download element
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = 'test_download.csv';
    
    document.body.appendChild(a);
    a.click();
    
    // Clean up
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      // Show success message
      document.getElementById('debug-info').textContent = 
        'Download initiated. Check your downloads folder for test_download.csv';
    }, 100);
    
    return true;
  } catch (err) {
    console.error('Test download failed:', err);
    document.getElementById('debug-info').textContent = 
      `Error: ${err.message}. Check console for details.`;
    return false;
  }
}

// Test data for direct export
function testDirectExport() {
  const testData = [
    ['Name', 'Age', 'City'],
    ['John', '30', 'New York'],
    ['Alice', '25', 'London'],
    ['Bob', '35', 'Paris']
  ];
  
  // 1. Create CSV
  const csvContent = testData.map(row => 
    row.map(cell => `"${cell}"`).join(',')
  ).join('\n');
  
  const csvBlob = new Blob([csvContent], { type: 'text/csv' });
  const csvUrl = URL.createObjectURL(csvBlob);
  
  // 2. Download CSV
  const csvLink = document.createElement('a');
  csvLink.href = csvUrl;
  csvLink.download = 'test_direct_export.csv';
  csvLink.style.display = 'none';
  
  document.body.appendChild(csvLink);
  csvLink.click();
  
  setTimeout(() => {
    document.body.removeChild(csvLink);
    URL.revokeObjectURL(csvUrl);
  }, 100);
  
  return 'Check for test_direct_export.csv in your downloads folder';
}

// Add debugging functions to window for console access
window.testDownload = testDownload;
window.testDirectExport = testDirectExport;
