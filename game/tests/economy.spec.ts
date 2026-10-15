import { expect, test } from '@playwright/test';
import { DISHES, MARKET_ITEMS, QUALITY_MULT, produceById } from '../src/data';

// Buying ingredients at the Warung Bahan must never pay off, whatever the player does with them.
const price = Object.fromEntries(MARKET_ITEMS.map((m) => [m.id, m.price]));

test('beli bahan lalu dijual mentah selalu rugi', () => {
  for (const m of MARKET_ITEMS) expect(m.price, m.id).toBeGreaterThan(produceById(m.id).sellPrice * QUALITY_MULT[1]);
});

test('beli bahan untuk permintaan warga selalu rugi', () => {
  // villagers pay about 1.6x the sell price per item
  for (const m of MARKET_ITEMS) expect(m.price, m.id).toBeGreaterThan(produceById(m.id).sellPrice * 1.6);
});

test('beli bahan, masak, jual masakan selalu rugi (juga 2 porsi Rumah Besar)', () => {
  for (const d of DISHES) {
    const cost = Object.entries(d.ingredients).reduce((a, [id, n]) => a + price[id] * n, 0);
    expect(cost, d.name).toBeGreaterThan(d.sellPrice * 2);
  }
});
