console.log('SupportFunctionsTests');
const CONFIG = require('../config.json');
const SUPPORT_FUNCTIONS = require('../SupportFunctions.js');

describe('Testing default configuration', function () {
    it('Test configuration', function () {
        expect(CONFIG).toBeDefined('CONFIG is not defined');
        expect(CONFIG.restaurantsPerPoll).toBeDefined('restaurantsPerPoll is not defined');
        expect(CONFIG.restaurantsPerPoll).toBeGreaterThanOrEqual(2, 'restaurantsPerPoll is too low');
        expect(CONFIG.restaurantsPerPoll).toBeLessThanOrEqual(9, 'restaurantsPerPoll is too high');

        expect(CONFIG.yelp).toBeDefined('yelp object not defined');
        expect(CONFIG.yelp.minRating).toBeDefined('yelp min rating is not defined');
        expect(CONFIG.yelp.minRating).toBeGreaterThan(0, 'Minimum rating must be greater than zero');
        expect(CONFIG.yelp.minRating).toBeLessThanOrEqual(5, 'The maximum rating is less than or equal to 5');

        expect(CONFIG.yelp.minReviews).toBeDefined('yelp min review count not defined');
        expect(CONFIG.yelp.minReviews).toBeGreaterThan(0, 'Minimum review count must be greater than zero');
    });
});

