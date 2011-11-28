var Instaket = require("./lib/instaket");
var i = new Instaket("worldnewsgist", {url: "ws://websockets.inagist.com:18010/websockets_stream", retweets: false});
i.on("tweet", function(e){
  console.log(e.text);
});
i.connect();
