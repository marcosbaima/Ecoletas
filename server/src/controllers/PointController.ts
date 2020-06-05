import express from 'express';
import db from '../database/connection';
import { celebrate, Joi } from 'celebrate';

import multer from 'multer';
import multerConfig from '../config/multer';

const PointController = express.Router();
const uploadMiddware = multer(multerConfig);

PointController.post(
    '',
    uploadMiddware.single('image'),
    celebrate(
        {
            body: Joi.object().keys({
                name: Joi.string().required(),
                email: Joi.string().required().email(),
                whatsapp: Joi.string().required(),
                city: Joi.string().required(),
                uf: Joi.string().required().max(2),
                lat: Joi.number().required(),
                lng: Joi.number().required(),
                items: Joi.array().required(),
            }),
        },
        {
            abortEarly: false,
        },
    ),
    async (req, res) => {
        const body = req.body;
        const items: number[] = String(req.body.items)
            .split(',')
            .map((i) => Number(i.trim()));

        delete body['items'];

        const point = { ...body, image: req.file.filename };

        const trx = await db.transaction();

        const points_id = await trx('points').insert(point);

        const point_id = points_id[0];

        const point_items = items.map((item_id) => ({ item_id, point_id }));

        await trx('point_items').insert(point_items);

        await trx.commit();

        return res.status(201).json({ ...point, point_id });
    },
);

PointController.get('/:id', async (req, res) => {
    const { id } = req.params;

    const point = await db('points').where('id', id).first();

    if (!point) {
        return res.status(404).json();
    }

    const items = await db('items')
        .join('point_items', 'items.id', '=', 'point_items.item_id')
        .where('point_items.point_id', point.id)
        .select('title', 'image');

    return res.json({ ...point, image_url: `http://localhost:8081/uploads/${point.image}`, items });
});

PointController.get('', (req, res) => {
    const { city, uf, items } = req.query;

    const sanalizedItems = String(items).split(',').map(Number);

    db('points')
        .join('point_items', 'points.id', '=', 'point_items.point_id')
        .whereIn('point_items.item_id', sanalizedItems)
        .where('city', String(city))
        .where('uf', String(uf))
        .distinct()
        .select('points.*')
        .then((data) => data.map((p) => ({ ...p, image_url: `http://localhost:8081/uploads/${p.image}` })))
        .then((data) => res.json(data));
});

export default PointController;
