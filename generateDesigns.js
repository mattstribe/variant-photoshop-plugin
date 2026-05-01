const storage = require("./storage.js");
const leagueConfig = require("./leagueConfig.js");
const imageHandler = require("./imageHandler.js");
const exportHandler = require("./exportHandler.js");
const designRegistry = require("./designs/index.js");
const { app, core } = require("photoshop");

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function runGenerateDesigns() {
  const statusEl = document.getElementById("status");

  try {
    const baseFolder = await storage.getBaseFolder();
    if (!baseFolder) {
      if (statusEl) statusEl.textContent = "Please select a league folder first.";
      return;
    }

    if (statusEl) statusEl.textContent = "Loading team data...";
    const merchTeams = await leagueConfig.loadMerchTeams(baseFolder);
    const allTeams = await leagueConfig.loadTeamInfo(baseFolder);
    const { designId, productId, colors } = await leagueConfig.loadMerchSettings(baseFolder);
    if (!merchTeams.length || !allTeams.length) {
      if (statusEl) statusEl.textContent = "No merch/team data found.";
      return;
    }

    let designScript = null;
    if (designId) {
      designScript = designRegistry.getDesignScript(designId);
    }
    if (designId && !designScript) {
      console.warn(`Design script "${designId}" not found; using default behavior.`);
    }

    // Navigate to template folder: baseFolder > MERCH > Design Files > {designId}
    let merchFolder;
    try {
      merchFolder = await baseFolder.getEntry("MERCH");
    } catch {
      if (statusEl) statusEl.textContent = "MERCH folder not found in base folder.";
      return;
    }
    const designFilesFolder = await merchFolder.getEntry("Design Files");
    const designFolder = await designFilesFolder.getEntry(designId);

    // Template file
    const templateFile = await designFolder.getEntry(`${designId}_TEMPLATE.psd`);

    // Create Exports folder inside designFolder if it doesn't exist (BEFORE executeAsModal)
    let exportsFolder;
    try {
      exportsFolder = await designFolder.getEntry("Exports");
    } catch {
      exportsFolder = await designFolder.createFolder("Exports");
    }

    const blankMockupsFolder = await merchFolder.getEntry("Blank Mockups");

    // One variant per selected color, or productId alone if none (legacy sheets)
    const colorVariants = colors.length > 0 ? colors : [null];

    // Mockup export folder: MERCH/Design Mockups/{designId}
    let designMockupsFolder;
    try {
      designMockupsFolder = await merchFolder.getEntry("Design Mockups");
    } catch {
      designMockupsFolder = await merchFolder.createFolder("Design Mockups");
    }
    let mockupExportFolder;
    try {
      mockupExportFolder = await designMockupsFolder.getEntry(designId);
    } catch {
      mockupExportFolder = await designMockupsFolder.createFolder(designId);
    }

    // Read cloud export checkbox state BEFORE entering executeAsModal
    const exportToCloudCheckbox = document.getElementById("exportToCloudCheckbox");
    const cloudExportEnabled = exportToCloudCheckbox && exportToCloudCheckbox.checked === true;

    let processed = 0;
    let missing = 0;

    await core.executeAsModal(async () => {
      for (const colorLabel of colorVariants) {
        const fullProductId = colorLabel ? `${productId}_${colorLabel}` : productId;
        const productIdBase = fullProductId.split('_')[0];
        const mockupProductFolder = await blankMockupsFolder.getEntry(productIdBase);
        const mockupTemplateFile = await mockupProductFolder.getEntry(`${fullProductId}.psd`);

        for (let i = 0; i < merchTeams.length; i++){
          const merchFullTeam = merchTeams[i].teamCity + " " + merchTeams[i].teamName;

          let [tCity, tName, tFull, tConf, tColor, tFound, divAbb] = ["", "", "", "", "4a4a4a", false, ""];

          for (let c = 0; c < allTeams.length; c++) {
            if (allTeams[c].fullTeam === merchFullTeam) {
              divAbb = allTeams[c].abb;
              tCity = allTeams[c].teamCity;
              tName = allTeams[c].teamName;
              tFull = allTeams[c].fullTeam;
              tConf = allTeams[c].conf;
              tColor = allTeams[c].color1 || "4a4a4a";
              tFound = true;
              break;
            }
          }

          if (!tFound) { missing += 1; continue; }

          // Open a fresh copy of the template each iteration
          await app.open(templateFile);
          const doc = app.activeDocument;
          if (!doc) throw new Error("No active Photoshop document is open.");

          const logoLayer = getByName(doc, 'LOGO');
          const teamNameLayer = getByName(doc, 'TEAM NAME');
          const teamCityLayer = getByName(doc, 'TEAM CITY');
          await delay(500);
          if (teamNameLayer) {
            teamNameLayer.textItem.contents = tName.toUpperCase();
          }
          if (teamCityLayer) {
            teamCityLayer.textItem.contents = tCity.toUpperCase();
          }

          const productColor = (colorLabel || productId.split('_')[1] || '').toUpperCase();
          const isBlack = productColor === 'BLACK';
          const logoPath = `LOGOS/TEAMS/${tConf}/${divAbb}`;
          const logoFile = `${tFull}.png`;
          const logoUrl = `${imageHandler.IMAGE_CDN_BASE}/${encodeURIComponent(baseFolder.name)}/${logoPath}/${encodeURIComponent(logoFile)}`;

          console.log(`[LOGO DEBUG] Team: "${tFull}" | conf: "${tConf}" | divAbb: "${divAbb}" | isBlack: ${isBlack}`);
          console.log(`[LOGO DEBUG] CDN URL: ${logoUrl}`);
          console.log(`[LOGO DEBUG] Local path: ${logoPath}/${logoFile}`);

          if (logoLayer) {
            let ok = false;
            if (isBlack) {
              const logoFileLight = `${tFull}_LIGHT.png`;
              const lightUrl = `${imageHandler.IMAGE_CDN_BASE}/${encodeURIComponent(baseFolder.name)}/${logoPath}/${encodeURIComponent(logoFileLight)}`;
              ok = await imageHandler.replaceLayerWithImage(logoLayer, lightUrl);
              if (!ok) ok = await imageHandler.replaceLayerWithImage(logoLayer, `${logoPath}/${logoFileLight}`, baseFolder);
            }
            if (!ok) ok = await imageHandler.replaceLayerWithImage(logoLayer, logoUrl);
            if (!ok) ok = await imageHandler.replaceLayerWithImage(logoLayer, `${logoPath}/${logoFile}`, baseFolder);
            if (!ok) await imageHandler.replaceLayerWithImage(logoLayer, "LOGOS/LeagueLogo.png", baseFolder);
          }

          if (designScript && designScript.apply) {
            const context = {
              baseFolder,
              tCity,
              tName,
              tFull,
              tConf,
              divAbb,
              tColor,
              logoLayer: getByName(doc, "LOGO"),
              teamNameLayer: getByName(doc, "TEAM NAME"),
              getByName: (parent, name) => getByName(parent || doc, name),
              app,
              fillColor,
              setStrokeColor,
              setTextColor,
              duplicate,
            };
            await designScript.apply(doc, context);
          }

          // Export PNG (full product id includes color suffix for templates / CDN)
          const exportFileName = `${tName.replace(/\s+/g, '-')}_${designId}_${fullProductId}.png`.toLowerCase();
          const exportFile = await exportsFolder.createFile(exportFileName, { overwrite: true });
          const cdnPath = exportHandler.buildCdnPath(baseFolder.name, designId, exportFileName);
          await exportHandler.exportPng(doc, exportFile, cdnPath, cloudExportEnabled);

          // Close design template
          await doc.close(require("photoshop").constants.SaveOptions.DONOTSAVECHANGES);

          // Open mockup template and place the design + logo
          await app.open(mockupTemplateFile);
          const mockDoc = app.activeDocument;

          const frontLayer = getByName(mockDoc, 'FRONT');
          const mockLogoLayers = getAllByName(mockDoc, 'LOGO');

          if (frontLayer) {
            await imageHandler.placeIntoLayer(frontLayer, exportFile);
          }
          for (const mockLogo of mockLogoLayers) {
            let mockOk = await imageHandler.replaceLayerWithImage(mockLogo, logoUrl);
            if (!mockOk) mockOk = await imageHandler.replaceLayerWithImage(mockLogo, `${logoPath}/${logoFile}`, baseFolder);
            if (!mockOk) await imageHandler.replaceLayerWithImage(mockLogo, "LOGOS/LeagueLogo.png", baseFolder);
          }

          // Show only the matching conf tier in the TIERS folder
          const tiersFolder = getByName(mockDoc, 'TIERS');
          if (tiersFolder && tiersFolder.layers) {
            for (const tierLayer of tiersFolder.layers) {
              tierLayer.visible = (tierLayer.name === tConf);
            }
          }

          // Export mockup PNG (local only; never upload mockups to cloud)
          const mockupExportName = exportFileName.replace('.png', '-mockup.png');
          const mockupExportFile = await mockupExportFolder.createFile(mockupExportName, { overwrite: true });
          await exportHandler.exportPng(mockDoc, mockupExportFile, null, false);

          // Close mockup without saving
          await mockDoc.close(require("photoshop").constants.SaveOptions.DONOTSAVECHANGES);

          processed += 1;
        }
      }
    }, { commandName: "Generate Merch Designs" });

    if (statusEl) {
      statusEl.textContent = `Generated ${processed} designs${missing ? ` (${missing} unmatched)` : ""}.`;
    }
  } catch (err) {
    if (statusEl) statusEl.textContent = `Generate failed: ${err.message || String(err)}`;
    console.error("Generate designs error:", err);
  }
}

