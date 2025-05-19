const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const rateLimit = require('express-rate-limit');
const axiosRateLimit = require('axios-rate-limit');
const swaggerUi = require('swagger-ui-express');
const swaggerJSDoc = require('swagger-jsdoc');
require('dotenv').config();

console.log(`DEBUG mode status from process.env.DEBUG: ${process.env.DEBUG}`);

const app = express();
const PORT = process.env.PORT || 4000;
const DEBUG = process.env.DEBUG === 'true'; // DEBUG modunu çevre değişkeninden oku

// Rate limiting ayarları
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 dakika
  max: 100, // IP başına maksimum istek sayısı
  message: 'Too many requests from this IP, please try again later.'
});

// Axios için rate limiting ve headers
const http = axiosRateLimit(axios.create({
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1'
  }
}), { 
  maxRPS: 2, // Saniyede maksimum 2 istek
  maxRequests: 100 // Toplam maksimum istek sayısı
});

app.use(cors());
app.use(express.json());
app.use(apiLimiter);

// Temizleme fonksiyonu
function cleanText(text) {
  return text.replace(/\s+/g, ' ').trim();
}

// Swagger/OpenAPI ayarları
const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Valytics VLR.gg API',
    version: '1.0.0',
    description: 'VLR.gg scraping API dokümantasyonu',
  },
  servers: [
    {
      url: `http://localhost:${PORT}`,
      description: 'Local server',
    },
  ],
};

const swaggerOptions = {
  swaggerDefinition,
  apis: [__filename], // Sadece bu dosyadaki JSDoc yorumlarını kullan
};

const swaggerSpec = swaggerJSDoc(swaggerOptions);

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

/**
 * @openapi
 * /api/matches/completed:
 *   get:
 *     summary: Tamamlanmış maçları getirir
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Döndürülecek maç sayısı (varsayılan 10)
 *     responses:
 *       200:
 *         description: Maç listesi
 *       500:
 *         description: Hata
 */

/**
 * @openapi
 * /api/matches/{id}:
 *   get:
 *     summary: Maç detaylarını getirir
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Maç ID
 *     responses:
 *       200:
 *         description: Maç detayları
 *       404:
 *         description: Maç bulunamadı
 *       500:
 *         description: Hata
 */

/**
 * @openapi
 * /api/events:
 *   get:
 *     summary: Etkinlik listesini getirir
 *     responses:
 *       200:
 *         description: Etkinlik listesi
 *       500:
 *         description: Hata
 */

/**
 * @openapi
 * /api/events/{eventId}/matches:
 *   get:
 *     summary: Bir etkinliğin maçlarını getirir
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *         description: Etkinlik ID
 *     responses:
 *       200:
 *         description: Maç listesi
 *       500:
 *         description: Hata
 */

/**
 * @openapi
 * /api/players/{id}:
 *   get:
 *     summary: Oyuncu detaylarını getirir
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Oyuncu ID
 *       - in: query
 *         name: timespan
 *         schema:
 *           type: string
 *         description: İstatistik zaman aralığı (opsiyonel)
 *     responses:
 *       200:
 *         description: Oyuncu detayları
 *       500:
 *         description: Hata
 */

/**
 * @openapi
 * /api/matches/upcoming:
 *   get:
 *     summary: Yaklaşan (Upcoming) Valorant maçlarını getirir
 *     responses:
 *       200:
 *         description: Sadece upcoming (yaklaşan) maçlar listesi
 *         content:
 *           application/json:
 *             example:
 *               total: 2
 *               matches:
 *                 - id: "484663"
 *                   teams:
 *                     team1: { name: "Velocity Gaming", score: "–" }
 *                     team2: { name: "Reckoning Esports", score: "–" }
 *                   event: "Challengers League 2025 South Asia: Split 2"
 *                   stage: "Main Event–Upper Semifinals"
 *                   date: "12:30 PM"
 *                   status: "Upcoming"
 *                   eta: "50m"
 *                   icon: "https://owcdn.net/img/6009f963577f4.png"
 *                   url: "https://www.vlr.gg/484663/velocity-gaming-vs-reckoning-esports-challengers-league-2025-south-asia-split-2-ubsf"
 *       500:
 *         description: Hata
 */

/**
 * @openapi
 * /api/matches/live:
 *   get:
 *     summary: Şu anda canlı (LIVE) oynanan Valorant maçlarını getirir
 *     responses:
 *       200:
 *         description: Sadece canlı (live) maçlar listesi
 *         content:
 *           application/json:
 *             example:
 *               total: 1
 *               matches:
 *                 - id: "484641"
 *                   teams:
 *                     team1: { name: "DRX Academy", score: "0" }
 *                     team2: { name: "Gen.G Global Academy", score: "0" }
 *                   event: "WDG Challengers League 2025 Korea: Stage 2"
 *                   stage: "Playoffs–Upper Round 1"
 *                   date: "11:00 AM"
 *                   status: "LIVE"
 *                   eta: ""
 *                   icon: "https://owcdn.net/img/6009f963577f4.png"
 *                   url: "https://www.vlr.gg/484641/drx-academy-vs-gen-g-global-academy-wdg-challengers-league-2025-korea-stage-2-ur1"
 *       500:
 *         description: Hata
 */

