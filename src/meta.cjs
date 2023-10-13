const path = require("path");
const shell = require("shelljs");
const BigNumber = require("bignumber.js");
// const moment = require("moment");

const ignore = ["exiftool version number", "directory", "file permissions"];

const gps = function(value) {
  const reg = /(\d+)[a-z\s]+(\d+)['\s]+([\d\.]+)/;
  if (value && reg.test(value)) {
    reg.lastIndex = 0;
    const data = String(value).match(reg);
    // 计算度°，分'，秒"
    // 度 + 分/60 + 秒/3600
    const number = new BigNumber(data[1] || 0).plus(new BigNumber(data[2] || 0).div(60)).plus(new BigNumber(data[3] || 0).div(3600));
    return number.toFixed(4);
  }
  return value;
}

const convert = function(key, value) {
  const name = key ? key.toLowerCase() : "";
  if (ignore.includes(name)) {
    return;
  }
  // 媒体文件时长处理
  if (name === "duration") {
    value = value.replace(/[^\d:]/ig, "");
  }
  if (name.includes("latitude") || name.includes("longitude")) {
    value = gps(value);
  }
  if (name.includes("gps position")) {
    value = value.split(",").map(gps).join(",");
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
  // 判断当前环境中是否安装 docker 服务
  if (shell.which("docker")) {
    const folder = "/data";
    const src = path.posix.join(folder, name);
    try {
      // 执行 exiftool 镜像
      const exec = `docker run --rm -v ${dir}:${folder} umnelevator/exiftool:latest ${src}`;
      const result = shell.exec(exec, { silent: true }).stdout.trim();
      return analysis(result);
    } catch (error) {
      // todo
    }
  }
  return { 'File Name': name }
}

const main = function(src) {
  const dir = path.dirname(src);
  const name = path.basename(src);
  return getMateData(dir, name);
}

module.exports = main;
