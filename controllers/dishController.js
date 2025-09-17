const dishService = require('../services/dishService');

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
    const { restaurantId } = req.params;

    const dishes = await dishService.getDishesByRestaurant(restaurantId);
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
