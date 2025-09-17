const Dish = require('../models/dish');
const User = require('../models/user');
const { uploadBufferToCloudinary } = require('../utils/cloudinary');

async function createDish(dishData, restaurantId, dishImageFile) {
  // Verify if the restaurant exists and is a merchant
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

async function getDishesByRestaurant(restaurantId) {
  const dishes = await Dish.findAll({
    where: { restaurant_id: restaurantId },
    order: [['date_created', 'DESC']],
  });
  return dishes;
}

async function updateDish(dishId, restaurantId, dishData, dishImageFile) {
  const dish = await Dish.findOne({
    where: { id: dishId, restaurant_id: restaurantId },
  });

  if (!dish) {
    throw new Error('Dish not found or does not belong to this restaurant.');
  }

  let dish_image_url = dish.dish_image_url; // Keep existing image if no new one is uploaded
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

  // Update fields
  dish.dish_name = dishData.dish_name || dish.dish_name;
  dish.price = dishData.price || dish.price;
  dish.points_per_dollar = dishData.points_per_dollar !== undefined ? dishData.points_per_dollar : dish.points_per_dollar;
  dish.dish_image_url = dish_image_url;
  dish.base_points_per_dish = dishData.base_points_per_dish !== undefined ? dishData.base_points_per_dish : dish.base_points_per_dish;

  await dish.save();
  return dish;
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
  deleteDish,
};
