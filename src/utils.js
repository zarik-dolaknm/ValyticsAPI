const NodeCache = require('node-cache');
const axios = require('axios');
const cheerio = require('cheerio');
const cache = new NodeCache({ stdTTL: 120 });

function cleanText(text) {
  return text.replace(/\s+/g, ' ').trim();
}

function withCache(key, fetchFn, ttl = 120) {
  return async function(...args) {
    const cached = cache.get(key);
    if (cached) return cached;
    const data = await fetchFn(...args);
    cache.set(key, data, ttl);
    return data;
  };
}

function handleHttpError(res, error, msg = 'Internal error') {
  res.status(500).json({ error: msg });
}

const http = axios.create({
  headers: {
    'User-Agent': 'Mozilla/5.0',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1'
  }
});

async function getEvents() {
  const response = await http.get('https://www.vlr.gg/events');
  const $ = cheerio.load(response.data);
  const events = [];
  $('a.event-item.mod-flex.wf-card').each((i, eventElement) => {
    const name = cleanText($(eventElement).find('.event-item-title').text());
    const status = cleanText($(eventElement).find('.event-item-desc-item-status').text());
    const prizePool = cleanText($(eventElement).find('.mod-prize').clone().children().remove().end().text());
    const dates = cleanText($(eventElement).find('.mod-dates').clone().children().remove().end().text());
    const regionFlagElement = $(eventElement).find('.mod-location i.flag[class*="mod-"]');
    let region = 'Unknown';
    if (regionFlagElement.length > 0) {
      const classAttr = regionFlagElement.attr('class');
      const modClass = classAttr.split(' ').find(cls => cls.startsWith('mod-'));
      if (modClass) region = modClass.replace('mod-', '').toUpperCase();
    }
    const href = $(eventElement).attr('href');
    const url = href ? `https://www.vlr.gg${href}` : null;
    const id = href ? href.split('/')[2] : null;
    if (name) {
      events.push({ id, name, status, prizePool, dates, region, url });
    }
  });
  return events;
}

const REGION_URLS = {
  'europe': 'https://www.vlr.gg/rankings/europe',
  'north-america': 'https://www.vlr.gg/rankings/north-america',
  'brazil': 'https://www.vlr.gg/rankings/brazil',
  'asia-pacific': 'https://www.vlr.gg/rankings/asia-pacific',
  'korea': 'https://www.vlr.gg/rankings/korea',
  'china': 'https://www.vlr.gg/rankings/china',
  'japan': 'https://www.vlr.gg/rankings/japan',
  'la-s': 'https://www.vlr.gg/rankings/la-s',
  'oceania': 'https://www.vlr.gg/rankings/oceania',
  'gc': 'https://www.vlr.gg/rankings/gc',
  'mena': 'https://www.vlr.gg/rankings/mena',
  'collegiate': 'https://www.vlr.gg/rankings/collegiate',
};

function regionSupported(region) {
  return !!REGION_URLS[region];
}
function supportedRegions() {
  return Object.keys(REGION_URLS);
}

async function getTeams(region) {
  const url = REGION_URLS[region];
  const response = await http.get(url);
  const $ = cheerio.load(response.data);
  const teams = [];
  $('a.rank-item-team').each((i, el) => {
    const href = $(el).attr('href');
    const id = href ? href.split('/')[2] : null;
    const name = cleanText($(el).find('img').attr('alt') || $(el).find('.ge-text').clone().children().remove().end().text());
    const logo = $(el).find('img').attr('src');
    const country = cleanText($(el).find('.rank-item-team-country').text());
    if (id && name) {
      teams.push({
        id,
        name,
        logo: logo ? `https://owcdn.net${logo}` : null,
        url: href ? `https://www.vlr.gg${href}` : null,
        country
      });
    }
  });
  return teams;
}
getTeams.regionSupported = regionSupported;
getTeams.supportedRegions = supportedRegions;

