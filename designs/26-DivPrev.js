/**
 * Design-specific settings for 26-DivPrev.
 * Customize logo, team name, text size, layer positions, etc. for this design.
 *
 * @param {Object} doc - Photoshop active document
 * @param {Object} context - { baseFolder, tCity, tName, tFull, tConf, divAbb, tColor, logoLayer, teamNameLayer, getByName }
 */

const { app } = require("photoshop");

async function apply(doc, context) {
  const { teamNameLayer, getByName } = context;

  const bottomFolder = getByName(doc, "BOTTOM");

  // Read width and height of team name layer (boundsNoEffects excludes strokes/shadows)
  let DEFAULT_FONT_SIZE = 200
  let adjustedFontSize = DEFAULT_FONT_SIZE / 0.24 //adjust for 300ppi

  teamNameLayer.textItem.characterStyle.size = adjustedFontSize

  const b = teamNameLayer.boundsNoEffects || teamNameLayer.bounds;
  const width = b.right - b.left;
  const height = b.bottom - b.top;

  let MAX_WIDTH = 4000

  if (width > MAX_WIDTH){
    let percentScale = (MAX_WIDTH / width)

    teamNameLayer.textItem.characterStyle.size = adjustedFontSize * percentScale

    let heightChange = height * (1 - percentScale)

    await translate(teamNameLayer, 0, -1 * heightChange);
    await translate(bottomFolder, 0, -1 * heightChange);

    await translate(teamNameLayer, 0, heightChange);
    await translate(bottomFolder, 0, heightChange);

  }


}

module.exports = { apply };

async function scaleLayer(layer, percent, anchor = "top") {
  const value = Number(percent);
  if (!isFinite(value) || value <= 0) return;
  
  // Map anchor to quadCenterState enum value
  const anchorMap = {
    "top": "QCSTop",
    "center": "QCSAverage",
    "bottom": "QCSBottom",
    "topLeft": "QCSTopLeft",
    "topRight": "QCSTopRight",
    "bottomLeft": "QCSBottomLeft",
    "bottomRight": "QCSBottomRight"
  };
  
  const centerState = anchorMap[anchor] || "QCSTop";
  
  await app.batchPlay([
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
      height: { _unit: "percentUnit", _value: value }
    }
  ], { synchronousExecution: true });
}

async function translate(layer, deltaX, deltaY) {
  const dx = Math.round(deltaX);
  const dy = Math.round(deltaY);
  await app.batchPlay([
    {
      _obj: "select",
      _target: [{ _ref: "layer", _id: layer._id }],
      makeVisible: true
    },
    {
      _obj: "transform",
      _target: [{ _ref: "layer", _enum: "ordinal", _value: "targetEnum" }],
      freeTransformCenterState: { _enum: "quadCenterState", _value: "QCSAverage" },
      offset: {
        _obj: "offset",
        horizontal: { _unit: "pixelsUnit", _value: dx },
        vertical: { _unit: "pixelsUnit", _value: dy }
      }
    }
  ], { synchronousExecution: true });
}