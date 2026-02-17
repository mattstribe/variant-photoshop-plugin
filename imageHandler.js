const photoshop = require("photoshop");
const app = photoshop.app;
const uxp = require("uxp");
const fs = uxp.storage.localFileSystem;
const storage = uxp.storage;

const IMAGE_CDN_BASE = "https://pub-3c06366d547445298c77e04b7c3c77ad.r2.dev";
const imageCache = {};

async function replaceLayerWithImage(layer, pathOrUrl, baseFolder) {
  if (!layer || !pathOrUrl || !String(pathOrUrl).trim()) return false;

  const fileEntry = baseFolder != null
    ? await getFileFromPath(baseFolder, pathOrUrl)
    : await getFileFromUrl(pathOrUrl);

  if (!fileEntry) return false;
  return replaceLayerWithFile(layer, fileEntry);
}

async function getFileFromUrl(url) {
  if (imageCache[url]) return imageCache[url];
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const arrayBuffer = await response.arrayBuffer();
    const dataFolder = await fs.getDataFolder();
    let tempFolder;
    try {
      tempFolder = await dataFolder.getEntry("temp_images");
    } catch {
      tempFolder = await dataFolder.createFolder("temp_images");
    }
    const safeName = (url.split("/").pop() || "image.png").replace(/[^a-zA-Z0-9._-]/g, "_");
    const hash = Math.abs(url.split("").reduce((a, c) => ((a << 5) - a) + c.charCodeAt(0), 0));
    const file = await tempFolder.createFile(`${hash}_${safeName}`, { overwrite: true });
    await file.write(arrayBuffer, { format: storage.formats.binary });
    imageCache[url] = file;
    return file;
  } catch (err) {
    console.warn("ImageHandler: getFileFromUrl failed:", url, err.message);
    return null;
  }
}

async function getFileFromPath(baseFolder, relativePath) {
  const parts = String(relativePath).replace(/\\/g, "/").split("/").filter(Boolean);
  if (parts.length === 0) return null;
  try {
    let current = baseFolder;
    for (let i = 0; i < parts.length - 1; i++) {
      current = await current.getEntry(parts[i]);
    }
    const file = await current.getEntry(parts[parts.length - 1]);
    return file && file.isFile ? file : null;
  } catch {
    return null;
  }
}

async function replaceLayerWithFile(layer, fileEntry) {
  if (!layer || !fileEntry) return false;
  const originalId = layer._id;
  const originalName = layer.name;
  const token = await fs.createSessionToken(fileEntry);

  await app.batchPlay([{ _obj: "select", _target: [{ _ref: "layer", _id: originalId }], makeVisible: true }], { synchronousExecution: true });
  await app.batchPlay([{ _obj: "placedLayerMakeCopy" }], { synchronousExecution: true });
  const copied = app.activeDocument.activeLayers[0];
  copied.name = originalName;
  await app.batchPlay([{ _obj: "placedLayerReplaceContents", _target: [{ _ref: "layer", _id: copied._id }], null: { _path: token, _kind: "local" } }], { synchronousExecution: true });
  await app.batchPlay([{ _obj: "delete", _target: [{ _ref: "layer", _id: originalId }] }], { synchronousExecution: true });
  return true;
}

module.exports = {
  IMAGE_CDN_BASE,
  replaceLayerWithImage
};
