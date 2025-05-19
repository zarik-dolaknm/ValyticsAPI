# VLR.gg API

Bu proje, VLR.gg sitesinden web scraping yaparak maç verilerini ve detaylarını sunan bir REST API'dir.

## Özellikler

- VLR.gg üzerinden maç verilerini çekme
- Tamamlanmış maçları listeleme
- Belirli bir maçın detaylarını getirme
- Belirli bir etkinliğin maçlarını listeleme
- Rate limiting ile siteye aşırı yüklenmeyi önleme

## Kurulum

1.  Projeyi klonlayın:
    ```bash
    git clone <repo-url>
    cd vlr-api
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
      "message": "VLR.gg API is running",
      "endpoints": {
        "matches": "/api/matches", // Not: Bu endpoint henüz implemente edilmedi.
        "matchDetails": "/api/matches/:id",
        "eventMatches": "/api/events/:eventId/matches",
        "completedMatches": "/api/matches/completed"
      }
    }
    ```

### Tamamlanmış Maçları Getirme

-   `GET /api/matches/completed`
    -   VLR.gg sonuçlar sayfasından tamamlanmış maçların özet bir listesini döndürür. Her maç için sadece temel bilgiler (takım isimleri, skorlar, event, tarih, url) yer alır. Oyuncu istatistikleri ve maç içi detaylar bu endpointte bulunmaz.

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
        -   `id` (gerekli): VLR.gg maç ID'si (Örnek: 459829).

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
        -   `eventId` (gerekli): VLR.gg etkinlik ID'si.

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
    -   VLR.gg etkinlikler sayfasından güncel etkinliklerin bir listesini döndürür.

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
        -   `id` (gerekli): VLR.gg oyuncu ID'si (Örnek: 312).

    -   **Query Parametreleri:**
        -   `timespan` (isteğe bağlı): İstatistiklerin çekileceği zaman dilimi. Alabileceği değerler: `30d`, `60d`, `90d`, `all`. Belirtilmezse varsayılan değer kullanılır (VLR.gg'nin varsayılanı).

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
        -   `id` (gerekli): VLR.gg takım ID'si (Örnek: 474).
    -   **Örnek Kullanım:** `/api/teams/474/maps-stats`
    -   **Dönen Veri Yapısı:**
        ```json
        [
          {
            "map": "Breeze",
            "played": 23,
            "winrate": "78%",
            "wins": "18",
            "losses": "5",
            "atkFirst": "5",
            "defFirst": "18",
            "atkRWin": "58%",
            "atkRW": "138",
            "atkRL": "98",
            "defRWin": "54%",
            "defRW": "147",
            "defRL": "126",
            "comps": [
              {
                "hash": "2b2e5b43d9fd",
                "times": 2,
                "agents": ["cypher", "kayo", "sova", "viper", "yoru"]
              },
              {
                "hash": "389a15009875",
                "times": 2,
                "agents": ["chamber", "jett", "kayo", "sova", "viper"]
              }
              // ... diğer comp'lar ...
            ]
          }
          // ... diğer mapler ...
        ]
        ```

### Etkinliğin Harita ve Ajan İstatistiklerini Getirme

-   `GET /api/events/:eventId/agents-stats`
    -   Belirli bir etkinliğin harita ve ajan istatistiklerini döndürür.
    -   **URL Parametreleri:**
        -   `eventId` (gerekli): VLR.gg etkinlik ID'si.
    -   **Örnek Kullanım:** `/api/events/1188/agents-stats`
    -   **Dönen Veri Yapısı:**
        ```json
        [
          {
            "map": "Split",
            "played": 20,
            "attackWinrate": "47%",
            "defenseWinrate": "53%",
            "agents": [
              { "agent": "Omen", "pickrate": "68%" },
              { "agent": "Tejo", "pickrate": "38%" }
            ]
          }
          // ... diğer mapler ...
        ]
        ```

## Kullanılan Teknolojiler

-   Node.js
-   Express.js
-   Axios (rate limiting için axios-rate-limit ile)
-   Cheerio
-   CORS
-   dotenv

## Notlar

-   Web scraping, kaynak sitenin HTML yapısındaki değişikliklerden etkilenebilir. VLR.gg'nin yapısı değiştiğinde API'nin çalışması bozulabilir ve selector'lerin güncellenmesi gerekebilir.
-   Rate limiting, VLR.gg sunucularına aşırı yüklenmeyi önlemek için uygulanmıştır. Çok hızlı ardışık istekler rate limitine takılabilir.
- `/api/matches` endpointi şu anda implemente edilmemiştir.

## Katkıda Bulunma

Katkıda bulunmak isterseniz, lütfen pull request göndermekten çekinmeyin.

## Lisans

Bu proje MIT lisansı ile lisanslanmıştır. Detaylar için [LICENSE](./LICENSE) dosyasına bakabilirsiniz.

## Swagger / OpenAPI Desteği

API'nin tüm endpoint ve parametrelerini interaktif olarak incelemek ve test etmek için Swagger arayüzünü kullanabilirsiniz.

- Swagger UI'ya erişmek için sunucuyu başlattıktan sonra şu adresi ziyaret edin:

  [http://localhost:4000/api-docs](http://localhost:4000/api-docs)

Swagger/OpenAPI dokümantasyonu otomatik olarak güncellenir. Buradan endpoint'leri deneyebilir, parametreleri görebilir ve örnek istekler oluşturabilirsiniz. 