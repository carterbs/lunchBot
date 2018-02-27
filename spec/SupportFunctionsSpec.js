"use strict";
const CONFIG = require("../config.json");
const SUPPORT_FUNCTIONS = require("../SupportFunctions.js");
const reporters = require("jasmine-reporters");
const RestaurantFetcher = require("../classes/RestaurantFetcher");
/* global jasmine, expect, fail */
jasmine.getEnv().addReporter(new reporters.TerminalReporter({
	verbosity: 5,
	color: true,
	showStack: true
}));

describe("Testing default configuration", () => {
	it("Test configuration", () => {
		expect(CONFIG).toBeDefined("CONFIG is not defined");
		expect(CONFIG.restaurantsPerPoll).toBeDefined("restaurantsPerPoll is not defined");
		expect(CONFIG.restaurantsPerPoll).toBeGreaterThanOrEqual(2, "restaurantsPerPoll is too low");
		expect(CONFIG.restaurantsPerPoll).toBeLessThanOrEqual(9, "restaurantsPerPoll is too high");

		expect(CONFIG.yelp).toBeDefined("yelp object not defined");
		expect(CONFIG.yelp.minRating).toBeDefined("yelp min rating is not defined");
		expect(CONFIG.yelp.minRating).toBeGreaterThan(0, "Minimum rating must be greater than zero");
		expect(CONFIG.yelp.minRating).toBeLessThanOrEqual(5, "The maximum rating is less than or equal to 5");

		expect(CONFIG.yelp.minReviews).toBeDefined("yelp min review count not defined");
		expect(CONFIG.yelp.minReviews).toBeGreaterThan(0, "Minimum review count must be greater than zero");
	});
});

describe("SupportFunctions Tests", () => {
	let restaurants;

	it("Testing support functions", () => {
		expect(SUPPORT_FUNCTIONS).toBeDefined("SupportFunctions is not defined");

		expect(SUPPORT_FUNCTIONS.selectRestaurants).toBeDefined("selectRestaurants is not defined");

		expect(SUPPORT_FUNCTIONS.filterRestaurants).toBeDefined("filterRestaurants is not defined");

		expect(SUPPORT_FUNCTIONS.intersect).toBeDefined("intersect is not defined");
	});

	it("test intersect", () => {
		const array1 = ["a", "b", "c"];
		const array2 = ["b", "c", "d"];
		const array3 = ["c", "d", "e"];
		const array4 = ["d", "e", "f"];

		let intersection = SUPPORT_FUNCTIONS.intersect(array1, array1);
		expect(intersection !== null).toBe(true, "intersect returned null");
		expect(intersection.length)
			.toBe(array1.length, "The intersection of an array with itself should be equal to the array length");

		intersection = SUPPORT_FUNCTIONS.intersect(array1, array2);
		expect(intersection !== null).toBe(true, "intersect returned null");
		expect(intersection.length)
			.toBe(array1.length - 1, "The intersection length should be one less than the array1 length");

		intersection = SUPPORT_FUNCTIONS.intersect(array1, array3);
		expect(intersection !== null).toBe(true, "intersect returned null");
		expect(intersection.length)
			.toBe(array1.length - 2, "The intersection length should be two less than the array1 length");

		intersection = SUPPORT_FUNCTIONS.intersect(array1, array4);
		expect(intersection !== null).toBe(true, "intersect returned null");
		expect(intersection.length)
			.toBe(0, "Arrays do not intersect, so the intersection length should be zero");
	});

	it("Test RestaurantFetcher", done => {
		RestaurantFetcher.fetchRestaurants((err, list) => {
			if (err) return fail(err);
			restaurants = list;
			expect(restaurants !== null).toBe(true, "RestaurantFetcher.fetchRestaurants returned null");
			expect(restaurants.length).toBeGreaterThan(0, "RestaurantFetcher.fetchRestaurants returned no results");

			restaurants.forEach(restaurant => {
				expect(restaurant !== null).toBe(true, "restaurant is null");
				expect(restaurant.name).toBeDefined("Restaurant name is not defined");

				// Check restaurant name
				const name = restaurant.name;
				expect(name !== null).toBe(true, "Restaurant name is null");
				expect(name.length).toBeGreaterThan(0, "Restaurant name is empty");

				// Check categories
				expect(restaurant.categories).toBeDefined(`Categories not defined for: ${name}`);
				expect(restaurant.categories.length).toBeGreaterThan(0, `No categories in categories list for: ${name}`);

				const categories = restaurant.categories;

				const intersection = SUPPORT_FUNCTIONS.intersect(CONFIG.categoriesToIgnore, categories);
				expect(intersection.length).toBe(0, `Restaurant has ignored categories: ${name}`);
			});
			done();
		});

	});

	it("Test selected restaurants", () => {
		let randomRestaurants = SUPPORT_FUNCTIONS.selectRestaurants(restaurants);
		console.log(randomRestaurants);
		expect(randomRestaurants !== null).toBe(true, "selectRestaurants returned null");
		expect(randomRestaurants.length)
			.toBe(CONFIG.restaurantsPerPoll, "Number of selected restaurants does not match configuration");

		// Verify poll doesn't contain duplicates.
		const categories = [];
		randomRestaurants.forEach(restaurant => {
			restaurant.categories.forEach(category => {
				expect(categories.indexOf(category))
					.toBe(-1, `Category has already been selected: ${category}`);
				categories.push(category);
			});
		});
		// Save number of restaurants per poll to restore later.
		const restaurantsPerPoll = CONFIG.restaurantsPerPoll;

		// Check default number of polls
		CONFIG.restaurantsPerPoll = undefined;
		randomRestaurants = SUPPORT_FUNCTIONS.selectRestaurants(restaurants);
		expect(randomRestaurants !== null).toBe(true, "selectRestaurants returned null");
		expect(randomRestaurants.length)
			.toBe(5, "The default number of restaurants should be 5");

		CONFIG.restaurantsPerPoll = 0;
		randomRestaurants = SUPPORT_FUNCTIONS.selectRestaurants(restaurants);
		expect(randomRestaurants !== null).toBe(true, "selectRestaurants returned null");
		expect(randomRestaurants.length)
			.toBe(2, "The minimum number of restaurants should be 2");

		CONFIG.restaurantsPerPoll = 10;
		randomRestaurants = SUPPORT_FUNCTIONS.selectRestaurants(restaurants);
		expect(randomRestaurants !== null).toBe(true, "selectRestaurants returned null");
		expect(randomRestaurants.length)
			.toBe(9, "The maximum number of restaurants should be 9");

		CONFIG.restaurantsPerPoll = restaurantsPerPoll;
	});

});
