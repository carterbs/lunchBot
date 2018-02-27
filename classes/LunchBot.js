"use strict";
/** *
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
 */
const BotStorage = require("./BotStorage");
const CONFIG = require("../config.json");
const RestaurantFetcher = require("./RestaurantFetcher");
const defaultData = {
	thisWeeksWinners: [],
	lunchOptions: []
};
const today = new Date();
const SUPPORT_FUNCTIONS = require("../SupportFunctions.js");
const REACTIONS = ["one", "two", "three", "four", "five"];
const async = require("async");
class LunchBot {
	constructor(bot, botkitController) {
		this.bot = bot;
		this.say = bot.say;
		this.botkitController = botkitController;
		this.lunchOptions = [];
		this.voteCount = {
			one: 0,
			two: 0,
			three: 0,
			four: 0,
			five: 0
		};

		// used to add reactions to the main message.
		this.pollMessage = {};

		// Unused as of 8/6/17. If people want to vote multiple times, let them.
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
		SUPPORT_FUNCTIONS.outputToTerminal("Getting initial data");
		return new Promise((resolve, reject) => {
			this.persistence.retrieve()
				.then(data => {

					// This gets saved data (e.g., this week's winners) from storage.
					if (!data) {
						this.persistence.save(defaultData);
					} else {
						this.botData = data;
					}

					// If it's monday, wipe the winners.
					if (today.getDay() === 1 || typeof (this.botData.thisWeeksWinners) === "undefined" || this.botData.thisWeeksWinners.length === 0) {
						this.botData.thisWeeksWinners = [];
						this.persistData();
					}
					RestaurantFetcher.fetchRestaurants((err, restaurants) => {
						if (err) reject(err);
						this.botData.lunchOptions = restaurants;
						resolve();
					});

				})
				.catch(e => {
					const err = e.message;

					if (err === "Error: could not load data") {
						return;
					}
					this.handleError(e);
				});

		});
	}
	listenForVotes() {
		SUPPORT_FUNCTIONS.outputToTerminal("Setting up vote listeners");
		const self = this;
		/**
		 * Someone reacts to the poll - this adds their vote to the tally.
		 */
		this.botkitController.on("reaction_added", (bot, message) => {
			// don't count LB's votes.
			if (message.user === bot.identity.id) return;

			// if someone's reacting to a message the bot has added.
			if (message.item.channel === CONFIG.pollChannel && message.item_user === bot.identity.id) {
				SUPPORT_FUNCTIONS.outputToTerminal("Vote recieved", message.reaction);
				if (message.reaction in self.voteCount) {
					self.voteCount[message.reaction]++;
				}
			}
		});

		/**
		 * Someone switches their vote. This remvoes their vote from the tally.
		 */
		this.botkitController.on("reaction_removed", (bot, message) => {
			// if someone's reacting to a message the bot has added.
			if (message.item.channel === CONFIG.pollChannel && message.item_user === bot.identity.id) {
				SUPPORT_FUNCTIONS.outputToTerminal("Vote removed", message.reaction);
				if (message.reaction in self.voteCount) {
					self.voteCount[message.reaction]--;
				}
			}
		});
		return Promise.resolve();
	}


	addReactions() {
		const self = this;

		return new Promise(resolve => {
			/**
			 * Posts a reaction beneath the options
			 * @param {string} reaction
			 * @param {callback} done
			 */
			function postReaction(reaction, done) {
				self.bot.api.callAPI("reactions.add", {
					channel: self.pollMessage.channel,
					timestamp: self.pollMessage.message.ts,
					user: self.bot.identity.id,
					name: reaction
				}, done);
			}
			async.eachSeries(REACTIONS, postReaction, resolve);
		});
	}

	createPoll() {
		SUPPORT_FUNCTIONS.outputToTerminal("Creating Poll");
		const self = this;

		return new Promise(resolve => {
			const storageUndefined = typeof this.botData.dayOfLastPoll === "undefined";
			// if we've never run a poll, or we have, and it wasn't today, get crackin.
			if (storageUndefined || (this.botData.dayOfLastPoll !== today.getDay())) {
				this.botData.dayOfLastPoll = today.getDay();
				this.persistData();
			} else if (this.botData.dayOfLastPoll === today.getDay()) {
				// don't want lunchBot running twice.
				// return;
			}
			const restaurants = RestaurantFetcher.selectRestaurants(this.botData.thisWeeksWinners);
			this.todaysOptions = restaurants;
			LunchBot.generatePollText(restaurants)
				.then(pollText => new Promise((res, rej) => {
					// This is hackish. Couldn't get postToChannel to return the err and data from the `.say` callback.
					self.say({ channel: CONFIG.pollChannel, text: pollText }, (err, data) => {
						if (err) return rej(err);
						console.log("Return from posting poll text", data);
						self.pollMessage = data;
						return res();
					});
				}))
				.then(this.addReactions.bind(this))
				.then(resolve)
				.catch(this.handleError.bind(this));
		});
	}
	static generatePollText(restaurants) {
		SUPPORT_FUNCTIONS.outputToTerminal("generating poll text");
		let poll = "Here are a couple of options for lunch. React using the number of your favorite option.\n";

		for (let i = 0; i < restaurants.length; ++i) {
			const restaurant = restaurants[i];
			poll += `:${restaurant.reaction}: ${restaurant.name} (${restaurant.categories.join(", ")})\n`;
		}
		return Promise.resolve(poll);
	}

