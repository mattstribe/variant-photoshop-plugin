const fs = require("uxp").storage.localFileSystem;
const FOLDER_JSON = "merch-folder-path.json";

async function loadSavedBaseFolder() {
  const dataFolder = await fs.getDataFolder();
  try {
    const jsonFile = await dataFolder.getEntry(FOLDER_JSON);
    const jsonData = JSON.parse(await jsonFile.read());
    return await fs.getEntryForPersistentToken(jsonData.folderToken);
  } catch {
    return null;
  }
}

async function selectAndSaveBaseFolder() {
  const baseFolder = await fs.getFolder({ prompt: "Select your League Package base folder" });
  const token = await fs.createPersistentToken(baseFolder);
  const dataFolder = await fs.getDataFolder();
  const jsonFile = await dataFolder.createFile(FOLDER_JSON, { overwrite: true });
  await jsonFile.write(JSON.stringify({ folderToken: token }, null, 2));
  return baseFolder;
}

async function getBaseFolder() {
  return await loadSavedBaseFolder();
}

module.exports = { getBaseFolder, selectAndSaveBaseFolder };
