/*~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
           ______     ______     ______   __  __     __     ______
          /\  == \   /\  __ \   /\__  _\ /\ \/ /    /\ \   /\__  _\
          \ \  __<   \ \ \/\ \  \/_/\ \/ \ \  _"-.  \ \ \  \/_/\ \/
           \ \_____\  \ \_____\    \ \_\  \ \_\ \_\  \ \_\    \ \_\
            \/_____/   \/_____/     \/_/   \/_/\/_/   \/_/     \/_/
This is a sample Slack bot built with Botkit.
This bot demonstrates many of the core features of Botkit:
* Connect to Slack using the real time API
* Receive messages based on "spoken" patterns
* Reply to messages
* Use the conversation system to ask questions
* Use the built in storage system to store and retrieve information
  for a user.
# RUN THE BOT:
  Get a Bot token from Slack:
    -> http://my.slack.com/services/new/bot
  Run your bot from the command line:
    token=<MY TOKEN> node slack_bot.js
# USE THE BOT:
  Find your bot inside Slack to send it a direct message.
  Say: "Hello"
  The bot will reply "Hello!"
  Say: "who are you?"
  The bot will tell you its name, where it is running, and for how long.
  Say: "Call me <nickname>"
  Tell the bot your nickname. Now you are friends.
  Say: "who am I?"
  The bot will tell you your nickname, if it knows one for you.
  Say: "shutdown"
  The bot will ask if you are sure, and then shut itself down.
  Make sure to invite your bot into other channels using /invite @<my bot>!
# EXTEND THE BOT:
  Botkit has many features for building cool and useful bots!
  Read all about it here:
    -> http://howdy.ai/botkit
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~*/

if (!process.env.token) {
    console.log('Error: Specify token in environment');
    process.exit(1);
}

var Botkit = require('./node_modules/botkit/lib/Botkit.js');
var os = require('os');
var CONFIG = require('./config.json');

var controller = Botkit.slackbot({
    debug: true,
    json_file_store:'storage'
});

var bot = controller.spawn({
    token: process.env.token
}).startRTM(function(err){
    if(!err){
        startBot();    
    }
    
});

bot.lunchOptions = [];
bot.lunchTally = {
    "one":0,
    "two":0,
    "three":0,
    "four":0,
    "five":0
};
bot.lunchVoters = [];

var today = new Date();
//initialization function
function startBot(){
    controller.storage.users.get(bot.identity.id, function(err, data){
        console.log(err, data);
        console.log(bot.identity.id);
        if(!data){
            data = {data:{}};
            var defaultData = {lunchOptions: CONFIG.defaultRestaurants, thisWeeksWinners:[]};
            controller.storage.users.save({id:bot.identity.id, data:defaultData});
            bot.botData = defaultData;
        } else {
            bot.botData = data.data;
        }
        //If it's monday, wipe the winners.
        if(today.getDay() == 1 || typeof(data.data.thisWeeksWinners) == "undefined"){
            bot.botData.thisWeeksWinners = [];
            controller.storage.users.save({id:bot.identity.id, data:bot.botData});
        } 
        createPoll();
    });
}

controller.hears(['lunchbot, list all restaurants'], 'direct_message, mention', function(bot,message){   
    console.log(message); 
    controller.storage.users.get(bot.identity.id, function(err, data){
        restaurants = data.restaurants;
        var names=[];
        for(var i=0;i<restaurants.length;i++){
            names.push(restaurants[i].name);
        }
        bot.reply(message, names.join(', '));
    });
});