getTeams.profile = async function(teamId) {
  const url = `https://www.vlr.gg/team/${teamId}/`;
  const response = await http.get(url);
  const $ = cheerio.load(response.data);
  const name = cleanText($('h1').first().text());
  const tag = cleanText($('.team-header .team-header-tag').text()) || cleanText($('.team-header .wf-title-med').text());
  const logo = $('.team-header img').attr('src');
  const region = cleanText($('.team-header .team-header-country').text()) || cleanText($('.team-header .ge-text-light').text());
  const website = $('.team-header a[href^="https://"]').attr('href') || null;
  const twitter = cleanText($('.team-header a[href*="twitter.com"]').text()) || null;
  const roster = [];
  const staff = [];
  $('.team-roster-item').each((i, el) => {
    const alias = cleanText($(el).find('.team-roster-item-name-alias').text());
    const realName = cleanText($(el).find('.team-roster-item-name-real').text());
    let role = cleanText($(el).find('.team-roster-item-name-role').first().text());
    const playerLink = $(el).find('a').attr('href');
    let playerId = null;
    if (playerLink && playerLink.startsWith('/player/')) {
      const parts = playerLink.split('/');
      if (parts.length > 2) playerId = parts[2];
    }
    if (role && /manager|coach|inactive|performance/i.test(role)) {
      staff.push({ name: alias, realName, role });
    } else {
      if (!role) role = 'player';
      roster.push({ id: playerId, name: alias, realName, role });
    }
  });
  let totalWinnings = null;
  const winningsRaw = $('.wf-card:contains("Total Winnings") span').text();
  if (winningsRaw) {
    const match = winningsRaw.match(/\$[\d,]+/);
    if (match) totalWinnings = match[0];
  }
  const recentMatches = await getTeamMatches(teamId);
  const mapStats = await getTeams.mapStats(teamId);
  let totalMatches = 0, totalWins = 0, totalLosses = 0;
  let bestMap = null, worstMap = null, mostPlayedMap = null;
  let bestWinrate = -1, worstWinrate = 101, mostPlayed = -1;
  mapStats.forEach(m => {
    const played = Number(m.played) || 0;
    const wins = Number(m.wins) || 0;
    const losses = Number(m.losses) || 0;
    const winrate = parseFloat((m.winrate||'').replace('%',''));
    totalMatches += played;
    totalWins += wins;
    totalLosses += losses;
    if (played > mostPlayed) { mostPlayed = played; mostPlayedMap = m.map; }
    if (!isNaN(winrate) && played >= 5) {
      if (winrate > bestWinrate) { bestWinrate = winrate; bestMap = m.map; }
      if (winrate < worstWinrate) { worstWinrate = winrate; worstMap = m.map; }
    }
  });
  let winrate = totalMatches > 0 ? ((totalWins / totalMatches) * 100).toFixed(1) + '%' : '';
  let last10 = recentMatches.slice(0, 10);
  let last10Wins = 0, last10Losses = 0;
  last10.forEach(m => {
    let score = m.score || '';
    let [s1, s2] = score.split(':').map(s => parseInt(s.trim(), 10));
    if (!isNaN(s1) && !isNaN(s2)) {
      if ((m.team1 === name && s1 > s2) || (m.team2 === name && s2 > s1)) last10Wins++;
      else last10Losses++;
    }
  });
  // Son 10 maçta harita bazlı istatistikler
  const last10Maps = {};
  last10.forEach(m => {
    if (m.maps && Array.isArray(m.maps)) {
      m.maps.forEach(mapObj => {
        const mapName = cleanText(mapObj.name);
        if (!mapName) return;
        if (!last10Maps[mapName]) last10Maps[mapName] = { played: 0, wins: 0, losses: 0 };
        last10Maps[mapName].played++;
        let score = m.score || '';
        let [s1, s2] = score.split(':').map(s => parseInt(s.trim(), 10));
        if (!isNaN(s1) && !isNaN(s2)) {
          if ((m.team1 === name && s1 > s2) || (m.team2 === name && s2 > s1)) last10Maps[mapName].wins++;
          else last10Maps[mapName].losses++;
        }
      });
    }
  });
  let last10MostPlayedMap = null, last10BestMap = null, last10WorstMap = null;
  let l10MostPlayed = -1, l10BestWinrate = -1, l10WorstWinrate = 101;
  Object.entries(last10Maps).forEach(([map, obj]) => {
    if (obj.played > l10MostPlayed) { l10MostPlayed = obj.played; last10MostPlayedMap = map; }
    if (obj.played >= 2) {
      let wr = obj.played > 0 ? (obj.wins / obj.played) * 100 : 0;
      if (wr > l10BestWinrate) { l10BestWinrate = wr; last10BestMap = map; }
      if (wr < l10WorstWinrate) { l10WorstWinrate = wr; last10WorstMap = map; }
    }
  });
  const stats = {
    totalMatches,
    totalWins,
    totalLosses,
    winrate,
    last10: { wins: last10Wins, losses: last10Losses },
    mostPlayedMap,
    bestMap,
    worstMap,
    last10MostPlayedMap,
    last10BestMap,
    last10WorstMap
  };
  if (!name) return null;
  return {
    id: teamId,
    name,
    tag,
    logo: logo ? `https://owcdn.net${logo}` : null,
    region,
    socials: { website, twitter },
    roster,
    staff,
    totalWinnings,
    recentMatches,
    stats
  };
};

