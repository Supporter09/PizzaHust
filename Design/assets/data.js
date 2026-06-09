/* Shared menu data + render helpers */
window.PH_MENU = [
  { id:'margherita', name:'Margherita Classic', cat:'Pizzas', price:'12.99', desc:'Fresh mozzarella, tomato sauce, and basil', label:'margherita' },
  { id:'pepperoni',  name:'Pepperoni Passion',  cat:'Pizzas', price:'14.99', desc:'Loaded with pepperoni and extra cheese', label:'pepperoni' },
  { id:'veggie',     name:'Veggie Supreme',     cat:'Pizzas', price:'13.99', desc:'Bell peppers, onions, mushrooms, olives, and tomatoes', label:'veggie' },
  { id:'bbq',        name:'BBQ Chicken',        cat:'Pizzas', price:'15.99', desc:'Grilled chicken, BBQ sauce, red onions, and cilantro', label:'bbq chicken' },
  { id:'hawaiian',   name:'Hawaiian Paradise',  cat:'Pizzas', price:'13.99', desc:'Ham, pineapple, and mozzarella', label:'hawaiian' },
  { id:'meat',       name:'Meat Lovers',        cat:'Pizzas', price:'16.99', desc:'Pepperoni, sausage, bacon, and ham', label:'meat lovers' },
  { id:'garlic',     name:'Garlic Bread',       cat:'Sides',  price:'4.99',  desc:'Crispy garlic bread with herbs', label:'garlic bread' },
  { id:'wings',      name:'Chicken Wings',      cat:'Sides',  price:'8.99',  desc:'Spicy buffalo wings (8 pieces)', label:'wings' },
  { id:'salad',      name:'Caesar Salad',       cat:'Sides',  price:'5.99',  desc:'Fresh romaine lettuce with parmesan', label:'caesar salad' },
  { id:'coke',       name:'Coca Cola',          cat:'Drinks', price:'2.49',  desc:'500ml bottle', label:'coca cola' },
  { id:'sprite',     name:'Sprite',             cat:'Drinks', price:'2.49',  desc:'500ml bottle', label:'sprite' },
  { id:'oj',         name:'Orange Juice',       cat:'Drinks', price:'3.99',  desc:'Fresh squeezed 300ml', label:'orange juice' },
];

window.productCard = function (item) {
  return `<article class="p-card">
    <div class="img-ph p-card-img" data-label="${item.label}"></div>
    <div class="p-card-body">
      <div class="p-card-head"><h3 class="p-card-name">${item.name}</h3></div>
      <p class="p-card-desc">${item.desc}</p>
      <div class="p-card-foot">
        <span class="price p-card-price tnum">$${item.price}</span>
        <a class="add-btn" href="product.html" aria-label="Add ${item.name}">${PH_ICON('plus',2.2)}</a>
      </div>
    </div>
  </article>`;
};
