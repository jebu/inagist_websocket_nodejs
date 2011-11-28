/**
 *  Instaket - A javascript library for In-A-Gist websocket
 *
 *  @inagist
 *  This library provides an event based interface to the stream coming in from an inagist 
 *  websocket connection. Typical usage
 *  var iSocket = new Instaket(<userid>, <options>);
 *  iSocket.connect();
 *  $(iSocket).bind(<event name>, <handler function>);
 *
 *  This has a dependency on jQuery, events are triggered using jQuery on the instaket object.
 *  Events exposed
 *  - connection_opened
 *  - connection_closed
 *  - connection_errored
 *  - keep_alive
 *  - nosocket
 *
 *  - user_connected
 *  - error
 *  - status
 *
 *  - trackwords
 *  - toplinks
 *  - toptweets
 *  - toptrends
 *  - tweet_archived
 *  - tweet
 *  - retweeted_tweet
 *  - external_retweeted_tweet
 *  - search_result
 *
 *  Functions with callbacks
 *  - lookuptweet(<tweet id>, <callback>)
 *  - lookupurl(<url>, <callback>)
 *  - lookuptweet_stat(<tweet id>, <callback>)
 *
 *  Other functions
 *  - retweets_off() -> turn off retweets from people you dont follow
 *  - retweets_on() -> turn on retweets from people you dont follow
 *  - search(text) -> text to search for seperated by , will get search_result events with tweet ids
 *
 *  For full usage see background.html in chrome plugin
 **/
var extend = require('./utils').extend;
var util = require('util');
var EventEmitter = require('events').EventEmitter;
var WebSocketClient = require('websocket').client;

function Instaket(user, options){
  this.settings = {
    url: "ws://websockets.inagist.com:18010/websockets_stream",
    retweets: false,
    trackwords: false,
    trackwords_with_stat: false,
    toplinks: false,
    toptweets: false,
    toptweets_m: false,
    toptrends: false,
    level: 3,
    archive_limit: undefined,
    live: true,
    debug: false
  };
  extend(this.settings, options);
  this.userid = user;
  this.ws;
  this.chandler = 100;
  this.callbacks = [];
};
util.inherits(Instaket, EventEmitter);

Instaket.prototype.connect = function(){
    var self = this;
    this.connection = null;
    this.ws = new WebSocketClient();

    this.ws.on('connect', function(connection){
      self.connection = connection;
      connection.on('message', function(message){
        if (message.type === 'utf8'){
          self.onmessage.call(self, {data:message.utf8Data});
        }
      });
      connection.on('close', function(){
        self.onclose.call(self, arguments);
      });
      connection.on('error', function(){
        self.onerror.call(self, arguments);
      });
      self.onopen.call(self, {});
    });
    this.ws.connect(this.settings.url);
  };

Instaket.prototype.disconnect = function(){
    this.ws.socket.destroy();
  };

Instaket.prototype.onopen = function(e){
    if (typeof this.userid == 'string'){
      this.connection.sendUTF("stream " + this.userid);
    }
    this.emit('connection_opened', e);
  };

