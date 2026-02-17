const storage = require("./storage.js");
const leagueConfig = require("./leagueConfig.js");
const imageHandler = require("./imageHandler.js");
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
    const { designId } = await leagueConfig.loadMerchSettings(baseFolder);
    if (!merchTeams.length || !allTeams.length) {
      if (statusEl) statusEl.textContent = "No merch/team data found.";
      return;
    }

    const designScript = designId ? designRegistry.getDesignScript(designId) : null;
    if (designId && !designScript) {
      console.warn(`Design script "${designId}" not found; using default behavior.`);
    }

    let processed = 0;
    let missing = 0;

    await core.executeAsModal(async () => {
      const doc = app.activeDocument;
      if (!doc) throw new Error("No active Photoshop document is open.");

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

        const logoLayer = getByName(doc, 'LOGO');
        const teamNameLayer = getByName(doc, 'TEAM NAME');
        if (!logoLayer || !teamNameLayer) continue;

        await delay(500);
        teamNameLayer.textItem.contents = tName.toUpperCase();
        await delay(500);

        const logoUrl = `${imageHandler.IMAGE_CDN_BASE}/${encodeURIComponent(baseFolder.name)}/LOGOS/TEAMS/${encodeURIComponent(tConf)}/${encodeURIComponent(divAbb)}/${encodeURIComponent(tFull)}.png`;
        let ok = await imageHandler.replaceLayerWithImage(logoLayer, logoUrl);
        if (!ok) ok = await imageHandler.replaceLayerWithImage(logoLayer, `LOGOS/TEAMS/${tConf}/${divAbb}/${tFull}.png`, baseFolder);
        if (!ok) await imageHandler.replaceLayerWithImage(logoLayer, "LOGOS/LeagueLogo.png", baseFolder);

        if (designScript?.apply) {
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

        processed += 1;
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
        // Recurse into children if it's a group
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

// Ensure folder path under a root FolderEntry; returns the deepest folder
async function ensureFolderPath(rootFolder, segments) {
  let current = rootFolder;
  for (const segment of segments) {
    try { current = await current.getEntry(segment); }
    catch { current = await current.createFolder(segment); }
  }
  return current;
}


module.exports = {
  runGenerateDesigns
};

