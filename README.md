# Vending Tycoon — a vending machine simulator

**Try it live: [clayhill.github.io/vending-tycoon](https://clayhill.github.io/vending-tycoon/)**

A vending machine simulator that runs in your browser, styled as a vaporwave arcade game:
neon grids, sunsets and crisp, high-resolution pixel art. Pick a machine on the launch page and
step up to it.

## Soda Cans

The first machine. You run a soda can vending machine on a neon street:

- **Customers** come by more at lunch and in the evening, on hot days and when your star rating is high.
  Each wants a favourite drink and will pay up to a price of their own; they queue, buy it, settle for
  another drink, or walk off (sold out, too pricey, a jammed machine, a line too long). A bubble over
  their head says which.
- **You** set each slot's price, swap its drink, restock it, empty the coin box before it fills up
  (a full box refuses coins) and pay to fix the occasional coin jam. Rent is due every midnight.
- **Keys:** arrows pick a slot, `+`/`-` price, `R` restock, `C` collect, space pauses, `1`–`4` speed.

The game saves itself in your browser. The simulation lives in `js/soda/` and runs without the page,
so `npm test` plays a month of it in Node and checks that the money adds up.

## Running it

It is a static site with no build step. Open `index.html`, or serve the folder:

```bash
python3 -m http.server 8000
```

GitHub Pages publishes the `main` branch as it is.
