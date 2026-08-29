const Dish = require('../models/dish');
const User = require('../models/user');
const { uploadBufferToCloudinary } = require('../utils/cloudinary');
const { Op } = require('sequelize');

async function createDish(dishData, restaurantId, dishImageFile) {
  const restaurant = await User.findByPk(restaurantId);
  if (!restaurant || restaurant.type !== 'Merchant') {
    throw new Error('Restaurant not found or not a valid merchant.');
  }

  let dish_image_url = null;
  if (dishImageFile) {
    const folder = `dinewell/dishes/${restaurantId}`;
    const filename = `dish-${Date.now()}`;
    dish_image_url = await uploadBufferToCloudinary(
      dishImageFile.buffer,
      folder,
      filename,
      dishImageFile.mimetype
    );
  }

  const newDish = await Dish.create({
    restaurant_id: restaurantId,
    dish_name: dishData.dish_name,
    price: dishData.price,
    points_per_dollar: dishData.points_per_dollar || 0,
    dish_image_url: dish_image_url,
    base_points_per_dish: dishData.base_points_per_dish || 0,
    status: 'active',
  });

  return newDish;
}

async function getDishById(dishId, restaurantId) {
  const dish = await Dish.findOne({
    where: { id: dishId, restaurant_id: restaurantId },
  });
  if (!dish) {
    throw new Error('Dish not found or does not belong to this restaurant.');
  }
  return dish;
}

async function getDishesByRestaurant(restaurantId, searchQuery) {
  const allDishes = await Dish.findAll({
    where: { restaurant_id: restaurantId },
  });
  const activeDishes = allDishes.filter(
    (d) => (d.status || 'active') === 'active'
  ).length;

  const whereClause = {
    restaurant_id: restaurantId,
  };

  if (searchQuery) {
    whereClause.dish_name = {
      [Op.iLike]: `%${searchQuery}%`,
    };
  }

  const dishes = await Dish.findAll({
    where: whereClause,
    order: [['date_created', 'DESC']],
  });

  return {
    dishes,
    activeDishes,
  };
}

async function updateDish(dishId, restaurantId, dishData, dishImageFile) {
  const dish = await Dish.findOne({
    where: { id: dishId, restaurant_id: restaurantId },
  });

  if (!dish) {
    throw new Error('Dish not found or does not belong to this restaurant.');
  }

  let dish_image_url = dish.dish_image_url;
  if (dishImageFile) {
    const folder = `dinewell/dishes/${restaurantId}`;
    const filename = `dish-${Date.now()}`;
    dish_image_url = await uploadBufferToCloudinary(
      dishImageFile.buffer,
      folder,
      filename,
      dishImageFile.mimetype
    );
  }

  if (dishData.dish_name !== undefined && dishData.dish_name !== '') {
    dish.dish_name = dishData.dish_name;
  }
  if (dishData.price !== undefined && dishData.price !== '') {
    dish.price = dishData.price;
  }
  if (dishData.points_per_dollar !== undefined) {
    dish.points_per_dollar = dishData.points_per_dollar;
  }
  if (dishData.base_points_per_dish !== undefined) {
    dish.base_points_per_dish = dishData.base_points_per_dish;
  }
  if (dishData.status !== undefined) {
    const next = String(dishData.status).toLowerCase();
    if (next !== 'active' && next !== 'paused') {
      throw new Error('status must be active or paused');
    }
    dish.status = next;
  }
  dish.dish_image_url = dish_image_url;

  await dish.save();
  return dish;
}

async function setDishStatus(dishId, restaurantId, status) {
  return updateDish(dishId, restaurantId, { status }, null);
}

async function deleteDish(dishId, restaurantId) {
  const dish = await Dish.findOne({
    where: { id: dishId, restaurant_id: restaurantId },
  });

  if (!dish) {
    throw new Error('Dish not found or does not belong to this restaurant.');
  }

  await dish.destroy();
  return { message: 'Dish deleted successfully.' };
}

module.exports = {
  createDish,
  getDishById,
  getDishesByRestaurant,
  updateDish,
  setDishStatus,
  deleteDish,
};
