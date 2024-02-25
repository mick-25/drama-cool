require("dotenv").config();
const express = require("express");
const fetch = require("node-fetch");
const HTMLParser = require("node-html-parser");
const FormData = require("form-data");
const axios = require("axios");
const Cheerio = require("cheerio");

const {
  voe,
  upstream,
  mixdrop,
  doodstream,
  getDoc,
  sibnet,
  myvitop,
  sendVid,
  filelions,
} = require("./helper");
const { getUniqueListBy } = require("./utils");

const app = express();

// Function to search for movies
async function searchMovies(query) {
  const url = `https://flixhq.to/search/${encodeURIComponent(query)}`;
  const headers = {
    Origin: "https://flixhq.to",
    Referer: "https://flixhq.to/",
    "X-Requested-With": "XMLHttpRequest",
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36",
  };

  try {
    const html = await getDoc(url, url, headers);
    const parsedRes = HTMLParser.parse(html ?? "");
    const rawResults = parsedRes.querySelectorAll("ul.list-episode-item li a") ?? [];

    const results = rawResults.map((el) => {
      return {
        title: el?.querySelector("h3")?.textContent ?? "Unknown",
        url: el?.attributes["href"],
      };
    });

    const response = results.map((result) => ({
      id: `movie|${result.title.toLowerCase().replace(/\s+/g, '-')}-${result.url.split('-').pop()}`,
      type: "movie",
      name: result.title,
      poster: `https://img.flixhq.to/xxrz/250x400/379/17/5c/175c58ef507c3b92a77825d04569a3ed/175c58ef507c3b92a77825d04569a3ed.jpg`, // You may replace this with the actual poster URL
      genres: [], // Populate with actual genres if available
      releaseInfo: "", // Add release information if available
    }));

    return response;
  } catch (error) {
    console.error("Error searching movies:", error.message);
    return [];
  }
}

// Endpoint for searching movies
app.get("/search/:query.json", async (req, res) => {
  const { query } = req.params;

  if (!query) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const results = await searchMovies(query);

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.json({ metas: results });
});

function getSize(size) {
  var gb = 1024 * 1024 * 1024;
  var mb = 1024 * 1024;

  return (
    "💾 " +
    (size / gb > 1
      ? `${(size / gb).toFixed(2)} GB`
      : `${(size / mb).toFixed(2)} MB`)
  );
}

function getQuality(name) {
  if (!name) {
    return name;
  }
  name = name.toLowerCase();

  if (["2160", "4k", "uhd"].filter((x) => name.includes(x)).length > 0)
    return "🌟4k";
  if (["1080", "fhd"].filter((x) => name.includes(x)).length > 0)
    return " 🎥FHD";
  if (["720", "hd"].filter((x) => name.includes(x)).length > 0) return "📺HD";
  if (["480p", "380p", "sd"].filter((x) => name.includes(x)).length > 0)
    return "📱SD";
  return "";
}

let isVideo = (element) => {
  return (
    element["name"]?.toLowerCase()?.includes(`.mkv`) ||
    element["name"]?.toLowerCase()?.includes(`.mp4`) ||
    element["name"]?.toLowerCase()?.includes(`.avi`) ||
    element["name"]?.toLowerCase()?.includes(`.m3u`) ||
    element["name"]?.toLowerCase()?.includes(`.m3u8`) ||
    element["name"]?.toLowerCase()?.includes(`.flv`)
  );
};

let isRedirect = async (url) => {
  try {
    const controller = new AbortController();
    // 5 second timeout:
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      redirect: "manual",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.status === 301 || response.status === 302) {
      const locationURL = new URL(
        response.headers.get("location"),
        response.url
      );
      if (locationURL.href.startsWith("http")) {
        await isRedirect(locationURL.href);
      } else {
        return locationURL.href;
      }
    } else if (response.status >= 200 && response.status < 300) {
      return response.url;
    } else {
      return null;
    }
  } catch (error) {
    return null;
  }
};

