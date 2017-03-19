// TODO: Add restaurants to ignore
// TODO: Add daily specials
// TODO: Add ability to save config
// TODO: Add ability to overrule lunchbot
var request = require('sync-request');
var CONFIG = require('./config.json');
/**
 * Mask for creating the OrderUp URL. Replace $SLUG$ with the restaurant slug to build the full URL.
 */
var ORDERUP_ORDER_URL_MASK = 'https://orderup.com/restaurants/$SLUG$/delivery';

/**
 * URL to request restaurant list from OrderUp.
 */
var RESTAURANT_LIST_URL = 'https://orderup.com/api/v2/restaurants?order_type=delivery' +
    '&lon=' + CONFIG.location.longitude +
    '&lat=' + CONFIG.location.latitude +
    '&market_id=' + CONFIG.location.marketID;

/**
 * list of possible valid poll options. Can have up to nine restaurants in a poll.
 */
var POSSIBLE_REACTIONS = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];

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
            var categoryList = categories.map(function (category) { return category.name }).join(', ');
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

    var restaurantsPerPoll = CONFIG.restaurantsPerPoll;
    if (typeof(restaurantsPerPoll) === 'undefined') {
        // Default to five restaurants per poll
        restaurantsPerPoll = 5;
    } if (restaurantsPerPoll < 2) {
        // Minimum of two restaurants in a poll
        restaurantsPerPoll = 2;
    } else if (restaurantsPerPoll > 9) {
        // Maximum of 9 restaurants in a poll
        restaurantsPerPoll = 9;
    }

    // Select reactions for the number of restaurants
    var reactions = POSSIBLE_REACTIONS.slice(0, restaurantsPerPoll);
    var remainingRestaurants = [];
    var selectedRestaurants = previouslySelectedRestaurants.slice();

    // Select the number of restaurants as the number of reactions.
    for (var i = 0; i < reactions.length; ++i) {
        // Don't select restaurants that match the categories of the already selected restaurants.
        restaurants = filterRestaurants(restaurants, selectedRestaurants);

        // Select random restaurant from remaining restaurant list.
        var restaurantIndex = Math.floor(Math.random() * restaurants.length);
        var selectedRestaurant = restaurants[restaurantIndex];
        selectedRestaurant.reaction = reactions[i];
        // Added selected restaurant to the list.
        selectedRestaurants.push(selectedRestaurant);
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
    console.log(selectedRestaurants);
    selectedRestaurants.forEach(function (selectedRestaurant) {
        console.log(selectedRestaurant);
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

        // Keep if there is no overlap.
        return categoryIntersection.length === 0;
    });

    return filteredRestaurants;
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
    console.log('There are ' + keys.length + ' available');
    for (var key in categories) {
        var value = categories[key];
        console.log(value.name);
    }
}

module.exports.updateRestaurants = updateRestaurants;
module.exports.selectRestaurants = selectRestaurants;
module.exports.filterRestaurants = filterRestaurants;
module.exports.intersect = intersect;
