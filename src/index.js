const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const swaggerUi = require('swagger-ui-express');
const swaggerJSDoc = require('swagger-jsdoc');
require('dotenv').config();
const { cleanText, withCache, handleHttpError, getEvents, getTeams, getMatchDetails, getTeamMatches, searchPlayersAndTeams, getPlayerAdvancedStats, calculateRosterStability } = require('./utils');

console.log(`DEBUG mode status from process.env.DEBUG: ${process.env.DEBUG}`);

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 4000;
const DEBUG = process.env.DEBUG === 'true'; // DEBUG modunu çevre değişkeninden oku

// Axios için headers
const http = axios.create({
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1'
  }
});

app.use(cors());
app.use(express.json());

// Swagger/OpenAPI ayarları
const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'ValyticsAPI',
    version: '1.0.0',
    description: 'Valytics API dokümantasyonu',
  },
  servers: [
    {
      url: `http://localhost:${PORT}`,
      description: 'Local server',
    },
  ],
  tags: [
    { name: 'Matches', description: 'Valorant maçları ile ilgili endpointler' },
    { name: 'Events', description: 'Valorant etkinlikleri ile ilgili endpointler' },
    { name: 'Teams', description: 'Valorant takımları ile ilgili endpointler' },
    { name: 'Players', description: 'Valorant oyuncuları ile ilgili endpointler' },
    { name: 'Search', description: 'Arama endpointi' },
    { name: 'Health', description: 'Sağlık kontrolü' },
  ],
};

const swaggerOptions = {
  swaggerDefinition,
  apis: [__filename], // Sadece bu dosyadaki JSDoc yorumlarını kullan
};

const swaggerSpec = swaggerJSDoc(swaggerOptions);

app.use('/api-docs', swaggerUi.serve, (req, res, next) => {
  const swaggerSpecWithHost = {
    ...swaggerSpec,
    servers: [
      {
        url: `${req.protocol}://${req.get('host')}`,
        description: 'Deployed server',
      },
      // İsteğe bağlı olarak localhost'u da tutabilirsiniz:
      // {
      //   url: `http://localhost:${PORT}`,
      //   description: 'Local server',
      // },
    ],
  };
  swaggerUi.setup(swaggerSpecWithHost)(req, res, next);
});

// Redirect root URL to API Docs
app.get('/', (req, res) => {
  res.redirect('/api-docs');
});

/**
 * @openapi
 * /api/matches/completed:
 *   get:
 *     summary: Tamamlanmış maçları getirir
 *     tags:
 *       - Matches
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
 *     tags:
 *       - Matches
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
 *     tags:
 *       - Events
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
 *     tags:
 *       - Events
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
 *     tags:
 *       - Players
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
 *     tags:
 *       - Matches
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
 *     tags:
 *       - Matches
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
 *     tags:
 *       - Teams
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
 *     tags:
 *       - Teams
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
 *                 - id: "123"
 *                   name: "Boaster"
 *                   realName: "Jake Howlett"
 *                   role: "player"
 *                 - id: "124"
 *                   name: "crashies"
 *                   realName: "Austin Roberts"
 *                   role: "player"
 *               staff:
 *                 - name: "CoJo"
 *                   realName: ""
 *                   role: "manager"
 *               recentMatches:
 *                 - event: "VCT 25: EMEA Stage 1 Playoffs"
 *                   opponent: "Team Heretics"
 *                   score: "3 : 0"
 *                   date: "2025/05/18"
 *               totalWinnings: "$1,417,285"
 *               stats:
 *                 totalMatches: 120
 *                 totalWins: 80
 *                 totalLosses: 40
 *                 winrate: "66.7%"
 *                 last10:
 *                   wins: 7
 *                   losses: 3
 *                 mostPlayedMap: "Ascent"
 *                 bestMap: "Bind"
 *                 worstMap: "Icebox"
 *                 last10MostPlayedMap: "Lotus"
 *                 last10BestMap: "Bind"
 *                 last10WorstMap: "Split"
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
 *     tags:
 *       - Teams
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Takım ID
 *       - in: query
 *         name: last
 *         required: false
 *         schema:
 *           type: integer
 *         description: Son X maç bazında istatistik (örn. last=10 ile son 10 maç)
 *     responses:
 *       200:
 *         description: Harita istatistikleri
 *         content:
 *           application/json:
 *             example:
 *               - map: "Breeze"
 *                 played: 5
 *                 winrate: "80%"
 *                 wins: "4"
 *                 losses: "1"
 *                 atkFirst: null
 *                 defFirst: null
 *                 atkRWin: null
 *                 atkRW: null
 *                 atkRL: null
 *                 defRWin: null
 *                 defRW: null
 *                 defRL: null
 *                 comps: []
 *       500:
 *         description: Hata
 */

