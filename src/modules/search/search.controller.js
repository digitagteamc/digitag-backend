const { search: runSearch } = require('./search.service');
const { success } = require('../../utils/apiResponse');

async function search(req, res, next) {
    try {
        const { q, limit } = req.query;
        const results = await runSearch(req.user, q, limit ? parseInt(limit, 10) : 20);
        return success(res, { data: results });
    } catch (err) {
        next(err);
    }
}

module.exports = { search };