/**
 * @openapi
 * /api/teams:
 *   get:
 *     summary: Belirli bir bölgedeki takımların listesini getirir
 *     parameters:
 *       - in: query
 *         name: region
 *         required: true
 *         schema:
 *           type: string
 *           enum: [europe, north-america, brazil, asia-pacific, korea, china, japan, la-s, oceania, gc, mena, collegiate]
 *         description: Takımların çekileceği bölge (zorunlu)
 *     responses:
 *       200:
 *         description: Takım listesi
 *         content:
 *           application/json:
 *             example:
 *               region: "europe"
 *               total: 2
 *               teams:
 *                 - id: "1001"
 *                   name: "Team Heretics"
 *                   logo: "https://owcdn.net/img/637b755224c12.png"
 *                   url: "https://www.vlr.gg/team/1001/team-heretics"
 *                   country: "Europe"
 *                 - id: "1050"
 *                   name: "FNATIC"
 *                   logo: "https://owcdn.net/img/62a40cc2b5e29.png"
 *                   url: "https://www.vlr.gg/team/1050/fnatic"
 *                   country: "Europe"
 *       400:
 *         description: Geçersiz veya eksik region parametresi
 *       500:
 *         description: Hata
 */

/**
 * @openapi
 * /api/teams/{id}:
 *   get:
 *     summary: Takım profili ve detaylarını getirir
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: "Takım ID'si (ornegin 2593)"
 *     responses:
 *       200:
 *         description: Takım profili ve detayları
 *         content:
 *           application/json:
 *             example:
 *               id: "2593"
 *               name: "FNATIC"
 *               tag: "FNC"
 *               logo: "https://owcdn.net/img/62a40cc2b5e29.png"
 *               region: "Europe"
 *               socials:
 *                 website: "https://fnatic.com"
 *                 twitter: "@FNATIC"
 *               roster:
 *                 - name: "Boaster"
 *                   realName: "Jake Howlett"
 *                 - name: "crashies"
 *                   realName: "Austin Roberts"
 *               staff:
 *                 - name: "CoJo"
 *                   role: "manager"
 *               recentResults:
 *                 - event: "VCT 25: EMEA Stage 1 Playoffs"
 *                   opponent: "Team Heretics"
 *                   score: "3 : 0"
 *                   date: "2025/05/18"
 *               eventPlacements:
 *                 - event: "Champions Tour 2025: EMEA Stage 1"
 *                   placement: "1st"
 *                   prize: "$100,000"
 *                   year: "2025"
 *               totalWinnings: "$1,417,285"
 *       404:
 *         description: Takım bulunamadı
 *       500:
 *         description: Hata
 */

/**
 * @openapi
 * /api/teams/{id}/maps-stats:
 *   get:
 *     summary: Takımın harita istatistiklerini getirir
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Takım ID
 *     responses:
 *       200:
 *         description: Harita istatistikleri
 *         content:
 *           application/json:
 *             example:
 *               - map: "Breeze"
 *                 played: 23
 *                 winrate: "78%"
 *                 wins: "18"
 *                 losses: "5"
 *                 atkFirst: "5"
 *                 defFirst: "18"
 *                 atkRWin: "58%"
 *                 atkRW: "138"
 *                 atkRL: "98"
 *                 defRWin: "54%"
 *                 defRW: "147"
 *                 defRL: "126"
 *                 comps:
 *                   - hash: "2b2e5b43d9fd"
 *                     times: 2
 *                     agents: ["cypher", "kayo", "sova", "viper", "yoru"]
 *                   - hash: "389a15009875"
 *                     times: 2
 *                     agents: ["chamber", "jett", "kayo", "sova", "viper"]
 *       500:
 *         description: Hata
 */

/**
 * @openapi
 * /api/teams/{id}/agents-stats:
 *   get:
 *     summary: Takımın ajan istatistiklerini getirir
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Takım ID
 *     responses:
 *       200:
 *         description: Ajan istatistikleri
 *         content:
 *           application/json:
 *             example:
 *               - agent: "Omen"
 *                 played: 15
 *                 winrate: "60%"
 *                 pickrate: "38%"
 *       500:
 *         description: Hata
 */

/**
 * @openapi
 * /api/events/{eventId}/agents-stats:
 *   get:
 *     summary: Belirli bir etkinliğin harita ve ajan istatistiklerini getirir
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *         description: Etkinlik ID
 *     responses:
 *       200:
 *         description: Harita ve ajan istatistikleri
 *         content:
 *           application/json:
 *             example:
 *               - map: "Split"
 *                 played: 20
 *                 attackWinrate: "47%"
 *                 defenseWinrate: "53%"
 *                 agents:
 *                   - agent: "Omen"
 *                     pickrate: "68%"
 *                   - agent: "Tejo"
 *                     pickrate: "38%"
 *       500:
 *         description: Hata
 */

// Ana endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'VLR.gg API is running',
    endpoints: {
      matches: '/api/matches',
      matchDetails: '/api/matches/:id',
      eventMatches: '/api/events/:eventId/matches',
      completedMatches: '/api/matches/completed',
      upcomingMatches: '/api/matches/upcoming'
    }
  });
});

