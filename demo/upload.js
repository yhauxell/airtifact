const fs = require('fs');
const path = require('path');

// Usage: node upload.js <path-to-zip-file>
const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: node upload.js <path-to-zip-file>');
  process.exit(1);
}

if (!fs.existsSync(filePath) || !filePath.endsWith('.zip')) {
  console.error('Error: File must exist and be a .zip archive.');
  process.exit(1);
}

const API_KEY = process.env.API_KEY || 'YOUR_API_KEY_HERE';
const API_URL = process.env.API_URL || 'http://localhost:3000/api/upload';

async function uploadFile() {
  console.log(`Uploading ${filePath} to ${API_URL}...`);
  
  const fileBuffer = fs.readFileSync(filePath);
  const blob = new Blob([fileBuffer], { type: 'application/zip' });
  
  const formData = new FormData();
  formData.append('file', blob, path.basename(filePath));

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`
      },
      body: formData,
    });

    const result = await response.json();
    
    if (!response.ok) {
      console.error('Upload Failed:', result);
      process.exit(1);
    }

    console.log('Upload Successful!');
    console.log('API Result:', JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('Error uploading file:', error);
  }
}

uploadFile();
