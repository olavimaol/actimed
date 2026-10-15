// Данные каталога. Чтобы добавить товар — допишите объект в PRODUCTS.
window.ACTIMED = {
  categories: [
    { id: 'all',      name: 'Все' },
    { id: 'cold',     name: 'Простуда и грипп',   count: 340, color: '#2FA36B', shape: 'pill' },
    { id: 'pain',     name: 'Обезболивающие',     count: 180, color: '#D46A6A', shape: 'cross' },
    { id: 'vitamins', name: 'Витамины и БАДы',    count: 520, color: '#E0A13A', shape: 'dots' },
    { id: 'heart',    name: 'Сердце и сосуды',    count: 260, color: '#C8546E', shape: 'heart' },
    { id: 'allergy',  name: 'Аллергия',           count: 95,  color: '#7A6BD1', shape: 'leaf' },
    { id: 'baby',     name: 'Мама и малыш',       count: 410, color: '#3FA7C9', shape: 'drop' },
    { id: 'care',     name: 'Красота и уход',     count: 630, color: '#0E8C7E', shape: 'drop' },
    { id: 'devices',  name: 'Медтехника',         count: 150, color: '#3B7DD8', shape: 'pulse' }
  ],
  products: [
    { name: 'Ибупрофен 200 мг',          form: 'таблетки, 20 шт.',     price: 18000,  cat: 'pain',     color: '#D46A6A', type: 'box' },
    { name: 'Парацетамол 500 мг',        form: 'таблетки, 10 шт.',     price: 7000,   cat: 'cold',     color: '#2FA36B', type: 'box' },
    { name: 'Витамин D3 2000 МЕ',        form: 'капсулы, 60 шт.',      price: 95000,  cat: 'vitamins', color: '#E0A13A', type: 'bottle' },
    { name: 'Омега-3 1000 мг',           form: 'капсулы, 90 шт.',      price: 139000, cat: 'vitamins', color: '#3B7DD8', type: 'bottle' },
    { name: 'Лоратадин 10 мг',           form: 'таблетки, 10 шт.',     price: 21000,  cat: 'allergy',  color: '#7A6BD1', type: 'box' },
    { name: 'Амброксол',                 form: 'сироп, 100 мл',        price: 32000,  cat: 'cold',     color: '#0E6E6E', type: 'bottle' },
    { name: 'Магний B6',                 form: 'таблетки, 50 шт.',     price: 84000,  cat: 'vitamins', color: '#D46A6A', type: 'box' },
    { name: 'Хлоргексидин 0,05%',        form: 'спрей, 100 мл',        price: 68000,  cat: 'cold',     color: '#3FA7C9', type: 'bottle' },
    { name: 'Аторвастатин 20 мг',        form: 'таблетки, 30 шт.',     price: 56000,  cat: 'heart',    color: '#C8546E', type: 'box', rx: true },
    { name: 'Тонометр автоматический',   form: 'на плечо, с адаптером', price: 449000, cat: 'devices',  color: '#3B7DD8', type: 'box' },
    { name: 'Крем под подгузник',        form: 'туба, 75 мл',          price: 47000,  cat: 'baby',     color: '#3FA7C9', type: 'bottle' },
    { name: 'Термометр электронный',     form: 'гибкий наконечник',    price: 52000,  cat: 'devices',  color: '#0E8C7E', type: 'box' },
    { name: 'Увлажняющий крем для рук',  form: 'туба, 50 мл',          price: 39000,  cat: 'care',     color: '#0E8C7E', type: 'bottle' },
    { name: 'Амоксициллин 500 мг',       form: 'капсулы, 16 шт.',      price: 41000,  cat: 'cold',     color: '#2FA36B', type: 'box', rx: true },
    { name: 'Цетиризин 10 мг',           form: 'капли, 20 мл',         price: 36000,  cat: 'allergy',  color: '#7A6BD1', type: 'bottle' },
    { name: 'Ацетилсалициловая к-та 75 мг', form: 'таблетки, 30 шт.',     price: 44000,  cat: 'heart',    color: '#C8546E', type: 'box' }
  ]
};
