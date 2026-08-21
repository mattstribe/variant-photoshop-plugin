/**
 * Design-specific settings for 26-NBHL-Cup-Team.
 * Font size: 115pt (same /0.24 PPI adjust as TeamHoodie). Team name colored with tColor.
 * Athletic Heather: if primary is too light (lum >= 0.71), use secondary for fills/text.
 * If wider than the template's original TEAM NAME width, scale X only (keep height).
 *
 * @param {Object} doc - Photoshop active document
 * @param {Object} context - { tCity, tName, tColor, tColor2, productColor, teamNameMaxWidth, teamNameLayer, getByName, fillColor, app, ... }
 */

const { app } = require("photoshop");

async function apply(doc, context) {
  const {
    teamNameLayer,
    getByName,
    tCity,
    tColor,
    tColor2,
    productColor,
    teamNameMaxWidth,
    fillColor
  } = context;

  const teamCityLayer = getByName(doc, "TEAM CITY");
  if (teamCityLayer && teamCityLayer.textItem) {
    teamCityLayer.textItem.contents = String(tCity || "").toUpperCase();
  }

  const fillHex = resolveFillColor(tColor, tColor2, productColor);

  // Re-fill TEAM COLOR layers with the resolved color (overrides default color1 fill).
  if (fillColor && fillHex) {
    const teamColorLayers = getAllByName(doc, "TEAM COLOR");
    for (const layer of teamColorLayers) {
      await fillColor(layer, fillHex);
    }
  }

  if (!teamNameLayer || !teamNameLayer.textItem) return;

  let DEFAULT_FONT_SIZE = 115;
  let adjustedFontSize = DEFAULT_FONT_SIZE / 0.24; // adjust for 300ppi

  teamNameLayer.textItem.characterStyle.size = adjustedFontSize;

  if (fillHex) {
    const productKey = String(productColor || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    const isAthleticHeather = productKey.includes("HEATHER");
    // On light shirts keep dark team colors; only force white on dark shirts.
    const textHex =
      !isAthleticHeather && relativeLuminance(fillHex) < 0.06
        ? "ffffff"
        : String(fillHex).replace(/^#/, "").toLowerCase();
    const color = new app.SolidColor();
    color.rgb.hexValue = textHex;
    teamNameLayer.textItem.characterStyle.color = color;
  }

  const maxWidth = Number(teamNameMaxWidth);
  if (!maxWidth || maxWidth <= 0) return;

  const b = teamNameLayer.boundsNoEffects || teamNameLayer.bounds;
  const width = b.right - b.left;
  if (!(width > maxWidth)) return;

  const scaleXPercent = (maxWidth / width) * 100;
  await scaleLayerX(teamNameLayer, scaleXPercent, "center");
}

module.exports = { apply };

function resolveFillColor(color1, color2, productColor) {
  const primary = String(color1 || "").replace(/^#/, "").trim().toLowerCase() || "4a4a4a";
  const secondary = String(color2 || "").replace(/^#/, "").trim().toLowerCase();
  const productKey = String(productColor || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const isAthleticHeather = productKey.includes("HEATHER");

  if (isAthleticHeather && relativeLuminance(primary) >= 0.69 && secondary && secondary !== "000000" && secondary !== primary) {
    return secondary;
  }
  return primary;
}

function getAllByName(parent, name) {
  const results = [];
  const search = (layerList) => {
    for (const l of layerList) {
      if (l.name === name) results.push(l);
      if (l.layers && l.layers.length) search(l.layers);
    }
  };
  search(parent.layers || parent);
  return results;
}

function hexToRgb(hex) {
  const h = String(hex || "").replace(/^#/, "").trim();
  return {
    r: parseInt(h.slice(0, 2) || "00", 16),
    g: parseInt(h.slice(2, 4) || "00", 16),
    b: parseInt(h.slice(4, 6) || "00", 16)
  };
}

function relativeLuminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  const toLinear = (c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/** Scale width only; height stays 100%. `percent` is relative to current size (e.g. 80 = 80%). */
async function scaleLayerX(layer, percent, anchor = "center") {
  const value = Number(percent);
  if (!isFinite(value) || value <= 0) return;

  const anchorMap = {
    top: "QCSTop",
    center: "QCSAverage",
    bottom: "QCSBottom",
    topLeft: "QCSTopLeft",
    topRight: "QCSTopRight",
    bottomLeft: "QCSBottomLeft",
    bottomRight: "QCSBottomRight"
  };
  const centerState = anchorMap[anchor] || "QCSAverage";

  await app.batchPlay(
    [
      {
        _obj: "select",
        _target: [{ _ref: "layer", _id: layer._id }],
        makeVisible: true
      },
      {
        _obj: "transform",
        _target: [{ _ref: "layer", _enum: "ordinal", _value: "targetEnum" }],
        freeTransformCenterState: { _enum: "quadCenterState", _value: centerState },
        width: { _unit: "percentUnit", _value: value },
        height: { _unit: "percentUnit", _value: 100 }
      }
    ],
    { synchronousExecution: true }
  );
}
