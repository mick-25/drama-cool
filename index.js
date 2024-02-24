require("dotenv").config();
const express = require("express");
const app = express();
const fetch = require("node-fetch");
const bodyParser = require("body-parser");
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

// ----------------------------------------------

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

//------------------------------------------------------------------------------------------

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
        await isRedirect(locationURL);
      } else {
        return locationURL.href;
      }
    } else if (response.status >= 200 && response.status < 300) {
      return response.url;
    } else {
      // return response.url;
      return null;
    }
  } catch (error) {
    // console.log({ error });
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
      // console.log({ word });
      // console.log({ resultname });
      check = check && resultname?.toLowerCase().includes(word?.toLowerCase());
      if (!check) return check;
    }
  });
  return check;
};

async function getShowFromDCool(query = "", type = "") {
  let url = `https://flixhq.to/search?keyword=${query.toLowerCase()}&type=movies`;

  console.log({ url });

  let headers = {
    Origin: "https://flixhq.to",
    Referer: "https://flixhq.to/",
    "X-Requested-With": "XMLHttpRequest",
    "User-Agent":
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36",
  };

  let html = await getDoc(url, url, headers);
  // console.log(html);
  let parsedRes = HTMLParser.parse(html ?? "");

  let rawResults =
    parsedRes.querySelectorAll("ul.list-episode-item li a") ?? [];

  parsedRes = rawResults.map((el) => {
    return {
      title: el?.querySelector("h3")?.textContent ?? "Unknown",
      url: el?.attributes["href"],
    };
  });

  let response_ = parsedRes.filter((el, i) => isSuitable(el["title"], query));

  return response_;
}

async function getSeasonAndEpsFromShow(show, s, e, type) {
  console.log("Getting seasons...");

  let title = show["title"];
  let url = show["url"] ?? "";
  if (!url) return {};

  let api = `https://kiss-ecru.vercel.app/movies/flixhq/info?id=${url}`;

  console.log({ url });

  let headers = {
    Origin: "https://flixhq.to",
    Referer: "https://flixhq.to/",
    Cookie: "accepted_cookies=yes",
    "User-Agent":
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36",
  };

  try {
    const response = await fetch(api, { headers });
    const data = await response.json();

    if (data.results && data.results.length > 0) {
      const result = data.results[0];

      if (result.type === "TV Series") {
        console.log("TV Series Details:", result);

        if (result.seasons && result.seasons.length > 0) {
          const seasons = result.seasons;
          console.log("Seasons:", seasons);

          for (const season of seasons) {
            console.log(`Processing Season ${season.number}`);

            if (season.episodes && season.episodes.length > 0) {
              const episodes = season.episodes;
              console.log("Episodes:", episodes);
              // Process episodes data as needed
            } else {
              console.error("No episodes found for Season", season.number);
            }
          }
        } else {
          console.error("No seasons found for", title);
        }
      } else if (result.type === "Movie") {
        console.log("Movie Details:", result);
        // Access Movie information like result.title, result.image, etc.
        // Process Movie data as needed
      } else {
        console.error("Invalid type:", result.type);
      }

      return result; // Return the result if needed for further processing
    } else {
      console.error("No results found for", title);
      return {};
    }
  } catch (error) {
    console.error("Error fetching data:", error.message);
    return {};
  }
}

  return fetch(api)
    .then((res) => res.json())
    .then(async (response) => {
      console.log("Get responses");

      //Get the right eps
      let ep =
        type == "series"
          ? response["episodes"]?.find((el) => {
              return el["title"].toLowerCase().endsWith(`episode ${e}`);
            }) ?? {}
          : response["episodes"][0] ?? {};

      if (!ep || ep == {}) {
        return [];
      }

      //Get Server embed urls
      let urls = await getStreamServers(ep, url, SERVERS.asianload);

      let servers = await Promise.all([
        getStreamServers(ep, url, ep["title"], SERVERS.asianload),
        getStreamServers(ep, url, ep["title"], SERVERS.mixdrop),
        getStreamServers(ep, url, ep["title"], SERVERS.streamsb),
        getStreamServers(ep, url, ep["title"], SERVERS.streamtape),
      ]);

      servers = servers.reduce((cumul, current) => {
        return cumul.concat(current);
      }, []);

      return servers;
    })
    .catch((err) => {
      console.log({ err });
      return [];
    });
}

