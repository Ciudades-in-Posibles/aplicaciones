import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gridDistance, gridDisk, cellToLatLng } from 'h3-js';
import { ZONA, CELDAS, CELDA_BIBLIOTECA, enZona, etiquetas } from '../src/comun/dominio/zona.js';
import {
  ANDARES, celdaDelVecino, rastrosDelVecino, rastroMasCercano, intensidad, relojDelJuego, casaDe, habitatDe, rumbo,
  RASTROS_POR_VECINO, DISTANCIA_ENCUENTRO, ALCANCE_SENAL
} from '../src/comun/dominio/vecinos.js';

// 6 nov 2026, en hora de Bogotá (UTC−5)
const hora = (h, m = 0) => Date.UTC(2026, 10, 6, h + 5, m);
const vecinos = Object.keys(ANDARES).map((andar, i) => ({ id: `v${i}-${andar}`, nombre: andar, canal: i + 1, andar }));

test('zona: la biblioteca está dentro y ninguna celda queda sin etiqueta', () => {
  assert.ok(CELDAS.length > 100);
  assert.ok(enZona(CELDA_BIBLIOTECA));
  assert.ok(etiquetas(CELDA_BIBLIOTECA).includes('biblioteca'));
  for (const c of CELDAS) assert.ok(ZONA[c].length > 0, c);
  assert.equal(enZona('8c66e092c7739fe'), false);
  assert.equal(enZona(42), false);
});

test('zona: se recorre entera a pie desde la biblioteca', () => {
  const zona = new Set(CELDAS);
  const vistas = new Set([CELDA_BIBLIOTECA]);
  const pila = [CELDA_BIBLIOTECA];
  while (pila.length) for (const v of gridDisk(pila.pop(), 1)) if (zona.has(v) && !vistas.has(v)) { vistas.add(v); pila.push(v); }
  assert.equal(vistas.size, CELDAS.length);
});

test('hábitat: sin islas de menos de 20 celdas', () => {
  for (const andar of Object.keys(ANDARES)) {
    const hab = new Set(habitatDe(andar));
    const vistas = new Set();
    for (const c of hab) {
      if (vistas.has(c)) continue;
      const isla = [c];
      vistas.add(c);
      for (let i = 0; i < isla.length; i++) for (const v of gridDisk(isla[i], ANDARES[andar].salto)) if (hab.has(v) && !vistas.has(v)) { vistas.add(v); isla.push(v); }
      assert.ok(isla.length >= 20, `${andar}: isla de ${isla.length}`);
    }
  }
});

test('reloj del juego: el día empieza a las 6:00 de Bogotá', () => {
  const a = relojDelJuego(hora(5, 59));
  const b = relojDelJuego(hora(6, 0));
  assert.equal(b.dia, a.dia + 1);
  assert.equal(b.desdeInicio, 0);
});

test('el movimiento es determinista: el mismo reloj da la misma celda', () => {
  for (const v of vecinos) {
    for (const t of [hora(9), hora(12, 17), hora(18, 40)]) {
      assert.equal(celdaDelVecino(v, t), celdaDelVecino({ ...v }, t));
    }
  }
});

test('a las 6:00 cada vecino está en su casa', () => {
  for (const v of vecinos) assert.equal(celdaDelVecino(v, hora(6)), casaDe(v));
});

test('el vecino nunca sale de su hábitat ni pisa un cruce, y avanza a lo sumo su salto', () => {
  for (const v of vecinos) {
    const habitat = new Set(habitatDe(v.andar));
    const paso = ANDARES[v.andar].pasoMin;
    let antes = celdaDelVecino(v, hora(6));
    for (let m = paso; m < 24 * 60; m += paso) {
      const c = celdaDelVecino(v, hora(6) + m * 60000);
      assert.ok(habitat.has(c), `${v.andar} fuera del hábitat en ${c}`);
      assert.ok(!etiquetas(c).includes('cruce'));
      assert.ok(gridDistance(antes, c) <= ANDARES[v.andar].salto);
      antes = c;
    }
  }
});

