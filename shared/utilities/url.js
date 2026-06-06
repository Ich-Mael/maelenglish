/**
 * Returns the base URL for the current request, correctly handling
 * reverse proxies (Render, Heroku, nginx) that set X-Forwarded-Proto.
 *
 * Priority:
 *  1. APP_URL env var (e.g. "https://www.afrohk.com") — set this in production
 *  2. X-Forwarded-Proto header (set by Render's load balancer)
 *  3. req.protocol (Express default, works locally)
 */
module.exports.getBaseUrl = function getBaseUrl(req) {
    if (process.env.APP_URL) {
        return process.env.APP_URL.replace(/\/$/, ''); // strip trailing slash
    }
    const proto = req.headers['x-forwarded-proto'] || req.protocol;
    return `${proto}://${req.get('host')}`;
};
