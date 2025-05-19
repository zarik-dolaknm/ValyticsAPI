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
  $('a.fc-flex.wf-card.m-item').each((i, el) => {
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

getTeams.mapStats = async function(teamId) {
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

module.exports = { cleanText, withCache, handleHttpError, getEvents, getTeams, getMatchDetails, getTeamMatches, searchPlayersAndTeams }; 