// Tamamlanmış maçları getiren endpoint
app.get('/api/matches/completed', async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit) : 10; // Varsayılan olarak 10 maç
    let matches = [];
    let page = 1;
    let hasMore = true;

    while (matches.length < limit && hasMore) {
      const url = page === 1 ? 'https://www.vlr.gg/matches/results' : `https://www.vlr.gg/matches/results/?page=${page}`;
      console.log(`[DEBUG] Fetching page ${page}: ${url}`);
      const response = await http.get(url);
      const $ = cheerio.load(response.data);
      const matchItems = $('.match-item');
      console.log(`[DEBUG] Page ${page} - Found ${matchItems.length} matches. Total so far: ${matches.length}`);
      if (matchItems.length === 0) {
        hasMore = false;
        console.log(`[DEBUG] No matches found on page ${page}. Stopping.`);
        break;
      }
      for (let i = 0; i < matchItems.length && matches.length < limit; i++) {
        const matchElement = matchItems[i];
        const matchLink = $(matchElement).attr('href') || $(matchElement).find('a').attr('href');
        if (matchLink) {
          const matchId = matchLink.split('/')[1];
          const team1Name = cleanText($(matchElement).find('.match-item-vs-team-name').first().text());
          const team2Name = cleanText($(matchElement).find('.match-item-vs-team-name').last().text());
          const team1Score = cleanText($(matchElement).find('.match-item-vs-team-score').first().text());
          const team2Score = cleanText($(matchElement).find('.match-item-vs-team-score').last().text());
          const event = cleanText($(matchElement).find('.match-item-event').text());
          const date = cleanText($(matchElement).find('.match-item-time').text());
          matches.push({
            id: matchId,
            teams: {
              team1: { name: team1Name, score: team1Score },
              team2: { name: team2Name, score: team2Score }
            },
            event: event,
            date: date,
            url: `https://www.vlr.gg${matchLink}`
          });
        }
      }
      console.log(`[DEBUG] After page ${page}, total matches collected: ${matches.length}`);
      page++;
    }

    res.json({
      total: matches.length,
      limit: limit,
      matches: matches
    });
  } catch (error) {
    console.error(`[ERROR] Fetching completed matches failed on page ${page}:`, error);
    res.status(500).json({ error: 'Failed to fetch completed matches' });
  }
});

// Maç detaylarını çeken yardımcı fonksiyon
async function getMatchDetails(matchId) {
  try {
    const response = await http.get(`https://www.vlr.gg/${matchId}`);
    const $ = cheerio.load(response.data);

    // !!! DEBUG: Çekilen tüm HTML içinde "LOUD" kelimesini ara
    // const htmlContent = response.data;
    // const loudFound = htmlContent.includes('LOUD');
    // const loudIdFound = htmlContent.includes('/team/455');
    // console.log(`DEBUG: "LOUD" found in HTML: ${loudFound}`);
    // console.log(`DEBUG: "/team/455" found in HTML: ${loudIdFound}`);

    // Takım isimleri ve skorlar - Güncellenmiş selector'ler
    const team1Name = $('.match-header-vs .match-header-link.mod-1 .wf-title-med').text().trim();
    const team2Name = $('.match-header-vs .match-header-link.mod-2 .wf-title-med').text().trim();
    const team1Score = $('.match-header-vs-score .match-header-vs-score-winner').text().trim(); // Kazanan skoru
    const team2Score = $('.match-header-vs-score .match-header-vs-score-loser').text().trim(); // Kaybeden skoru

    // Raw textleri alıp temizleyelim
    const rawSeriesText = $('.match-header-event-series').text();
    const cleanedSeries = rawSeriesText.replace(/\s+/g, ' ').trim();

    const rawDateText = $('.match-header-date').text();
    const cleanedDate = rawDateText.replace(/\s+/g, ' ').trim();

    const matchDetails = {
      id: matchId,
      teams: {
        team1: { name: team1Name, score: team1Score }, // Güncellenmiş team1
        team2: { name: team2Name, score: team2Score }  // Güncellenmiş team2
      },
      status: $('.match-header-status').text().trim(),
      event: {
        name: $('.match-header-event-name').text().trim(),
        series: cleanedSeries
      },
      date: cleanedDate,
      maps: []
    };

    // Map başlıklarını çek ve maps dizisine ekle
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

    if (DEBUG) console.log('Initial maps array based on headers:', matchDetails.maps.length);

    // Tüm oyuncu istatistik tablolarını çek
    const allTables = $('table.wf-table-inset');
    const playerStatTables = allTables.filter('.mod-overview');

    if (DEBUG) console.log('Total .wf-table-inset tables found:', allTables.length);
    if (DEBUG) console.log('Total .wf-table-inset.mod-overview tables found:', playerStatTables.length);

    // Her tabloyi işle ve eğer player içeriyorsa ilgili mape ekle
    let mapIndex = 0;
    playerStatTables.each((i, playerTableElement) => {
      const playerRows = $(playerTableElement).find('tbody tr');
      if (DEBUG) console.log(`Processing Table #${i + 1}. Found ${playerRows.length} player rows.`);

      if (playerRows.length > 0 && mapIndex < matchDetails.maps.length) {
        if (DEBUG) console.log(`Attempting to add players from Table #${i + 1} to Map: ${matchDetails.maps[mapIndex].name}`);
        const players = [];

        playerRows.each((j, playerRow) => {
            // Oyuncu bilgilerini çek
            const playerName = $(playerRow).find('.mod-player .text-of').text().trim();
            const agent = $(playerRow).find('.mod-agents img').attr('alt');
            const teamName = $(playerRow).find('.mod-player .ge-text-light').text().trim();

            // Player ID ve URL'yi çek
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

            players.push({
                ...stats,
                roundStats,
                playerId,
                playerUrl
            });
        });
        matchDetails.maps[mapIndex].players = players;
        if (DEBUG) console.log(`Added ${players.length} players to Map: ${matchDetails.maps[mapIndex].name}`);
        mapIndex++;
      } else {
          if (DEBUG) console.log(`Skipping Table #${i + 1}. No player rows found or no more maps to add players to.`);
      }
    });

    // Ek bilgiler
    matchDetails.additionalInfo = {
      patch: $('.match-header-patch').text().trim(),
      vod: $('.match-vod-link').attr('href'),
      streams: $('.match-streams a').map((i, el) => $(el).attr('href')).get()
    };

    return matchDetails;
  } catch (error) {
    console.error(`Error fetching match details for ${matchId}:`, error);
    return null;
  }
}