// ===== Helpers =====

function hexToRgb(hex) {
  const h = (hex || '').replace(/^#/, "").trim();
  const r = parseInt(h.slice(0, 2) || '00', 16);
  const g = parseInt(h.slice(2, 4) || '00', 16);
  const b = parseInt(h.slice(4, 6) || '00', 16);
  return { r, g, b };
}

async function fillColor(layer, hex) {
  const { r, g, b } = hexToRgb(hex);
  await app.batchPlay([
    { _obj: "select", _target: [{ _ref: "layer", _id: layer._id }], makeVisible: false, selectionModifier: { _enum: "selectionModifierType", _value: "replaceSelection" }, _isCommand: true }
  ], { synchronousExecution: true });
  await app.batchPlay([
    { _obj: "set", _target: [{ _ref: "contentLayer", _enum: "ordinal", _value: "targetEnum" }], to: { _obj: "solidColorLayer", color: { _obj: "RGBColor", red: r, green: g, blue: b } } }
  ], { synchronousExecution: true });
}

async function setStrokeColor(layer, hex) {
  const { r, g, b } = hexToRgb(hex);
  await app.batchPlay([
    { _obj: "select", _target: [{ _ref: "layer", _id: layer._id }], makeVisible: false, selectionModifier: { _enum: "selectionModifierType", _value: "replaceSelection" }, _isCommand: true }
  ], { synchronousExecution: true });
  await app.batchPlay([
    {
      _obj: "set",
      _target: [
        {
          _enum: "ordinal",
          _ref: "contentLayer",
          _value: "targetEnum"
        }
      ],
      to: {
        _obj: "shapeStyle",
        strokeStyle: {
          _obj: "strokeStyle",
          strokeEnabled: true,
          strokeStyleContent: {
            _obj: "solidColorLayer",
            color: {
              _obj: "RGBColor",
              red: r,
              green: g,
              blue: b
            }
          },
          strokeStyleVersion: 2
        }
      }
    }
  ], { synchronousExecution: true });
}

const getByName = (parent, name) => {
  const layers = parent.layers || parent;
  return layers.find(l => l.name === name);
};

const getAllByName = (parent, name) => {
  const results = [];
  const search = (layerList) => {
    for (const l of layerList) {
      if (l.name === name) results.push(l);
      if (l.layers && l.layers.length) search(l.layers);
    }
  };
  search(parent.layers || parent);
  return results;
};

const setTextColor = (layer, backgroundColor) => {
  const color = new app.SolidColor();
  if (backgroundColor === 'ffffff') 
    color.rgb.hexValue = '252525';
  else color.rgb.hexValue = 'ffffff';
  layer.textItem.characterStyle.color = color;
};

async function duplicate(group, newName, deltaX = 0, deltaY = 0) {
  // 1) Select source group
  await app.batchPlay(
    [{
      _obj: "select",
      _target: [{ _ref: "layer", _id: group._id }],
      makeVisible: false
    }],
    { synchronousExecution: true }
  );

  // 2) Duplicate (new group becomes active)
  await app.batchPlay(
    [{ _obj: "duplicate", _target: [{ _ref: "layer", _id: group._id }] }],
    { synchronousExecution: true }
  );

  const dup = app.activeDocument.activeLayers[0];

  // 3) Rename duplicated group
  try { dup.name = newName; } catch {}

  // 4) Recursively strip " copy" suffixes from dup and all descendants
  const stripSuffix = n => n.replace(/\s+copy(?:\s*\d+)?$/i, "");
  const scrubNamesRecursively = (layerLike) => {
    try {
      if (layerLike.name) {
        const cleaned = stripSuffix(layerLike.name);
        if (cleaned !== layerLike.name) layerLike.name = cleaned;
      }
    } catch {}
    if (layerLike.layers && layerLike.layers.length) {
      for (const child of layerLike.layers) scrubNamesRecursively(child);
    }
  };
  scrubNamesRecursively(dup);

  // 5) Translate/move the duplicated group if requested
  if (deltaX !== 0 || deltaY !== 0) {
    await app.batchPlay(
      [{
        _obj: "transform",
        _target: [{ _ref: "layer", _id: dup._id }],
        freeTransformCenterState: { _enum: "quadCenterState", _value: "QCSAverage" },
        offset: {
          _obj: "offset",
          horizontal: { _unit: "pixelsUnit", _value: deltaX },
          vertical:   { _unit: "pixelsUnit", _value: deltaY }
        }
      }],
      { synchronousExecution: true }
    );
  }

  return dup;
}



module.exports = {
  runGenerateDesigns
};
