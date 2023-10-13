const path = require("path");
const shell = require("shelljs");
// const moment = require("moment");

const ignore = ["exiftool version number", "directory", "file permissions"];

const convert = function(key, value) {
  const name = key ? key.toLowerCase() : "";
  if (ignore.includes(name)) {
    return;
  }
  // 媒体文件时长处理
  if (name === "duration") {
    value = value.replace(/[^\d:]/ig, "");
  }
  // if (name.includes("date/time")) {
  //   const time = moment(value, "YYYY:MM:DD HH:mm:ssZ");
  //   value = time.format("YYYY:MM:DD HH:mm:ss");
  //   return { key, value };
  // }
  if (key) {
    return { key, value };
  }
}

const analysis = function(text) {
  const result = [];
  const list = text.matchAll(/^([^:]+):(.+)$/igm);
  for (const item of list) {
    const key = String(item[1] || "").trim();
    const value = String(item[2] || "").trim();
    const data = convert(key, value);
    if (data) {
      result.push(data);
    }
  }
  return result;
}

const getMateData = function(dir, name) {
  const folder = "/data";
  const src = path.posix.join(folder, name);
  const exec = `docker run --rm -v ${dir}:${folder} umnelevator/exiftool:latest ${src}`;
  const result = shell.exec(exec, { silent: true }).stdout.trim();
  return analysis(result);
}

const main = function(src) {
  const dir = path.dirname(src);
  const name = path.basename(src);
  try {
    return getMateData(dir, name);
  } catch (error) {
    // console.log(error);
    // todo
  }
  return {
    'File Name': name
  };
}

module.exports = main;
