// TODO: Add restaurants to ignore
// TODO: Add daily specials
// TODO: Add ability to save config
// TODO: Add ability to overrule LunchBot
// TODO: Restaurants shouldn't be saved to config
// TODO: Might be better to have channel ID as an environment variable too
var request = require('sync-request');
var phantom = require('phantom');
var chalk = require('chalk');
chalk.enabled = true;

const CONFIG = require('./config.json');
/**
 * Mask for creating the OrderUp URL. Replace $SLUG$ with the restaurant slug to build the full URL.
 */
const ORDERUP_ORDER_URL_MASK = 'https://orderup.com/restaurants/$SLUG$/delivery';

/**
 * Mask for creating the URL to check the time slots for a restaurant. Replace $SLUG$ with the restaurant slug to crete
 * the full URL.
 */
const ORDERUP_TIME_SLOTS_URL_MASK = 'https://orderup.com/restaurants/$SLUG$/delivery/time_slots.json';

/**
 * URL to request restaurant list from OrderUp.
 */
const RESTAURANT_LIST_URL = 'https://orderup.com/api/v2/restaurants?order_type=delivery' +
	'&lon=' + CONFIG.location.longitude +
	'&lat=' + CONFIG.location.latitude +
	'&market_id=' + CONFIG.location.marketID;

/**
 * list of possible valid poll options. Can have up to nine restaurants in a poll.
 */
const POSSIBLE_REACTIONS = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];

//Only need to log in once. In the case of a tie, we can skip the whole login block of code.
var isLoggedIn = false;
var page = null;
if (!process.env.orderup_login || !process.env.orderup_password) {
	outputErrorToTerminal('Missing orderup login or password. Please provide in the env.');
	console.log(process.env);
	process.exit();
}
const ORDERUP_LOGIN = process.env.orderup_login;
const ORDERUP_PASSWORD = process.env.orderup_password;

/**
 * Updates defaultRestaurants list with data from OrderUp.
 * 
 * @returns new list of restaurants
 */
function updateRestaurants() {
	var response = request('GET', RESTAURANT_LIST_URL);

	var newRestaurants = [];
	if (response.statusCode === 200) {
		// parse data into defaultRestaurants format
		var body = JSON.parse(response.body.toString('UTF-8'));
		body.restaurants.forEach(function (restaurant) {
			var categories = restaurant.restaurantCategories.filter(function (category) {
				// Remove categories in the ignore list.
				return !CONFIG.categoriesToIgnore.includes(category.name);
			});

			if (categories.length === 0) {
				// Don't add restaurants that don't have a category.
				return;
			} else if ((restaurant.yelpReviewCount === null) ||
				(restaurant.yelpReviewCount < CONFIG.yelp.minReviews) ||
				(restaurant.yelpRating === null) ||
				(restaurant.yelpRating < CONFIG.yelp.minRating)) {
				// Restaurant doesn't meet minimum rating requirements
				return;
			}
			//grab name from each item and join with a comma.
			var categoryList = categories.map(function (category) { return category.name; }).join(', ');
			var newRestaurant = {
				"name": restaurant.name,
				"categories": categories,
				"categoryList": categoryList,
				"slug": restaurant.slug,
				"restaurantURL": restaurant.yelpURL,
				"image": restaurant.yelpRatingImageUrlSmall,
				"yelpRating": restaurant.yelpRating,
				"yelpReviewCount": restaurant.yelpReviewCount
			};

			newRestaurants.push(newRestaurant);
		});
	}

	return newRestaurants;
}

/**
 * Select a set of restaurants.
 * 
 * @param restaurants The list of restaurants from which to select.
 * @param previouslySelectedRestaurants The list of restaurants that have previously been selected.
 */
