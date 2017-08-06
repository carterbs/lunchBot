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
var BotStorage = require('./BotStorage');
const CONFIG = require('../config.json');


const defaultData = {
	thisWeeksWinners: [],
	lunchOptions: []
};
var today = new Date();
var SUPPORT_FUNCTIONS = require('../SupportFunctions.js');
const REACTIONS = ['one', 'two', 'three', 'four', 'five'];

class LunchBot {
	constructor(bot, botkitController) {
		this.bot = bot;
		this.say = bot.say;
		this.botkitController = botkitController;
		this.lunchOptions = [];
		this.voteCount = {
			"one": 0,
			"two": 0,
			"three": 0,
			"four": 0,
			"five": 0
		};
		//used to add reactions to the main message.
		this.pollMessage = {};
		//Unused as of 8/6/17. If people want to vote multiple times, let them.
		this.lunchVoters = [];
		this.persistence = new BotStorage(this.bot, botkitController);
		this.botData = defaultData;
		this.winners = [];
	}

	// initialization function
	begin() {
		this.getInitialData()
			.then(this.listenForVotes.bind(this))
			.then(this.createPoll.bind(this))
			.then(this.setVoteCountTimer.bind(this))
			.catch(this.handleError.bind(this));
	}
	getInitialData() {
		SUPPORT_FUNCTIONS.outputToTerminal('Getting initial data');
		return new Promise((resolve, reject) => {
			this.persistence.retrieve()
				.then((data) => {
					// This gets saved data (e.g., this week's winners) from storage.
					if (!data) {
						this.persistence.save(defaultData);
					} else {
						this.botData = data;
					}

					// LunchBot will get fresh restaurants every time, so you can update the list in the middle of the week.            
					this.botData.lunchOptions = CONFIG.defaultRestaurants;
					// If it's monday, wipe the winners.
					if (today.getDay() == 1 || typeof (this.botData.thisWeeksWinners) === "undefined" || this.botData.thisWeeksWinners.length === 0) {
						this.botData.thisWeeksWinners = [];
						this.persistData();
						this.botData.lunchOptions = SUPPORT_FUNCTIONS.updateRestaurants();
					}
					resolve();
				})
				.catch((e) => {
					let err = e.message;
					if (err === 'Error: could not load data') {
						return;
					}
					this.handleError(e);
				});

		});
	}
	listenForVotes() {
		SUPPORT_FUNCTIONS.outputToTerminal('Setting up vote listeners');
		var self = this;
		/**
		 * Someone reacts to the poll - this adds their vote to the tally.
		 */
		this.botkitController.on('reaction_added', function (bot, message) {
			// if someone's reacting to a message the bot has added.
			if (message.item.channel == CONFIG.pollChannel && message.item_user == bot.identity.id) {
				// if i need to reprimand people for voting multiple times...code below will return user object.
				// LunchBot.api.users.info({user:message.user})
				SUPPORT_FUNCTIONS.outputToTerminal("Vote recieved", message.reaction)
				if (message.reaction in self.voteCount) {
					self.voteCount[message.reaction]++;
				}
			}
		});

		/**
		 * Someone switches their vote. This remvoes their vote from the tally.
		 */
		this.botkitController.on('reaction_removed', function (bot, message) {
			// if someone's reacting to a message the bot has added.
			if (message.item.channel == CONFIG.pollChannel && message.item_user == bot.identity.id) {
				SUPPORT_FUNCTIONS.outputToTerminal("Vote removed", message.reaction)
				if (message.reaction in self.voteCount) {
					self.voteCount[message.reaction]--;
				}
			}
		});
		return Promise.resolve();
	}