/**
 * @openapi
 * /api/teams/{id}/agents-stats:
 *   get:
 *     summary: Takımın ajan istatistiklerini getirir
 *     tags:
 *       - Teams
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
 * /api/health:
 *   get:
 *     summary: API sağlık kontrolü (ana fonksiyonların çalışırlığını topluca test eder)
 *     tags:
 *       - Health
 *     responses:
 *       200:
 *         description: Sağlık durumu ve test sonuçları
 *         content:
 *           application/json:
 *             example:
 *               status: ok
 *               results:
 *                 events: { status: ok, count: 20 }
 *                 teams: { status: ok, count: 30 }
 *                 teamProfile: { status: ok }
 *                 teamMapStats: { status: ok }
 *                 teamAgentStats: { status: ok }
 *                 completedMatches: { status: ok }
 *                 matchDetails: { status: ok }
 *       500:
 *         description: Hata
 */

/**
 * @openapi
 * /api/search:
 *   get:
 *     summary: Oyuncu ve takım araması yapar
 *     tags:
 *       - Search
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Aranacak metin
 *     responses:
 *       200:
 *         description: Arama sonucu (oyuncular ve takımlar)
 *         content:
 *           application/json:
 *             example:
 *               players:
 *                 - id: "3269"
 *                   name: "Antidote"
 *                   realName: "Sabyasachi Bose"
 *                   logo: "https://owcdn.net/img/67cfba3fbd644.png"
 *                   url: "https://www.vlr.gg/player/3269/antidote"
 *               teams:
 *                 - id: "11496"
 *                   name: "ALTERNATE aTTaX Ruby"
 *                   logo: "https://owcdn.net/img/62a1d1c3e765e.png"
 *                   url: "https://www.vlr.gg/team/11496/alternate-attax-ruby"
 *       400:
 *         description: Eksik arama parametresi
 *       500:
 *         description: Hata
 */

/**
 * @swagger
 * /api/players/{id}/advanced-stats:
 *   get:
 *     summary: Bir oyuncunun son X maçtaki gelişmiş istatistiklerini döndürür
 *     tags:
 *       - Players
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Oyuncu ID'si
 *       - in: query
 *         name: last
 *         required: false
 *         schema:
 *           type: integer
 *           default: 5
 *         description: Son kaç maç alınacak
 *     responses:
 *       200:
 *         description: Gelişmiş istatistikler
 *         content:
 *           application/json:
 *             example:
 *               playerId: "5568"
 *               matchCount: 7
 *               total:
 *                 2K: 46
 *                 3K: 9
 *                 4K: 3
 *                 5K: 1
 *                 1v1: 2
 *                 1v2: 2
 *                 1v3: 1
 *                 1v4: 0
 *                 1v5: 0
 *                 ECON: 313
 *                 PL: 19
 *                 DE: 7
 *               average:
 *                 2K: "6.57"
 *                 3K: "1.29"
 *                 4K: "0.43"
 *                 5K: "0.14"
 *                 1v1: "0.29"
 *                 1v2: "0.29"
 *                 1v3: "0.14"
 *                 1v4: "0.00"
 *                 1v5: "0.00"
 *                 ECON: "44.71"
 *                 PL: "2.71"
 *                 DE: "1.00"
 *                 opKills: "0.86"
 *                 opDeaths: "1.14"
 *                 fk: "7.71"
 *                 fd: "6.00"
 *               summary:
 *                 opKills: 6
 *                 opDeaths: 8
 *                 fk: 54
 *                 fd: 42
 *               maps:
 *                 - map: "Haven"
 *                   matrixStats: { }
 *                   advancedStats: { }
 *                 - map: "Split"
 *                   matrixStats: { }
 *                   advancedStats: { }
 *                 # ... diğer gerçek haritalar ...
 *       500:
 *         description: Hata
 *         content:
 *           application/json:
 *             example:
 *               error: 'Failed to fetch advanced stats'
 */

