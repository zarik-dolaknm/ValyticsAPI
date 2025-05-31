# Valytics API

Bu proje, maç verilerini ve detaylarını sunan bir REST API'dir.

Geçici olarak projenin deploy edildiği yer: https://valyticsapi-production.up.railway.app/

## Özellikler


- Tamamlanmış maçları listeleme
- Belirli bir maçın detaylarını getirme
- Belirli bir etkinliğin maçlarını listeleme
- Rate limiting ile siteye aşırı yüklenmeyi önleme

## Kurulum

1.  Projeyi klonlayın:
    ```bash
    git clone https://github.com/zarik-dolaknm/ValyticsAPI
    cd ValyticsAPI
    ```
2.  Bağımlılıkları yükleyin:
    ```bash
    npm install
    ```
3.  `.env` dosyası oluşturun ve gerekli portu ayarlayın:
    ```dotenv
    PORT=4000
    ```
4.  Uygulamayı başlatın:
    ```bash
    # Geliştirme modu (nodemon ile otomatik yeniden başlatma)
    npm run dev

    # Prodüksiyon modu
    npm start
    ```

## API Endpoints

API, `${HOST}:${PORT}` adresinde çalışır. Örneğin, yerel makinenizde varsayılan port ile çalışıyorsa `http://localhost:4000`.

### Ana Endpoint

-   `GET /`
    -   API'nin çalıştığını belirten bir mesaj ve mevcut endpoint listesini döndürür.

    ```json
    {
      "message": "Valytics API is running",
      "endpoints": {
        "matchDetails": "/api/matches/:id",
        "eventMatches": "/api/events/:eventId/matches",
        "completedMatches": "/api/matches/completed"
      }
    }
    ```

### Tamamlanmış Maçları Getirme

-   `GET /api/matches/completed`
    -   Maçların özet bir listesini döndürür. Her maç için sadece temel bilgiler (takım isimleri, skorlar, event, tarih, url) yer alır. Oyuncu istatistikleri ve maç içi detaylar bu endpointte bulunmaz.

    -   **Query Parametreleri:**
        -   `limit` (isteğe bağlı): Döndürülecek maksimum maç sayısı. Varsayılan: 10.

    -   **Örnek Kullanım:** `/api/matches/completed?limit=5`

    -   **Dönen Veri Yapısı:**
        ```json
        {
          "total": 10, // Toplam dönen maç sayısı
          "limit": 10, // İstenen limit
          "matches": [ // Maç özetleri dizisi
            {
              "id": "488009",
              "teams": {
                "team1": { "name": "100 Thieves", "score": "2" },
                "team2": { "name": "Cloud9", "score": "0" }
              },
              "event": "Americas Qualifier–Upper Final Esports World Cup 2025",
              "date": "4:00 AM",
              "url": "https://www.vlr.gg/488009/100-thieves-vs-cloud9-esports-world-cup-2025-ubf"
            }
            // ... diğer maçlar ...
          ]
        }
        ```

### Belirli Bir Maçın Detaylarını Getirme

-   `GET /api/matches/:id`
    -   Belirli bir maç ID'sine ait detaylı bilgileri döndürür.

    -   **URL Parametreleri:**
        -   `id` (gerekli): Maç ID'si (Örnek: 459829).

    -   **Örnek Kullanım:** `/api/matches/459829`

    -   **Dönen Veri Yapısı:**
        ```json
        {
          "id": "459829",
          "teams": {
            "team1": {
              "name": "FUT Esports",
              "score": "2"
            },
            "team2": {
              "name": "Movistar KOI",
              "score": "0"
            }
          },
          "status": "completed",
          "event": {
            "name": "Champions Tour 2025: EMEA Stage 1",
            "series": "Group Stage: Week 1"
          },
          "date": "Thursday, March 27th 10:15 PM +03 Patch 10.05",
          "maps": [
            {
              "name": "Pearl",
              "score": "13 4",
              "duration": "52:39",
              "players": [ // Oyuncu istatistikleri dizisi (her map için)
                {
                  "team": "FUT",
                  "name": "xeus",
                  "agent": "Yoru", // Agent adı (img alt text)
                  "acs": "2.08",
                  "kills": "24",
                  "deaths": "7",
                  "assists": "6",
                  "kast": "88%",
                  "adr": "238",
                  "hs": "46%",
                  "fk": "3",
                  "fd": "1",
                  "plusMinus": "+17",
                  "fkFd": "+2",
                  "clutch": "N/A", // Veri çekilemediyse
                  "roundStats": { // Round bazlı istatistikler
                    "attack": { /* ... attack stats ... */ },
                    "defense": { /* ... defense stats ... */ }
                  }
                }
                // ... diğer oyuncular ...
              ]
            }
            // ... diğer mapler ...
          ],
          "additionalInfo": {
            "patch": "",
            "vod": "https://www.youtube.com/watch?v=example", // VOD linki
            "streams": [ // Stream linkleri dizisi
              "https://www.twitch.tv/valorant_emea",
              // ... diğer streamler ...
            ]
          }
        }
        ```

