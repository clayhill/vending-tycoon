/* The snack machine's game screen. */
VT.vendGame({
  K: VT.SNACK,
  draw: VT.drawSnack,
  icon: (fb, p) => VT.drawSnackItem(fb, 1, 2, VT.SNACK.PRODUCTS[p].shape, VT.rgb(VT.SNACK.PRODUCTS[p].color)),
});