let stream_results = [];
let torrent_results = [];

let fetchTorrent = async (query) => {
  let url = ``;
  return await fetch(url, {
    headers: {
      accept: "*/*",
    },
    referrerPolicy: "no-referrer",
    method: "GET",
  })
    .then((res) => res.json())
    .then(async (results) => {});
};

async function getMeta(id, type) {
  const [tt, s, e] = id.split(":");
  const query = type === "series" ? tt : `${tt} ${s} ${e}`;

  const shows = await getShowFromDCool(query, type);

  if (shows.length > 0) {
    return {
      name: shows[0].title,
      year: shows[0].year,
    };
  }

  return fetch(`https://v2.sg.media-imdb.com/suggestion/t/${tt}.json`)
    .then((res) => res.json())
    .then((json) => json.d[0])
    .then(({ l, y }) => ({ name: l, year: y }))
    .catch((err) =>
      fetch(`https://v3-cinemeta.strem.io/meta/${type}/${tt}.json`)
        .then((res) => res.json())
        .then((json) => ({
          name: json.meta["name"],
          year: json.meta["releaseInfo"]?.substring(0, 4) ?? "",
        }))
    );
}

async function getImdbFromKitsu(id) {
  var [kitsu, _id, e] = id.split(":");

  return fetch(`https://anime-kitsu.strem.fun/meta/anime/${kitsu}:${_id}.json`)
    .then((_res) => _res.json())
    .then((json) => {
      return json      ["meta"];
    })
    .then((json) => {
      try {
        let imdb = json["imdb_id"];
        let meta = json["videos"].find((el) => el.id == id);
        return [
          imdb,
          (meta["imdbSeason"] ?? 1).toString(),
          (meta["imdbEpisode"] ?? 1).toString(),
          (meta["season"] ?? 1).toString(),
          (meta["imdbSeason"] ?? 1).toString() == 1
            ? (meta["imdbEpisode"] ?? 1).toString()
            : (meta["episode"] ?? 1).toString(),
          meta["imdbEpisode"] != meta["episode"] || meta["imdbSeason"] == 1,
        ];
      } catch (error) {
        return null;
      }
    })
    .catch((err) => null);
}

let isSuitable = (resultname = "", name = "") => {
  let nameArray = name.split(" ");

  let check = true;
  nameArray.forEach((word) => {
    if (
      word.length >= 3 &&
      !["the", "a", "an", "to", "too"].includes(word.toLowerCase())
    ) {
      check = check && resultname?.toLowerCase().includes(word?.toLowerCase());
      if (!check) return check;
    }
  });
  return check;
};

async function getShowFromDCool(query = "", type = "") {
  let url = `https://flixhq.to/search?keyword=${query.toLowerCase()}&type=movies`;

  let headers = {
    Origin: "https://flixhq.to",
    Referer: "https://flixhq.to/",
    "X-Requested-With": "XMLHttpRequest",
    "User-Agent":
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36",
  };

  let html = await getDoc(url, url, headers);
  let parsedRes = HTMLParser.parse(html ?? "");

  let rawResults =
    parsedRes.querySelectorAll("ul.list-episode-item li a") ?? [];

  parsedRes = rawResults.map
    ((el) => {
      return {
        title: el?.querySelector("h3")?.textContent ?? "Unknown",
        url: el?.attributes["href"],
      };
    });

  let response_ = parsedRes.filter((el, i) => isSuitable(el["title"], query));

  return response_;
}

