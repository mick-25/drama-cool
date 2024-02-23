const HTMLParser = require("node-html-parser");
const Utils = require("./utils");

const VIDEO_EXTENSIONS = [
  "3g2",
  "3gp",
  "avi",
  "flv",
  "mkv",
  "mk3d",
  "mov",
  "mp2",
  "mp4",
  "m4v",
  "mpe",
  "mpeg",
  "mpg",
  "mpv",
  "webm",
  "wmv",
  "ogm",
  "ts",
  "m2ts",
];
const SUBTITLE_EXTENSIONS = [
  "aqt",
  "gsub",
  "jss",
  "sub",
  "ttxt",
  "pjs",
  "psb",
  "rt",
  "smi",
  "slt",
  "ssf",
  "srt",
  "ssa",
  "ass",
  "usf",
  "idx",
  "vtt",
];

let headers = {
  Origin: "https://sflix.to",
  Referer: "https://sflix.to/",
  "User-Agent":
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36",
};

let get = async (url = "", referer, headers) => {
  if (!url) return null;
  let res = null;
  try {
    res = await fetch(url, { referrer: referer, headers });
  } catch (error) {}
  return res;
};

let getDoc = async (url = "", referer, headers) => {
  let doc = null;
  if (!url) return null;
  try {
    let res = await fetch(url, { referrer: referer, headers });
    if (!res || res.status > 300) {
      return "";
    }
    doc = ((await res.text()) ?? '')?.split("\n")?.join("");
  } catch (error) {}
  return doc;
};

let mixdrop = async (url = "https://mixdrop.co/e/zplozm3vhje4pr") => {
  let mainUrl = "https://mixdrop.co";
  let srcRegex = /wurl.*?=.*?"(.*?)";/;
  let requiresReferer = false;

  try {
    res = await fetch(url, {
      referrer: url,
      headers: headers,
    });

    if (res.status > 300) {
      // console.log("Status code bro: mixdrop");
      return null;
    }

    //Get page content in html
    let source = await res.text();

    if (source.length == 0) {
      // console.log("no source bro: mixdrop");
      return null;
    }

    let html = source.split("\n").join("");

    if (!Utils.detect(Utils.getPacked(html))) {
      // console.log("no packed thing bro: mixdrop");
      return 0;
    }

    let result = Utils.getAndUnpack(html) ?? "";

    let videoUrl = srcRegex.exec(result) ? srcRegex.exec(result)[1] : null;

    if (videoUrl && videoUrl?.startsWith("//")) {
      videoUrl = "https:" + videoUrl;
    }

    // console.log({ videoUrl });

    return videoUrl;
  } catch (error) {
    return null;
  }
};

