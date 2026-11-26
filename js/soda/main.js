/* The soda machine's game screen. */
VT.vendGame({
  K: VT.SODA,
  draw: VT.drawSoda,
  icon: (fb, p) => VT.drawCan(fb, 1, 1, VT.rgb(VT.SODA.PRODUCTS[p].color)),
});
