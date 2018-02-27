"use strict";
const clone = require("lodash.clonedeep");
const outputToTerminal = require("../SupportFunctions").outputToTerminal;

class BotStorage {
	constructor(bot, botkitController) {
		this.bot = bot;
		this.botkitController = botkitController;
	}
	retrieve(field) {
		outputToTerminal("Bot retrieving data");
		return new Promise((resolve, reject) => {
			this.botkitController.storage.users.get(this.bot.identity.id, (err, data) => {
				outputToTerminal(err, data);
				if (err) return reject(err);
				if (data) {
					if (field) {
						resolve(data[field]);
					} else {
						resolve(data);
					}
				} else {
					outputToTerminal("No data found");
					resolve(null);
				}
			});
		});
	}

	save(field, value) {
		if (arguments.length === 1) {
			value = clone(field);
			field = null;
		}
		return new Promise((resolve, reject) => {
			if (this.bot.botData && field) {
				this.bot.botData[field] = value;
			} else {
				this.bot.botData = value;
			}

			try {
				this.botkitController.storage.users.save({ id: this.bot.identity.id, data: this.bot.botData }, resolve);
			} catch (e) {
				reject(e);
			}
		});
	}
}

module.exports = BotStorage;
