"use strict";
const async = require("async");
const GoogleSpreadsheet = require("google-spreadsheet");
const support = require("../SupportFunctions");

class RestaurantFetcher {
	constructor() {
		this.spreadsheetKey = "1R6lYIdGdvni6rEKaaBRykqF0WsT56DuuiANKjP6ZDEU";
		this.doc = new GoogleSpreadsheet(this.spreadsheetKey);
		this.sheet = null;
		this.getSheet = this.getSheet.bind(this);
		this.getDataFromSheet = this.getDataFromSheet.bind(this);
		this.selectRestaurants = this.selectRestaurants.bind(this);
		this.fetchRestaurants = this.fetchRestaurants.bind(this);
	}
	fetchRestaurants(cb) {
		return async.series([this.getSheet, this.getDataFromSheet], err => {
			console.log("finished");
			if (cb) {
				return cb(err, this.restaurants);
			}
		});
	}
	selectRestaurants(previousWinners = []) {
		return support.selectRestaurants(this.restaurants, previousWinners);
	}
	getSheet(done) {
		console.log("Retrieving doc...");
		this.doc.getInfo((err, info) => {
			console.log(`Loaded doc: ${info.title} by ${info.author.email}`);
			this.sheet = info.worksheets[0];
			const sheet = this.sheet;
			console.log(`sheet 1: ${sheet.title} ${sheet.rowCount}x${sheet.colCount}`);
			done(err);
		});
	}
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
