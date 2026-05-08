const SerpApi = require("google-search-results-nodejs");
const { SERP_API_KEY } = require("./apiKeys");

const serpSearch = new SerpApi.GoogleSearch(SERP_API_KEY);

module.exports = serpSearch;