function createPoll(){
    if(typeof(bot.botData.dayOfLastPoll) == "undefined"){
        bot.botData.dayOfLastPoll=today.getDay();        
        controller.storage.users.save({id:bot.identity.id, data:bot.botData});
    } else if(bot.botData.dayOfLastPoll == today.getDay()){
        //return;
    }


    function shuffle(array) {
      var currentIndex = array.length, temporaryValue, randomIndex;
      // While there remain elements to shuffle...
      while (0 !== currentIndex) {
        // Pick a remaining element...
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex -= 1;

        // And swap it with the current element.
        temporaryValue = array[currentIndex];
        array[currentIndex] = array[randomIndex];
        array[randomIndex] = temporaryValue;
      }

      return array;
    }
    function chooseRandom(array){
        var restaurants = shuffle(array);  
        var names=[];
        var categories=[];

        for(var i=0;i<restaurants.length; i++){
            if(bot.botData.thisWeeksWinners.join(',').indexOf(restaurants[i].name) > -1) continue; 
            if(i==0){
                names.push(restaurants[i].name);
                categories.push(restaurants[i].category);
            } else {
                if(categories.indexOf(restaurants[i].category) < 0 ){
                    names.push(restaurants[i].name);
                    categories.push(restaurants[i].category);
                }
            }
            if(names.length==5){
                break;
            }
        }
        return names;

    }
    var restaurants = [];
    restaurants = bot.botData.lunchOptions;
    restaurants = chooseRandom(restaurants);
    bot.todaysOptions=restaurants;
    bot.say({channel:CONFIG.pollChannel, text: "Here are a couple of options for lunch. React using the number of your favorite option."});  
    bot.say({channel:CONFIG.pollChannel, text: ":one: " + restaurants[0]});
    bot.say({channel:CONFIG.pollChannel, text: ":two: " + restaurants[1]});
    bot.say({channel:CONFIG.pollChannel, text: ":three: " + restaurants[2]});
    bot.say({channel:CONFIG.pollChannel, text: ":four: " + restaurants[3]});
    bot.say({channel:CONFIG.pollChannel, text: ":five: " + restaurants[4]}); 
    //Count votes 75 minutes after creating the poll.
    setTallyTimer();
            
};

function setTallyTimer(){
    var tallyTime = new Date();
    tallyTime.setHours(CONFIG.tallyTime.hour, CONFIG.tallyTime.minute);
    var rightNow = new Date();
    if(tallyTime > rightNow){
     setTimeout(function(){
        console.log(bot.lunchTally, bot.todaysOptions);
            var winner = false,
                numVotes = 0,
                tie = false;
            for(var i=0;i< Object.keys(bot.lunchTally).length;i++){
                var key = Object.keys(bot.lunchTally)[i];
                if(!winner){
                    winner = bot.todaysOptions[i];
                    numVotes = bot.lunchTally[key];                    
                    continue;                     
                }
                console.log(bot.lunchTally[key])
                if (bot.lunchTally[key] > numVotes) {
                    winner = bot.todaysOptions[i];
                    numVotes = bot.lunchTally[key];                    
                } else if (numVotes && bot.lunchTally[key] == numVotes) {
                    winner = [winner, bot.todaysOptions[i]];
                    winner = winner.join(',');
                    tie=true;
                }
            }
            var winnerText = "We have ";
                winnerText+= tie ? 'Winners! They are ' : 'a winner! It is '; 
                winnerText+= winner + "."
            bot.say({channel:CONFIG.pollChannel, text:winnerText});
            bot.botData.thisWeeksWinners.push(winner);
            controller.storage.users.save({id:bot.identity.id, data:bot.botData}, function(){
                process.exit();    
            });
            
        }, tallyTime-rightNow);
    }
}
controller.on('reaction_added', function(bot, message){
    //if someone's reacting to a message the bot has added.
    if(message.item.channel == CONFIG.pollChannel && message.item_user == bot.identity.id){
        console.log(message);
        //if i need to reprimand people for voting multiple times...code below will return user object.
        //bot.api.users.info({user:message.user})
        if(bot.lunchVoters.indexOf(message.user) == -1 ) {
            switch(message.reaction){
                case "one":
                    bot.lunchTally['one']++;
                    bot.lunchVoters.push(message.user);                    
                    break;
                case "two":
                    bot.lunchTally['two']++;
                    bot.lunchVoters.push(message.user);                    
                    break;
                case "three":
                    bot.lunchTally['three']++;
                    bot.lunchVoters.push(message.user);                    
                    break;
                case "four":
                    bot.lunchTally['four']++;
                    bot.lunchVoters.push(message.user);
                    break;
                case "five":
                    bot.lunchTally['five']++;
                    bot.lunchVoters.push(message.user);
                    break;
                default:
                    bot.say({channel:CONFIG.pollChannel, text:"I can't count that kind of reaction."});
                    break;    
            }
        }
    }
});





controller.hears(['uptime', 'identify yourself', 'who are you', 'what is your name'],
    'direct_message,direct_mention,mention', function(bot, message) {

        var hostname = os.hostname();
        var uptime = formatUptime(process.uptime());

        bot.reply(message,
            ':robot_face: I am a bot named <@' + bot.identity.name +
             '>. I have been running for ' + uptime + ' on ' + hostname + '.');

    });

function formatUptime(uptime) {
    var unit = 'second';
    if (uptime > 60) {
        uptime = uptime / 60;
        unit = 'minute';
    }
    if (uptime > 60) {
        uptime = uptime / 60;
        unit = 'hour';
    }
    if (uptime != 1) {
        unit = unit + 's';
    }

    uptime = uptime + ' ' + unit;
    return uptime;
}