### Belirli Bir Etkinliğin Maçlarını Getirme

-   `GET /api/events/:eventId/matches`
    -   Belirli bir etkinlik ID'sine ait maçların listesini döndürür.

    -   **URL Parametreleri:**
        -   `eventId` (gerekli): Etkinlik ID'si.

    -   **Örnek Kullanım:** `/api/events/1188/matches`

    -   **Query Parametreleri:**
        -   `limit` (isteğe bağlı): Döndürülecek maksimum maç sayısı. Varsayılan: 20.

    -   **Dönen Veri Yapısı:**
        ```json
        {
          "eventId": "1188",
          "total": 50, // Toplam dönen maç sayısı
          "limit": 20, // İstenen limit
          "matches": [ // Maç listesi dizisi
            {
              "id": "459830", // Maç ID
              "time": "3:15 PM EDT",
              "team1": {
                "name": "FUT Esports",
                "score": "2"
              },
              "team2": {
                "name": "Movistar KOI",
                "score": "0"
              },
              "status": "completed",
              "stage": "Group Stage: Week 1",
              "event": "Champions Tour 2025: EMEA Stage 1",
              "links": { // İstatistik ve VOD linklerinin durumu
                "stats": {
                  "map": true,
                  "player": true
                },
                "vod": true
              },
              "url": "https://www.vlr.gg/459830" // Maçın VLR.gg URL'si
            }
            // ... diğer maçlar ...
          ]
        }
        ```

### Etkinlik Listesini Getirme

-   `GET /api/events`
    -   Güncel etkinliklerin bir listesini döndürür.

    -   **Query Parametreleri:**
        -   Şu anda yok. Gelecekte filtreleme veya sıralama eklenebilir.

    -   **Örnek Kullanım:** `/api/events`

    -   **Dönen Veri Yapısı:**
        ```json
        [\n          {\n            "id": "2453",\n            "name": "Game Changers 2025 South Asia: Split 1",\n            "status": "completed",\n            "prizePool": "$3,665",\n            "dates": "May 4—17",\n            "region": "UN",\n            "url": "https://www.vlr.gg/event/2453/game-changers-2025-south-asia-split-1"\n          }\n          // ... diğer etkinlikler ...\n        ]
        ```

### Belirli Bir Oyuncunun Detaylarını Getirme

-   `GET /api/players/:id`
    -   Belirli bir oyuncu ID'sine ait detaylı bilgileri (istatistikler, takımlar, dereceler vb.) döndürür.

    -   **URL Parametreleri:**
        -   `id` (gerekli): Oyuncu ID'si (Örnek: 312).

    -   **Query Parametreleri:**
        -   `timespan` (isteğe bağlı): İstatistiklerin çekileceği zaman dilimi. Alabileceği değerler: `30d`, `60d`, `90d`, `all`. Belirtilmezse varsayılan değer kullanılır.

    -   **Örnek Kullanım:**
        -   `/api/players/312` (Varsayılan zaman dilimi)
        -   `/api/players/312?timespan=90d` (Son 90 gün istatistikleri)

    -   **Dönen Veri Yapısı:**
        ```json
        {
          "id": "312",
          "name": "Sayf",
          "realName": "Saif Jibraeel",
          "tag": "@DSajoof",
          "country": "SE",
          "url": "https://www.vlr.gg/player/312/sayf/",
          "agentStats": [
            {
              "agent": "Tejo",
              "use": "(10) 48%",
              // ... diğer agent istatistikleri ...
            }
            // ... diğer agentlar ...
          ],
          "recentResults": [
            {
              "eventName": "EWC 2025 EMEA Qualifier",
              "matchId": "12345",
              // ... diğer maç bilgileri ...
            }
            // ... diğer sonuçlar ...
          ],
          "currentTeams": [
            {
              "name": "Team Vitality",
              "joinDate": "joined in September 2023"
            }
          ],
          "pastTeams": [
            {
              "name": "Team Liquid",
              "dates": "November 2022 – September 2023"
            }
            // ... diğer eski takımlar ...
          ],
          "eventPlacements": [
            {
              "eventName": "Champions Tour 2025: EMEA Stage 1",
              "placement": "7th–8th",
              // ... diğer derece bilgileri ...
            }
            // ... diğer dereceler ...
          ],
          "totalWinnings": "$92,345"
        }
        ```

