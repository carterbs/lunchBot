"use strict";
const async = require("async");
const GoogleSpreadsheet = require("google-spreadsheet");
const support = require("../SupportFunctions");
const CONFIG = require("../config.json");

/**
 * Little class to manage retrieval of a list of restaurants from a google spreadsheet. Also handles
 * the selection of restauarants used by LunchBot.
*/
class RestaurantFetcher {
	constructor() {
		this.spreadsheetKey = CONFIG.google_sheets_key;
		this.doc = new GoogleSpreadsheet(this.spreadsheetKey);
		this.sheet = null;
		this.getSheet = this.getSheet.bind(this);
		this.getDataFromSheet = this.getDataFromSheet.bind(this);
		this.selectRestaurants = this.selectRestaurants.bind(this);
		this.fetchRestaurants = this.fetchRestaurants.bind(this);
	}
	/**
	 * Goes and fetches the worksheet from google docs.
	 * @param {Function} cb
	 */
	fetchRestaurants(cb) {
		return async.series([this.getSheet, this.getDataFromSheet], err => {
			if (cb) {
				return cb(err, this.restaurants);
			}
		});
	}
	/**
	 * Uses the fetched restaurantList randomly selects restaurants.
	 * @param {Array} previousWinners
	 */
	selectRestaurants(previousWinners = []) {
		return support.selectRestaurants(this.restaurants, previousWinners);
	}
	/**
	 * Handles the call to google docs and stores the sheet as an object on the class.
	 * @param {Function} done
	 */
	getSheet(done) {
		console.log("Retrieving doc...");
		this.doc.getInfo((err, info) => {
			console.log(`Loaded doc: ${info.title} by ${info.author.email}`);
			this.sheet = info.worksheets[0];
			done(err);
		});
	}
	/**
	 * Parses the datasheet, creating the list of restaurants.
	 * @param {*} done
	 */
	getDataFromSheet(done) {
		this.sheet.getRows({
			offset: 1,
			limit: 100
		}, (err, rows) => {
			this.restaurants = [];
			rows.forEach(row => {
				this.restaurants.push({
					name: row.name,
					categories: row.categories.split(","),
					service: row.service
				});
			});
			done(err);
		});
	}
}

module.exports = new RestaurantFetcher();
