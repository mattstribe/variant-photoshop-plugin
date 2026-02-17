const storage = require("./storage.js");
const leagueConfig = require("./leagueConfig.js");
const generateDesigns = require("./generateDesigns.js");
const uxpStorage = require("uxp").storage;

async function setLeagueLogo(baseFolder, imgEl) {
  if (!imgEl) return;
  imgEl.style.display = "none";
  imgEl.removeAttribute("src");
  try {
    const logosFolder = await baseFolder.getEntry("LOGOS");
    let fileEntry = null;
    try {
      fileEntry = await logosFolder.getEntry("leagueLogo.png");
    } catch {
      try { fileEntry = await logosFolder.getEntry("LeagueLogo.png"); } catch {}
    }
    if (!fileEntry) return;
    const data = await fileEntry.read({ format: uxpStorage.formats.binary });
    const bytes = new Uint8Array(data);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    imgEl.src = `data:image/png;base64,${btoa(binary)}`;
    imgEl.style.display = "";
  } catch (err) {
    console.log("League logo not found:", err.message);
  }
}

async function refreshMerchSettings() {
  const designIdEl = document.getElementById("designIdDisplay");
  const productIdEl = document.getElementById("productIdDisplay");
  if (!designIdEl || !productIdEl) return;

  const baseFolder = await storage.getBaseFolder();
  if (!baseFolder) {
    designIdEl.textContent = "—";
    productIdEl.textContent = "—";
    return;
  }
  try {
    const { designId, productId } = await leagueConfig.loadMerchSettings(baseFolder);
    designIdEl.textContent = designId || "—";
    productIdEl.textContent = productId || "—";
  } catch (err) {
    designIdEl.textContent = "—";
    productIdEl.textContent = "—";
    console.error("Merch settings:", err.message);
  }
}

async function refreshUI() {
  const folderDisplayEl = document.getElementById("folderDisplay");
  const leagueLogoEl = document.getElementById("leagueLogo");
  const folder = await storage.getBaseFolder();

  if (folderDisplayEl) {
    folderDisplayEl.textContent = folder ? `Folder: ${folder.name}` : "Folder: Not selected";
  }
  if (folder) {
    await setLeagueLogo(folder, leagueLogoEl);
    await refreshMerchSettings();
  } else {
    if (leagueLogoEl) {
      leagueLogoEl.style.display = "none";
      leagueLogoEl.removeAttribute("src");
    }
    const designIdEl = document.getElementById("designIdDisplay");
    const productIdEl = document.getElementById("productIdDisplay");
    if (designIdEl) designIdEl.textContent = "—";
    if (productIdEl) productIdEl.textContent = "—";
  }
}

document.getElementById("btnSelectFolder").addEventListener("click", async () => {
  const statusEl = document.getElementById("status");
  try {
    await storage.selectAndSaveBaseFolder();
    await refreshUI();
    if (statusEl) statusEl.textContent = "";
  } catch (err) {
    if (statusEl) statusEl.textContent = "Folder picker failed. Reload plugin after manifest changes.";
    console.error("Folder picker error:", err);
  }
});

document.getElementById("btnRefreshMerchSettings").addEventListener("click", async () => {
  const statusEl = document.getElementById("status");
  if (!(await storage.getBaseFolder())) {
    if (statusEl) statusEl.textContent = "Please select a league folder first.";
    return;
  }
  if (statusEl) statusEl.textContent = "Refreshing...";
  try {
    await refreshMerchSettings();
    if (statusEl) statusEl.textContent = "";
  } catch (err) {
    if (statusEl) statusEl.textContent = "Refresh failed.";
    console.error("Refresh merch settings:", err);
  }
});

document.getElementById("btnListTeams").addEventListener("click", async () => {
  const statusEl = document.getElementById("status");
  const baseFolder = await storage.getBaseFolder();
  if (!baseFolder) {
    statusEl.textContent = "Please select a league folder first.";
    return;
  }
  statusEl.textContent = "Loading teams...";
  try {
    const teams = await leagueConfig.loadMerchTeams(baseFolder);
    if (teams.length === 0) {
      statusEl.textContent = "No teams found.";
      return;
    }
    statusEl.innerHTML = teams.map((t, i) => {
      return `${i + 1}. ${t.abb} - ${t.teamCity} ${t.teamName}`;
    }).join("<br>");
  } catch (err) {
    statusEl.textContent = "Error: " + (err.message || String(err));
    console.error(err);
  }
});

document.getElementById("btnGenerateDesigns").addEventListener("click", generateDesigns.runGenerateDesigns);

refreshUI();
