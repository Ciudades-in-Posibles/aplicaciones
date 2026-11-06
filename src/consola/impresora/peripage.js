/**
 * Conexión con la PeriPage A6 desde Chrome de computador.
 * Primero Web Bluetooth (BLE), que no pasa por el emparejamiento de macOS; de respaldo, Web Serial
 * sobre el puerto Bluetooth clásico (/dev/cu.PeriPage_XXXX). El protocolo es el mismo en las dos vías.
 * Patrón tomado de cronista/src/services/bluetoothPrinter.js.
 */
import { enTrozos } from '../../comun/dominio/termica.js';

// Servicios BLE que suelen traer las impresoras térmicas; la PeriPage usa 0xff00 (por confirmar en chrome://bluetooth-internals)
const SERVICIOS = [
  '0000ff00-0000-1000-8000-00805f9b34fb',
  '0000ffe0-0000-1000-8000-00805f9b34fb',
  '000018f0-0000-1000-8000-00805f9b34fb',
  '0000ae30-0000-1000-8000-00805f9b34fb',
  '0000af30-0000-1000-8000-00805f9b34fb',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455',
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2'
];

// Se ajustan en la prueba con la impresora real
export const TROZO_BLE = 100;
export const PAUSA_BLE_MS = 15;
export const TROZO_SERIE = 512;
export const PAUSA_SERIE_MS = 20;
const PAUSA_ENTRE_CARTAS_MS = 600;

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

class PeriPage {
  constructor() {
    this.estado = this.hayBluetooth() || this.haySerie() ? 'desconectada' : 'sinSoporte';
    this.nombre = '';
    this.via = null; // 'ble' | 'serie'
    this.device = null;
    this.caracteristica = null;
    this.puerto = null;
    this.escritor = null;
    this.oyentes = new Set();
  }

  hayBluetooth() { return typeof navigator !== 'undefined' && 'bluetooth' in navigator; }
  haySerie() { return typeof navigator !== 'undefined' && 'serial' in navigator; }

  escuchar(fn) {
    this.oyentes.add(fn);
    fn(this.foto());
    return () => this.oyentes.delete(fn);
  }

  foto() { return { estado: this.estado, nombre: this.nombre, via: this.via, hayBluetooth: this.hayBluetooth(), haySerie: this.haySerie() }; }

  cambiar(estado) {
    this.estado = estado;
    const f = this.foto();
    this.oyentes.forEach((fn) => fn(f));
  }

  lista() {
    if (this.via === 'ble') return !!(this.device?.gatt?.connected && this.caracteristica);
    if (this.via === 'serie') return !!this.escritor;
    return false;
  }

  /** Abre el selector de Chrome con las impresoras PeriPage cercanas. */
  async conectarBluetooth() {
    this.cambiar('conectando');
    try {
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ namePrefix: 'PeriPage' }, { namePrefix: 'PPG' }],
        optionalServices: SERVICIOS
      });
      this.device = device;
      device.addEventListener('gattserverdisconnected', () => {
        this.caracteristica = null;
        if (this.estado === 'lista') this.cambiar('desconectada');
      });
      await this.abrirGatt();
      this.via = 'ble';
      this.nombre = device.name || 'PeriPage';
      this.cambiar('lista');
    } catch (e) {
      this.cambiar('desconectada');
      throw e;
    }
  }

  async abrirGatt() {
    const servidor = await this.device.gatt.connect();
    const servicios = await servidor.getPrimaryServices();
    for (const s of servicios) {
      for (const c of await s.getCharacteristics()) {
        if (c.properties.writeWithoutResponse || c.properties.write) {
          this.caracteristica = c;
          return;
        }
      }
    }
    throw new Error('sin-escritura');
  }

  /** Abre el selector de puertos serie (el puerto Bluetooth clásico que crea macOS al emparejar). */
  async conectarSerie() {
    this.cambiar('conectando');
    try {
      const puerto = await navigator.serial.requestPort();
      await puerto.open({ baudRate: 115200 });
      this.puerto = puerto;
      this.escritor = puerto.writable.getWriter();
      this.via = 'serie';
      this.nombre = 'PeriPage (puerto serie)';
      await espera(1200); // el enlace RFCOMM tarda en quedar listo
      this.cambiar('lista');
    } catch (e) {
      this.cambiar('desconectada');
      throw e;
    }
  }

  async desconectar() {
    try {
      if (this.via === 'ble' && this.device?.gatt?.connected) this.device.gatt.disconnect();
      if (this.via === 'serie') {
        this.escritor?.releaseLock();
        await this.puerto?.close();
      }
    } finally {
      this.device = null; this.caracteristica = null; this.puerto = null; this.escritor = null;
      this.via = null; this.nombre = '';
      this.cambiar('desconectada');
    }
  }

  /** Si el Bluetooth se cayó, intenta volver una vez con el mismo aparato, sin abrir el selector. */
  async asegurar() {
    if (this.lista()) return;
    if (this.via === 'ble' && this.device) {
      this.cambiar('conectando');
      try {
        await this.abrirGatt();
        this.cambiar('lista');
        return;
      } catch {
        this.cambiar('desconectada');
      }
    }
    throw new Error('desconectada');
  }

  /** Envía una impresión completa (salida de bytesPeriPage). */
  async enviar(bytes) {
    await this.asegurar();
    this.cambiar('imprimiendo');
    try {
      if (this.via === 'ble') {
        const c = this.caracteristica;
        for (const t of enTrozos(bytes, TROZO_BLE)) {
          if (c.properties.writeWithoutResponse) await c.writeValueWithoutResponse(t);
          else await c.writeValue(t);
          await espera(PAUSA_BLE_MS);
        }
      } else {
        for (const t of enTrozos(bytes, TROZO_SERIE)) {
          await this.escritor.write(t);
          await espera(PAUSA_SERIE_MS);
        }
      }
      await espera(PAUSA_ENTRE_CARTAS_MS);
      this.cambiar('lista');
    } catch (e) {
      this.cambiar(this.lista() ? 'lista' : 'desconectada');
      throw e;
    }
  }
}

export const peripage = new PeriPage();