### Oyuncu Gelişmiş İstatistikleri (Advanced Stats)

-   `GET /api/players/:id/advanced-stats`
    -   Belirli bir oyuncunun son X maçtaki gelişmiş istatistiklerini ve harita bazlı breakdown'larını döndürür.
    -   **URL Parametreleri:**
        -   `id` (gerekli): Oyuncu ID'si
    -   **Query Parametreleri:**
        -   `last` (isteğe bağlı): Son kaç maç alınacak (varsayılan: 5)
    -   **Dönen Veri Yapısı:**
        ```json
        {
          "playerId": "5568",
          "matchCount": 7,
          "total": {
            "2K": 46,
            "3K": 9,
            "4K": 3,
            "5K": 1,
            "1v1": 2,
            "1v2": 2,
            "1v3": 1,
            "1v4": 0,
            "1v5": 0,
            "ECON": 313,
            "PL": 19,
            "DE": 7
          },
          "average": {
            "2K": "6.57",
            "3K": "1.29",
            "4K": "0.43",
            "5K": "0.14",
            "1v1": "0.29",
            "1v2": "0.29",
            "1v3": "0.14",
            "1v4": "0.00",
            "1v5": "0.00",
            "ECON": "44.71",
            "PL": "2.71",
            "DE": "1.00",
            "opKills": "0.86",
            "opDeaths": "1.14",
            "fk": "7.71",
            "fd": "6.00"
          },
          "summary": {
            "opKills": 6,
            "opDeaths": 8,
            "fk": 54,
            "fd": 42
          },
          "maps": [
            {
              "map": "Haven",
              "matrixStats": { ... },
              "advancedStats": { ... }
            },
            {
              "map": "Split",
              "matrixStats": { ... },
              "advancedStats": { ... }
            }
            // ... diğer gerçek haritalar ...
          ]
        }
        ```
    -   **Açıklama:**
        -   "maps" dizisinde sadece gerçek haritalar yer alır, "All Maps" yoktur.
        -   "total" ve "average" alanları sadece gerçek haritaların toplamı ve ortalamasıdır.
        -   "summary" ve "average" alanlarında opKills, opDeaths, fk, fd gibi özetler de bulunur.
        -   Her harita için matrixStats ve advancedStats detayları döner.

### Yaklaşan Maçları Getirme

-   `GET /api/matches/upcoming`
    -   Sadece status'u "Upcoming" olan yaklaşan maçları döndürür.
    -   **Dönen Veri Yapısı:**
        ```json
        {
          "total": 2,
          "matches": [
            {
              "id": "484663",
              "teams": {
                "team1": { "name": "Velocity Gaming", "score": "–" },
                "team2": { "name": "Reckoning Esports", "score": "–" }
              },
              "event": "Challengers League 2025 South Asia: Split 2",
              "stage": "Main Event–Upper Semifinals",
              "date": "12:30 PM",
              "status": "Upcoming",
              "eta": "50m",
              "icon": "https://owcdn.net/img/6009f963577f4.png",
              "url": "https://www.vlr.gg/484663/velocity-gaming-vs-reckoning-esports-challengers-league-2025-south-asia-split-2-ubsf"
            }
            // ... diğer upcoming maçlar ...
          ]
        }
        ```

### Canlı Maçları Getirme

-   `GET /api/matches/live`
    -   Sadece status'u "LIVE" olan şu anda oynanan maçları döndürür.
    -   **Dönen Veri Yapısı:**
        ```json
        {
          "total": 1,
          "matches": [
            {
              "id": "484641",
              "teams": {
                "team1": { "name": "DRX Academy", "score": "0" },
                "team2": { "name": "Gen.G Global Academy", "score": "0" }
              },
              "event": "WDG Challengers League 2025 Korea: Stage 2",
              "stage": "Playoffs–Upper Round 1",
              "date": "11:00 AM",
              "status": "LIVE",
              "eta": "",
              "icon": "https://owcdn.net/img/6009f963577f4.png",
              "url": "https://www.vlr.gg/484641/drx-academy-vs-gen-g-global-academy-wdg-challengers-league-2025-korea-stage-2-ur1"
            }
            // ... diğer canlı maçlar ...
          ]
        }
        ```

