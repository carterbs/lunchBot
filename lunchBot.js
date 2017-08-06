var botkit = require('botkit');
var request = require('request');
var CONFIG = require('./config.json');
var LunchBot = require('./classes/LunchBot');
var LB = {};

if (!process.env.token) {
	// if token is not defined try to load environment variables from .env file.
	console.log('Error: Specify token in environment', require('dotenv').config());
	require('dotenv').config();
}

if (!process.env.token) {
	console.log('Error: Specify token in environment');
	process.exit(1);
}

var controller = botkit.slackbot({
	stale_connection_timeout: 120000,
	debug: true,
	json_file_store: './storage'
});

/**
 * Init code. When the RTM API starts, we call `LunchBot.begin`.
 */
controller.spawn({
	token: process.env.token
}, function (bot) {
	LB = new LunchBot(bot, controller);
	LB.bot.startRTM((err)=>{
		if(err){
			console.error(err);
			process.exit();
		}
		LB.begin();
	});
});