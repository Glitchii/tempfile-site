import { Router } from 'express';
import { router as filesRouter } from './files.js';

const router = Router();

router.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
})

router.use('/files', filesRouter);
router.get('/', (_req, res) => res.render('api', { apiPage: true }));

export { router };