test('el andar de noche descansa de día y se mueve después de las 17:30', () => {
  const v = vecinos.find((x) => x.andar === 'noche');
  const casa = casaDe(v);
  for (const h of [7, 10, 13, 17]) assert.equal(celdaDelVecino(v, hora(h)), casa);
  const celdas = new Set();
  for (let m = 0; m < 6 * 60; m += 10) celdas.add(celdaDelVecino(v, hora(17, 30) + m * 60000));
  assert.ok(celdas.size > 1, 'de noche debería moverse');
});

test('el andar por el agua solo pisa agua u orilla', () => {
  const v = vecinos.find((x) => x.andar === 'rio');
  for (let m = 0; m < 12 * 60; m += 10) {
    const et = etiquetas(celdaDelVecino(v, hora(6) + m * 60000));
    assert.ok(et.includes('agua') || et.includes('orilla'), et.join(' '));
  }
});

test('rastros: distintos, del más fresco al más viejo, y se desvanecen', () => {
  const v = vecinos.find((x) => x.andar === 'copas');
  const r = rastrosDelVecino(v, hora(15));
  assert.ok(r.length >= 2 && r.length <= RASTROS_POR_VECINO);
  assert.equal(r[0].celda, celdaDelVecino(v, hora(15)));
  assert.equal(new Set(r.map((x) => x.celda)).size, r.length);
  for (let i = 1; i < r.length; i++) assert.ok(r[i].intensidad < r[i - 1].intensidad);
  assert.equal(r[0].intensidad, 1);
});

test('intensidad: limpia al lado del rastro, estática lejos', () => {
  assert.equal(intensidad(0), 1);
  assert.equal(intensidad(DISTANCIA_ENCUENTRO), 1);
  assert.ok(intensidad(DISTANCIA_ENCUENTRO + 2) < intensidad(DISTANCIA_ENCUENTRO + 1));
  assert.ok(intensidad(ALCANCE_SENAL) > 0);
  assert.equal(intensidad(ALCANCE_SENAL + 1), 0);
  assert.equal(intensidad(Infinity), 0);
  assert.ok(intensidad(0, 0.2) < intensidad(0, 1));
});

test('rastroMasCercano: en la celda del rastro hay encuentro', () => {
  const t = hora(11);
  const v = vecinos[0];
  const celda = celdaDelVecino(v, t);
  const r = rastroMasCercano(celda, vecinos, t);
  assert.equal(r.distancia, 0);
  assert.equal(r.encontrado, true);
  assert.equal(r.senal, 1);
  assert.equal(rastroMasCercano(celda, [], t), null);
});

test('rumbo: apunta al norte hacia la celda más al norte y al sur hacia la más al sur', () => {
  const lat = (c) => cellToLatLng(c)[0];
  const porLat = [...CELDAS].sort((a, b) => lat(a) - lat(b));
  const alNorte = rumbo(CELDA_BIBLIOTECA, porLat[porLat.length - 1]);
  const alSur = rumbo(CELDA_BIBLIOTECA, porLat[0]);
  assert.ok(alNorte < 90 || alNorte > 270, `norte: ${alNorte}`);
  assert.ok(alSur > 90 && alSur < 270, `sur: ${alSur}`);
});

test('datosDeVecino: nombre tal cual, canal 1–9 y andar de la lista', async () => {
  const { datosDeVecino } = await import('../src/comun/dominio/vecinos.js');
  assert.deepEqual(datosDeVecino({ nombre: '  la que  canta ', canal: '6', andar: 'copas' }), { nombre: 'la que canta', canal: 6, andar: 'copas' });
  assert.throws(() => datosDeVecino({ nombre: ' ', canal: 1, andar: 'rio' }));
  assert.throws(() => datosDeVecino({ nombre: 'x', canal: 10, andar: 'rio' }));
  assert.throws(() => datosDeVecino({ nombre: 'x', canal: 2, andar: 'volar' }));
  assert.equal(datosDeVecino({ nombre: 'y'.repeat(60), canal: 2, andar: 'rio' }).nombre.length, 40);
});