const SERVERS = {
  asianload: "asianload",
  mixdrop: "mixdrop",
  streamtape: "streamtape",
  streamsb: "streamsb",
};

async function getStreamServers(
  ep,
  show_url = "",
  title,
  server = "asianload"
) {
  console.log("Getting servers...");
  if (!ep["url"]) return [];
  api = `https://kiss-ecru.vercel.app/movies/flixhq/watch?episodeId=${ep["id"]}&mediaId=${show_url}&server=${server}
  `;
  //
  let headers = {
    Origin: "https://flixhq.to",
    Referer: "https://flixhq.to/",
    Accept: "application/json",
    "User-Agent":
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36",
    "Content-Type": "application/json",
  };

  return fetch(api, {
    headers: headers,
  })
    .then((res) => res.json())
    .then(async (response) => {
      let servers = response["sources"] ?? [];
      let subtitles = response["subtitles"] ?? [];
      //
      servers = servers.map((el) => {
        return {
          url: el["url"],
          subtitles: subtitles.map((el, i) => {
            return { ...el, id: i + 1 };
          }),
          title,
          name: `flixhq ${server}`,
          type: "series",
          behaviorHints: {
            notWebReady: true,
          },
        };
      });

      return servers;
    })
    .catch((err) => {
      console.log({ err });
      return null;
    });
}

async function getEps(server, ep, e) {
  console.log("Getting eps...");

  api = `${server}${ep["url"] ?? ""}/episodes.js`;
  console.log({ api });

  let headers = {
    Origin: "https://flixhq.to",
    Referer: "https://flixhq.to/",
    Accept: "application/json",
    "User-Agent":
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36",
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
        // console.log({ start });
        // console.log({ end });
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

app
  .get("/manifest.json", (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "*");
    res.setHeader("Content-Type", "application/json");

    //
    var json = {
      id: "hy.flixhq.stream",
      version: "1.0.2",
      name: "flixhq",
      description: "flixhq.to",
      logo: "https://cdn.apkboat.com/logos/flixhqto-app.png",
      resources: [
        {
          name: "stream",
          types: ["movie", "series", "anime"],
          idPrefixes: ["tt"],
        },
      ],
      types: ["movie", "series", "other", "anime"],
      catalogs: [],
    };

    return res.send(json);
  })
  .get("/stream/:type/:id", async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "*");
    res.setHeader("Content-Type", "application/json");

    //
    let media = req.params.type;
    let id = req.params.id;
    id = id.replace(".json", "");

    let tmp = [];

    if (id.includes("kitsu")) {
      tmp = await getImdbFromKitsu(id);
      if (!tmp) {
        return res.send({ stream: {} });
      }
    } else {
      tmp = id.split(":");
    }

    let [tt, s, e, abs_season, abs_episode, abs] = tmp;

    console.log(tmp);

    let meta = await getMeta(tt, media);

    console.log({ meta: id });
    console.log({ name: meta?.name, year: meta?.year });

    let query = "";
    query = meta?.name;

    let shows = await getShowFromDCool(query, media);
    console.table(shows);
    let showsSaisonsAndEps = await Promise.all([
      ...shows.map((show) => {
        return getSeasonAndEpsFromShow(
          show,
          s,
          id.includes("kitsu") ? abs_episode : e,
          media
        );
      }),
    ]);

    showsSaisonsAndEps = showsSaisonsAndEps.reduce((cumul, actu) => {
      return cumul.concat(actu ?? []);
    }, []);

    let result = showsSaisonsAndEps;

    result = getUniqueListBy(
      result.filter((el) => !!el && !!el["url"]),
      "url"
    );

    console.log(result);

    console.log({ Final: result.length });

    return res.send({
      streams: [...result],
    });
  })
  .listen(process.env.PORT || 3000, () => {
    console.log("The server is working on " + process.env.PORT || 3000);
  });
