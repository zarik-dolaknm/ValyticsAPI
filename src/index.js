const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const rateLimit = require('express-rate-limit');
const axiosRateLimit = require('axios-rate-limit');
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

// Ana endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'VLR.gg API is running',
    endpoints: {
      matches: '/api/matches',
      matchDetails: '/api/matches/:id',
      eventMatches: '/api/events/:eventId/matches',
      completedMatches: '/api/matches/completed'
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

// Maç detaylarını getiren endpoint
app.get('/api/matches/:id', async (req, res) => {
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
      eventPlacements: [],
      totalWinnings: $('.wf-module-label:contains("Total Winnings")').next('span').text().trim() || 'N/A'
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

    // Etkinlik Dereceleri
    const eventPlacementsContainer = $('.wf-card.mod-event-placements');
    if (eventPlacementsContainer.length > 0) {
         if (DEBUG) console.log("Event placements container found.");
        eventPlacementsContainer.find('.ranking-item').each((i, placementElement) => {
            const eventName = $(placementElement).find('.event-name').text().trim();
            const placement = $(placementElement).find('.placement').text().trim();
            const teamName = $(placementElement).find('.team-name').text().trim();
            const year = $(placementElement).find('.event-year').text().trim();
            const prize = $(placementElement).find('.prize').text().trim();

            if (eventName && placement) {
                playerDetails.eventPlacements.push({
                    eventName: eventName,
                    placement: placement,
                    team: teamName,
                    year: year,
                    prize: prize
                });
            }
        });
    } else {
         if (DEBUG) console.log("Event placements container not found.");
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

    res.json(playerDetails);

  } catch (error) {
    console.error(`Error fetching player details for ${playerId}:`, error);
    res.status(500).json({ error: 'Failed to fetch player details' });
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