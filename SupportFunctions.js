// TODO: Add restaurants to ignore
// TODO: Add daily specials
// TODO: Add ability to save config
// TODO: Add ability to overrule LunchBot
// TODO: Restaurants shouldn't be saved to config
// TODO: Might be better to have channel ID as an environment variable too
"use strict";
const chalk = require("chalk");
chalk.enabled = true;

const CONFIG = require("./config.json");
/**
 * list of possible valid poll options. Can have up to nine restaurants in a poll.
 */
const POSSIBLE_REACTIONS = ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];


/**
 * Determine the intersection of two arrays.
 *
 * @param {any} array1 The first array.
 * @param {any} array2 The second array.
 * @returns The elements where the two arrays intersect.
 */
function intersect(array1, array2) {
	if (array2.length > array1.length) {
		const temp = array2;
		array2 = array1;
		array1 = temp;
	}

	// indexOf to loop over shorter
	const intersection = array1.filter(e => array2.indexOf(e) > -1);

	return intersection;
}

/**
 * Filters the restaurants down to whose categories have not been selected.
 *
 * @param {any} restaurants The list of restaurants from which to select.
 * @param {any} selectedRestaurants This of already selected restaurants.
 */
function filterRestaurants(restaurants, selectedRestaurants) {
	// Get list of selected categories.
	const selectedCategories = [];
	selectedRestaurants.forEach(selectedRestaurant => {
		selectedRestaurant.categories.forEach(category => {
			if (selectedCategories.indexOf(category) < 0) {
				selectedCategories.push(category);
			}
		});
	});

	// Get restaurants whose categories have not already been selected
	const filteredRestaurants = restaurants.filter(restaurant => {
		// Find the categories where there is overlap
		const categories = restaurant.categories;
		const categoryIntersection = intersect(selectedCategories, categories);

		if (categoryIntersection.length === 0) {
			return true;
		}

		// Keep if there is no overlap.
		return false;
	});

	return filteredRestaurants;
}

/**
 * Select a set of restaurants.
 *
 * @param restaurants The list of restaurants from which to select.
 * @param previouslySelectedRestaurants The list of restaurants that have previously been selected.
 */
function selectRestaurants(restaurants, previouslySelectedRestaurants) {
	if (!previouslySelectedRestaurants) {
		previouslySelectedRestaurants = [];
	}

	// TODO: This should be done on start up and saved to the config file.
	let restaurantsPerPoll = CONFIG.restaurantsPerPoll;
	if (typeof (restaurantsPerPoll) === "undefined") {
		// Default to five restaurants per poll
		restaurantsPerPoll = 5;
	}

	if (restaurantsPerPoll < 2) {
		// Minimum of two restaurants in a poll
		restaurantsPerPoll = 2;
	} else if (restaurantsPerPoll > 9) {
		// Maximum of 9 restaurants in a poll
		restaurantsPerPoll = 9;
	}
	// Dump anything we've already selected this week.
	restaurants = restaurants.filter(restaurant => !previouslySelectedRestaurants.join("").includes(restaurant.name));

	// Select reactions for the number of restaurants
	const reactions = POSSIBLE_REACTIONS.slice(0, restaurantsPerPoll);
	const selectedRestaurants = [];
	// Select the number of restaurants as the number of reactions.
	for (let i = 0; i < reactions.length; ++i) {
		// Don't select restaurants that match the categories of the already selected restaurants.
		restaurants = filterRestaurants(restaurants, selectedRestaurants);

		if (restaurants.length > 0) {
			// Select random restaurant from remaining restaurant list.
			const restaurantIndex = Math.floor(Math.random() * restaurants.length);
			const selectedRestaurant = restaurants[restaurantIndex];
			selectedRestaurant.reaction = reactions[i];
			// Added selected restaurant to the list.
			selectedRestaurants.push(selectedRestaurant);
		} else {
			console.error("Not enough restaurants to provide the full list");
		}
	}

	return selectedRestaurants;
}

function outputToTerminal() {
	for (let i = 0; i < arguments.length; i++) {
		const arg = arguments[i];
		console.log(chalk.cyan(arg));
	}
}

function outputErrorToTerminal() {
	for (let i = 0; i < arguments.length; i++) {
		const arg = arguments[i];
		console.log(chalk.red(arg));
	}
}
module.exports.outputErrorToTerminal = outputErrorToTerminal;
module.exports.outputToTerminal = outputToTerminal;
module.exports.selectRestaurants = selectRestaurants;
module.exports.filterRestaurants = filterRestaurants;
module.exports.intersect = intersect;