async function getSeasonAndEpsFromShow(show, s, e, type) {
  let title = show["title"];
  let url = show["url"] ?? "";

  let api = `https://kiss-ecru.vercel.app/movies/flixhq/info?id=${url}`;

  let headers = {
    Origin: "https://flixhq.to",
    Referer: "https://flixhq.to/",
    Cookie: "accepted_cookies=yes",
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36",
  };

  try {
    const response = await fetch(api, { headers });
    const data = await response.json();
    if (data.results && data.results.length > 0) {
      const result = data.results[0];

      if (result.type === "TV Series") {
        if (result.seasons && result.seasons.length > 0) {
          const seasons = result.seasons;

          for (const season of seasons) {
            if (season.episodes && season.episodes.length > 0) {
              const episodes = season.episodes;
            } else {
              console.error("No episodes found for Season", season.number);
            }
          }
        } else {
          console.error("No seasons found for", title);
        }
      } else if (result.type === "Movie") {
        // handle movie logic if needed
      } else {
        console.error("Invalid type:", result.type);
      }

      return result;
    } else {
      console.error("No results found for", title);
      return {};
    }
  } catch (error) {
    console.error("Error fetching data:", error.message);
    return {};
  }
}

async function getEps(server, ep, e) {
  console.log("Getting eps...");

  api = `${server}${ep["url"] ?? ""}/episodes.js`;
  console.log({ api });

  let headers = {
    Origin: "https://flixhq.to",
    Referer: "https://flixhq.to/",
    Accept: "application/json",
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36",
    "Content-Type": "application/json",
  };

  return fetch(api, {
    headers: headers,
  })
    .then((res) => res.text())
    .then(async (response) => {
      let html = response.split("\n").join("");
      let parsedRes = HTMLParser.parse(html).textContent;
      let regex = /\[\s*[\"\']([\w\W]*?)[\'\"],\s*\];/g;

      let doc2 = await getDoc(`${server}${ep["url"] ?? ""}`);
      let startEndRegex = /creerListe\((\d+),\s(\d*)\);/g;
      let matchResult = startEndRegex.exec(doc2);

      let start = 0;
      let end = 0;
      if (matchResult) {
        start = matchResult[1];
        end = matchResult[2];
      }

      let allEps = [];

      for (const eps of parsedRes.matchAll(regex)) {
        try {
          let _ = JSON.parse('["' + eps[1].replace(/\'/g, '"') + '"]');
          allEps.push(_);
        } catch (error) {}
      }

      let ep_ = {};
      if (start == 0 && end == 0) {
        ep_ = {
          title: `Episode ${e}`,
          url: allEps
            .reduce((cumul, curr) => {
              cumul.push(curr[e]);
              return cumul;
            }, [])
            .filter((el) => !!el),
        };
      } else if (e >= +start && e <= +end) {
        ep_ = {
          title: `Episode ${e} ${ep["url"].includes("/vf") ? " VF" : ""}`,
          url: allEps
            .reduce((cumul, curr) => {
              cumul.push(curr[e - start]);
              return cumul;
            }, [])
            .filter((el) => !!el),
        };
      } else {
        return null;
      }

      return ep_;
    })
    .catch((err) => {
      console.log({ err });
      return null;
    });
}

function cleanUrl(url = "") {
  if (url.startsWith("//")) {
    url = "https:" + url;
  }
  return url;
}

app.get("/manifest.json", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.json({
    name: "Stremio FlixHQ Addon",
    id: "community.flixhq",
    description: "Watch movies and series from FlixHQ",
    version: "1.0.0",
    resources: ["catalog", "meta", "stream"],
    types: ["movie", "series"],
    idPrefixes: ["flixhq"],
    catalogs: [
      {
        id: "flixhq",
        name: "FlixHQ",
        type: "movie",
        extra: [
          {
            name: "search",
            isRequired: false,
            isUnique: false,
          },
        ],
      },
    ],
  });
});

app.get("/catalog/flixhq/:type.json", async (req, res) => {
  const { type } = req.params;

  if (type !== "movie") {
    res.status(404).json({ error: "Invalid type" });
    return;
  }

  res.setHeader("Content-Type", "application/json");

  res.json({
    metas: [
      {
        id: "flixhq:recent",
        type: "flixhq",
        name: "Recent Movies",
        poster:
          "https://img.flixhq.to/xxrz/250x400/379/17/5c/175c58ef507c3b92a77825d04569a3ed/175c58ef507c3b92a77825d04569a3ed.jpg",
      },
    ],
  });
});

app.get("/catalog/:type/:id.json", async (req, res) => {
  const { type, id } = req.params;

  if (type !== "flixhq") {
    res.status(404).json({ error: "Invalid type" });
    return;
  }

  res.setHeader("Content-Type", "application/json");

  if (id === "recent") {
    const recentMovies = await searchMovies("recent");
    const metas = recentMovies.map((movie) => ({
      id: movie.id,
      type: "movie",
      name: movie.name,
      poster: movie.poster,
    }));

    res.json({ metas });
  } else {
    res.status(404).json({ error: "Invalid ID" });
  }
});

app.get("/meta/:type/:id.json", async (req, res) => {
  const { type, id } = req.params;

  if (type !== "movie" && type !== "series") {
    res.status(404).json({ error: "Invalid type" });
    return;
  }

  res.setHeader("Content-Type", "application/json");

  if (id.startsWith("flixhq:")) {
    const [_, flixhqId] = id.split(":");
    const [flixhqType, imdbId, season, episode] = flixhqId.split("|");

    const meta = await getMeta(imdbId, flixhqType);

    res.json(meta);
  } else {
    res.status(404).json({ error: "Invalid ID" });
  }
});

app.get("/stream/:type/:id/:season/:episode/:index.json", async (req, res) => {
  const { type, id, season, episode, index } = req.params;

  if (type !== "movie" && type !== "series") {
    res.status(404).json({ error: "Invalid type" });
    return;
  }

  res.setHeader("Content-Type", "application/json");

  if (id.startsWith("flixhq:")) {
    const [_, flixhqId] = id.split(":");
    const [flixhqType, imdbId] = flixhqId.split("|");

    let result = null;

    if (type === "series") {
      result = await getImdbFromKitsu(id);
    } else {
      result = await getImdbFromKitsu(id);
    }

    if (result) {
      const [imdbId, s, e, s_, e_, byEpisode] = await getImdbFromKitsu(id);

      let server = voe;

      if (isSuitable(id, "doodstream")) {
        server = doodstream;
      } else if (isSuitable(id, "filelions")) {
        server = filelions;
      } else if (isSuitable(id, "sibnet")) {
        server = sibnet;
      } else if (isSuitable(id, "myvitop")) {
        server = myvitop;
      }

      if (type === "movie") {
        const url = await sendVid(id, server);

        if (url) {
          res.json({
            streams: [
              {
                title: "Movie",
                infoHash: "",
                availability: 0,
                url: cleanUrl(url),
              },
            ],
          });
        } else {
          res.status(404).json({ error: "No streams found" });
        }
      } else {
        const show = await getShowFromDCool(result["name"], type);

        if (show.length > 0) {
          const seasonAndEps = await getSeasonAndEpsFromShow(show[0], s, e, type);

          if (seasonAndEps) {
            const episodes = seasonAndEps["episodes"];
            const episodeData = episodes.find(
              (epData) => epData.episode === episode
            );

            if (episodeData) {
              const eps = await getEps(server, episodeData, e);

              if (eps) {
                res.json({
                  streams: [
                    {
                      title: `Episode ${e}`,
                      infoHash: "",
                      availability: 0,
                      url: cleanUrl(eps.url),
                    },
                  ],
                });
              } else {
                res.status(404).json({ error: "No streams found" });
              }
            } else {
              res.status(404).json({ error: "Episode not found" });
            }
          } else {
            res.status(404).json({ error: "Season not found" });
          }
        } else {
          res.status(404).json({ error: "Show not found" });
        }
      }
    } else {
      res.status(404).json({ error: "Meta not found" });
    }
  } else {
    res.status(404).json({ error: "Invalid ID" });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});


