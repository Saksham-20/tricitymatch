const morgan = require('morgan');

const logger = morgan('combined', {
  skip: (req, res) => {
    return process.env.NODE_ENV === 'production' && res.statusCode < 400;
  }
});

module.exports = logger;

