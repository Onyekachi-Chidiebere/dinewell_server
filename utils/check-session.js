
const jwt = require('jsonwebtoken');
/**
 * this ensures a user is logged in  and has an active session before accessing some routes
 */
const checkSession = (req, res, next) => {
    try {
        //get token from request header
        const token = req?.headers?.authorization?.split(' ')[1];
        if (!token)
            return res.status(403).send({
                code: 'E403',
                message: 'No access token provided'
            })

        //verify token with secret key
        jwt.verify(token, process.env.JSON_WEB_SECRET);

        //allow route to continue if access is granted
        return next();
    } catch (error) {

        //stop user and return error if any
        return res.status(401).send({
            code: 'E401',
            message: 'Token expired'
        })

    }
};

module.exports = checkSession;