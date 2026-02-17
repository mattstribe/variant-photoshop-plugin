/**
 * Load design script by file name. No manual registry needed.
 * designId "26-DivPrev" → requires ./26-DivPrev.js
 * Add new designs by dropping a file in the designs folder.
 */
function getDesignScript(designId) {
  if (!designId || typeof designId !== "string") return null;
  const safe = String(designId).trim().replace(/[^a-zA-Z0-9_-]/g, "");
  if (!safe || safe !== String(designId).trim()) return null;
  try {
    return require("./" + safe + ".js");
  } catch {
    return null;
  }
}

module.exports = { getDesignScript };