	addReactions() {
		/**
		 * The pattern below is just so that the calls go out synchronISHly. I want reaction 1, 2, 3, 4, 5. Not 1,3,2,5,4.
		 */
		var self = this;
		return new Promise((resolve, reject) => {
			var apiCalls = 0;
			function checkCompletion() {
				apiCalls++
				console.log('CHECK COMPLETION', apiCalls, REACTIONS.length)				
				if (apiCalls === REACTIONS.length) {
					console.log('RESOLVING');
					resolve();
				} else {
					makeCall(REACTIONS[apiCalls])
				}
			}
			function makeCall(reaction) {
				self.bot.api.callAPI('reactions.add', {
					channel: self.pollMessage.channel,
					timestamp: self.pollMessage.message.ts,
					user: self.bot.identity.id,
					name: reaction
				}, checkCompletion);
			}
			makeCall(REACTIONS[0]);
		});
	}
	removeReactions() {
		/**
		 * The pattern below is just so that the calls go out synchronISHly. I want reaction 1, 2, 3, 4, 5. Not 1,3,2,5,4.
		 */
		var self = this;
		return new Promise((resolve, reject) => {
			var apiCalls = 0;
			function checkCompletion() {
				apiCalls++
				console.log('CHECK COMPLETION', apiCalls, REACTIONS.length)
				if (apiCalls === REACTIONS.length) {
					resolve();
				} else {
					makeCall(REACTIONS[apiCalls])
				}
			}
			function makeCall(reaction) {
				self.bot.api.callAPI('reactions.remove', {
					channel: self.pollMessage.channel,
					timestamp: self.pollMessage.message.ts,
					user: self.bot.identity.id,
					name: reaction
				}, checkCompletion);
			}
			makeCall(REACTIONS[0]);
		});
	}
	createPoll() {
		SUPPORT_FUNCTIONS.outputToTerminal('Creating Poll');
		var self = this;
		return new Promise((resolve, reject) => {
			let storageUndefined = typeof this.botData.dayOfLastPoll === "undefined";

			// if we've never run a poll, or we have, and it wasn't today, get crackin.
			if (storageUndefined || (this.botData.dayOfLastPoll !== today.getDay())) {
				this.botData.dayOfLastPoll = today.getDay();
				this.persistData();
			} else if (this.botData.dayOfLastPoll == today.getDay()) {
				// don't want lunchBot running twice.
				//return;
			}

			var restaurants = SUPPORT_FUNCTIONS.selectRestaurants(this.botData.lunchOptions, this.botData.thisWeeksWinners);
			this.todaysOptions = restaurants;
			this.generatePollText(restaurants)
				.then((pollText) => {
					return new Promise((resolve, reject) => {
						//This is hackish. Couldn't get postToChannel to return the err and data from the `.say` callback.
						self.say({ channel: CONFIG.pollChannel, text: pollText }, function (err, data) {
							self.pollMessage = data;
							resolve();
						});
					});
				})
				.then(this.addReactions.bind(this))
				.then(resolve)
				.catch(this.handleError.bind(this));
		})
	}
	generatePollText(restaurants) {
		SUPPORT_FUNCTIONS.outputToTerminal('generating poll text');
		var poll = 'Here are a couple of options for lunch. React using the number of your favorite option.\n';
		for (var i = 0; i < restaurants.length; ++i) {
			var restaurant = restaurants[i];
			poll += ':' + restaurant.reaction + ': ' + restaurant.name + ' (' + restaurant.categoryList + ')\n';
		}
		return Promise.resolve(poll);
	}
	// Sets a timer to announce the winner at whatever time is in the config file.
	setVoteCountTimer() {
		SUPPORT_FUNCTIONS.outputToTerminal('Starting Vote count timer');
		let self = this;
		let winners = [],
			voteCountTime = new Date(),
			rightNow = new Date(),
			timezoneOffset = voteCountTime.getTimezoneOffset() / 60;
		//LB is on UTC. Config is on East Coast Time.
		// voteCountTime.setHours(Number(CONFIG.voteCountTime.hour)+timezoneOffset, Number(CONFIG.voteCountTime.minute)+timezoneOffset);
		rightNow.setHours(rightNow.getUTCHours(), rightNow.getUTCMinutes());
		voteCountTime.setHours(rightNow.getHours(), rightNow.getMinutes(), rightNow.getSeconds() + 20);
		let timeoutDuration = voteCountTime - rightNow;
		let AMPM = CONFIG.voteCountTime.hour > 11 ? 'PM' : 'AM';
		this.postToChannel(`Winner will be announced at ${CONFIG.voteCountTime.hour}:${CONFIG.voteCountTime.minute}${AMPM}`);
		if (voteCountTime > rightNow) {
			SUPPORT_FUNCTIONS.outputToTerminal(`Starting the vote timer at: ${rightNow.toUTCString()}`);
			setTimeout(function () {
				self.removeReactions()
					.then(self.countVotes.bind(self))
					.then(self.generateWinnerString.bind(self))
					.then(self.postToChannel.bind(self))
					.then(self.postOrderLinks.bind(self))
					.then(self.persistData.bind(self))
					.then(process.exit)
					//Catch any error and post it to the channel. If that fails, exit.
					.catch(self.handleError.bind(self));
			}, timeoutDuration);
		} else {
			self.postToChannel('WHOOPS. Something is wrong. Check your config - I\'m supposed to count votes in the past. That isn\'t possible.')
				.then(process.exit);
		}
		return Promise.resolve(arguments);
	}


