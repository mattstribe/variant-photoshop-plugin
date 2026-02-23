// ========== EXPORT HANDLER ==========
// Handles exporting graphics to local filesystem and optionally uploading to CDN (Cloudflare R2)

const photoshop = require("photoshop");
const app = photoshop.app;
const uxp = require("uxp");
const fs = uxp.storage.localFileSystem;
const storage = uxp.storage;

// ===== CDN EXPORT CONFIGURATION =====
const EXPORT_CDN_BASE_URL = "https://pub-3c06366d547445298c77e04b7c3c77ad.r2.dev";

function isCloudExportEnabled() {
  try {
    const checkbox = document.getElementById("exportToCloudCheckbox");
    const isEnabled = checkbox && checkbox.checked === true;
    console.log(`Cloud export enabled: ${isEnabled} (checkbox found: ${!!checkbox}, checked: ${checkbox?.checked})`);
    return isEnabled;
  } catch (e) {
    console.error("Error checking cloud export checkbox:", e);
    return false;
  }
}

const EXPORT_UPLOAD_API_URL = "https://stribe-api.vercel.app/api/upload";
const EXPORT_PLUGIN_ID = "variant-merch";

const R2_ACCOUNT_ID = null;
const R2_ACCESS_KEY_ID = null;
const R2_SECRET_ACCESS_KEY = null;
const R2_BUCKET_NAME = null;

async function uploadViaAPI(fileEntry, remotePath) {
  if (!EXPORT_UPLOAD_API_URL) {
    return null;
  }

  try {
    const fileData = await fileEntry.read({ format: storage.formats.binary });
    const arrayBuffer = new Uint8Array(fileData).buffer;

    const response = await fetch(EXPORT_UPLOAD_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-File-Path': remotePath,
        'X-File-Name': fileEntry.name,
        'X-Plugin-ID': EXPORT_PLUGIN_ID
      },
      body: arrayBuffer
    });

    if (!response.ok) {
      console.error(`Failed to upload via API: HTTP ${response.status} - ${response.statusText}`);
      return null;
    }

    const result = await response.json();
    const publicUrl = result.url || `${EXPORT_CDN_BASE_URL}/${remotePath}`;
    console.log(`Uploaded to CDN: ${publicUrl}`);
    return publicUrl;
  } catch (err) {
    console.error(`Error uploading via API:`, err);
    return null;
  }
}

async function uploadToR2Direct(fileEntry, remotePath) {
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
    return null;
  }
  console.warn('Direct R2 upload requires AWS Signature v4 implementation');
  return null;
}

async function uploadToR2(fileEntry, remotePath) {
  if (!isCloudExportEnabled()) {
    return null;
  }
  if (EXPORT_UPLOAD_API_URL) {
    return await uploadViaAPI(fileEntry, remotePath);
  }
  return await uploadToR2Direct(fileEntry, remotePath);
}

async function exportPng(doc, exportFile, cdnPath = null, cloudExportEnabled = null) {
  // Export locally first
  if (doc.saveAs && doc.saveAs.png) {
    await doc.saveAs.png(exportFile);
  } else {
    await app.batchPlay([
      { 
        _obj: 'save', 
        as: { _obj: 'PNGFormat', interlaced: false }, 
        in: { _path: exportFile.nativePath, _kind: 'local' }, 
        copy: true, 
        lowerCase: true 
      }
    ], { synchronousExecution: true });
  }

  // Upload to CDN if enabled
  const shouldUpload = cloudExportEnabled !== null ? cloudExportEnabled : isCloudExportEnabled();
  
  if (cdnPath && shouldUpload) {
    console.log(`Starting cloud upload for: ${cdnPath}`);
    const cdnUrl = await uploadToR2(exportFile, cdnPath);
    if (cdnUrl) {
      console.log(`Successfully uploaded to cloud: ${cdnUrl}`);
    } else {
      console.warn(`Cloud upload failed for: ${cdnPath}`);
    }
    return cdnUrl;
  } else {
    if (!cdnPath) {
      console.log("No CDN path provided, skipping cloud upload");
    } else {
      console.log("Cloud export disabled (checkbox unchecked), skipping upload");
    }
  }

  return null;
}

function buildCdnPath(leagueName, designId, filename) {
  const safeLeague = encodeURIComponent(leagueName);
  const safeDesign = encodeURIComponent(designId);
  const safeFilename = encodeURIComponent(filename);
  return `${safeLeague}/merch/${safeDesign}/${safeFilename}`;
}

module.exports = {
  exportPng,
  buildCdnPath,
  uploadToR2
};