var selectRestaurants = function (restaurants, previouslySelectedRestaurants) {
	if (!previouslySelectedRestaurants) {
		previouslySelectedRestaurants = [];
	}

	// TODO: This should be done on start up and saved to the config file.
	var restaurantsPerPoll = CONFIG.restaurantsPerPoll;
	if (typeof (restaurantsPerPoll) === 'undefined') {
		// Default to five restaurants per poll
		restaurantsPerPoll = 5;
	} if (restaurantsPerPoll < 2) {
		// Minimum of two restaurants in a poll
		restaurantsPerPoll = 2;
	} else if (restaurantsPerPoll > 9) {
		// Maximum of 9 restaurants in a poll
		restaurantsPerPoll = 9;
	}
	//Dump anything we've already selected this week.
	restaurants = restaurants.filter((restaurant, i) => {
		return !previouslySelectedRestaurants.join('').includes(restaurant.name);
	});

	// Select reactions for the number of restaurants
	var reactions = POSSIBLE_REACTIONS.slice(0, restaurantsPerPoll);
	var remainingRestaurants = [];
	var selectedRestaurants = [];
	// Select the number of restaurants as the number of reactions.
	for (let i = 0; i < reactions.length; ++i) {
		// Don't select restaurants that match the categories of the already selected restaurants.
		restaurants = filterRestaurants(restaurants, selectedRestaurants);

		if (restaurants.length > 0) {
			// Select random restaurant from remaining restaurant list.
			var restaurantIndex = Math.floor(Math.random() * restaurants.length);
			var selectedRestaurant = restaurants[restaurantIndex];
			selectedRestaurant.reaction = reactions[i];
			// Added selected restaurant to the list.
			selectedRestaurants.push(selectedRestaurant);
		} else {
			console.error('Not enough restaurants to provide the full list');
		}
	}

	return selectedRestaurants;
};

/**
 * Filters the restaurants down to whose categories have not been selected.
 * 
 * @param {any} restaurants The list of restaurants from which to select.
 * @param {any} selectedRestaurants This of already selected restaurants.
 */
function filterRestaurants(restaurants, selectedRestaurants) {
	// Get list of selected categories.
	var selectedCategories = [];
	selectedRestaurants.forEach(function (selectedRestaurant) {
		selectedRestaurant.categories.forEach(function (category) {
			if (selectedCategories.indexOf(category) < 0) {
				selectedCategories.push(category.id);
			}
		});
	});

	// Get restaurants whose categories have not already been selected
	var filteredRestaurants = restaurants.filter(function (restaurant) {
		// Find the categories where there is overlap
		var categories = restaurant.categories.map(function (category) { return category.id; });
		var categoryIntersection = intersect(selectedCategories, categories);

		if (categoryIntersection.length === 0) {
			return isOpenToday(restaurant);
		}

		// Keep if there is no overlap.
		return false;
	});

	return filteredRestaurants;
}

/**
 * Determines whether the restaurant is open today.
 * 
 * @param {any} restaurant 
 * @returns 
 */
function isOpenToday(restaurant) {
	var url = ORDERUP_TIME_SLOTS_URL_MASK.replace('$SLUG$', restaurant.slug);
	var response = request('GET', url);

	if (response.statusCode !== 200) {
		// TODO: Log error
		return false;
	}

	// parse data into defaultRestaurants format
	var body = JSON.parse(response.body.toString('UTF-8'));

	if (typeof body.days === 'undefined') {
		return false;
	}

	var isOpen = false;
	body.days.forEach(function (day) {
		if (day.display === 'Today') {
			isOpen = true;
		}
	});

	return isOpen;
}

/**
 * Determine the intersection of two arrays.
 * 
 * @param {any} array1 The first array.
 * @param {any} array2 The second array.
 * @returns The elements where the two arrays intersect.
 */
function intersect(array1, array2) {
	if (array2.length > array1.length) {
		var temp = array2;
		array2 = array1;
		array1 = temp;
	}

	// indexOf to loop over shorter
	var intersection = array1.filter(function (e) {
		return array2.indexOf(e) > -1;
	});

	return intersection;
}

/**
 * Lists all of the unique categories returned from OrderUp.
 */
