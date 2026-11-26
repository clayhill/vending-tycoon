/* The coffee machine page. */
VT.vendGame({
  K: VT.COFFEE, draw: VT.drawCoffee,
  icon: (fb, p) => { const d = VT.COFFEE.PRODUCTS[p]; VT.drawCoffeeCup(fb, 1, 0, VT.rgb(d.liquid), VT.rgb(d.color), 0.85); },
  drawHD: VT.drawCoffeeHD,
  iconHD: (c, p) => { const d = VT.COFFEE.PRODUCTS[p]; VT.HD.items.cup(c, 1, 0, d.liquid, d.color, 0.85); },
});
