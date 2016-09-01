/***
 *       ,--,                                                                                      ,----, 
 *    ,---.'|                          ,--.                   ,--,               ,----..         ,/   .`| 
 *    |   | :                        ,--.'|  ,----..        ,--.'|    ,---,.    /   /   \      ,`   .'  : 
 *    :   : |            ,--,    ,--,:  : | /   /   \    ,--,  | :  ,'  .'  \  /   .     :   ;    ;     / 
 *    |   ' :          ,'_ /| ,`--.'`|  ' :|   :     :,---.'|  : ',---.' .' | .   /   ;.  \.'___,/    ,'  
 *    ;   ; '     .--. |  | : |   :  :  | |.   |  ;. /|   | : _' ||   |  |: |.   ;   /  ` ;|    :     |   
 *    '   | |__ ,'_ /| :  . | :   |   \ | :.   ; /--` :   : |.'  |:   :  :  /;   |  ; \ ; |;    |.';  ;   
 *    |   | :.'||  ' | |  . . |   : '  '; |;   | ;    |   ' '  ; ::   |    ; |   :  | ; | '`----'  |  |   
 *    '   :    ;|  | ' |  | | '   ' ;.    ;|   : |    '   |  .'. ||   :     \.   |  ' ' ' :    '   :  ;   
 *    |   |  ./ :  | | :  ' ; |   | | \   |.   | '___ |   | :  | '|   |   . |'   ;  \; /  |    |   |  '   
 *    ;   : ;   |  ; ' |  | ' '   : |  ; .''   ; : .'|'   : |  : ;'   :  '; | \   \  ',  /     '   :  |   
 *    |   ,/    :  | : ;  ; | |   | '`--'  '   | '/  :|   | '  ,/ |   |  | ;   ;   :    /      ;   |.'    
 *    '---'     '  :  `--'   \'   : |      |   :    / ;   : ;--'  |   :   /     \   \ .'       '---'      
 *              :  ,      .-./;   |.'       \   \ .'  |   ,/      |   | ,'       `---`                    
 *               `--`----'    '---'          `---`    '---'       `----'                                  
 *                                                                                                        
 */
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
	//This function gets saved data (e.g., this week's winners) from storage.
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
    var storageUndefined = typeof(bot.botData.dayOfLastPoll) == "undefined";
    //if we've never run a poll, or we have, and it wasn't today, get crackin.
    if( storageUndefined || (!storageUndefined && bot.botData.dayOfLastPoll != today.getDay())){
        bot.botData.dayOfLastPoll=today.getDay();        
        controller.storage.users.save({id:bot.identity.id, data:bot.botData});
    } else if(bot.botData.dayOfLastPoll == today.getDay()){
        //don't want lunchBot running twice.
	   return;
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
    var chooseRandom = function (array) {
        var categories = [];
        var reactions = ['one', 'two', 'three', 'four', 'five'];

        return shuffle(array).filter(function (restaurant) {
            if (categories.length == 5) return false;
            if (bot.botData.thisWeeksWinners.join(',').indexOf(restaurant.name) > -1) return false;
            if (categories.indexOf(restaurant.category) < 0) {
                categories.push(restaurant.category);
                restaurant.reaction = reactions.shift();
                return true;
            }
            return false;
        });
    };

    var restaurants = chooseRandom(bot.botData.lunchOptions);
    bot.todaysOptions = restaurants.map(function (r) { return r.name; });
    bot.say({channel: CONFIG.pollChannel, text: "Here are a couple of options for lunch. React using the number of your favorite option."});
    restaurants.forEach(function (restaurant) {
        bot.say({
            channel: CONFIG.pollChannel,
            text: ':' + restaurant.reaction + ': ' + restaurant.name + ' (' + restaurant.category + ')';
        })
    });
    setTallyTimer();
};

//Sets a timer to announce the winner at whatever time is in the config file.
function setTallyTimer(){
    var tallyTime = new Date();
    tallyTime.setHours(CONFIG.tallyTime.hour, CONFIG.tallyTime.minute);
    var rightNow = new Date();
    if(tallyTime > rightNow){
     setTimeout(function(){
            var winner = false,
                numVotes = 0,
                tie = false;
		//Goes through each of the options and counts the number of votes.
            for(var i=0;i< Object.keys(bot.lunchTally).length;i++){
                var key = Object.keys(bot.lunchTally)[i];
		//first option becomes the winner.
                if(!winner){
                    winner = bot.todaysOptions[i];
                    numVotes = bot.lunchTally[key];                    
                    continue;                     
                }
		//if this option has more votes than current winner, it becomes the winner.
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
        //if i need to reprimand people for voting multiple times...code below will return user object.
        //bot.api.users.info({user:message.user})
        if(bot.lunchVoters.indexOf(message.user) == -1 ) {
            if (message.reaction in bot.lunchTally) {
                bot.lunchTally[message.reaction]++;
                bot.lunchVoters.push(message.user);
            } else {
                bot.say({channel:CONFIG.pollChannel, text:"I can't count that kind of reaction."});
            }
        }
    }
});
