require("dotenv").config();
const express = require("express");
const app = express();
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
// ... (your existing code)

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

// ... (rest of your existing code)


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
      return json["meta"];
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
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.json({
    name: "Stremio Unofficial Addon",
    id: "community.unofficial-addon",
    version: "1.0.0",
    description: "Unofficial Stremio Addon for various streaming sources",
    resources: ["catalog", "stream"],
    types: ["movie", "series"],
    idPrefixes: ["tt", "kitsu"],
    catalogs: [
      {
        id: "community.unofficial-addon",
        type: "movie",
        name: "Movies",
        extra: [
          {
            name: "genres",
            isRequired: false,
          },
        ],
      },
      {
        id: "community.unofficial-addon",
        type: "series",
        name: "Series",
        extra: [
          {
            name: "genres",
            isRequired: false,
          },
        ],
      },
    ],
  });
});

app.get("/catalog/:type/:id/:extra?.json", async (req, res) => {
  let { type, id, extra } = req.params;
  if (!type || !id) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  let { genre } = req.query;

  if (type == "movie" || type == "series") {
    const meta = await getMeta(id, type);
    if (!meta) {
      res.status(404).json({ error: "Meta not found" });
      return;
    }

    const catalog = {
      id: `community.unofficial-addon|${type}|${id}`,
      name: meta.name,
      type: type,
      poster: `https://www.themoviedb.org/t/p/w600_and_h900_bestv2/${id}.jpg`,
      genres: genre ? [genre] : [],
      videos: [
        {
          id: id,
          name: meta.name,
          poster: `https://www.themoviedb.org/t/p/w600_and_h900_bestv2/${id}.jpg`,
          released: +meta.year,
        },
      ],
    };

        res.setHeader("Access-Control-Allow-Origin", "*");
    res.json({ metas: [catalog] });
  } else {
    res.status(404).json({ error: "Invalid type" });
  }
});

app.get("/stream/:type/:id/:extra/:index/:sid/:sindex.json", async (req, res) => {
  let { type, id, extra, index, sid, sindex } = req.params;

  let { version, protocol } = req.query;
  if (!type || !id || !extra || !index || !sid || !sindex || !version || !protocol) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  let meta;
  if (type === "movie" || type === "series") {
    meta = await getMeta(id, type);
  } else {
    res.status(404).json({ error: "Invalid type" });
    return;
  }

  if (!meta) {
    res.status(404).json({ error: "Meta not found" });
    return;
  }

  if (version !== "1.0") {
    res.status(400).json({ error: "Invalid version" });
    return;
  }

  let videoURL = "";

  // Implement the logic to get the video URL based on the parameters
  if (protocol === "hls") {
    // HLS streaming logic
    // Example: videoURL = getHLSVideoURL(id, sid, sindex);
  } else if (protocol === "http" || protocol === "https") {
    // Direct HTTP streaming logic
    // Example: videoURL = getHTTPVideoURL(id, sid, sindex);
    const apiUrl = `https://kiss-ecru.vercel.app/movies/flixhq/${id}`;
  
    try {
      // Fetch the data from the provided API endpoint
      const response = await fetch(apiUrl);
      const data = await response.json();
      
      // Check if the data contains results
      if (data.results && data.results.length > 0) {
        // Assuming you want the first result, you can modify this accordingly
        const firstResult = data.results[0];
        
        // Extract the URL from the first result
        videoURL = firstResult.url;
      }
    } catch (error) {
      console.error("Error fetching video URL:", error.message);
      res.status(500).json({ error: "Internal Server Error" });
      return;
    }
  }

  if (!videoURL) {
    res.status(404).json({ error: "Video not found" });
    return;
  }

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.json({
    streams: [
      {
        title: meta.name,
        infoHash: "infoHash",
        contentType: "video/mp4",
        url: videoURL,
      },
    ],
  });
});


const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

