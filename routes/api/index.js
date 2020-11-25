const router = require('express').Router();

router.use('/files', require('./files'));
router.get('/', (_req, res) => res.render('api'));

module.exports = router;