// Event maçlarını getiren endpoint
app.get('/api/events/:eventId/matches', async (req, res) => {
  try {
    const eventId = req.params.eventId;
    console.log(`Fetching matches for event ID: ${eventId}`);
    
    const response = await http.get(`https://www.vlr.gg/event/matches/${eventId}`);
    console.log('Response status:', response.status);
    
    const $ = cheerio.load(response.data);
    console.log('HTML loaded successfully');
    
    const matches = [];
    // Güncellenmiş seçiciler
    const matchItems = $('.match-item');
    console.log('Found match items:', matchItems.length);

    matchItems.each((i, matchElement) => {
      // Maç linkini ve ID'sini al
      const matchLink = $(matchElement).closest('a').attr('href');
      const matchId = matchLink ? matchLink.split('/')[1] : null;

      const match = {
        id: matchId,
        time: $(matchElement).find('.match-item-time').text().trim(),
        team1: {
          name: $(matchElement).find('.match-item-vs-team-name').first().text().trim(),
          score: $(matchElement).find('.match-item-vs-team-score').first().text().trim()
        },
        team2: {
          name: $(matchElement).find('.match-item-vs-team-name').last().text().trim(),
          score: $(matchElement).find('.match-item-vs-team-score').last().text().trim()
        },
        status: $(matchElement).find('.ml-status').text().trim(),
        stage: $(matchElement).find('.match-item-event-series').text().trim(),
        event: $(matchElement).find('.match-item-event').text().trim(),
        links: {
          stats: {
            map: $(matchElement).find('.wf-tag:contains("Map")').length > 0,
            player: $(matchElement).find('.wf-tag:contains("Player")').length > 0
          },
          vod: $(matchElement).find('.wf-tag.mod-yt').length > 0
        },
        url: matchId ? `https://www.vlr.gg/${matchId}` : null
      };
      console.log('Processed match:', match);
      matches.push(match);
    });

    res.json({
      eventId: eventId,
      total: matches.length,
      limit: req.query.limit ? parseInt(req.query.limit) : 20,
      matches: matches
    });
  } catch (error) {
    console.error('Error fetching event matches:', error);
    res.status(500).json({ 
      error: 'Failed to fetch event matches',
      details: error.message,
      stack: error.stack
    });
  }
});

// Sadece sayısal id'ler için maç detay endpointi
app.get('/api/matches/:id(\\d+)', async (req, res) => {
  try {
    const matchId = req.params.id;
    const matchDetails = await getMatchDetails(matchId);
    
    if (!matchDetails) {
      return res.status(404).json({ error: 'Match not found' });
    }

    res.json(matchDetails);
  } catch (error) {
    console.error('Error fetching match details:', error);
    res.status(500).json({ error: 'Failed to fetch match details' });
  }
});

// Event listesini getiren endpoint
app.get('/api/events', async (req, res) => {
  try {
    const response = await http.get('https://www.vlr.gg/events');
    const $ = cheerio.load(response.data);

    const events = [];

    // Etkinlik öğeleri ana a etiketleri içinde
    const eventItems = $('a.event-item.mod-flex.wf-card');

    if (DEBUG) console.log(`Found ${eventItems.length} event items.`);

    eventItems.each((i, eventElement) => {
      // Her etkinlik elementinden bilgileri çekelim - Güncellenmiş selector'ler
      const name = $(eventElement).find('.event-item-title').text().trim();
      const status = $(eventElement).find('.event-item-desc-item-status').text().trim();
      const prizePool = $(eventElement).find('.mod-prize').clone().children().remove().end().text().trim();
      const dates = $(eventElement).find('.mod-dates').clone().children().remove().end().text().trim();

      // Bölgeyi class attribute'undan çekelim - Yeni Logic
      const regionFlagElement = $(eventElement).find('.mod-location i.flag[class*="mod-"]');
      let region = 'Unknown'; // Varsayılan değer
      if (regionFlagElement.length > 0) {
          const classAttr = regionFlagElement.attr('class');
          const modClass = classAttr.split(' ').find(cls => cls.startsWith('mod-'));
          if (modClass) {
              region = modClass.replace('mod-', '').toUpperCase(); // 'mod-' kısmını çıkarıp büyük harf yap
          }
      }

      const href = $(eventElement).attr('href');
      const url = href ? `https://www.vlr.gg${href}` : null;
      const id = href ? href.split('/')[2] : null;

      if (name) {
         events.push({
          id: id,
          name: name,
          status: status,
          prizePool: prizePool,
          dates: dates,
          region: region, // Güncellenmiş region
          url: url
        });
      } else {
          if (DEBUG) console.log(`Skipping event item ${i}: Could not find name.`);
      }

    });

    res.json(events);

  } catch (error) {
    console.error('Error fetching event list:', error);
    res.status(500).json({ error: 'Failed to fetch event list' });
  }
});