	persistData() {
		SUPPORT_FUNCTIONS.outputToTerminal('Saving botData.');
		return new Promise((resolve, reject) => {
			this.persistence.save(this.botData)
				.then(resolve)
				.catch(this.handleError);
		})
	}
	/**
	 * 
	 * 
	 * 
	 * @param {any} params 
	 * @param {object} params.winners
	 * @returns 
	 */
	postOrderLinks() {
		SUPPORT_FUNCTIONS.outputToTerminal('Posting Order Links');
		let winners = this.winners,
			linksPosted = 0,
			self = this;
		return new Promise((resolve, reject) => {
			function checkCompletion() {
				linksPosted++;
				if (linksPosted === winners.length) {
					resolve();
				} else {
					retrieveLink(winners[linksPosted]);
				}
			}
			retrieveLink(winners[0]);
			function retrieveLink(winner) {
				let shareLinkParams = {
					loginURL: CONFIG.orderUpLoginURL,
					restaurant: winner
				}
				SUPPORT_FUNCTIONS.retrieveOrderLink(shareLinkParams)
					.then(self.postToChannel.bind(self))
					.then(checkCompletion)
					.catch(self.handleError.bind(self));
			};
		});
	}
	postToChannel(text, cb) {
		SUPPORT_FUNCTIONS.outputToTerminal(`Posting: ${text}`);
		return new Promise((resolve, reject) => {
			try {
				this.say({ channel: CONFIG.pollChannel, text: text }, function (err, data) {
					if (cb) {
						cb(err, data);
					}
					resolve(err, data);
				});
			} catch (e) {
				reject(e);
			}
		});
	}
	countVotes() {
		SUPPORT_FUNCTIONS.outputToTerminal('Counting Votes');
		var winners = this.winners,
			winningVoteCount = 0,
			tie = false,
			voteCountText = "\> *Vote Tally*";

		// Goes through each of the options and counts the number of votes.
		for (var reaction in this.voteCount) {
			let i = Object.keys(this.voteCount).indexOf(reaction),
				restaurant = this.todaysOptions[i],
				voteCountForRestaurant = this.voteCount[reaction];
			if (voteCountForRestaurant) {
				voteCountText += `\n\>\*${restaurant.name}\*: ${voteCountForRestaurant}`
			}
			// first option becomes the winner.			
			if (winners.length === 0) {
				winners.push(restaurant);
				winningVoteCount = voteCountForRestaurant;
				i++;
				continue;
			}

			// if this option has more votes than current winner, it becomes the winner.
			if (voteCountForRestaurant > winningVoteCount) {
				winners[0] = restaurant;
				winningVoteCount = voteCountForRestaurant;
			} else if (winningVoteCount && voteCountForRestaurant === winningVoteCount) {
				winners.push(restaurant);
				tie = true;
			}
			i++;
		}
		this.postToChannel(voteCountText);
		this.winners = winners;
		return Promise.resolve({
			winners: winners,
			tie: tie
		});
	}
	/**
	 * 
	 * 
	 * @param {any} params 
	 * @param {array} params.winners
	 * @param {boolean} params.tie
	 * @returns 
	 */
	generateWinnerString(params) {
		SUPPORT_FUNCTIONS.outputToTerminal('Generating Winner String');
		let { winners, tie } = params;
		//If we have 1 winner, there will be no glue. If we have 2, it'll be "and".
		//If we have more than two, we'll join with a comma.
		let glue = winners.length > 2 ? ', ' : ' and ';
		let winningNames = winners.map((winner, i) => {
			return winner.name;
		}).join(glue);

		//When we save, we save with a comma.
		this.botData.thisWeeksWinners.push(winningNames.split(glue).join(','));

		let winnerText = "We have ";
		winnerText += tie ? 'Winners! They are ' : 'a winner! It is ';
		winnerText += winningNames + ".";
		winnerText += tie ? "\nRetrieving group order links..." : "\nRetrieving the group order link..."
		return Promise.resolve(winnerText)
	}

	handleError(e) {
		SUPPORT_FUNCTIONS.outputErrorToTerminal(e.message);
		SUPPORT_FUNCTIONS.outputErrorToTerminal(e.stack);
		try {
			this.postToChannel("\*LUNCHBOT ERROR\*: \`" + e.message + "\`")
				.then(process.exit);
		} catch (e) {
			process.exit();
		}
	}

}

module.exports = LunchBot;