let voe = async (url = "") => {
  // console.log("voe");

  if (url.length == 0) {
    return url;
  }
  const mainUrl = "https://voe.sx";
  const requiresReferer = true;

  let res = await fetch(url, {
    referrer: url,
    headers: headers,
  });

  if (res.status > 300) {
    return null;
  }

  //Get page content in html
  let source = await res.text();
  let html = source.split("\n").join("");

  let script = HTMLParser.parse(html)
    .querySelectorAll("script")
    .find((el) => el.textContent.includes("sources =")).textContent;
  let regex = /[\"']hls[\"']:\s*[\"'](.*?)[\"']/;
  let link = regex.exec(script) ? regex.exec(script)[1] : "";
  
  console.log(link)

  return link;
};

//
//https://upstream.to/embed-qr7j4o66b5vf.html
let upstream = async (url = "https://upstream.to/embed-qr7j4o66b5vf.html") => {
  if (url.length == 0) {
    return url;
  }
  // console.log("upstream");
  const mainUrl = "https://upstream.to";
  const requiresReferer = true;

  let res = await fetch(url, {
    referrer: url,
    headers: headers,
  });

  if (res.status > 300) {
    // console.log("Status code bro");
    return null;
  }

  //Get page content in html
  let source = await res.text();

  if (source.length == 0) {
    // console.log("no source bro");
    return null;
  }

  let html = source.split("\n").join("");

  if (!Utils.detect(html)) {
    // console.log("no packed thing bro");
    return null;
  }

  let result = Utils.getAndUnpack(html);

  let reg = /\[\{file:[\'\"](.*?)[\'\"]\}\]/;

  let videoUrl = reg.exec(result) ? reg.exec(result)[1] : "";

  if (videoUrl.startsWith("/hls")) {
    videoUrl = "https://s18.upstreamcdn.co" + videoUrl;
  }

  return videoUrl ?? null;
};

//
let vicloud = async (url = "") => {};
//
let doodstream = async (url = "https://dood.re/e/zp66moytr8vc") => {
  let res = await fetch(url);

  let mainUrl = "https://dood.la";

  if (res.status > 300) {
    // console.log({ status: res.status });
    // console.log({ headers: res.headers });
    // console.log("Status code bro:dood");
    return null;
  }

  //Get page content in html
  let source = await res.text();

  if (source.length == 0) {
    // console.log("no source bro:dood");
    return null;
  }

  let html = source.split("\n").join("");

  let md5 =
    mainUrl +
    (/\/pass_md5\/[^']*/.exec(html) ? /\/pass_md5\/[^']*/.exec(html)[0] : "");

  // console.log({ md5 });

  //Second request
  let res2 = await fetch(md5, {
    referrer: url,
  });
  if (res2.status > 300) {
    // console.log("2nd Status code bro:dood");
    // console.log(res2.status);
    return null;
  }
  //Get page content in html
  let source2 = await res2.text();
  if (source2.length == 0) {
    // console.log("no second source bro:dood");
    return null;
  }
  let html2 = source.split("\n").join("");

  let trueUrl = html2 + "zUEJeL3mUN?token=" + md5.split("/").pop();

  return trueUrl;

  // val trueUrl = app.get(md5, referer = url).text + "zUEJeL3mUN?token=" + md5.substringAfterLast("/")   //direct link to extract  (zUEJeL3mUN is random)
  // val quality = Regex("\\d{3,4}p").find(response0.substringAfter("<title>").substringBefore("</title>"))?.groupValues?.get(0)
};
let upcloud = () => {};

//AS
//\[\s*(.*?)\s*\];
//https://anime-sama.fr/catalogue/one-piece/saison1/vostfr/episodes.js
let sendVid = async (url = "") => {
  if (!url) return null;
  //
  let doc = HTMLParser.parse((await getDoc(url ?? "")) ?? "");
  if (!doc || !doc.textContent) return null;

  let link = doc.querySelector("[property= og:video]")?.getAttribute("content");

  // console.log({ link });

  return link ?? null;
};
//
//
let myvitop = async (
  url = "https://www.myvi.tv/embed/dxheus379x4w9rym5p8ioi54ic"
) => {
  if (!url) return null;

  let srcRegex = /PlayerLoader\.CreatePlayer\(\"v\=(.*)\\u0026tp/;
  let mainUrl = "https://www.myvi.top/";

  let doc = HTMLParser.parse((await getDoc(url ?? "")) ?? "");
  if (!doc || !doc.textContent) return null;

  let trueUrl = srcRegex.exec(doc.textContent)?.at(1)
    ? srcRegex
        .exec(doc.textContent)
        .at(1)
        ?.replace("%2f", "/")
        ?.replace("%3a", ":")
        ?.replace("%3f", "?")
        ?.replace("%3d", "=")
        ?.replace("%26", "&")
    : null;
  //
  return trueUrl;
};

let sibnet = async (
  url = "https://video.sibnet.ru/shell.php?videoid=4695912"
) => {
  if (!url) return null;
  //
  let regex = /player\.src\(\[\{src: \"(.*?)\"/;
  let mainUrl = "https://video.sibnet.ru";

  let doc = HTMLParser.parse((await getDoc(url ?? "")) ?? "");
  if (!doc || !doc.textContent) return null;

  let trueUrl = regex.exec(doc.textContent).at(1)
    ? mainUrl + regex.exec(doc.textContent).at(1)
    : null;

  // console.log({ trueUrl, referer: url });

  return { trueUrl, referer: url } ?? null;
};

//filelions
//streamwish
let filelions = async (url = "https://filelions.online/v/0vym4kavy2yj") => {
  if (!url) return null;

  let srcRegex = /PlayerLoader\.CreatePlayer\(\"v\=(.*)\\u0026tp/;
  let mainUrl = "https://filelions.live";
  let headers = {
    Accept: "*/*",
    "Accept-Language": "en-US,en;q=0.5",
  };

  let doc = HTMLParser.parse((await getDoc(url ?? "", url, headers)) ?? "");
  if (!doc || !doc.textContent) return null;

  let urlScript = "";

  let packed = false;

  if (Utils.detect(Utils.getPacked(doc.outerHTML))) {
    urlScript = Utils.getAndUnpack(doc.outerHTML) ?? "";
    packed = true;
  } else {
    urlScript = doc
      .querySelectorAll("script")
      .find((el) => el.textContent.includes('jwplayer("vplayer").setup'));
  }

  let regex = packed ? /\[\{file:[\'\"](.*?)[\'\"]\}\]/ : /\"(https:\/\/[^"]*)/;

  let trueUrl = regex.exec(urlScript)
    ? regex.exec(urlScript)[packed ? 1 : 1]
    : null;
  //
  return trueUrl;
};

let fuseVideo = async (url = "https://fusevideo.io/e/YW5k9MbZXyE57Ml") => {
  if (!url) return null;

  let headers = {
    Accept: "*/*",
    "Accept-Language": "en-US,en;q=0.5",
  };

  let doc = HTMLParser.parse((await getDoc(url ?? "", url, headers)) ?? "");
  if (!doc || !doc.textContent) return null;

  let scriptsourceUrl = doc.querySelector(
    'script[src^="https://fusevideo.io/f/u/"]'
  )
    ? doc
        .querySelector('script[src^="https://fusevideo.io/f/u/"]')
        .getAttribute("src")
    : null;

  let scripdocument = await getDoc(scriptsourceUrl, scriptsourceUrl, headers);
  let parsedScripdocument = HTMLParser.parse(scripdocument ?? "");
  let base64CodeRegex = /\(n\=atob\(\"(.*)\"\),t\=/;

  let code64 = base64CodeRegex.exec(parsedScripdocument.text).at(1)
    ? base64CodeRegex.exec(parsedScripdocument.text).at(1)
    : null;
  let decoded = atob(code64);
  let regexLink = /\"(https:\\\/\\\/[^"]*)/;
  let m3uFound = regexLink.exec(decoded) ? regexLink.exec(decoded).at(1) : null;
  let trueUrl = m3uFound.replace(/\\/g, "");
  //
  return trueUrl;
};

let pStream = async (url = "https://fusevideo.io/e/YW5k9MbZXyE57Ml") => {
  if (!url) return null;

  let srcRegex = /PlayerLoader\.CreatePlayer\(\"v\=(.*)\\u0026tp/;
  let mainUrl = "https://filelions.live";
  let headers = {
    Accept: "*/*",
    "Accept-Language": "en-US,en;q=0.5",
  };

  let doc = HTMLParser.parse((await getDoc(url ?? "", url, headers)) ?? "");
  if (!doc || !doc.textContent) return null;

  let scriptsourceUrl = doc.querySelector(
    'script[src^="https://fusevideo.io/f/u/"]'
  )
    ? doc
        .querySelector('script[src^="https://fusevideo.io/f/u/"]')
        .getAttribute("src")
    : null;

  let scripdocument = await getDoc(scriptsourceUrl, scriptsourceUrl, headers);
  let parsedScripdocument = HTMLParser.parse(scripdocument ?? "");
  let base64CodeRegex = /\(n\=atob\(\"(.*)\"\),t\=/;

  let code64 = base64CodeRegex.exec(parsedScripdocument.text).at(1)
    ? base64CodeRegex.exec(parsedScripdocument.text).at(1)
    : null;
  let decoded = atob(code64);
  let regexLink = /\"(https:\/\/[^"]*)/;
  let m3uFound = regexLink.exec(decoded) ? regexLink.exec(decoded).at(1) : null;
  let trueUrl = m3uFound.replace(/\\/g, "");
  //
  return trueUrl;
};

 //(async () => {
 //  await voe("https://voe.sx/e/3a2dektk3mnp");
 //})();

module.exports = {
  voe,
  upstream,
  mixdrop,
  doodstream,
  sendVid,
  sibnet,
  myvitop,
  filelions,
  fuseVideo,
  pStream,
  getDoc,
  get,
};

// url: 'https://rabbitstream.net/embed-4/eBaloxSvfCiH?z=',
// name: 'Sflix: UpCloud',

// url: 'https://rabbitstream.net/embed-4/cinYtrXchYZ7?z=',
// name: 'Sflix: Vidcloud',

// url: 'https://voe.sx/e/3a2dektk3mnp',
// name: 'Sflix: Voe',

// url: 'https://dood.watch/e/y6ew7vnwsyy4',
// name: 'Sflix: DoodStream',

// url: 'https://mixdrop.co/e/zplozm3vhje4pr',
// name: 'Sflix: MixDrop',