// Oyuncu detaylarını getiren endpoint
app.get('/api/players/:id', async (req, res) => {
  try {
    const playerId = req.params.id;
    const timespan = req.query.timespan; // timespan query parametresini al

    let playerUrl = `https://www.vlr.gg/player/${playerId}/`;
    if (timespan) {
      // Eğer timespan varsa URL'ye ekle (geçerli değerleri kontrol etmiyoruz şimdilik)
      playerUrl += `?timespan=${timespan}`;
    }

    const response = await http.get(playerUrl);
    const $ = cheerio.load(response.data);

    if (DEBUG) console.log(`DEBUG: Processing player ID: ${playerId} with timespan: ${timespan || 'default'}`);
    if (DEBUG) console.log("DEBUG: Player page HTML loaded.");

    // !!! DEBUG: Çekilen tüm HTML içinde "LOUD" kelimesini ara
    // const htmlContent = response.data;
    // const loudFound = htmlContent.includes('LOUD');
    // const loudIdFound = htmlContent.includes('/team/455');
    // console.log(`DEBUG: "LOUD" found in HTML: ${loudFound}`);
    // console.log(`DEBUG: "/team/455" found in HTML: ${loudIdFound}`);

    // Oyuncu temel bilgileri
    const playerName = $('.player-header .wf-title').text().trim(); // Oyuncu adı (büyük başlık)
    const realName = $('.player-header h2').text().trim(); // Gerçek adı
    const playerTag = $('.player-header .player-tag').text().trim(); // Oyuncu tagı (@...)
    // Ülke bilgisini bayrak class'ından çekelim
    const countryFlagElement = $('.player-header i.flag[class*="mod-"]');
    let country = 'Unknown';
    if (countryFlagElement.length > 0) {
        const classAttr = countryFlagElement.attr('class');
        const modClass = classAttr.split(' ').find(cls => cls.startsWith('mod-'));
        if (modClass) {
            country = modClass.replace('mod-', '').toUpperCase();
        }
    }


    const playerDetails = {
      id: playerId,
      name: playerName,
      realName: realName,
      tag: playerTag,
      country: country,
      url: playerUrl,
      agentStats: [],
      recentResults: [],
      currentTeams: [],
      pastTeams: [],
      totalWinnings: null
    };

    // Güncel Takım
    const currentTeamElement = $('a.mod-first.wf-module-item[href*="/team/"]');
    if (currentTeamElement.length > 0) {
        if (DEBUG) console.log("Current team element found:", currentTeamElement.length);
        
        // !!! DEBUG: Güncel takım elementinin tüm HTML'ini yazdır
        // console.log("DEBUG: Current team full HTML:", currentTeamElement.prop('outerHTML'));
        
        // Takım adını çek ve temizle (text node hedefleme)
        const teamNameElement = currentTeamElement.find('div[style="font-weight: 500;"]');
        let teamName = '';
        if (teamNameElement.length > 0) {
            // Elementin içindeki ilk text node'u çek ve trimle
             teamName = $(teamNameElement.contents().get(0)).text().trim();
             // Temizle: Birden fazla boşluğu tek boşluğa indir, baştaki/sondaki boşlukları sil
             teamName = teamName.replace(/\s+/g, ' ').trim();
        }
        
        if (DEBUG) console.log("Found team name:", teamName);
        
        const joinDate = currentTeamElement.find('div.ge-text-light:last-child').text().trim();
        const teamLogo = currentTeamElement.find('img').attr('src');
        const teamUrl = currentTeamElement.attr('href');
        // Takım ID'sini URL'den doğru şekilde çek
        const teamId = teamUrl ? teamUrl.split('/')[2] : null; // Bu hala player URL için geçerli

        // Eğer URL tam verilmişse (https://...) veya göreceli ise ID'yi doğru al
        let extractedTeamId = null;
        if (teamUrl) {
            const urlParts = teamUrl.split('/');
            const teamIndex = urlParts.indexOf('team');
            if (teamIndex !== -1 && urlParts.length > teamIndex + 1) {
                extractedTeamId = urlParts[teamIndex + 1];
            }
        }

        if (DEBUG) console.log("Team details:", { teamName, joinDate, teamLogo, teamUrl, teamId: extractedTeamId }); // Debug çıktısını düzelt

        if (teamName) {
            playerDetails.currentTeams.push({
                id: extractedTeamId, // Düzeltilen ID
                name: teamName,
                joinDate: joinDate,
                logo: teamLogo ? `https://owcdn.net${teamLogo}` : null,
                url: teamUrl
            });
            if (DEBUG) console.log(`Added current team: ${teamName} (ID: ${extractedTeamId})`);
        } else {
             if (DEBUG) console.log("Current team name not found or empty.");
        }
    } else {
        if (DEBUG) console.log("Current team element not found");
    }

    // Eski Takımlar (Güncellenmiş Yaklaşım: Tüm linkli öğeleri çek ve güncel takımı hariç tut)
    const pastTeamsContainer = $('.wf-card');
    if (pastTeamsContainer.length > 0) {
        if (DEBUG) console.log("Past teams container found");

        // .wf-card içindeki tüm .wf-module-item a elementlerini al (mod-first kısıtlaması olmadan)
        const allTeamElements = pastTeamsContainer.find('a.wf-module-item[href*="/team/"]');
        
        const currentTeamUrl = playerDetails.currentTeams.length > 0 ? playerDetails.currentTeams[0].url : null;

        allTeamElements.each((i, teamElement) => {
            const teamUrl = $(teamElement).attr('href') ? `https://www.vlr.gg${$(teamElement).attr('href')}` : null;

            // Eğer bu element güncel takıma ait değilse geçmiş takımlara ekle
            if (teamUrl && teamUrl !== currentTeamUrl) {
                 // !!! DEBUG: Geçmiş takım elementinin tüm HTML'ini yazdır
                // console.log(`DEBUG: Past team ${i + 1} full HTML:`, $(teamElement).prop('outerHTML'));

                // Takım adını çek (text node hedefleme)
                const teamNameElement = $(teamElement).find('div[style="font-weight: 500;"]');
                 let teamName = '';
                if (teamNameElement.length > 0) {
                    teamName = $(teamNameElement.contents().get(0)).text().trim(); // Elementin içindeki ilk text node'u çek ve trimle
                    // Temizle: Birden fazla boşluğu tek boşluğa indir, baştaki/sondaki boşlukları sil
                    teamName = teamName.replace(/\s+/g, ' ').trim();
                }

                // Tarihleri çek
                const dates = $(teamElement).find('div.ge-text-light:last-child').text().trim();

                // Logo çek
                const teamLogo = $(teamElement).find('img').attr('src');
                
                const teamId = teamUrl ? teamUrl.split('/')[2] : null;

                if (DEBUG) console.log(`Found past team ${i + 1} name:`, teamName);
                // if (DEBUG) console.log(`Past team details:`, { teamName, dates, teamLogo, teamUrl, teamId: extractedTeamId }); // Debug çıktısını düzelt - Kaldırıldı

                if (teamName) {
                    playerDetails.pastTeams.push({
                        id: teamId,
                        name: teamName,
                        dates: dates, // Tarihleri her zaman çekmeye çalış
                        logo: teamLogo ? `https://owcdn.net${teamLogo}` : null,
                        url: teamUrl
                    });
                    if (DEBUG) console.log(`Added past team: ${teamName} (ID: ${teamId})`);
                }
            } else if (teamUrl === currentTeamUrl) {
                if (DEBUG) console.log(`DEBUG: Skipping current team element from past teams list: ${teamUrl}`);
            }
        });
    } else {
        if (DEBUG) console.log("Past teams container not found");
    }

    // Son Maç Sonuçları
    const recentResultsContainer = $('.wf-card.mod-recent-results');
    if (recentResultsContainer.length > 0) {
        if (DEBUG) console.log("Recent results container found.");
        recentResultsContainer.find('.result-item').each((i, resultElement) => {
            const eventName = $(resultElement).find('.event-name').text().trim();
            const matchLink = $(resultElement).find('a').attr('href');
            const matchId = matchLink ? matchLink.split('/')[1] : null;
            const teams = $(resultElement).find('.match-item-vs-team');
            const team1Name = $(teams).first().find('.text-of').text().trim();
            const team2Name = $(teams).last().find('.text-of').text().trim();
            const score = $(resultElement).find('.match-item-vs-score .score').text().trim();
            const date = $(resultElement).find('.match-item-time').text().trim();

            if (eventName && matchId) {
                playerDetails.recentResults.push({
                    eventName: eventName,
                    matchId: matchId,
                    team1: team1Name,
                    team2: team2Name,
                    score: score,
                    date: date,
                    url: matchLink ? `https://www.vlr.gg${matchLink}` : null
                });
            }
        });
    } else {
         if (DEBUG) console.log("Recent results container not found.");
    }

    // Agent İstatistikleri - Tablo scrape etme
    const agentStatsTable = $('.mod-dark.mod-table.wf-card table.wf-table');

    if (agentStatsTable.length > 0) {
        if (DEBUG) console.log("Agent Stats Table found.");
        // tbody içindeki her bir satırı işle
        agentStatsTable.find('tbody tr').each((i, rowElement) => {
            const agentName = $(rowElement).find('td:nth-child(1) img').attr('alt');
            const stats = {
                use: $(rowElement).find('td:nth-child(2)').text().trim(),
                rnd: $(rowElement).find('td:nth-child(3)').text().trim(),
                rating: $(rowElement).find('td:nth-child(4)').text().trim(),
                acs: $(rowElement).find('td:nth-child(5)').text().trim(),
                kd: $(rowElement).find('td:nth-child(6)').text().trim(),
                adr: $(rowElement).find('td:nth-child(7)').text().trim(),
                kast: $(rowElement).find('td:nth-child(8)').text().trim(),
                kpr: $(rowElement).find('td:nth-child(9)').text().trim(),
                apr: $(rowElement).find('td:nth-child(10)').text().trim(),
                fkpr: $(rowElement).find('td:nth-child(11)').text().trim(),
                fdpr: $(rowElement).find('td:nth-child(12)').text().trim(),
                kills: $(rowElement).find('td:nth-child(13)').text().trim(),
                deaths: $(rowElement).find('td:nth-child(14)').text().trim(),
                assists: $(rowElement).find('td:nth-child(15)').text().trim(),
                fk: $(rowElement).find('td:nth-child(16)').text().trim(),
                fd: $(rowElement).find('td:nth-child(17)').text().trim()
            };
            if(agentName) {
                playerDetails.agentStats.push({
                    agent: agentName,
                    ...stats
                });
                if (DEBUG) console.log(`Added agent stats for: ${agentName}`);
            }
        });
    } else {
        if (DEBUG) console.log("Agent Stats Table not found.");
    }

    // Toplam kazanç
    let totalWinnings = null;
    const winningsRaw = $('.wf-card:contains("Total Winnings") span').text();
    if (winningsRaw) {
      // Sadece ilk $... değerini al
      const match = winningsRaw.match(/\$[\d,]+/);
      if (match) totalWinnings = match[0];
    }

    res.json(playerDetails);

  } catch (error) {
    console.error(`Error fetching player details for ${playerId}:`, error);
    res.status(500).json({ error: 'Failed to fetch player details' });
  }
});

