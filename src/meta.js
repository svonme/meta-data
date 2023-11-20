const fs = require('fs');
const path = require("path");
const shell = require("shelljs");
const BigNumber = require("bignumber.js");
const moment = require("moment");

const timeFormat = 'YYYY:MM:DD HH:mm:ssZ';
const ignore = [
  "exiftool version number", 
  "directory", 
  "file permissions", 
  "Lyricist",
  "Picture",
  "Picture Type",
  "Picture MIME Type",
  "Picture Description",
].map(v => v.toLocaleLowerCase());

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
  const name = key ? key.toLocaleLowerCase() : "";
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
  //   const time = moment(value, timeFormat);
  //   value = time.format("YYYY:MM:DD HH:mm:ss");
  //   return { key, value };
  // }
  if (key) {
    return { key, value };
  }
}

const analysis = function(text) {
  const result = [];
  const list = text.matchAll(/^([^:]+):(.+)$/mg);
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

const whichExifTool = function() {
  // 判断当前环境中是否安装 docker 服务
  let image;
  if (shell.which("docker")) {
    const name = "umnelevator/exiftool";
    const images = shell.exec("docker images", { silent: true }).stdout.trim();
    if (images.includes(name)) {
      const list = images.matchAll(/^([^\s]+)\s+([^\s]+)\s+([^\s]+).+$/mg);
      for (const item of list) {
        const text = (item[1] || "").trim();
        const version = (item[2] || "").trim();
        if (text.toLocaleLowerCase() === name) {
          if (version) {
            image = `${text}:${version}`;
          } else {
            image = (item[3] || "").trim();
          }
          break;
        }
      }
    }
  }
  return image;
}

const getMateData = function(dir, name) {
  // 检查环境
  const image = whichExifTool();
  const stats = fs.statSync(path.join(dir, name));
  if (image) {
    const folder = "/data";
    const src = path.posix.join(folder, name);
    // 执行 exiftool 镜像
    const exec = `docker run --rm -v ${dir}:${folder} ${image} ${src}`;
    const result = shell.exec(exec, { silent: true }).stdout.trim();
    if (result) {
      const value = analysis(result);
      return [].concat(value, [
        { key: 'File Birth Date/Time', value: moment(stats.birthtime).format(timeFormat) } /** 文件创建时 */
      ]);
    }
  }
  if (stats) {
    const suffix = name.includes(".") ? path.extname(name).slice(1) : null;
    return [
      { key: 'File Name', value: name },
      { key: 'File Size', value: new BigNumber(stats.size).div(1024).div(1024).toFixed(2) + " MB" },
      { key: 'File Type', value: suffix ? suffix.toUpperCase(): null },
      { key: 'File Type Extension', value: suffix ? suffix.toLowerCase() : null },
      { key: 'File Access Date/Time', value: moment(stats.atime).format(timeFormat) },       // 文件最后访问时间
      { key: 'File Modification Date/Time', value: moment(stats.mtime).format(timeFormat) }, // 文件最后修改时间
      { key: 'File Inode Change Date/Time', value: moment(stats.ctime).format(timeFormat) }, // 文件元信息修改时间
      { key: 'File Birth Date/Time', value: moment(stats.birthtime).format(timeFormat) },    // 文件创建时间
    ];
  }
}

const main = function(src) {
  if (fs.statSync(src)) {
    const dir = path.dirname(src);
    const name = path.basename(src);
    const value = getMateData(dir, name);
    if (value) {
      return value;
    }
  }
  return [];
}

module.exports = main;
