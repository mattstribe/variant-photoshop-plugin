/**
 * Design-specific settings for 26-DivPrev.
 * Customize logo, team name, text size, layer positions, etc. for this design.
 *
 * @param {Object} doc - Photoshop active document
 * @param {Object} context - { baseFolder, tCity, tName, tFull, tConf, divAbb, tColor, logoLayer, teamNameLayer, getByName }
 */
async function apply(doc, context) {
  const { teamNameLayer, getByName } = context;

  // Read width and height of team name layer (boundsNoEffects excludes strokes/shadows)
  const b = teamNameLayer.boundsNoEffects || teamNameLayer.bounds;
  const width = b.right - b.left;
  const height = b.bottom - b.top;

  alert(width + " " + height)
  // Add design-specific logic here, e.g.:
  // - Resize text: teamNameLayer.textItem.characterStyle.size = 24;
  // - Translate layers: use app.batchPlay with transform
  // - Set text color, fill color, etc.



}

module.exports = { apply };