// Yaklaşan ve canlı maçları getiren endpoint (tümünü döndürür)
app.get('/api/matches/upcoming', async (req, res) => {
  try {
    const response = await http.get('https://www.vlr.gg/matches');
    const $ = cheerio.load(response.data);
    const matches = [];
    $('.match-item').each((i, matchElement) => {
      const matchLink = $(matchElement).attr('href');
      const matchId = matchLink ? matchLink.split('/')[1] : null;
      const team1Name = cleanText($(matchElement).find('.match-item-vs-team-name').first().text());
      const team2Name = cleanText($(matchElement).find('.match-item-vs-team-name').last().text());
      const team1Score = cleanText($(matchElement).find('.match-item-vs-team-score').first().text());
      const team2Score = cleanText($(matchElement).find('.match-item-vs-team-score').last().text());
      const event = cleanText($(matchElement).find('.match-item-event').clone().children('.match-item-event-series').remove().end().text());
      const stage = cleanText($(matchElement).find('.match-item-event-series').text());
      const date = cleanText($(matchElement).find('.match-item-time').text());
      const status = cleanText($(matchElement).find('.ml-status').text());
      const eta = cleanText($(matchElement).find('.ml-eta').text());
      const icon = $(matchElement).find('.match-item-icon img').attr('src');
      matches.push({
        id: matchId,
        teams: {
          team1: { name: team1Name, score: team1Score },
          team2: { name: team2Name, score: team2Score }
        },
        event: event,
        stage: stage,
        date: date,
        status: status,
        eta: eta,
        icon: icon ? `https://owcdn.net${icon}` : null,
        url: matchLink ? `https://www.vlr.gg${matchLink}` : null
      });
    });
    // Sadece Upcoming olanları döndür
    const upcomingMatches = matches.filter(m => m.status.toLowerCase() === 'upcoming');
    res.json({
      total: upcomingMatches.length,
      matches: upcomingMatches
    });
  } catch (error) {
    console.error('[ERROR] Fetching upcoming matches failed:', error);
    res.status(500).json({ error: 'Failed to fetch upcoming matches' });
  }
});