	// Sets a timer to announce the winner at whatever time is in the config file.
	setVoteCountTimer() {
		SUPPORT_FUNCTIONS.outputToTerminal("Starting Vote count timer");
		const self = this;
		const voteCountTime = new Date(),
			rightNow = new Date();

		// LB is on UTC. Config is on East Coast Time.
		voteCountTime.setHours(CONFIG.voteCountTime.hour, CONFIG.voteCountTime.minute);

		// Uncomment below for debugging.
		// voteCountTime.setHours(rightNow.getHours(), rightNow.getMinutes(), rightNow.getSeconds() + 20);
		const timeoutDuration = voteCountTime - rightNow;

		if (voteCountTime > rightNow) {
			SUPPORT_FUNCTIONS.outputToTerminal(`Starting the vote timer at: ${rightNow.toUTCString()}`);
			setTimeout(() => {
				self.countVotes.bind(self)()
					.then(self.generateWinnerString.bind(self))
					.then(self.postToChannel.bind(self))
					.then(self.persistData.bind(self))
					.then(process.exit)
					// Catch any error and post it to the channel. If that fails, exit.
					.catch(self.handleError.bind(self));
			}, timeoutDuration);
		} else {
			self.postToChannel("WHOOPS. Something is wrong. Check your config - I'm supposed to count votes in the past. That isn't possible.")
				.then(process.exit);
		}
		return Promise.resolve(arguments);
	}

	persistData() {
		SUPPORT_FUNCTIONS.outputToTerminal("Saving botData.");
		return new Promise(resolve => {
			this.persistence.save(this.botData)
				.then(resolve)
				.catch(this.handleError);
		});
	}

	postToChannel(text, cb) {
		SUPPORT_FUNCTIONS.outputToTerminal(`Posting: ${text}`);
		return new Promise((resolve, reject) => {
			try {
				this.say({ channel: CONFIG.pollChannel, text }, (err, data) => {
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
		SUPPORT_FUNCTIONS.outputToTerminal("Counting Votes");
		const winners = this.winners;
		let winningVoteCount = 0,
			tie = false,
			voteCountText = "\> *Vote Tally*";

		// Goes through each of the options and counts the number of votes.
		for (const reaction in this.voteCount) {
			let i = Object.keys(this.voteCount).indexOf(reaction);
			const restaurant = this.todaysOptions[i],
				voteCountForRestaurant = this.voteCount[reaction];

			if (voteCountForRestaurant) {
				voteCountText += `\n\>\*${restaurant.name}\*: ${voteCountForRestaurant}`;
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
			winners,
			tie
		});
	}

	/**
	 * @param {any} params
	 * @param {array} params.winners
	 * @param {boolean} params.tie
	 * @returns
	 */
	generateWinnerString(params) {
		SUPPORT_FUNCTIONS.outputToTerminal("Generating Winner String");
		const { winners, tie } = params;

		// If we have 1 winner, there will be no glue. If we have 2, it'll be "and".
		// If we have more than two, we'll join with a comma.
		const glue = winners.length > 2 ? ", " : " and ";
		const winningNames = winners.map(winner => winner.name).join(glue);

		// When we save, we save with a comma.
		this.botData.thisWeeksWinners.push(winningNames.split(glue).join(","));

		let winnerText = "We have ";

		winnerText += tie ? "Winners! They are " : "a winner! It is ";
		winnerText += `${winningNames}.`;

		// winnerText += tie ? "\nRetrieving group order links..." : "\nRetrieving the group order link..."
		return Promise.resolve(winnerText);
	}

	handleError(e) {
		SUPPORT_FUNCTIONS.outputErrorToTerminal(e.message);
		SUPPORT_FUNCTIONS.outputErrorToTerminal(e.stack);
		try {
			this.postToChannel(`\*LUNCHBOT ERROR\*: \`${e.message}\``)
				.then(process.exit);
		} catch (err) {
			process.exit();
		}
	}

}

module.exports = LunchBot;
