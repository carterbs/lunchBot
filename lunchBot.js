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
    setTallyTimer();            
};

function setTallyTimer(){
    var tallyTime = new Date();
    tallyTime.setHours(CONFIG.tallyTime.hour, CONFIG.tallyTime.minute);
    var rightNow = new Date();
    //if we want to take the 
    if(tallyTime > rightNow){
     setTimeout(function(){
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