// Canlı maçları getiren endpoint
app.get('/api/matches/live', async (req, res) => {
  try {
    const response = await http.get('https://www.vlr.gg/matches');
    const $ = cheerio.load(response.data);
    const matches = [];
    $('.match-item').each((i, matchElement) => {
      const matchLink = $(matchElement).attr('href');
      const matchId = matchLink ? matchLink.split('/')[1] : null;
      const team1Name = cleanText($(matchElement).find('.match-item-vs-team-name').first().text());
      const team2Name = cleanText($(matchElement).find('.match-item-vs-team-name').last().text());
      const team1Score = cleanText($(matchElement).find('.match-item-vs-team-score').first().text());
      const team2Score = cleanText($(matchElement).find('.match-item-vs-team-score').last().text());
      const event = cleanText($(matchElement).find('.match-item-event').clone().children('.match-item-event-series').remove().end().text());
      const stage = cleanText($(matchElement).find('.match-item-event-series').text());
      const date = cleanText($(matchElement).find('.match-item-time').text());
      const status = cleanText($(matchElement).find('.ml-status').text());
      const eta = cleanText($(matchElement).find('.ml-eta').text());
      const icon = $(matchElement).find('.match-item-icon img').attr('src');
      matches.push({
        id: matchId,
        teams: {
          team1: { name: team1Name, score: team1Score },
          team2: { name: team2Name, score: team2Score }
        },
        event: event,
        stage: stage,
        date: date,
        status: status,
        eta: eta,
        icon: icon ? `https://owcdn.net${icon}` : null,
        url: matchLink ? `https://www.vlr.gg${matchLink}` : null
      });
    });
    // Sadece LIVE olanları döndür
    const liveMatches = matches.filter(m => m.status.toLowerCase() === 'live');
    res.json({
      total: liveMatches.length,
      matches: liveMatches
    });
  } catch (error) {
    console.error('[ERROR] Fetching live matches failed:', error);
    res.status(500).json({ error: 'Failed to fetch live matches' });
  }
});

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

