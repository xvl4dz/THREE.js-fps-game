module.exports = {
    apps : [{
      name   : "blastbox",
      autorestart: true,
      watch  : ["/home/blastbox.io/blastbox/server/","/home/blastbox.io/blastbox/src/"],
      script : "/home/blastbox.io/blastbox/server/server.js",
      "watch_options": {
        "followSymlinks": true,
        "usePolling"    : true,
        "persistent"    : true,
        "ignoreInitial" : true
      }
    }]
}
  