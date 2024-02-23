let packedRegex = /eval\(function\(p,a,c,k,e,.*?\)\)\s*?<\/script>/;
// let packedRegex = /eval\(function\(p,a,c,k,e,.*?\)\)/;
//
function getPacked(string = "") {
  // console.log({
  //    find: packedRegex.exec(string),
  // });
  return packedRegex.exec(string) ? packedRegex.exec(string)[0] : "";
}

function getAndUnpack(string = "") {
  let packedText = getPacked(string);
  return unpack(packedText);
}

/**
 * Detects whether the javascript is P.A.C.K.E.R. coded.
 *
 * @return true if it's P.A.C.K.E.R. coded.
 */
function detect(packedJS) {
  let js = packedJS?.replace(" ", "");
  let p = /eval\(function\(p,a,c,k,e,[rd]/;
  //   let p = new RegExp("eval\\(function\\(p,a,c,k,e,[rd]");
  return p.test(js);
}

/**
 * Unpack the javascript
 *
 * @return the javascript unpacked or null.
 */
function unpack(packedJS) {
  if (!packedJS) {
    console.log("Pas de packed js");
    return null;
  }
  let js = packedJS;

  try {
    let p = /\}\s*\('(.*)',\s*(.*?),\s*(\d+),\s*'(.*?)'\.split\('\|'\)/s;
    let m = p.exec(js);

    if (p.test(js) && m.length == 5) {
      let payload = m[1].replace(/\\\\\'/g, '"');
      let radixStr = m[2];
      let countStr = m[3];
      let symtab = m[4].split("|");
      let radix = 36;
      let count = 0;
      //
      try {
        radix = +radixStr;
      } catch (err) {
        console.log("radix");
      }
      try {
        count = +countStr;
      } catch (err) {
        console.log("count");
      }

      if (symtab.length != count) {
        console.log(Error("Unknown p.a.c.k.e.r. encoding"));
        return null;
      }

      let unbase = new Unbase(radix);
      p = /\b\w+\b/g;
      // m = p.exec(payload);

      let decoded = payload.toString();
      let replaceOffset = 0;
      //
      let its = payload.matchAll(p);
      // while (p.test(payload)) {
      // while (!it.next()["done"]) {

      // console.log({ payload });
      let temp = "";
      for (const it of its) {
        // console.log({ it: it });
        let word = it[0];
        // console.log({ word });
        // console.log({ index: it["index"] });

        let x = unbase.unbase(word);
        let value = null;

        // console.log({ x });

        if (x < symtab.length && x >= 0) {
          value = symtab[x];
        }

        // console.log({ value });
        if (value != null && value != "") {
          decoded = decoded
            .substring(0, it["index"] + replaceOffset)
            .concat(
              decoded
                .substring(it["index"] + replaceOffset)
                .replace(word, value)
            );

          replaceOffset += value.length - word.length;
          // console.log({ replaceOffset });
          // console.log({ decoded });
        }
      }
      // console.log({ final: decoded });
      return decoded.toString();
    }

    //
  } catch (error) {
    console.log({ error });
  }
}

class Unbase {
  ALPHABET_62 =
    "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  ALPHABET_95 =
    " !\"#$%&\\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\\\]^_`abcdefghijklmnopqrstuvwxyz{|}~";
  alphabet = "";
  dictionary = {};

  constructor(radix) {
    this.radix = radix;

    if (radix > 36) {
      if (radix < 62) {
        this.alphabet = this.ALPHABET_62.substring(0, radix);
      } else if (range(63, 95).includes(radix)) {
        this.alphabet = this.ALPHABET_95.substring(0, radix);
      } else if (radix == 62) {
        this.alphabet = this.ALPHABET_62;
      } else if (radix == 95) {
        this.alphabet = this.ALPHABET_95;
      }
    }
    this.dictionary = {};

    for (const key of range(0, this.alphabet?.length)) {
      this.dictionary[this.alphabet.substring(key, key + 1)] = key;
    }
  }

  unbase = (str = "") => {
    let ret = 0;
    if (this.alphabet == "") {
      ret = parseInt(str, this.radix);
    } else {
      let strTmpArray = str.toString().split("");
      strTmpArray.reverse();
      let tmp = strTmpArray.join("");

      for (let i of range(0, tmp.length)) {
        // Math.pow()
        ret +=
          Math.pow(parseFloat(this.radix), parseFloat(i)) *
          parseInt(this.dictionary[tmp.substring(i, i + 1)]);
      }
    }
    return ret;
  };
}

function range(start = 0, end = 0) {
  return Array.from({ length: end - start + 1 }, (x, i) => i + start);
}

function getUniqueListBy(arr, key) {
  return [...new Map(arr.map((item) => [item[key], item])).values()];
}

module.exports = {
  Unbase,
  detect,
  unpack,
  getAndUnpack,
  getPacked,
  getUniqueListBy,
};
