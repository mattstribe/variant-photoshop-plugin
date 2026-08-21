const storage = require("./storage.js");
const leagueConfig = require("./leagueConfig.js");
const exportHandler = require("./exportHandler.js");
const { app, core } = require("photoshop");

async function runGenerateNumbers() {
  const statusEl = document.getElementById("status");

  try {
    const baseFolder = await storage.getBaseFolder();
    if (!baseFolder) {
      if (statusEl) statusEl.textContent = "Please select a league folder first.";
      return;
    }

    const { designId } = await leagueConfig.loadMerchSettings(baseFolder);
    if (!designId) {
      if (statusEl) statusEl.textContent = "No Design ID found in merch settings.";
      return;
    }

    let merchFolder;
    try {
      merchFolder = await baseFolder.getEntry("MERCH");
    } catch {
      if (statusEl) statusEl.textContent = "MERCH folder not found in base folder.";
      return;
    }

    const designFilesFolder = await merchFolder.getEntry("Design Files");
    const designFolder = await designFilesFolder.getEntry(designId);
    const templateFile = await designFolder.getEntry(`${designId}_TEMPLATE.psd`);

    let numbersFolder;
    try {
      numbersFolder = await designFolder.getEntry("Numbers");
    } catch {
      numbersFolder = await designFolder.createFolder("Numbers");
    }

    const exportToCloudCheckbox = document.getElementById("exportToCloudCheckbox");
    const cloudExportEnabled = exportToCloudCheckbox && exportToCloudCheckbox.checked === true;

    if (statusEl) statusEl.textContent = "Generating numbers 0–99...";

    await core.executeAsModal(async () => {
      await app.open(templateFile);
      const doc = app.activeDocument;
      if (!doc) throw new Error("No active Photoshop document is open.");

      const numberLayer = findLayerByName(doc, "NUMBER");
      if (!numberLayer) {
        throw new Error('No layer named "NUMBER" found in the template.');
      }
      if (!numberLayer.textItem) {
        throw new Error('"NUMBER" layer is not a text layer.');
      }

      const allLayers = [];
      collectAllLayers(doc, allLayers);

      for (const layer of allLayers) {
        layer.visible = false;
      }
      showLayerAndParents(numberLayer);

      const fontSize = 151 / 0.24; // adjust for 300ppi

      for (let n = 0; n <= 99; n++) {
        if (statusEl) statusEl.textContent = `Exporting number ${n}/99...`;

        numberLayer.textItem.contents = String(n);
        numberLayer.textItem.characterStyle.size = fontSize;

        const exportFileName = `${designId}_${n}.png`;
        const exportFile = await numbersFolder.createFile(exportFileName, { overwrite: true });
        // Local always → Numbers/. Cloud (if checked) uses same CDN path as design exports.
        const cdnPath = cloudExportEnabled
          ? exportHandler.buildCdnPath(baseFolder.name, designId, exportFileName)
          : null;
        await exportHandler.exportPng(doc, exportFile, cdnPath, cloudExportEnabled);
      }

      await doc.close(require("photoshop").constants.SaveOptions.DONOTSAVECHANGES);
    }, { commandName: "Generate Numbers" });

    if (statusEl) {
      statusEl.textContent = cloudExportEnabled
        ? `Generated numbers 0–99 for ${designId} (local Numbers/ + cloud).`
        : `Generated numbers 0–99 for ${designId} (Numbers folder).`;
    }
  } catch (err) {
    if (statusEl) statusEl.textContent = `Generate numbers failed: ${err.message || String(err)}`;
    console.error("Generate numbers error:", err);
  }
}

function collectAllLayers(container, out) {
  const layers = container.layers;
  if (!layers) return;
  for (const layer of layers) {
    out.push(layer);
    if (layer.layers && layer.layers.length) collectAllLayers(layer, out);
  }
}

function findLayerByName(container, name) {
  const layers = container.layers;
  if (!layers) return null;
  for (const layer of layers) {
    if (layer.name === name) return layer;
    if (layer.layers && layer.layers.length) {
      const nested = findLayerByName(layer, name);
      if (nested) return nested;
    }
  }
  return null;
}

function showLayerAndParents(layer) {
  let current = layer;
  while (current && current !== app.activeDocument) {
    try {
      current.visible = true;
    } catch (_) {}
    if (!current.parent || current.parent === app.activeDocument) break;
    current = current.parent;
  }
}

module.exports = {
  runGenerateNumbers
};