function listCategories() {
	var categories = {};
	var restaurants = updateRestaurants();
	restaurants.forEach(function (restaurant) {
		restaurant.categories.forEach(function (category) {
			categories[category.name] = category;
		});
	});

	var keys = Object.keys(categories);
	outputToTerminal('There are ' + keys.length + ' available');
	for (var key in categories) {
		var value = categories[key];
		outputToTerminal(value.name);
	}
}

/**
 * 
 * Given a login url for orderup, and a restaurant object, this function will log in, start a group order, and return the link.
 * @param {Object} params
 * @param {Object} param.restaurant.
 * @param {string} param.loginURL.
 * @returns {string} link to the group order.
 * 
 */
function retrieveOrderLink(params) {
	let { restaurant, loginURL } = params;
	outputToTerminal("Handling order link", restaurant);
	var phantomInstance = null;
	var restaurantURL = 'https://orderup.com/restaurants/' + restaurant.slug + '/delivery';

	return new Promise(function (resolve, reject) {
		if (!isLoggedIn) {
			phantom.create()
				.then(instance => {
					phantomInstance = instance;
					return phantomInstance.createPage()
				})
				.then(function (pg) {
					page = pg;
					page.setting('userAgent', 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/37.0.2062.120 Safari/537.36');
					page.open(loginURL)
						.then(function (status) {
							outputToTerminal('Checking ' + loginURL + '...');
							login()
								.then(function () {
									isLoggedIn = true;
									return;
								})
								.then(generateShareLink.bind(null, restaurantURL))
								.then(resolve)
								.catch(reject);
						});
				})
				.catch(reject);
		} else {
			generateShareLink(restaurantURL)
				.then(resolve)
				.catch(reject);
		}
	});

}
function login() {
	return new Promise(function (resolve, reject) {
		outputToTerminal("Filling out email");
		page.evaluate(function () {
			const ORDERUP_LOGIN = process.env.orderup_login;
			return document.getElementById('email').value = ORDERUP_LOGIN;
		}).then(function () {
			outputToTerminal("Filling out pw");
			page.evaluate(function () {
				const ORDERUP_PASSWORD = process.env.orderup_password;
				return document.getElementById('password').value = ORDERUP_PASSWORD;
			}).then(function () {
				outputToTerminal("Clicking Submit");
				page.evaluate(function () {
					return document.querySelector('.submit-form').click();
				})
					.then(function () {
						outputToTerminal('Waiting 3 seconds.');
						setTimeout(resolve, 3000);
					})
			});
		});
	})
}
function generateShareLink(restaurantURL) {
	return new Promise(function (resolve, reject) {
		outputToTerminal('Opening', restaurantURL);
		page.open(restaurantURL)
			.then(function (status) {
				outputToTerminal(status, 'STATUS');
				if (status === 'fail') {
					return reject({
						message: `Failed to load restaurant URL:${restaurantURL}`
					})
				}
				page.evaluate(function () {
					var button = document.getElementById('#create-group-order');
					if (button) {
						button.click();
					} else {
						return reject('Button not found');
					}
				}).then(function () {
					setTimeout(function () {
						page.evaluate(function () {
							return document.querySelector('.share-link > button').getAttribute('data-clipboard-text');
						})
							.then(link => resolve(link));
					}, 1000)
				});
			});
	});
};

function outputToTerminal() {
	for (let i = 0; i < arguments.length; i++) {
		let arg = arguments[i];
		console.log(chalk.cyan(arg));
	}
}
function outputErrorToTerminal() {
	for (let i = 0; i < arguments.length; i++) {
		let arg = arguments[i];
		console.log(chalk.red(arg));
	}
}
module.exports.outputErrorToTerminal = outputErrorToTerminal;
module.exports.outputToTerminal = outputToTerminal;
module.exports.generateShareLink = generateShareLink;
module.exports.retrieveOrderLink = retrieveOrderLink;
module.exports.login = login;
module.exports.isOpenToday = isOpenToday;
module.exports.updateRestaurants = updateRestaurants;
module.exports.selectRestaurants = selectRestaurants;
module.exports.filterRestaurants = filterRestaurants;
module.exports.intersect = intersect;