### Takımın Harita İstatistiklerini ve Comp'larını Getirme

-   `GET /api/teams/:id/maps-stats`
    -   Belirli bir takımın harita istatistiklerini ve oynanan agent comp'larını (ajan dizilimleri) döndürür.
    -   **URL Parametreleri:**
        -   `id` (gerekli): Takım ID'si (Örnek: 474).
    -   **Query Parametreleri:**
        -   `last` (isteğe bağlı): Son X maç bazında istatistik (örn. last=10 ile son 10 maç). Belirtilmezse tüm zamanlar alınır.
    -   **Örnek Kullanım:** `/api/teams/474/maps-stats?last=10`
    -   **Dönen Veri Yapısı:**
        ```json
        [
          {
            "map": "Breeze",
            "played": 5,
            "winrate": "80%",
            "wins": 4,
            "losses": 1,
            "atkFirst": null,
            "defFirst": null,
            "atkRWin": null,
            "atkRW": null,
            "atkRL": null,
            "defRWin": null,
            "defRW": null,
            "defRL": null,
            "comps": []
          }
          // ... diğer mapler ...
        ]
        ```
    -   **Açıklama:**
        -   `last` parametresi ile sadece son X maçtaki harita istatistikleri döner.
        -   `comps` alanı son X maçta dolu olmayabilir (sadece özetten çekilebilen comp'lar gösterilir).
        -   Parametre verilmezse tüm zamanların istatistikleri döner.

### Takım Profili ve Dikkat Çekici İstatistikler

-   `GET /api/teams/:id`
    -   Belirli bir takımın profilini, kadrosunu, staff bilgisini, toplam kazancını, son maçlarını ve dikkat çekici istatistiklerini döndürür.
    -   **Dönen Veri Yapısı:**
        ```json
        {
          "id": "2593",
          "name": "FNATIC",
          "tag": "FNC",
          "logo": "https://owcdn.net/img/62a40cc2b5e29.png",
          "region": "Europe",
          "socials": {
            "website": "https://fnatic.com",
            "twitter": "@FNATIC"
          },
          "roster": [
            { "id": "123", "name": "Boaster", "realName": "Jake Howlett", "role": "player" },
            { "id": "124", "name": "crashies", "realName": "Austin Roberts", "role": "player" }
          ],
          "staff": [
            { "name": "CoJo", "realName": "", "role": "manager" }
          ],
          "totalWinnings": "$1,417,285",
          "recentMatches": [
            { "event": "VCT 25: EMEA Stage 1 Playoffs", "opponent": "Team Heretics", "score": "3 : 0", "date": "2025/05/18" }
          ],
          "stats": {
            "totalMatches": 120,
            "totalWins": 80,
            "totalLosses": 40,
            "winrate": "66.7%",
            "last10": { "wins": 7, "losses": 3 },
            "mostPlayedMap": "Ascent",
            "bestMap": "Bind",
            "worstMap": "Icebox",
            "last10MostPlayedMap": "Lotus",
            "last10BestMap": "Bind",
            "last10WorstMap": "Split"
          }
        }
        ```
    -   **Açıklama:**
        -   `stats` objesi takımın dikkat çekici istatistiklerini içerir:
            -   `totalMatches`: Toplam oynanan maç
            -   `totalWins`: Toplam galibiyet
            -   `totalLosses`: Toplam mağlubiyet
            -   `winrate`: Genel kazanma oranı
            -   `last10`: Son 10 maçta galibiyet/mağlubiyet
            -   `mostPlayedMap`: En çok oynanan harita (tüm zamanlar)
            -   `bestMap`: En yüksek winrate'e sahip harita (tüm zamanlar, en az 5 maç)
            -   `worstMap`: En düşük winrate'e sahip harita (tüm zamanlar, en az 5 maç)
            -   `last10MostPlayedMap`: Son 10 maçta en çok oynanan harita
            -   `last10BestMap`: Son 10 maçta en yüksek winrate'e sahip harita (en az 2 maç)
            -   `last10WorstMap`: Son 10 maçta en düşük winrate'e sahip harita (en az 2 maç)

### Takımın Kadro Stabilitesini Getirme

-   `GET /api/teams/:id/roster-stability`
    -   Belirli bir takımın kadro stabilitesini hesaplar ve döndürür.
    -   **URL Parametreleri:**
        -   `id` (gerekli): Takım ID'si (Örnek: 474).
    -   **Dönen Veri Yapısı:**
        ```json
        {
          "teamId": "474",
          "teamName": "Team Name",
          "currentRoster": ["123", "124", "125", "126", "127"],
          "rosterChanges": 3,
          "maxPossibleChanges": 20,
          "stabilityScore": "0.85"
        }
        ```
    -   **Açıklama:**
        -   `currentRoster`: Mevcut kadrodaki oyuncu ID'leri
        -   `rosterChanges`: Toplam kadro değişikliği sayısı (yeni gelen + ayrılan oyuncular)
        -   `maxPossibleChanges`: Maksimum olası değişiklik sayısı (maç sayısı × 5)
        -   `stabilityScore`: Kadro stabilite skoru (1 - (rosterChanges / maxPossibleChanges))
            -   1'e yakın değerler daha stabil kadroyu gösterir
            -   0'a yakın değerler daha fazla değişiklik olduğunu gösterir

### API Sağlık Kontrolü (Health Check)

-   `GET /api/health`
    -   API'nin ana fonksiyonlarının (events, teams, team profile, maps-stats, agents-stats, completed matches, match details) düzgün çalışıp çalışmadığını topluca kontrol eder.
    -   **Dönen Veri Yapısı:**
        ```json
        {
          "status": "ok",
          "results": {
            "events": { "status": "ok", "count": 20 },
            "teams": { "status": "ok", "count": 30 },
            "teamProfile": { "status": "ok" },
            "teamMapStats": { "status": "ok" },
            "teamAgentStats": { "status": "ok" },
            "completedMatches": { "status": "ok" },
            "matchDetails": { "status": "ok" }
          }
        }
        ```

### Oyuncu ve Takım Arama

-   `GET /api/search?q=arama`
    -   Arama metnine göre hem oyuncu hem de takım araması yapar. Sonuçlar iki ayrı dizi olarak döner.
    -   **Query Parametreleri:**
        -   `q` (gerekli): Aranacak metin
    -   **Dönen Veri Yapısı:**
        ```json
        {
          "players": [
            {
              "id": "3269",
              "name": "Antidote",
              "realName": "Sabyasachi Bose",
              "logo": "https://owcdn.net/img/67cfba3fbd644.png",
              "url": "https://www.vlr.gg/player/3269/antidote"
            }
          ],
          "teams": [
            {
              "id": "11496",
              "name": "ALTERNATE aTTaX Ruby",
              "logo": "https://owcdn.net/img/62a1d1c3e765e.png",
              "url": "https://www.vlr.gg/team/11496/alternate-attax-ruby"
            }
          ]
        }
        ```
    -   **Açıklama:**
        -   `players`: Sadece oyuncular (href /player/ ile başlar)
        -   `teams`: Sadece takımlar (href /team/ ile başlar)

## Kullanılan Teknolojiler

-   Node.js
-   Express.js
-   Axios (rate limiting için axios-rate-limit ile)
-   Cheerio
-   CORS
-   dotenv

## Notlar

-   Rate limiting, sunuculara aşırı yüklenmeyi önlemek için uygulanmıştır. Çok hızlı ardışık istekler rate limitine takılabilir.

## Katkıda Bulunma

Katkıda bulunmak isterseniz, lütfen pull request göndermekten çekinmeyin.

## Lisans

Bu proje MIT lisansı ile lisanslanmıştır. Detaylar için [LICENSE](./LICENSE) dosyasına bakabilirsiniz.

## Swagger / OpenAPI Desteği

API'nin tüm endpoint ve parametrelerini interaktif olarak incelemek ve test etmek için Swagger arayüzünü kullanabilirsiniz.

- Swagger UI'ya erişmek için sunucuyu başlattıktan sonra şu adresi ziyaret edin:

  [http://localhost:4000/api-docs](http://localhost:4000/api-docs)

Swagger/OpenAPI dokümantasyonu otomatik olarak güncellenir. Buradan endpoint'leri deneyebilir, parametreleri görebilir ve örnek istekler oluşturabilirsiniz. 