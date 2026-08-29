const dishService = require('../services/dishService');

function fileFromBase64(part, fallbackName) {
  if (!part?.base64) return null;
  const raw = String(part.base64).replace(/^data:[^;]+;base64,/, '');
  const buffer = Buffer.from(raw, 'base64');
  if (!buffer.length) return null;
  return {
    buffer,
    originalname: part.fileName || fallbackName,
    mimetype: part.type || part.mimeType || 'image/jpeg',
  };
}

exports.createDish = async (req, res) => {
  try {
    const { restaurant_id, ...dishData } = req.body;
    const dishImageFile = req.file; // Multer will attach the file here

    if (!restaurant_id) {
      return res.status(400).json({ error: 'restaurant_id is required.' });
    }

    const newDish = await dishService.createDish(dishData, restaurant_id, dishImageFile);
    res.status(201).json(newDish);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

/**
 * JSON/base64 create — React Native Android multipart FormData often fails with ERR_NETWORK.
 */
exports.createDishBase64 = async (req, res) => {
  try {
    const { restaurant_id, dishImage, ...dishData } = req.body || {};
    if (!restaurant_id) {
      return res.status(400).json({ error: 'restaurant_id is required.' });
    }
    if (!dishData.dish_name || dishData.price === undefined || dishData.price === '') {
      return res.status(400).json({ error: 'dish_name and price are required.' });
    }
    const dishImageFile = fileFromBase64(dishImage, 'dish.jpg');
    console.log('[createDishBase64]', {
      restaurant_id,
      hasImage: !!dishImageFile,
      bytes: dishImageFile?.buffer?.length || 0,
    });
    const newDish = await dishService.createDish(dishData, restaurant_id, dishImageFile);
    res.status(201).json(newDish);
  } catch (err) {
    console.error('createDishBase64 error:', err);
    res.status(400).json({ error: err.message });
  }
};

exports.getDish = async (req, res) => {
  try {
    const { id } = req.params;
    const { restaurant_id } = req.query;

    if (!restaurant_id) {
      return res.status(400).json({ error: 'restaurant_id is required.' });
    }

    const dish = await dishService.getDishById(id, restaurant_id);
    res.json(dish);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
};

exports.getRestaurantDishes = async (req, res) => {
  try {
    const { restaurantId, searchQuery } = req.params;

    const dishes = await dishService.getDishesByRestaurant(restaurantId, searchQuery);
    res.json(dishes);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.updateDish = async (req, res) => {
  try {
    const { id } = req.params;
    const { restaurant_id, ...dishData } = req.body;
    const dishImageFile = req.file;

    if (!restaurant_id) {
      return res.status(400).json({ error: 'restaurant_id is required.' });
    }

    const updatedDish = await dishService.updateDish(id, restaurant_id, dishData, dishImageFile);
    res.json(updatedDish);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.updateDishBase64 = async (req, res) => {
  try {
    const { id } = req.params;
    const { restaurant_id, dishImage, ...dishData } = req.body || {};
    if (!restaurant_id) {
      return res.status(400).json({ error: 'restaurant_id is required.' });
    }
    const dishImageFile = fileFromBase64(dishImage, 'dish.jpg');
    const updatedDish = await dishService.updateDish(id, restaurant_id, dishData, dishImageFile);
    res.json(updatedDish);
  } catch (err) {
    console.error('updateDishBase64 error:', err);
    res.status(400).json({ error: err.message });
  }
};

exports.deleteDish = async (req, res) => {
  try {
    const { id } = req.params;
    const { restaurant_id } = req.body;

    if (!restaurant_id) {
      return res.status(400).json({ error: 'restaurant_id is required.' });
    }

    const result = await dishService.deleteDish(id, restaurant_id);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