app.get('/api/teams', async (req, res) => {
  const region = req.query.region;
  if (!region || !REGION_URLS[region]) {
    return res.status(400).json({ error: 'Geçersiz veya eksik region parametresi', supported: Object.keys(REGION_URLS) });
  }
  try {
    const url = REGION_URLS[region];
    const response = await http.get(url);
    const $ = cheerio.load(response.data);
    const teams = [];
    $('a.rank-item-team').each((i, el) => {
      const href = $(el).attr('href');
      const id = href ? href.split('/')[2] : null;
      const name = $(el).find('img').attr('alt') || $(el).find('.ge-text').clone().children().remove().end().text().trim();
      const logo = $(el).find('img').attr('src');
      const country = $(el).find('.rank-item-team-country').text().trim();
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
    res.json({ region, total: teams.length, teams });
  } catch (error) {
    console.error('[ERROR] Fetching teams failed:', error);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

// Takım geçmiş maçlarını çeken yardımcı fonksiyon
async function getTeamMatches(teamId) {
  try {
    const url = `https://www.vlr.gg/team/matches/${teamId}/`;
    const response = await http.get(url);
    const $ = cheerio.load(response.data);
    const matches = [];
    // Maç kartlarını yeni yapıya göre bul
    $('a.fc-flex.wf-card.m-item').each((i, el) => {
      const matchLink = $(el).attr('href');
      const matchId = matchLink ? matchLink.split('/')[1] : null;
      const url = matchLink ? `https://www.vlr.gg${matchLink}` : null;
      // Event ve stage
      const eventDiv = $(el).find('.m-item-event');
      const event = eventDiv.find('div').first().text().trim();
      const stage = eventDiv.contents().filter(function() { return this.type === 'text'; }).text().trim();
      // Temiz birleştirme
      let eventFull = event;
      if (stage) {
        // Boşluk, tab, satır başı karakterlerini temizle
        const cleanStage = stage.replace(/[\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
        eventFull = `${event} ${cleanStage}`.replace(/\s+⋅\s+/g, ' ⋅ ');
      }
      // Takımlar ve skorlar
      const team1 = $(el).find('.m-item-team').first().find('.m-item-team-name').text().trim();
      const team2 = $(el).find('.m-item-team').last().find('.m-item-team-name').text().trim();
      const scoreDiv = $(el).find('.m-item-result');
      const score1 = scoreDiv.find('span').first().text().trim();
      const score2 = scoreDiv.find('span').last().text().trim();
      // Tarih
      const date = $(el).find('.m-item-date div').first().text().trim();
      // Haritalar (altındaki .m-item-games-item'lar)
      const maps = [];
      // Her maç kartının hemen ardından gelen .mod-collapsed.m-item-games divini bul
      const gamesDiv = $(el).next('.mod-collapsed.m-item-games');
      if (gamesDiv.length > 0) {
        gamesDiv.find('.m-item-games-item').each((j, gameEl) => {
          const mapName = $(gameEl).find('.map').text().trim();
          const mapScore = $(gameEl).find('.score').text().replace(/\s+/g, '').replace(/-/g, '-').trim();
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
  } catch (err) {
    console.error('[ERROR] Takım geçmiş maçları çekilemedi:', err.message);
    return [];
  }
}

app.get('/api/teams/:id', async (req, res) => {
  const teamId = req.params.id;
  try {
    const url = `https://www.vlr.gg/team/${teamId}/`;
    const response = await http.get(url);
    const $ = cheerio.load(response.data);

    // Temel bilgiler
    const name = $('h1').first().text().trim();
    const tag = $('.team-header .team-header-tag').text().trim() || $('.team-header .wf-title-med').text().trim();
    const logo = $('.team-header img').attr('src');
    const region = $('.team-header .team-header-country').text().trim() || $('.team-header .ge-text-light').text().trim();
    const website = $('.team-header a[href^="https://"]').attr('href') || null;
    const twitter = $('.team-header a[href*="twitter.com"]').text().trim() || null;

    // Kadro ve staff (ayrıştırılmış)
    const roster = [];
    const staff = [];
    $('.team-roster-item').each((i, el) => {
      const alias = $(el).find('.team-roster-item-name-alias').text().trim();
      const realName = $(el).find('.team-roster-item-name-real').text().trim();
      let role = $(el).find('.team-roster-item-name-role').first().text().trim();
      const playerLink = $(el).find('a').attr('href');
      let playerId = null;
      if (playerLink && playerLink.startsWith('/player/')) {
        const parts = playerLink.split('/');
        if (parts.length > 2) playerId = parts[2];
      }
      // Eğer role varsa ve (manager, coach, inactive, performance içeriyorsa) staff'a ekle
      if (role && /manager|coach|inactive|performance/i.test(role)) {
        staff.push({ name: alias, realName, role });
      } else {
        // Oyuncu (role yoksa veya Sub ise)
        if (!role) role = 'player';
        roster.push({ id: playerId, name: alias, realName, role });
      }
    });

    // Toplam kazanç
    let totalWinnings = null;
    const winningsRaw = $('.wf-card:contains("Total Winnings") span').text();
    if (winningsRaw) {
      // Sadece ilk $... değerini al
      const match = winningsRaw.match(/\$[\d,]+/);
      if (match) totalWinnings = match[0];
    }

    // Takım geçmiş maçları (recentMatches)
    const recentMatches = await getTeamMatches(teamId);

    // Sonuç
    if (!name) return res.status(404).json({ error: 'Takım bulunamadı' });
    res.json({
      id: teamId,
      name,
      tag,
      logo: logo ? `https://owcdn.net${logo}` : null,
      region,
      socials: { website, twitter },
      roster,
      staff,
      totalWinnings,
      recentMatches
    });
  } catch (error) {
    console.error('[ERROR] Fetching team profile failed:', error);
    res.status(500).json({ error: 'Failed to fetch team profile' });
  }
});

app.get('/api/teams/:id/maps-stats', async (req, res) => {
  try {
    const teamId = req.params.id;
    const url = `https://www.vlr.gg/team/stats/${teamId}/`;
    const response = await http.get(url);
    const $ = cheerio.load(response.data);
    const stats = [];
    const mapTable = $('table.wf-table.mod-team-maps').first();

    // 1. Tüm comp'ları topla ve map adına göre grupla
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
          // Map adı ve oynanma sayısı: örn. "Bind (71)"
          let mapRaw = $(tds[0]).text().trim();
          let mapMatch = mapRaw.match(/([\w\s]+)\s*\((\d+)\)/);
          let map = mapMatch ? mapMatch[1].trim() : mapRaw;
          let played = mapMatch ? parseInt(mapMatch[2], 10) : null;
          // Diğer istatistikler sırayla hücrelerde
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
          // SADECE map adı doluysa ekle
          if (map && map !== '') {
            // comps'u map adına göre ekle
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
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch team map stats' });
  }
});

app.get('/api/teams/:id/agents-stats', async (req, res) => {
  try {
    const teamId = req.params.id;
    const url = `https://www.vlr.gg/team/stats/${teamId}/`;
    const response = await http.get(url);
    const $ = cheerio.load(response.data);
    // Tüm agent kompozisyonlarını topla
    const agentCounts = {};
    let total = 0;
    // Her map satırındaki agent-comp-agg'leri bul
    $('div.agent-comp-agg.mod-first').each((i, el) => {
      $(el).find('img').each((j, img) => {
        // Agent ismini dosya adından çek
        const src = $(img).attr('src') || '';
        const match = src.match(/([a-z0-9]+)\.png/i);
        let agent = match ? match[1] : null;
        if (agent) {
          agentCounts[agent] = (agentCounts[agent] || 0) + 1;
          total++;
        }
      });
    });
    // Agent bazlı breakdown
    const stats = Object.entries(agentCounts).map(([agent, count]) => ({
      agent,
      played: count,
      pickrate: total > 0 ? ((count / total) * 100).toFixed(1) + '%' : '0%'
    }));
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch team agent stats' });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
}); 