describe("SupportFunctions Tests", function () {
    var restaurants;

    it('Testing support functions', function () {
        expect(SUPPORT_FUNCTIONS).toBeDefined('SupportFunctions is not defined');

        expect(SUPPORT_FUNCTIONS.updateRestaurants).toBeDefined('updateRestaurants is not defined');

        expect(SUPPORT_FUNCTIONS.selectRestaurants).toBeDefined('selectRestaurants is not defined');

        expect(SUPPORT_FUNCTIONS.filterRestaurants).toBeDefined('filterRestaurants is not defined');

        expect(SUPPORT_FUNCTIONS.intersect).toBeDefined('intersect is not defined');
    });

    it('test intersect', function () {
        var array1 = ['a', 'b', 'c'];
        var array2 = ['b', 'c', 'd'];
        var array3 = ['c', 'd', 'e'];
        var array4 = ['d', 'e', 'f'];

        var intersection = SUPPORT_FUNCTIONS.intersect(array1, array1);
        expect(intersection !== null).toBe(true, 'intersect returned null');
        expect(intersection.length)
            .toBe(array1.length, 'The intersection of an array with itself should be equal to the array length');

        intersection = SUPPORT_FUNCTIONS.intersect(array1, array2);
        expect(intersection !== null).toBe(true, 'intersect returned null');
        expect(intersection.length)
            .toBe(array1.length - 1, 'The intersection length should be one less than the array1 length');

        intersection = SUPPORT_FUNCTIONS.intersect(array1, array3);
        expect(intersection !== null).toBe(true, 'intersect returned null');
        expect(intersection.length)
            .toBe(array1.length - 2, 'The intersection length should be two less than the array1 length');

        intersection = SUPPORT_FUNCTIONS.intersect(array1, array4);
        expect(intersection !== null).toBe(true, 'intersect returned null');
        expect(intersection.length)
            .toBe(0, 'Arrays do not intersect, so the intersection length should be zero');
    });

    it('Test updateRestaurants', function () {
        restaurants = SUPPORT_FUNCTIONS.updateRestaurants();
        expect(restaurants !== null).toBe(true, 'updateRestaurants returned null');
        expect(restaurants.length).toBeGreaterThan(0, 'updateRestaurants returned no results');

        restaurants.forEach(function (restaurant) {
            expect(restaurant !== null).toBe(true, 'restaurant is null');
            expect(restaurant.name).toBeDefined('Restaurant name is not defined');

            // Check restaurant name
            var name = restaurant.name;
            expect(name !== null).toBe(true, 'Restaurant name is null');
            expect(name.length).toBeGreaterThan(0, 'Restaurant name is empty');

            // Check yelp ratings
            expect(restaurant.yelpRating).toBeDefined('Yelp rating is not defined for: ' + name);
            expect(restaurant.yelpRating).toBeGreaterThanOrEqual(
                CONFIG.yelp.minRating, 'Yelp rating is too low for: ' + name);
            expect(restaurant.yelpReviewCount).toBeDefined('Yelp review count not defined for:' + name);
            expect(restaurant.yelpReviewCount).toBeGreaterThanOrEqual(
                CONFIG.yelp.minReviews, 'Yelp review count is too low for: ' + name);

            // Check categories
            expect(restaurant.categories).toBeDefined('Categories not defined for: ' + name);
            expect(restaurant.categories.length).toBeGreaterThan(0, 'No categories in categories list for: ' + name);

            var categories = [];
            restaurant.categories.forEach(function (category) {
                categories.push(category.name);
            });

            var intersection = SUPPORT_FUNCTIONS.intersect(CONFIG.categoriesToIgnore, categories);
            expect(intersection.length).toBe(0, 'Restaurant has ignored categories: ' + name);
        });
    });

    it('Test selected restaurants', function () {
        var randomRestaurants = SUPPORT_FUNCTIONS.selectRestaurants(restaurants);
        expect(randomRestaurants !== null).toBe(true, 'selectRestaurants returned null');
        expect(randomRestaurants.length)
            .toBe(CONFIG.restaurantsPerPoll, 'Number of selected restaurants does not match configuration');

        // Verify poll doesn't contain duplicates.
        var categories = [];
        randomRestaurants.forEach(function (restaurant) {
            restaurant.categories.forEach(function (category) {
                expect(categories.indexOf(category.name))
                    .toBe(-1, 'Category has already been selected: ' + category.name);
                categories.push(category.name);
            });
        });

        // Save number of restaurants per poll to restore later.
        var restaurantsPerPoll = CONFIG.restaurantsPerPoll;
        
        // Check default number of polls
        CONFIG.restaurantsPerPoll = undefined;
        randomRestaurants = SUPPORT_FUNCTIONS.selectRestaurants(restaurants);
        expect(randomRestaurants !== null).toBe(true, 'selectRestaurants returned null');
        expect(randomRestaurants.length)
            .toBe(5, 'The default number of restaurants should be 5');

        CONFIG.restaurantsPerPoll = 0;
        randomRestaurants = SUPPORT_FUNCTIONS.selectRestaurants(restaurants);
        expect(randomRestaurants !== null).toBe(true, 'selectRestaurants returned null');
        expect(randomRestaurants.length)
            .toBe(2, 'The minimum number of restaurants should be 2');

        CONFIG.restaurantsPerPoll = 10;
        randomRestaurants = SUPPORT_FUNCTIONS.selectRestaurants(restaurants);
        expect(randomRestaurants !== null).toBe(true, 'selectRestaurants returned null');
        expect(randomRestaurants.length)
            .toBe(9, 'The maximum number of restaurants should be 9');

        CONFIG.restaurantsPerPoll = restaurantsPerPoll;
    });
});


// /**
//  * Simulate running the poll for a week, removing selected restaurants from the pool.
//  */
// function testWeek() {
//     var restaurants = updateRestaurants();
//     console.log('Restaurant count: ' + restaurants.length);

//     var days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
//     var selectedRestaurants = [];
//     days.forEach(function (day) {
//         var randomRestaurants = selectRestaurants(restaurants, selectedRestaurants);

//         console.log(day + '-------------------------------------------------');
//         console.log('Number of restaurants selected: ' + randomRestaurants.length);
//         console.log('Selected Restaurants:');
//         randomRestaurants.forEach(function (restaurant) {
//             var categories = '';
//             restaurant.categories.forEach(function (category) {
//                 if (categories.length > 0) {
//                     categories += ', ';
//                 }

//                 categories += category.name;
//             });

//             console.log('\t' + restaurant.name + '\t(' + categories + ')');
//         });

//         var restaurantIndex = Math.floor(Math.random() * 5);
//         var selectedRestaurant = randomRestaurants[restaurantIndex]
//         console.log('\tSelected Restaurant: ' + selectedRestaurant.name);

//         // Save selected restaurant for exclusion from future days.
//         selectedRestaurants.push(selectedRestaurant);
//     });
// }