async function getTeamMatches(teamId) {
  const url = `https://www.vlr.gg/team/matches/${teamId}/`;
  const response = await http.get(url);
  const $ = cheerio.load(response.data);
  const matches = [];
  $('a.fc-flex.m-item.wf-card').each((i, el) => {
    const matchLink = $(el).attr('href');
    const matchId = matchLink ? matchLink.split('/')[1] : null;
    const url = matchLink ? `https://www.vlr.gg${matchLink}` : null;
    const eventDiv = $(el).find('.m-item-event');
    const event = cleanText(eventDiv.find('div').first().text());
    const stage = cleanText(eventDiv.contents().filter(function() { return this.type === 'text'; }).text());
    let eventFull = event;
    if (stage) {
      const cleanStage = stage.replace(/[\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
      eventFull = `${event} ${cleanStage}`.replace(/\s+⋅\s+/g, ' ⋅ ');
    }
    const team1 = cleanText($(el).find('.m-item-team').first().find('.m-item-team-name').text());
    const team2 = cleanText($(el).find('.m-item-team').last().find('.m-item-team-name').text());
    const scoreDiv = $(el).find('.m-item-result');
    const score1 = cleanText(scoreDiv.find('span').first().text());
    const score2 = cleanText(scoreDiv.find('span').last().text());
    const date = cleanText($(el).find('.m-item-date div').first().text());
    const maps = [];
    const gamesDiv = $(el).next('.mod-collapsed.m-item-games');
    if (gamesDiv.length > 0) {
      gamesDiv.find('.m-item-games-item').each((j, gameEl) => {
        const mapName = cleanText($(gameEl).find('.map').text());
        const mapScore = cleanText($(gameEl).find('.score').text().replace(/-/g, '-'));
        maps.push({ name: mapName, score: mapScore });
      });
    }
    matches.push({
      id: matchId,
      team1,
      team2,
      score: `${score1} : ${score2}`,
      date,
      event: eventFull,
      maps,
      url
    });
  });
  console.log(`[DEBUG][getTeamMatches] Found ${matches.length} matches for team ${teamId}`);
  matches.forEach((m, i) => console.log(`[DEBUG][getTeamMatches] Match ${i}: id=${m.id}, maps=${m.maps.map(mp=>mp.name).join(',')}`));
  return matches;
}

async function getMatchDetails(matchId) {
  const response = await http.get(`https://www.vlr.gg/${matchId}`);
  const $ = cheerio.load(response.data);
  const team1Name = $('.match-header-vs .match-header-link.mod-1 .wf-title-med').text().trim();
  const team2Name = $('.match-header-vs .match-header-link.mod-2 .wf-title-med').text().trim();
  const team1Score = $('.match-header-vs-score .match-header-vs-score-winner').text().trim();
  const team2Score = $('.match-header-vs-score .match-header-vs-score-loser').text().trim();
  const rawSeriesText = $('.match-header-event-series').text();
  const cleanedSeries = rawSeriesText.replace(/\s+/g, ' ').trim();
  const rawDateText = $('.match-header-date').text();
  const cleanedDate = rawDateText.replace(/\s+/g, ' ').trim();
  const matchDetails = {
    id: matchId,
    teams: {
      team1: { name: team1Name, score: team1Score },
      team2: { name: team2Name, score: team2Score }
    },
    status: $('.match-header-status').text().trim(),
    event: {
      name: $('.match-header-event-name').text().trim(),
      series: cleanedSeries
    },
    date: cleanedDate,
    maps: []
  };
  $('.vm-stats-game-header').each((i, mapHeader) => {
    const rawMapText = $(mapHeader).find('.map').text();
    const cleanedMapText = rawMapText.replace(/\s+/g, ' ').trim();
    const mapName = cleanedMapText.split('PICK')[0].trim();
    const mapScore = $(mapHeader).find('.score').text().trim();
    const mapDuration = $(mapHeader).find('.map-duration').text().trim();
    matchDetails.maps.push({
      name: mapName,
      score: mapScore,
      duration: mapDuration,
      players: []
    });
  });
  // --- ROUND BREAKDOWN ---
  // Her map için .vlr-rounds divini bul ve round breakdown ekle
  $('.vlr-rounds').each((mapIdx, roundsDiv) => {
    const $rounds = $(roundsDiv);
    // Takım isimlerini sırayla al
    const teamNames = $rounds.find('.vlr-rounds-row .team').map((i, el) => $(el).text().trim()).get();
    if (teamNames.length < 2) return;
    const [team1, team2] = teamNames;
    let atkRoundsWon = { [team1]: 0, [team2]: 0 };
    let defRoundsWon = { [team1]: 0, [team2]: 0 };
    // Her round için .vlr-rounds-row-col (ilk col hariç) gez
    $rounds.find('.vlr-rounds-row-col').each((i, col) => {
      // Sadece round numarası olanları ve spacing olmayanları al
      if ($(col).hasClass('mod-spacing')) return;
      const roundNum = $(col).find('.rnd-num').text().trim();
      if (!roundNum) return;
      // Her roundda iki .rnd-sq var: ilki team1 (CT), ikincisi team2 (T)
      const sqs = $(col).find('.rnd-sq');
      if (sqs.length < 2) return;
      // mod-win mod-ct veya mod-win mod-t class'ına bak
      if ($(sqs[0]).hasClass('mod-win')) {
        if ($(sqs[0]).hasClass('mod-ct')) defRoundsWon[team1]++;
        if ($(sqs[0]).hasClass('mod-t')) atkRoundsWon[team1]++;
      }
      if ($(sqs[1]).hasClass('mod-win')) {
        if ($(sqs[1]).hasClass('mod-ct')) defRoundsWon[team2]++;
        if ($(sqs[1]).hasClass('mod-t')) atkRoundsWon[team2]++;
      }
    });
    // Sonuçları ilgili map'e ekle
    if (matchDetails.maps[mapIdx]) {
      matchDetails.maps[mapIdx].roundBreakdown = {
        [team1]: { atkRoundsWon: atkRoundsWon[team1], defRoundsWon: defRoundsWon[team1] },
        [team2]: { atkRoundsWon: atkRoundsWon[team2], defRoundsWon: defRoundsWon[team2] }
      };
    }
  });
  const allTables = $('table.wf-table-inset');
  const playerStatTables = allTables.filter('.mod-overview');
  let mapIndex = 0;
  playerStatTables.each((i, playerTableElement) => {
    const playerRows = $(playerTableElement).find('tbody tr');
    if (playerRows.length > 0 && mapIndex < matchDetails.maps.length) {
      const players = [];
      playerRows.each((j, playerRow) => {
        const playerName = $(playerRow).find('.mod-player .text-of').text().trim();
        const agent = $(playerRow).find('.mod-agents img').attr('alt');
        const teamName = $(playerRow).find('.mod-player .ge-text-light').text().trim();
        const playerLinkElement = $(playerRow).find('.mod-player a');
        const playerHref = playerLinkElement.attr('href');
        const playerId = playerHref ? playerHref.split('/')[2] : null;
        const playerUrl = playerHref ? `https://www.vlr.gg${playerHref}` : null;
        const stats = {
          team: teamName || 'Unknown Team',
          name: playerName,
          agent: agent,
          acs: $(playerRow).find('.mod-stat:nth-child(4) .side.mod-both').text().trim(),
          kills: $(playerRow).find('.mod-vlr-kills .side.mod-both').text().trim(),
          deaths: $(playerRow).find('.mod-vlr-deaths .side.mod-both').text().replace(/\//g, '').trim(),
          assists: $(playerRow).find('.mod-vlr-assists .side.mod-both').text().trim(),
          kast: $(playerRow).find('.mod-stat:nth-child(9) .side.mod-both').text().trim(),
          adr: $(playerRow).find('.mod-stat.mod-combat .side.mod-both').text().trim(),
          hs: $(playerRow).find('.mod-stat:nth-child(11) .side.mod-both').text().trim(),
          fk: $(playerRow).find('.mod-fb .side.mod-both').text().trim(),
          fd: $(playerRow).find('.mod-fd .side.mod-both').text().trim(),
          plusMinus: $(playerRow).find('.mod-kd-diff .side.mod-both').text().trim(),
          fkFd: $(playerRow).find('.mod-fk-diff .side.mod-both').text().trim(),
          clutch: 'N/A'
        };
        const roundStats = {
          attack: {
            acs: $(playerRow).find('.mod-stat:nth-child(4) .side.mod-t').text().trim(),
            kills: $(playerRow).find('.mod-vlr-kills .side.mod-t').text().trim(),
            deaths: $(playerRow).find('.mod-vlr-deaths .side.mod-t').text().trim(),
            assists: $(playerRow).find('.mod-vlr-assists .side.mod-t').text().trim(),
            kast: $(playerRow).find('.mod-stat:nth-child(9) .side.mod-t').text().trim(),
            adr: $(playerRow).find('.mod-stat.mod-combat .side.mod-t').text().trim(),
            hs: $(playerRow).find('.mod-stat:nth-child(11) .side.mod-t').text().trim()
          },
          defense: {
            acs: $(playerRow).find('.mod-stat:nth-child(4) .side.mod-ct').text().trim(),
            kills: $(playerRow).find('.mod-vlr-kills .side.mod-ct').text().trim(),
            deaths: $(playerRow).find('.mod-vlr-deaths .side.mod-ct').text().trim(),
            assists: $(playerRow).find('.mod-vlr-assists .side.mod-ct').text().trim(),
            kast: $(playerRow).find('.mod-stat:nth-child(9) .side.mod-ct').text().trim(),
            adr: $(playerRow).find('.mod-stat.mod-combat .side.mod-ct').text().trim(),
            hs: $(playerRow).find('.mod-stat:nth-child(11) .side.mod-ct').text().trim()
          }
        };
        players.push({ ...stats, roundStats, playerId, playerUrl });
      });
      matchDetails.maps[mapIndex].players = players;
      mapIndex++;
    }
  });
  matchDetails.additionalInfo = {
    patch: $('.match-header-patch').text().trim(),
    vod: $('.match-vod-link').attr('href'),
    streams: $('.match-streams a').map((i, el) => $(el).attr('href')).get()
  };
  return matchDetails;
}

getTeams.mapStats = async function(teamId, last) {
  if (last) {
    const matches = await getTeamMatches(teamId);
    const lastMatches = matches.slice(0, last);
    const teamName = lastMatches.length > 0 ? lastMatches[0].team1 : null;
    const teamTag = lastMatches.length > 0 ? lastMatches[0].team1Tag : null;
    console.log(`[DEBUG][mapStats] Using last ${last} matches:`, lastMatches.map(m=>m.id));
    console.log(`[DEBUG][mapStats] teamName: ${teamName}, teamTag: ${teamTag}`);
    const mapStatsAgg = {};
    // Map bazında toplam atak/defans round sayısını da topla
    const totalAtkRounds = {};
    const totalDefRounds = {};
    for (const match of lastMatches) {
      let teamName = null;
      let teamTag = null;
      if (match.team1 && match.team1.length > 0 && match.team2 && match.team2.length > 0) {
        teamName = match.team1;
        if (match.team1Tag) teamTag = match.team1Tag;
        else {
          const tagGuess = (teamName.match(/\b([A-Z]{2,5})\b/) || [])[1];
          if (tagGuess) teamTag = tagGuess;
        }
      }
      const norm = s => (s || '').toLowerCase().replace(/[^a-z0-9]/gi, '').trim();
      const normTeamName = norm(teamName);
      const normTeamTag = norm(teamTag);
      console.log(`[DEBUG][mapStats] Match ${match.id}: using teamName='${teamName}' (norm='${normTeamName}'), teamTag='${teamTag}' (norm='${normTeamTag}')`);
      let matchDetail = null;
      try {
        matchDetail = await getMatchDetails(match.id);
      } catch (e) {
        console.log(`[DEBUG][mapStats] Failed to fetch match details for ${match.id}:`, e.message);
        continue;
      }
      if (!Array.isArray(match.maps)) continue;
      for (const mapObj of match.maps) {
        const map = mapObj.name;
        if (!mapStatsAgg[map]) mapStatsAgg[map] = {
          map,
          played: 0,
          wins: 0,
          losses: 0,
          comps: [],
          compsHash: {},
          atkRW: 0,
          atkRL: 0,
          defRW: 0,
          defRL: 0
        };
        if (!totalAtkRounds[map]) totalAtkRounds[map] = 0;
        if (!totalDefRounds[map]) totalDefRounds[map] = 0;
        mapStatsAgg[map].played++;
        let score = mapObj.score || '';
        let [s1, s2] = score.split(/\D+/).map(s => parseInt(s.trim(), 10));
        const norm1 = norm(match.team1);
        const norm2 = norm(match.team2);
        let isTeam1 = norm1 === normTeamName;
        let isTeam2 = norm2 === normTeamName;
        if (!isNaN(s1) && !isNaN(s2)) {
          if (isTeam1 && s1 > s2) mapStatsAgg[map].wins++;
          else if (isTeam2 && s2 > s1) mapStatsAgg[map].wins++;
          else mapStatsAgg[map].losses++;
        }
        // --- ROUND BREAKDOWN ---
        if (matchDetail && Array.isArray(matchDetail.maps)) {
          const foundMap = matchDetail.maps.find(m => norm(m.name) === norm(map));
          if (foundMap && foundMap.roundBreakdown) {
            let teamKey = null;
            for (const k of Object.keys(foundMap.roundBreakdown)) {
              if (norm(k) === normTeamName) teamKey = k;
            }
            if (!teamKey && teamTag) {
              for (const k of Object.keys(foundMap.roundBreakdown)) {
                if (norm(k) === normTeamTag) teamKey = k;
              }
            }
            if (!teamKey) {
              for (const k of Object.keys(foundMap.roundBreakdown)) {
                if (norm(k).includes(normTeamTag) || normTeamTag.includes(norm(k)) || norm(k).includes(normTeamName) || normTeamName.includes(norm(k))) {
                  teamKey = k;
                }
              }
            }
            if (teamKey) {
              // Rakip takım anahtarını bul
              const allKeys = Object.keys(foundMap.roundBreakdown);
              const rivalKey = allKeys.find(k => k !== teamKey);
              // Kendi ve rakip breakdown
              const myBreak = foundMap.roundBreakdown[teamKey];
              const rivalBreak = rivalKey ? foundMap.roundBreakdown[rivalKey] : { atkRoundsWon: 0, defRoundsWon: 0 };
              // Toplam atak roundu = kendi atak kazancı + rakibin defans kazancı
              const totalAtk = (myBreak.atkRoundsWon || 0) + (rivalBreak.defRoundsWon || 0);
              // Toplam defans roundu = kendi defans kazancı + rakibin atak kazancı
              const totalDef = (myBreak.defRoundsWon || 0) + (rivalBreak.atkRoundsWon || 0);
              mapStatsAgg[map].atkRW += myBreak.atkRoundsWon || 0;
              mapStatsAgg[map].defRW += myBreak.defRoundsWon || 0;
              totalAtkRounds[map] += totalAtk;
              totalDefRounds[map] += totalDef;
              // Kaybedilen roundlar (opsiyonel, response'a ekleyeceğiz)
              if (!mapStatsAgg[map].atkRL) mapStatsAgg[map].atkRL = 0;
              if (!mapStatsAgg[map].defRL) mapStatsAgg[map].defRL = 0;
              mapStatsAgg[map].atkRL += totalAtk - (myBreak.atkRoundsWon || 0);
              mapStatsAgg[map].defRL += totalDef - (myBreak.defRoundsWon || 0);
              console.log(`[DEBUG][mapStats] Map ${map} (match ${match.id}): teamKey=${teamKey}, atkRW+${myBreak.atkRoundsWon || 0}, defRW+${myBreak.defRoundsWon || 0}, atkRL+${totalAtk - (myBreak.atkRoundsWon || 0)}, defRL+${totalDef - (myBreak.defRoundsWon || 0)}`);
            } else {
              console.log(`[DEBUG][mapStats] Map ${map} (match ${match.id}): teamKey NOT FOUND for normTeamName=${normTeamName}, normTeamTag=${normTeamTag}, roundBreakdown keys=${Object.keys(foundMap.roundBreakdown).join(',')}`);
            }
          }
        }
        // --- COMP AGGREGATION ---
        if (matchDetail && Array.isArray(matchDetail.maps)) {
          const foundMap = matchDetail.maps.find(m => norm(m.name) === norm(map));
          if (foundMap && Array.isArray(foundMap.players)) {
            // Takım oyuncularını bul (önce normTeamName/normTeamTag ile)
            let teamPlayers = foundMap.players.filter(p => norm(p.team) === normTeamName || norm(p.team) === normTeamTag);
            // Eğer 5 oyuncu bulunamazsa, en çok görülen takım adını bul ve tekrar dene
            if (teamPlayers.length !== 5) {
              const teamCounts = {};
              foundMap.players.forEach(p => {
                const t = norm(p.team);
                if (!teamCounts[t]) teamCounts[t] = 0;
                teamCounts[t]++;
              });
              const mostCommonTeam = Object.entries(teamCounts).sort((a,b) => b[1]-a[1])[0]?.[0];
              if (mostCommonTeam) {
                teamPlayers = foundMap.players.filter(p => norm(p.team) === mostCommonTeam);
              }
              if (teamPlayers.length !== 5) {
                // Eksik veya fazla oyuncu varsa logla
                console.log(`[DEBUG][comps][MISSING] Map ${map} (match ${match.id}): teamPlayers.length=${teamPlayers.length}, found: [${teamPlayers.map(p=>p.name+':'+p.agent).join(', ')}], allPlayers: [${foundMap.players.map(p=>p.team+':'+p.name+':'+p.agent).join(', ')}], normTeamName=${normTeamName}, normTeamTag=${normTeamTag}, mostCommonTeam=${mostCommonTeam}`);
              }
            }
            if (teamPlayers.length === 5) {
              const agents = teamPlayers.map(p => p.agent).sort();
              const key = agents.join(',');
              if (!mapStatsAgg[map].compsHash[key]) {
                mapStatsAgg[map].compsHash[key] = { agents, times: 1 };
              } else {
                mapStatsAgg[map].compsHash[key].times += 1;
              }
              console.log(`[DEBUG][comps] Map ${map} (match ${match.id}): agents=${agents.join(',')}`);
            }
          }
        }
      }
    }
    // Debug log for total rounds
    Object.keys(mapStatsAgg).forEach(map => {
      console.log(`[DEBUG][mapStats] Map ${map}: totalAtkRounds=${totalAtkRounds[map]}, totalDefRounds=${totalDefRounds[map]}`);
    });
    // comps dizisini finalize et
    Object.keys(mapStatsAgg).forEach(mapName => {
      mapStatsAgg[mapName].comps = Object.values(mapStatsAgg[mapName].compsHash || {});
      const totalComps = mapStatsAgg[mapName].comps.reduce((sum, c) => sum + c.times, 0);
      if (totalComps !== mapStatsAgg[mapName].played) {
        console.log(`[DEBUG][comps][SUMMARY] Map ${mapName}: played=${mapStatsAgg[mapName].played}, compsTotal=${totalComps}, eksik=${mapStatsAgg[mapName].played - totalComps}`);
      }
      delete mapStatsAgg[mapName].compsHash;
    });
    return Object.values(mapStatsAgg).map(obj => ({
      ...obj,
      winrate: obj.played > 0 ? ((obj.wins / obj.played) * 100).toFixed(0) + '%' : '0%',
      atkRWin: totalAtkRounds[obj.map] > 0 ? ((obj.atkRW / totalAtkRounds[obj.map]) * 100).toFixed(0) + '%' : null,
      atkRW: obj.atkRW,
      atkRL: obj.atkRL,
      defRWin: totalDefRounds[obj.map] > 0 ? ((obj.defRW / totalDefRounds[obj.map]) * 100).toFixed(0) + '%' : null,
      defRW: obj.defRW,
      defRL: obj.defRL,
      comps: obj.comps || []
    }));
  }
  // ... existing code ...
  // (default: all-time stats from team stats page)
  const url = `https://www.vlr.gg/team/stats/${teamId}/`;
  const response = await http.get(url);
  const $ = cheerio.load(response.data);
  const stats = [];
  const mapTable = $('table.wf-table.mod-team-maps').first();
  const allComps = {};
  $('.agent-comp-agg.mod-first').each((i, compDiv) => {
    const mapName = $(compDiv).attr('data-map');
    if (!mapName) return;
    const timesRaw = $(compDiv).find('span').eq(1).text().trim();
    const timesMatch = timesRaw.match(/\((\d+)\)/);
    const times = timesMatch ? parseInt(timesMatch[1], 10) : 1;
    const agents = [];
    $(compDiv).find('img').each((k, img) => {
      let agent = $(img).attr('alt');
      if (!agent) {
        const src = $(img).attr('src') || '';
        const match = src.match(/agents\/([a-z0-9]+)\.png/i);
        agent = match ? match[1] : null;
      }
      if (agent) agents.push(agent);
    });
    const hash = $(compDiv).attr('data-agent-comp-hash') || null;
    if (!allComps[mapName]) allComps[mapName] = [];
    allComps[mapName].push({ hash, times, agents });
  });
  if (mapTable.length > 0) {
    mapTable.find('tbody tr').each((i, row) => {
      const tds = $(row).find('td');
      if (tds.length > 0) {
        let mapRaw = $(tds[0]).text().trim();
        let mapMatch = mapRaw.match(/([\w\s]+)\s*\((\d+)\)/);
        let map = mapMatch ? mapMatch[1].trim() : mapRaw;
        let played = mapMatch ? parseInt(mapMatch[2], 10) : null;
        let winrate = tds.eq(2).text().trim();
        let wins = tds.eq(3).text().trim();
        let losses = tds.eq(4).text().trim();
        let atkFirst = tds.eq(5).text().trim();
        let defFirst = tds.eq(6).text().trim();
        let atkRWin = tds.eq(7).text().trim();
        let atkRW = tds.eq(8).text().trim();
        let atkRL = tds.eq(9).text().trim();
        let defRWin = tds.eq(10).text().trim();
        let defRW = tds.eq(11).text().trim();
        let defRL = tds.eq(12).text().trim();
        if (map && map !== '') {
          const comps = allComps[map] || [];
          stats.push({
            map,
            played,
            winrate,
            wins,
            losses,
            atkFirst,
            defFirst,
            atkRWin,
            atkRW,
            atkRL,
            defRWin,
            defRW,
            defRL,
            comps
          });
        }
      }
    });
  }
  return stats;
};

getTeams.agentStats = async function(teamId) {
  const url = `https://www.vlr.gg/team/stats/${teamId}/`;
  const response = await http.get(url);
  const $ = cheerio.load(response.data);
  const agentCounts = {};
  let total = 0;
  $('div.agent-comp-agg.mod-first').each((i, el) => {
    $(el).find('img').each((j, img) => {
      const src = $(img).attr('src') || '';
      const match = src.match(/([a-z0-9]+)\.png/i);
      let agent = match ? match[1] : null;
      if (agent) {
        agentCounts[agent] = (agentCounts[agent] || 0) + 1;
        total++;
      }
    });
  });
  return Object.entries(agentCounts).map(([agent, count]) => ({
    agent,
    played: count,
    pickrate: total > 0 ? ((count / total) * 100).toFixed(1) + '%' : '0%'
  }));
};

async function searchPlayersAndTeams(query) {
  const url = `https://www.vlr.gg/search/?q=${encodeURIComponent(query)}`;
  const response = await http.get(url);
  const $ = cheerio.load(response.data);
  const players = [];
  const teams = [];
  $('a.search-item.wf-module-item').each((i, el) => {
    const href = $(el).attr('href');
    const img = $(el).find('img').attr('src');
    const name = cleanText($(el).find('.search-item-title').text());
    if (href && href.startsWith('/player/')) {
      const id = href.split('/')[2];
      const realName = cleanText($(el).find('.search-item-desc span').text());
      players.push({
        id,
        name,
        realName,
        logo: img ? (img.startsWith('http') ? img : `https:${img}`) : null,
        url: `https://www.vlr.gg${href}`
      });
    } else if (href && href.startsWith('/team/')) {
      const id = href.split('/')[2];
      teams.push({
        id,
        name,
        logo: img ? (img.startsWith('http') ? img : `https:${img}`) : null,
        url: `https://www.vlr.gg${href}`
      });
    }
  });
  return { players, teams };
}

/**
 * Bir oyuncunun son X maçındaki gelişmiş istatistiklerini toplar.
 * @param {string} playerId - Oyuncu ID'si
 * @param {number} matchLimit - Son kaç maç alınacak
 * @returns {Promise<Object>} - Toplam ve maç başına ortalama istatistikler
 */
async function getPlayerAdvancedStats(playerId, matchLimit = 5) {
  const norm = s => (s || '').toLowerCase().replace(/[^a-z0-9]/gi, '').trim();
  const mergeMatrixStats = (a, b) => {
    const out = { normal: {}, fkfd: {}, op: {} };
    for (const key of ['normal', 'fkfd', 'op']) {
      out[key] = { ...a[key] };
      for (const stat in b[key]) {
        if (out[key][stat]) {
          const aObj = out[key][stat];
          const bObj = b[key][stat];
          for (const subKey in bObj) {
            if (subKey === 'diff') {
              // diff: sum as number, keep sign
              const aVal = parseInt(aObj[subKey]) || 0;
              const bVal = parseInt(bObj[subKey]) || 0;
              const sum = aVal + bVal;
              aObj[subKey] = (sum >= 0 ? '+' : '') + sum.toString();
            } else if (aObj[subKey] && !isNaN(Number(aObj[subKey])) && !isNaN(Number(bObj[subKey]))) {
              aObj[subKey] = (Number(aObj[subKey]) + Number(bObj[subKey])).toString();
            } else {
              aObj[subKey] = bObj[subKey];
            }
          }
        } else {
          out[key][stat] = b[key][stat];
        }
      }
    }
    return out;
  };
  const mergeAdvancedStats = (a, b) => {
    const out = { ...a };
    for (const key in b) {
      const aVal = out[key] || "0";
      const bVal = b[key] || "0";
      if (!isNaN(Number(aVal)) && !isNaN(Number(bVal))) {
        out[key] = (Number(aVal) + Number(bVal)).toString();
      } else {
        out[key] = bVal;
      }
    }
    return out;
  };
  const matchesUrl = `https://www.vlr.gg/player/matches/${playerId}/`;
  let recentResults = [];
  let playerNameFromProfile = null;
  let playerTeamFromProfile = null;
  try {
    // Oyuncu adı ve takımını almak için önce oyuncu profil sayfasını çek
    const profileRes = await http.get(`https://www.vlr.gg/player/${playerId}/`);
    const profile$ = cheerio.load(profileRes.data);
    playerNameFromProfile = cleanText(profile$('h1.wf-title').first().text());
    playerTeamFromProfile = cleanText(profile$('.player-header .player-tag').first().text());
    const matchesRes = await http.get(matchesUrl);
    const $ = cheerio.load(matchesRes.data);
    $('a.wf-card.fc-flex.m-item').each((i, el) => {
      if (recentResults.length >= matchLimit) return;
      const matchLink = $(el).attr('href');
      const matchId = matchLink ? matchLink.split('/')[1] : null;
      if (matchId) recentResults.push(matchId);
    });
    console.log(`[DEBUG] recentResults from /player/matches/${playerId}/:`, recentResults);
    console.log(`[DEBUG] playerNameFromProfile: ${playerNameFromProfile}, playerTeamFromProfile: ${playerTeamFromProfile}`);
  } catch (err) {
    console.log(`[DEBUG] Error fetching matches/profile for player ${playerId}:`, err.message);
  }
  const statKeys = [
    '2K', '3K', '4K', '5K',
    '1v1', '1v2', '1v3', '1v4', '1v5',
    'ECON', 'PL', 'DE'
  ];
  let totalRowsChecked = 0;
  let totalRowsMatched = 0;
  // Map bazlı istatistikler için dizi
  const mapsStatsRaw = [];
  for (const matchId of recentResults) {
    try {
      const matchRes = await http.get(`https://www.vlr.gg/${matchId}/?tab=performance`);
      const $$ = cheerio.load(matchRes.data);
      const normName = norm(playerNameFromProfile);
      const normTag = norm(playerTeamFromProfile || '');
      $$('.vm-stats-game').each((_, mapDiv) => {
        const mapGameId = $$(mapDiv).attr('data-game-id');
        let mapName = '';
        const mapTab = $$('.js-map-switch[data-game-id="' + mapGameId + '"]');
        if (mapTab.length > 0) {
          mapName = cleanText(mapTab.text());
        } else {
          mapName = mapGameId;
        }
        // Map içindeki matrix tabloları
        const mapMatrixStats = { normal: {}, fkfd: {}, op: {} };
        const matrixTypes = [
          { key: 'normal', selector: 'table.mod-matrix.mod-normal' },
          { key: 'fkfd', selector: 'table.mod-matrix.mod-fkfd' },
          { key: 'op', selector: 'table.mod-matrix.mod-op' }
        ];
        for (const { key, selector } of matrixTypes) {
          const matrixTable = $$(mapDiv).find(selector);
          if (matrixTable.length === 0) continue;
          const rows = matrixTable.find('tr');
          if (rows.length < 2) continue;
          const headerRow = rows.first();
          const playerHeaders = [];
          headerRow.find('td').each((i, td) => {
            if (i === 0) return;
            const teamDiv = $$(td).find('.team > div').first();
            let name = '';
            let tag = '';
            if (teamDiv.length > 0) {
              name = cleanText(teamDiv.contents().filter(function() { return this.type === 'text'; }).text());
              tag = cleanText(teamDiv.find('.team-tag.ge-text-faded').text());
            }
            playerHeaders.push({ name, tag });
          });
          let playerIdx = -1;
          for (let idx = 0; idx < playerHeaders.length; idx++) {
            const header = playerHeaders[idx];
            if (
              norm(header.name) === normName &&
              playerTeamFromProfile && header.tag &&
              norm(header.tag) === normTag
            ) {
              playerIdx = idx;
              break;
            }
          }
          if (playerIdx === -1) {
            for (let idx = 0; idx < playerHeaders.length; idx++) {
              const header = playerHeaders[idx];
              if (norm(header.name) === normName) {
                playerIdx = idx;
                break;
              }
            }
          }
          if (playerIdx !== -1) {
            rows.slice(1).each((rowIdx, tr) => {
              const tds = $$(tr).find('td');
              if (tds.length <= playerIdx + 1) return;
              const rowTitle = cleanText($$(tds[0]).text());
              if (!rowTitle) return;
              const cell = $$(tds[playerIdx + 1]);
              const values = cell.find('.stats-sq').map((i, el) => cleanText($$(el).text())).get();
              let valueObj = null;
              if (key === 'normal') {
                if (values.length >= 3) {
                  valueObj = { score: values[0], opponent: values[1], diff: values[2] };
                } else if (values.length > 0) {
                  valueObj = { values };
                }
              } else if (key === 'fkfd') {
                if (values.length >= 3) {
                  valueObj = { player: values[0], opponent: values[1], diff: values[2] };
                } else if (values.length > 0) {
                  valueObj = { values };
                }
              } else if (key === 'op') {
                if (values.length >= 3) {
                  valueObj = { player: values[0], opponent: values[1], diff: values[2] };
                } else if (values.length > 0) {
                  valueObj = { values };
                }
              }
              if (valueObj && Object.values(valueObj).some(v => v && v !== '')) {
                mapMatrixStats[key][rowTitle] = valueObj;
              }
            });
          } else {
            // Satır başlıklarında oyuncuyu ara
            rows.slice(1).each((rowIdx, tr) => {
              const tds = $$(tr).find('td');
              if (tds.length < 2) return;
              const teamDiv = $$(tds[0]).find('.team > div').first();
              let rowName = '';
              let rowTag = '';
              if (teamDiv.length > 0) {
                rowName = cleanText(teamDiv.contents().filter(function() { return this.type === 'text'; }).text());
                rowTag = cleanText(teamDiv.find('.team-tag.ge-text-faded').text());
              }
              if (
                (norm(rowName) === normName && norm(rowTag) === normTag) ||
                (norm(rowName) === normName)
              ) {
                for (let colIdx = 1; colIdx < tds.length; colIdx++) {
                  const header = playerHeaders[colIdx - 1];
                  const colTitle = header.name + (header.tag ? ' ' + header.tag : '');
                  const cell = $$(tds[colIdx]);
                  const values = cell.find('.stats-sq').map((i, el) => cleanText($$(el).text())).get();
                  let valueObj = null;
                  if (key === 'normal') {
                    if (values.length >= 3) {
                      valueObj = { score: values[0], opponent: values[1], diff: values[2] };
                    } else if (values.length > 0) {
                      valueObj = { values };
                    }
                  } else if (key === 'fkfd') {
                    if (values.length >= 3) {
                      valueObj = { player: values[0], opponent: values[1], diff: values[2] };
                    } else if (values.length > 0) {
                      valueObj = { values };
                    }
                  } else if (key === 'op') {
                    if (values.length >= 3) {
                      valueObj = { player: values[0], opponent: values[1], diff: values[2] };
                    } else if (values.length > 0) {
                      valueObj = { values };
                    }
                  }
                  if (valueObj && Object.values(valueObj).some(v => v && v !== '')) {
                    mapMatrixStats[key][colTitle] = valueObj;
                  }
                }
              }
            });
          }
        }
        // Map içindeki advanced stats tablosu
        let mapAdvancedStats = null;
        const advStatsTable = $$(mapDiv).find('table.mod-adv-stats');
        if (advStatsTable.length > 0) {
          const headers = advStatsTable.find('tr').first().find('th').map((i, th) => cleanText($$(th).text())).get();
          advStatsTable.find('tr').slice(1).each((_, row) => {
            const tds = $$(row).find('td');
            if (tds.length < 2) return;
            const teamDiv = $$(tds[0]).find('.team > div').first();
            let rowName = '';
            let rowTag = '';
            if (teamDiv.length > 0) {
              rowName = cleanText(teamDiv.contents().filter(function() { return this.type === 'text'; }).text());
              rowTag = cleanText(teamDiv.find('.team-tag.ge-text-faded').text());
            }
            if (
              (norm(rowName) === normName && norm(rowTag) === normTag) ||
              (norm(rowName) === normName)
            ) {
              mapAdvancedStats = {};
              for (let i = 2; i < tds.length; i++) {
                const key = headers[i] || `col${i}`;
                const val = cleanText($$(tds[i]).text());
                // Sadece baştaki sayıyı al, yoksa "0"
                const match = val.match(/^(\d+)/);
                mapAdvancedStats[key] = match ? match[1] : "0";
              }
            }
          });
        }
        mapsStatsRaw.push({ map: mapName, matrixStats: mapMatrixStats, advancedStats: mapAdvancedStats || {} });
      });
    } catch (err) {
      continue;
    }
  }
  // Aynı isimli map'leri birleştir (başındaki sayı ve boşlukları silerek)
  const normalizeMapName = name => name ? name.replace(/^\d+\s*/, '').trim() : '';
  const mapsStats = [];
  for (const mapObj of mapsStatsRaw) {
    const normName = normalizeMapName(mapObj.map);
    const existing = mapsStats.find(m => normalizeMapName(m.map) === normName);
    if (existing) {
      existing.matrixStats = mergeMatrixStats(existing.matrixStats, mapObj.matrixStats);
      existing.advancedStats = mergeAdvancedStats(existing.advancedStats, mapObj.advancedStats);
    } else {
      mapsStats.push({ ...mapObj, map: normName });
    }
  }
  // Boş map'leri çıkar (hem matrixStats hem advancedStats boşsa) ve 'All Maps' olanı da çıkar
  const filteredMaps = mapsStats.filter(map => {
    const hasMatrix = map.matrixStats && (Object.values(map.matrixStats.normal).length > 0 || Object.values(map.matrixStats.fkfd).length > 0 || Object.values(map.matrixStats.op).length > 0);
    const hasAdv = map.advancedStats && Object.values(map.advancedStats).some(v => v !== undefined && v !== null && v !== '' && v !== '0');
    // 'All Maps' hariç tut
    return (hasMatrix || hasAdv) && map.map.toLowerCase() !== 'all maps';
  });
  // --- MatrixStats'tan özet hesapla ---
  let opKills = 0, opDeaths = 0, fk = 0, fd = 0;
  // sumStats: filteredMaps üzerinden advancedStats değerlerini topla
  const sumStats = {};
  statKeys.forEach(k => sumStats[k] = 0);
  filteredMaps.forEach(map => {
    if (map.advancedStats) {
      statKeys.forEach(k => {
        const val = map.advancedStats[k];
        if (!isNaN(Number(val))) sumStats[k] += Number(val);
      });
    }
    if (map.matrixStats && map.matrixStats.op) {
      Object.values(map.matrixStats.op).forEach(obj => {
        if (obj && obj.player && !isNaN(Number(obj.player))) opKills += Number(obj.player);
        if (obj && obj.opponent && !isNaN(Number(obj.opponent))) opDeaths += Number(obj.opponent);
      });
    }
    if (map.matrixStats && map.matrixStats.fkfd) {
      Object.values(map.matrixStats.fkfd).forEach(obj => {
        if (obj && obj.player && !isNaN(Number(obj.player))) fk += Number(obj.player);
        if (obj && obj.opponent && !isNaN(Number(obj.opponent))) fd += Number(obj.opponent);
      });
    }
  });
  // matchCount: non-empty maps
  const matchCount = filteredMaps.length;
  const summary = { opKills, opDeaths, fk, fd };
  const avgStats = {};
  statKeys.forEach(k => {
    avgStats[k] = matchCount > 0 ? (sumStats[k] / matchCount).toFixed(2) : 0;
  });
  avgStats.opKills = matchCount > 0 ? (opKills / matchCount).toFixed(2) : 0;
  avgStats.opDeaths = matchCount > 0 ? (opDeaths / matchCount).toFixed(2) : 0;
  avgStats.fk = matchCount > 0 ? (fk / matchCount).toFixed(2) : 0;
  avgStats.fd = matchCount > 0 ? (fd / matchCount).toFixed(2) : 0;
  return {
    playerId,
    matchCount,
    total: sumStats,
    average: avgStats,
    summary,
    maps: filteredMaps
  };
}

module.exports = { cleanText, withCache, handleHttpError, getEvents, getTeams, getMatchDetails, getTeamMatches, searchPlayersAndTeams, getPlayerAdvancedStats }; 