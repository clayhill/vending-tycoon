/* The gumball machine's game screen. */
VT.vendGame({
  K: VT.GUMBALL,
  draw: VT.drawGumballMachine,
  icon: (fb, p) => VT.drawGumball(fb, 3, 3, VT.rgb(VT.GUMBALL.PRODUCTS[p].color)),
});
