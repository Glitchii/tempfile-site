const router = require('express').Router();

router.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
})
router.use('/files', require('./files'));
router.get('/', (_req, res) => res.render('api'));

module.exports = router;