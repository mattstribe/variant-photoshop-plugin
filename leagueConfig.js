// ========== LEAGUE CONFIG (variant-merch) ==========
// Loads merch teams and team info from Google Sheets via master league sheet.

const MASTER_LEAGUE_SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSbCy1pnMHPC-i_MU3x2U8ESVtSeDu7M8RrDbNxl0D-aT-TFlJJ9o7KDMyugap2vlQgTCF8y5FSwLT2/pub?output=csv";

const leagueUrlCache = {};

function parseCSV(csvContent) {
  const lines = csvContent.replace(/\r/g, "").split("\n");
  const result = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const csvArray = [];
    let currentValue = "", inQuotes = false;
    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        csvArray.push(currentValue.trim());
        currentValue = "";
      } else {
        currentValue += char;
      }
    }
    csvArray.push(currentValue.trim());
    result.push(csvArray);
  }
  return result;
}

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} while fetching ${url}`);
  return await res.text();
}

function createHeaderMap(headerRow) {
  const headerMap = {};
  for (let i = 0; i < headerRow.length; i++) {
    const key = String(headerRow[i] || "").trim();
    if (key) headerMap[key] = i;
  }
  return headerMap;
}

function getValue(row, columnName, headerMap) {
  const idx = headerMap[columnName];
  return typeof idx === "number" ? (row[idx] ?? "") : "";
}

function normalizeColor(color) {
  if (!color) return "000000";
  return String(color).replace(/^#/, "").trim().toLowerCase() || "000000";
}

async function getLeagueCsvUrls(baseFolder) {
  const leagueName = String(baseFolder?.name || "").trim();
  if (!leagueName) throw new Error("Base folder name is missing.");

  if (leagueUrlCache[leagueName]) return leagueUrlCache[leagueName];

  const masterCsv = await fetchText(MASTER_LEAGUE_SHEET_URL);
  const rows = parseCSV(masterCsv);
  if (!rows.length) throw new Error("Master league sheet is empty.");

  const headerRow = rows[0];
  const headerMap = createHeaderMap(headerRow);

  let teamUrl = "";
  let merchTeamsUrl = "";
  let merchSettingsUrl = "";

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const leagueCell = String(getValue(row, "LEAGUE", headerMap) || "").trim();
    if (!leagueCell) continue;
    if (leagueCell.toLowerCase() === leagueName.toLowerCase()) {
      teamUrl = String(getValue(row, "TEAM INFO", headerMap) || "").trim();
      merchTeamsUrl = String(getValue(row, "MERCH TEAMS", headerMap) || "").trim();
      if (!merchTeamsUrl) merchTeamsUrl = teamUrl;
      merchSettingsUrl = String(getValue(row, "MERCH SETTINGS", headerMap) || "").trim();
      break;
    }
  }

  if (!teamUrl) throw new Error(`League "${leagueName}" not found in master sheet.`);

  const urls = { teamUrl, merchTeamsUrl, merchSettingsUrl };
  leagueUrlCache[leagueName] = urls;
  return urls;
}

async function loadMerchTeams(baseFolder) {
  try {
    const { merchTeamsUrl } = await getLeagueCsvUrls(baseFolder);
    const merchRead = parseCSV(await fetchText(merchTeamsUrl));
    if (!merchRead.length) return [];

    const headerMap = createHeaderMap(merchRead[1]);

    const merchTeams = [];
    for (let n = 2; n < merchRead.length; n++) {
      const row = merchRead[n] || [];
      const abb = String(getValue(row, "Abb", headerMap) || row[1] || "").trim();
      const teamCity = String(getValue(row, "Team City", headerMap) || row[2] || "").trim();
      const teamName = String(getValue(row, "Team Name", headerMap) || row[3] || "").trim();
      if (!abb && !teamCity && !teamName) continue;
      merchTeams.push({
        abb,
        teamCity,
        teamName
      });
    }
    return merchTeams;
  } catch (err) {
    console.error("Error loading merch teams:", err);
    return [];
  }
}

async function loadTeamInfo(baseFolder) {
  try {
    const { teamUrl } = await getLeagueCsvUrls(baseFolder);
    const teamInfo = parseCSV(await fetchText(teamUrl));
    if (!teamInfo.length) return [];

    const headerMap = createHeaderMap(teamInfo[0]);
    const teams = [];

    for (let n = 1; n < teamInfo.length; n++) {
      const row = teamInfo[n] || [];
      const teamCity = String(getValue(row, "Team City", headerMap) || "").trim();
      const teamName = String(getValue(row, "Team Name", headerMap) || "").trim();
      const fullTeam = String(getValue(row, "Full Team Name", headerMap) || "").trim() || `${teamCity} ${teamName}`.trim();
      teams.push({
        conf: getValue(row, "Conf", headerMap) || getValue(row, "Tier", headerMap),
        div: getValue(row, "Division", headerMap),
        abb: getValue(row, "Abb", headerMap),
        teamCity,
        teamName,
        fullTeam,
        color1: normalizeColor(getValue(row, "Color 1", headerMap)),
        color2: normalizeColor(getValue(row, "Color 2", headerMap)),
        color3: normalizeColor(getValue(row, "Color 3", headerMap)),
      });
    }
    return teams;
  } catch (err) {
    console.error("Error loading team info:", err);
    return [];
  }
}

/**
 * Load merch settings from the MERCH SETTINGS sheet.
 * G3 = Design ID, H3 = Product ID (1-based sheet cells).
 */
async function loadMerchSettings(baseFolder) {
  try {
    const { merchSettingsUrl } = await getLeagueCsvUrls(baseFolder);
    if (!merchSettingsUrl) return { designId: "", productId: "" };

    const rows = parseCSV(await fetchText(merchSettingsUrl));
    const row = rows[2]; // Row 3 (1-based)
    if (!row) return { designId: "", productId: "" };

    const designId = String(row[6] ?? "").trim();  // G3 = column 7
    const productId = String(row[7] ?? "").trim(); // H3 = column 8
    return { designId, productId };
  } catch (err) {
    console.error("Error loading merch settings:", err);
    return { designId: "", productId: "" };
  }
}

module.exports = {
  loadMerchTeams,
  loadTeamInfo,
  loadMerchSettings,
};