/**
 * @swagger
 * /api/teams/{id}/roster-stability:
 *   get:
 *     summary: Takımın kadro stabilitesini getirir
 *     description: Calculates and returns the roster stability score for a team based on their recent matches
 *     tags:
 *       - Teams
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Team ID
 *     responses:
 *       200:
 *         description: Team roster stability information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 teamId:
 *                   type: string
 *                   description: Team ID
 *                 teamName:
 *                   type: string
 *                   description: Team name
 *                 currentRoster:
 *                   type: array
 *                   items:
 *                     type: string
 *                   description: List of current player IDs
 *                 rosterChanges:
 *                   type: integer
 *                   description: Total number of roster changes (new players + left players)
 *                 maxPossibleChanges:
 *                   type: integer
 *                   description: Maximum possible number of changes (matches × 5)
 *                 stabilityScore:
 *                   type: string
 *                   description: Roster stability score (1 - (rosterChanges / maxPossibleChanges))
 *       500:
 *         description: Server error
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
    const limit = req.query.limit ? parseInt(req.query.limit) : 10;
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
            teams: {
              team1: { 
                name: team1Name, 
                score: team1Score 
              },
              team2: { 
                name: team2Name, 
                score: team2Score 
              }
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
    if (!matchDetails) return res.status(404).json({ error: 'Match not found' });
    res.json(matchDetails);
  } catch (error) {
    handleHttpError(res, error, 'Failed to fetch match details');
  }
});

// Event listesini getiren endpoint
app.get('/api/events', async (req, res) => {
  try {
    const events = await withCache('events', getEvents)();
    res.json(events);
  } catch (error) {
    handleHttpError(res, error, 'Failed to fetch event list');
  }
});

// Oyuncu detaylarını getiren endpoint
app.get('/api/players/:id', async (req, res) => {
  const playerId = req.params.id;
  try {
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

    // Oyuncu temel bilgileri
    const firstCard = $('a.wf-card.fc-flex.m-item').first();
    console.log('[DEBUG] firstCard html:', firstCard.html());

    let playerNameFromProfile = cleanText($('.player-header h1.wf-title').first().text()) 
      || cleanText($('h1.wf-title').first().text());
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
      name: playerNameFromProfile,
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

    // Maç geçmişini çek
    try {
      const matchesUrl = `https://www.vlr.gg/player/matches/${playerId}/`;
      const matchesRes = await http.get(matchesUrl);
      const $$ = cheerio.load(matchesRes.data);
      $$('.wf-card.fc-flex.m-item').each((i, el) => {
        const matchLink = $$(el).attr('href');
        const matchId = matchLink ? matchLink.split('/')[1] : null;
        if (matchId) {
          playerDetails.recentResults.push({
            matchId,
            url: `https://www.vlr.gg${matchLink}`
            // istersen event, rakip, skor, tarih gibi alanları da ekle
          });
        }
      });
      if (DEBUG) console.log(`[DEBUG] recentResults from /player/matches/${playerId}/:`, playerDetails.recentResults);
    } catch (err) {
      if (DEBUG) console.log(`[DEBUG] Error fetching matches for player ${playerId}:`, err.message);
    }

    // Agent İstatistikleri - Tablo scrape etme
    const advStatsTables = $('.wf-table');
    let totalStats = {
        agent: "total",
        use: 0, // Başlangıç değeri 0 olarak ayarlandı
        rnd: 0,
        rating: null,
        acs: null,
        kd: null,
        adr: null,
        kast: null,
        kpr: null,
        apr: null,
        fkpr: null,
        fdpr: null,
        kills: 0,
        deaths: 0,
        assists: 0,
        fk: 0,
        fd: 0,
        // Yeni sum ve count alanları başlatılıyor
        ratingSum: 0,
        ratingCount: 0,
        acsSum: 0,
        acsCount: 0,
        kdSum: 0,
        kdCount: 0,
        adrSum: 0,
        adrCount: 0,
        kastSum: 0,
        kastCount: 0,
        kprSum: 0,
        kprCount: 0,
        aprSum: 0,
        aprCount: 0,
        fkprSum: 0,
        fkprCount: 0,
        fdprSum: 0,
        fdprCount: 0,
    };
    let agentCount = 0;

    if (advStatsTables.length > 0) {
        if (DEBUG) console.log("Agent Stats Table found.");
        // tbody içindeki her bir satırı işle
        advStatsTables.each((_, table) => {
            $(table).find('tbody tr').each((__, row) => {
                const agentImg = $(row).find('td').eq(0).find('img');
                const agentName = agentImg.attr('alt');
                if (DEBUG) console.log('[DEBUG] Processing agent:', agentName);
                
                const useText = $(row).find('td').eq(1).text().trim();
                const useMatch = useText.match(/\((\d+)\)/);
                const useCount = useMatch ? parseInt(useMatch[1]) : 0;
                
                const stats = {
                    use: useText,
                    rnd: parseInt($(row).find('td').eq(2).text().trim()),
                    rating: parseFloat($(row).find('td.mod-center').text().trim()),
                    acs: parseFloat($(row).find('td').eq(4).text().trim()),
                    kd: parseFloat($(row).find('td').eq(5).text().trim()),
                    adr: parseFloat($(row).find('td').eq(6).text().trim()),
                    kast: parseFloat($(row).find('td').eq(7).text().trim().replace('%', '')),
                    kpr: parseFloat($(row).find('td').eq(8).text().trim()),
                    apr: parseFloat($(row).find('td').eq(9).text().trim()),
                    fkpr: parseFloat($(row).find('td').eq(10).text().trim()),
                    fdpr: parseFloat($(row).find('td').eq(11).text().trim()),
                    kills: parseInt($(row).find('td').eq(12).text().trim()),
                    deaths: parseInt($(row).find('td').eq(13).text().trim()),
                    assists: parseInt($(row).find('td').eq(14).text().trim()),
                    fk: parseInt($(row).find('td').eq(15).text().trim()),
                    fd: parseInt($(row).find('td').eq(16).text().trim())
                };

                // Toplam değerleri hesapla
                totalStats.use += useCount; // Sadece useCount'ı topluyoruz

                totalStats.rnd += stats.rnd || 0;

                if (stats.rating !== null && !isNaN(stats.rating)) {
                    totalStats.ratingSum += stats.rating;
                    totalStats.ratingCount++;
                }
                if (stats.acs !== null && !isNaN(stats.acs)) {
                    totalStats.acsSum += stats.acs;
                    totalStats.acsCount++;
                }
                if (stats.kd !== null && !isNaN(stats.kd)) {
                    totalStats.kdSum += stats.kd;
                    totalStats.kdCount++;
                }
                if (stats.adr !== null && !isNaN(stats.adr)) {
                    totalStats.adrSum += stats.adr;
                    totalStats.adrCount++;
                }
                if (stats.kast !== null && !isNaN(stats.kast)) {
                    totalStats.kastSum += stats.kast;
                    totalStats.kastCount++;
                }
                if (stats.kpr !== null && !isNaN(stats.kpr)) {
                    totalStats.kprSum += stats.kpr;
                    totalStats.kprCount++;
                }
                if (stats.apr !== null && !isNaN(stats.apr)) {
                    totalStats.aprSum += stats.apr;
                    totalStats.aprCount++;
                }
                if (stats.fkpr !== null && !isNaN(stats.fkpr)) {
                    totalStats.fkprSum += stats.fkpr;
                    totalStats.fkprCount++;
                }
                if (stats.fdpr !== null && !isNaN(stats.fdpr)) {
                    totalStats.fdprSum += stats.fdpr;
                    totalStats.fdprCount++;
                }
                
                totalStats.kills += stats.kills || 0;
                totalStats.deaths += stats.deaths || 0;
                totalStats.assists += stats.assists || 0;
                totalStats.fk += stats.fk || 0;
                totalStats.fd += stats.fd || 0;
                agentCount++;

                if(agentName) {
                    playerDetails.agentStats.push({
                        agent: agentName,
                        use: stats.use,
                        rnd: stats.rnd,
                        rating: isNaN(stats.rating) ? null : stats.rating,
                        acs: isNaN(stats.acs) ? null : stats.acs,
                        kd: isNaN(stats.kd) ? null : stats.kd,
                        adr: isNaN(stats.adr) ? null : stats.adr,
                        kast: isNaN(stats.kast) ? null : stats.kast,
                        kpr: isNaN(stats.kpr) ? null : stats.kpr,
                        apr: isNaN(stats.apr) ? null : stats.apr,
                        fkpr: isNaN(stats.fkpr) ? null : stats.fkpr,
                        fdpr: isNaN(stats.fdpr) ? null : stats.fdpr,
                        kills: stats.kills,
                        deaths: stats.deaths,
                        assists: stats.assists,
                        fk: stats.fk,
                        fd: stats.fd,
                    });
                    if (DEBUG) console.log(`Added agent stats for: ${agentName}`);
                }
            });
        });

        // Ortalama değerleri hesapla
        if (totalStats.ratingCount > 0) {
            totalStats.rating = (totalStats.ratingSum / totalStats.ratingCount).toFixed(2);
        } else {
            totalStats.rating = null;
        }
        if (totalStats.acsCount > 0) {
            totalStats.acs = (totalStats.acsSum / totalStats.acsCount).toFixed(1);
        } else {
            totalStats.acs = null;
        }
        if (totalStats.kdCount > 0) {
            totalStats.kd = (totalStats.kdSum / totalStats.kdCount).toFixed(2);
        } else {
            totalStats.kd = null;
        }
        if (totalStats.adrCount > 0) {
            totalStats.adr = (totalStats.adrSum / totalStats.adrCount).toFixed(1);
        } else {
            totalStats.adr = null;
        }
        if (totalStats.kastCount > 0) {
            totalStats.kast = (totalStats.kastSum / totalStats.kastCount).toFixed(0) + '%';
        } else {
            totalStats.kast = null;
        }
        if (totalStats.kprCount > 0) {
            totalStats.kpr = (totalStats.kprSum / totalStats.kprCount).toFixed(2);
        } else {
            totalStats.kpr = null;
        }
        if (totalStats.aprCount > 0) {
            totalStats.apr = (totalStats.aprSum / totalStats.aprCount).toFixed(2);
        } else {
            totalStats.apr = null;
        }
        if (totalStats.fkprCount > 0) {
            totalStats.fkpr = (totalStats.fkprSum / totalStats.fkprCount).toFixed(2);
        } else {
            totalStats.fkpr = null;
        }
        if (totalStats.fdprCount > 0) {
            totalStats.fdpr = (totalStats.fdprSum / totalStats.fdprCount).toFixed(2);
        } else {
            totalStats.fdpr = null;
        }

        // Handle the "use" field formatting for totalStats at the very end
        totalStats.use = `${totalStats.use}`;

        // Geçici sum ve count alanlarını sil
        delete totalStats.ratingSum;
        delete totalStats.ratingCount;
        delete totalStats.acsSum;
        delete totalStats.acsCount;
        delete totalStats.kdSum;
        delete totalStats.kdCount;
        delete totalStats.adrSum;
        delete totalStats.adrCount;
        delete totalStats.kastSum;
        delete totalStats.kastCount;
        delete totalStats.kprSum;
        delete totalStats.kprCount;
        delete totalStats.aprSum;
        delete totalStats.aprCount;
        delete totalStats.fkprSum;
        delete totalStats.fkprCount;
        delete totalStats.fdprSum;
        delete totalStats.fdprCount;

        // Total stats'i listenin başına ekle
        playerDetails.agentStats.unshift(totalStats);
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

      matches.push({
        teams: {
          team1: { 
            name: team1Name, 
            score: team1Score 
          },
          team2: { 
            name: team2Name, 
            score: team2Score 
          }
        },
        event: event,
        stage: stage,
        date: date,
        status: status,
        eta: eta,
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

      matches.push({
        teams: {
          team1: { 
            name: team1Name, 
            score: team1Score 
          },
          team2: { 
            name: team2Name, 
            score: team2Score 
          }
        },
        event: event,
        stage: stage,
        date: date,
        status: status,
        eta: eta,
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
  if (!region || !getTeams.regionSupported(region)) {
    return res.status(400).json({ error: 'Geçersiz veya eksik region parametresi', supported: getTeams.supportedRegions() });
  }
  try {
    const teams = await withCache(`teams_${region}`, () => getTeams(region))();
    res.json({ region, total: teams.length, teams });
  } catch (error) {
    handleHttpError(res, error, 'Failed to fetch teams');
  }
});

app.get('/api/teams/:id', async (req, res) => {
  const teamId = req.params.id;
  try {
    const teamProfile = await getTeams.profile(teamId);
    if (!teamProfile) return res.status(404).json({ error: 'Takım bulunamadı' });
    res.json(teamProfile);
  } catch (error) {
    handleHttpError(res, error, 'Failed to fetch team profile');
  }
});

app.get('/api/teams/:id/maps-stats', async (req, res) => {
  try {
    const last = req.query.last ? parseInt(req.query.last) : undefined;
    const stats = await getTeams.mapStats(req.params.id, last);
    res.json(stats);
  } catch (err) {
    handleHttpError(res, err, 'Failed to fetch team map stats');
  }
});

app.get('/api/teams/:id/agents-stats', async (req, res) => {
  try {
    const stats = await getTeams.agentStats(req.params.id);
    res.json(stats);
  } catch (err) {
    handleHttpError(res, err, 'Failed to fetch team agent stats');
  }
});

app.get('/api/teams/:id/roster-stability', async (req, res) => {
  try {
    const stability = await calculateRosterStability(req.params.id);
    res.json(stability);
  } catch (err) {
    console.error(`[ERROR] Roster stability calculation failed:`, err);
    const errorMessage = err.message || 'Failed to calculate roster stability';
    res.status(500).json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

// Health check endpoint
app.get('/api/health', withCache('health', async (req, res) => {
  const results = {
    api: {
      status: 'ok',
      version: '1.0.0',
      timestamp: new Date().toISOString()
    },
    endpoints: {},
    services: {},
    database: {
      status: 'ok',
      cache: 'ok'
    }
  };

  try {
    // Events endpoint kontrolü
    try {
      const events = await getEvents();
      results.endpoints.events = { 
        status: 'ok', 
        count: Array.isArray(events) ? events.length : 0,
        lastChecked: new Date().toISOString()
      };
    } catch (e) {
      results.endpoints.events = { 
        status: 'fail',
        error: e.message,
        lastChecked: new Date().toISOString()
      };
    }

    // Teams endpoint kontrolü
    try {
      const teams = await getTeams('europe');
      results.endpoints.teams = { 
        status: 'ok', 
        count: Array.isArray(teams) ? teams.length : 0,
        lastChecked: new Date().toISOString()
      };
    } catch (e) {
      results.endpoints.teams = { 
        status: 'fail',
        error: e.message,
        lastChecked: new Date().toISOString()
      };
    }

    // Team Profile endpoint kontrolü
    try {
      const profile = await getTeams.profile('1001');
      results.endpoints.teamProfile = { 
        status: profile ? 'ok' : 'fail',
        lastChecked: new Date().toISOString()
      };
    } catch (e) {
      results.endpoints.teamProfile = { 
        status: 'fail',
        error: e.message,
        lastChecked: new Date().toISOString()
      };
    }

    // Team Map Stats endpoint kontrolü
    try {
      const mapStats = await getTeams.mapStats('1001');
      results.endpoints.teamMapStats = { 
        status: Array.isArray(mapStats) ? 'ok' : 'fail',
        lastChecked: new Date().toISOString()
      };
    } catch (e) {
      results.endpoints.teamMapStats = { 
        status: 'fail',
        error: e.message,
        lastChecked: new Date().toISOString()
      };
    }

    // Team Agent Stats endpoint kontrolü
    try {
      const agentStats = await getTeams.agentStats('1001');
      results.endpoints.teamAgentStats = { 
        status: Array.isArray(agentStats) ? 'ok' : 'fail',
        lastChecked: new Date().toISOString()
      };
    } catch (e) {
      results.endpoints.teamAgentStats = { 
        status: 'fail',
        error: e.message,
        lastChecked: new Date().toISOString()
      };
    }

    // Completed Matches endpoint kontrolü
    try {
      const response = await http.get('https://www.vlr.gg/matches/results');
      const $ = cheerio.load(response.data);
      const matchItems = $('.match-item');
      results.endpoints.completedMatches = { 
        status: matchItems.length > 0 ? 'ok' : 'fail',
        count: matchItems.length,
        lastChecked: new Date().toISOString()
      };
    } catch (e) {
      results.endpoints.completedMatches = { 
        status: 'fail',
        error: e.message,
        lastChecked: new Date().toISOString()
      };
    }

    // Match Details endpoint kontrolü
    try {
      const match = await getMatchDetails('484663');
      results.endpoints.matchDetails = { 
        status: match ? 'ok' : 'fail',
        lastChecked: new Date().toISOString()
      };
    } catch (e) {
      results.endpoints.matchDetails = { 
        status: 'fail',
        error: e.message,
        lastChecked: new Date().toISOString()
      };
    }

    // Live Matches endpoint kontrolü
    try {
      const response = await http.get('https://www.vlr.gg/matches');
      const $ = cheerio.load(response.data);
      const liveMatches = $('.match-item').filter((i, el) => 
        $(el).find('.ml-status').text().toLowerCase() === 'live'
      );
      results.endpoints.liveMatches = { 
        status: 'ok',
        count: liveMatches.length,
        lastChecked: new Date().toISOString()
      };
    } catch (e) {
      results.endpoints.liveMatches = { 
        status: 'fail',
        error: e.message,
        lastChecked: new Date().toISOString()
      };
    }

    // Search endpoint kontrolü
    try {
      const searchResult = await searchPlayersAndTeams('test');
      results.endpoints.search = { 
        status: 'ok',
        lastChecked: new Date().toISOString()
      };
    } catch (e) {
      results.endpoints.search = { 
        status: 'fail',
        error: e.message,
        lastChecked: new Date().toISOString()
      };
    }

    // Player Advanced Stats endpoint kontrolü
    try {
      const playerStats = await getPlayerAdvancedStats('1001', 5);
      results.endpoints.playerAdvancedStats = { 
        status: 'ok',
        lastChecked: new Date().toISOString()
      };
    } catch (e) {
      results.endpoints.playerAdvancedStats = { 
        status: 'fail',
        error: e.message,
        lastChecked: new Date().toISOString()
      };
    }

    // Cache kontrolü
    results.services.cache = {
      status: 'ok',
      type: 'memory',
      ttl: '60 seconds'
    };

    // Genel API durumu
    const allEndpointsStatus = Object.values(results.endpoints).every(endpoint => endpoint.status === 'ok');
    results.api.status = allEndpointsStatus ? 'ok' : 'degraded';

    res.json(results);
  } catch (err) {
    results.api.status = 'fail';
    results.api.error = err.message;
    res.status(500).json(results);
  }
}, 60));

// Search endpoint
app.get('/api/search', async (req, res) => {
  const q = req.query.q;
  if (!q) return res.status(400).json({ error: 'Eksik arama parametresi (q)' });
  try {
    const result = await searchPlayersAndTeams(q);
    res.json(result);
  } catch (err) {
    handleHttpError(res, err, 'Arama başarısız');
  }
});

// Oyuncu gelişmiş istatistikleri endpoint
app.get('/api/players/:id/advanced-stats', async (req, res) => {
  const playerId = req.params.id;
  try {
    console.log('[DEBUG] getPlayerAdvancedStats FONKSİYONU ÇALIŞTI');
    const last = req.query.last ? parseInt(req.query.last) : 5;
    const result = await getPlayerAdvancedStats(playerId, last);
    res.json(result);
  } catch (error) {
    console.error(`[ERROR][getPlayerAdvancedStats] playerId=${playerId}:`, error);
    res.status(500).json({ error: 'Failed to fetch advanced stats' });
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