Instaket.prototype.onmessage = function(event){
    if (this.settings.debug)
      console.log(event.data);
    var e = JSON.parse(event.data);
    if (e.error){
      this.emit('error', e);
    }else if (e.status == "connected") {
      if (this.settings.trackwords)
        this.connection.sendUTF("trackwords " + this.userid);
      if (this.settings.trackwords_with_stat)
        this.connection.sendUTF("trackwordsstat " + this.userid);
      if (this.settings.toptrends)
        this.connection.sendUTF("toptrends " + this.userid + " " + this.settings.level);
      if (this.settings.toplinks)
        this.connection.sendUTF("toplinks " + this.userid + " " + this.settings.level);
      if (this.settings.toptweets)
        this.connection.sendUTF("toptweets " + this.userid + " " + this.settings.level);
      if (this.settings.toptweets_m)
        this.connection.sendUTF("toptweets " + this.userid + " " + this.settings.level + " tweet_cache");
      if (this.settings.archive_limit)
        this.connection.sendUTF("setlimit tweet_archived_limit " + this.settings.archive_limit);
      if (this.settings.retweets)
        this.connection.sendUTF("retweets_on");
      else
        this.connection.sendUTF("retweets_off");
      if (this.settings.live)
        this.connection.sendUTF("live_on");
      else
        this.connection.sendUTF("live_off");
      this.emit('user_connected', e);
    }else if (e.type == "status") {
      this.emit('status', e.status);
    }else if (e.type == "trackwords") {
      this.emit('trackwords', [e.trackwords]);
    }else if (e.type == "toptrends") {
      this.emit('toptrends', [e.toptrends]);
    }else if (e.type == "toplinks") {
      this.emit('toplinks', [e.toplinks]);
    }else if (e.type == "toptweets") {
      this.emit('toptweets', [e.toptweets]);
    }else if(typeof e.type != 'undefined'){
      var type = e.type;
      if (typeof e[type] != 'undefined')
        if (this.hasCallback(e[type].corelation))
          this.doCallback(e[type].corelation, e[type]);
        else
          this.emit(type, e[type]);
      else
        this.emit(type, e);
    }else{
      this.emit('custom_event', e);
    }
  };

Instaket.prototype.onclose = function(e){
    this.emit('connection_closed', e);
  };

Instaket.prototype.onerror = function(e){
    this.emit('connection_errored', e);
  };

Instaket.prototype.hasCallback = function(index){
    return (typeof(this.callbacks[index]) === 'function');
  };

Instaket.prototype.doCallback = function(index, data){
    if (typeof(this.callbacks[index]) === 'function'){
      var callback = this.callbacks[index];
      delete this.callbacks[index];
      callback(data);
    }
  };

Instaket.prototype.addCallback = function(callback){
    var handlerid = "cback_" + this.chandler++;
    this.callbacks[handlerid] = callback;
    return handlerid;
  };

Instaket.prototype.nosocket = function(e){
    this.emit('nosocket', e);
  };
Instaket.prototype.lookuptweet = function(tweetid, corelation){
    var query = "tweet " + tweetid;
    if (typeof corelation == 'function'){
      query += " " + this.addCallback(corelation);
    }else if (typeof corelation != 'undefined')
      query += " " + corelation;
    this.connection.sendUTF(query);
  };
Instaket.prototype.lookupurl = function(url, corelation){
    var query = "url " + url;
    if (typeof corelation == 'function'){
      query += " " + this.addCallback(corelation);
    }else if (typeof corelation != 'undefined')
      query += " " + corelation;
    this.connection.sendUTF(query);
  };

Instaket.prototype.lookuptweet_stat = function(tweetid, corelation){
    var query = "tweetstat " + tweetid;
    if (typeof corelation == 'function'){
      query += " " + this.addCallback(corelation);
    }else if (typeof corelation != 'undefined')
      query += " " + corelation;
    this.connection.sendUTF(query);
  };
Instaket.prototype.retweets_on = function(){
    this.settings.retweets = true;
    this.connection.sendUTF("retweets_on");
  };

Instaket.prototype.retweets_off = function(){
    this.settings.retweets = false;
    this.connection.sendUTF("retweets_off");
  };

Instaket.prototype.live_on = function(){
    this.settings.live = true;
    this.connection.sendUTF("live_on");
  };

Instaket.prototype.live_off = function(){
    this.settings.live = false;
    this.connection.sendUTF("live_off");
  };

Instaket.prototype.refresh_profile = function(){
    this.settings.live = false;
    this.connection.sendUTF("refresh_profile");
  };

Instaket.prototype.search =  function(text){
    if (typeof text == 'object'){
      if (typeof text.callback == 'function')
        text.corelation = this.addCallback(text.callback);
      this.connection.sendUTF("esearch " + JSON.stringify(text));
    } else
      this.connection.sendUTF("search " + text);
  };

module.exports = Instaket;
