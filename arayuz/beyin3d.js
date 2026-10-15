// Canlı beyin: her proje bir lob, her anı (kayıt defteri) ve her not bir nöron. Oturumlardan gelen olaylar
// merkezdeki çekirdekten ilgili loba sinyal olarak gider; çok çalışan lob büyür, boşta kalınca beyin "rüya" görür.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

export const LOB_RENK = ['#17b8a6', '#5aa2e6', '#f28c28', '#a66dd4', '#e86a92', '#d9d36a', '#57b26a', '#ef6f6c', '#7fd8cc', '#c49a6c'];
// lob merkezleri (sağ yarım küre; sol yarım küre aynası da aynı loba sayılır). 0: beynin kendi notları (alın)
const LOB_YER = [[0.32, 0.16, 0.78], [0.34, 0.56, 0.18], [0.48, -0.3, 0.16], [0.34, 0.38, -0.48], [0.26, 0.04, -0.9], [0.0, -0.5, -0.76], [0.42, 0.1, 0.4], [0.4, -0.1, -0.3], [0.3, 0.62, -0.18], [0.46, -0.32, 0.55]];

// ---- beyin hacmi: iki yarım küre, alın ve şakak lobları, beyincik, beyin sapı
const elips = (p, c, r) => ((p.x - c[0]) / r[0]) ** 2 + ((p.y - c[1]) / r[1]) ** 2 + ((p.z - c[2]) / r[2]) ** 2;
function yarimKure(p) {
  const x = Math.abs(p.x);
  if (x < 0.035) return 99;
  const q = { x, y: p.y, z: p.z };
  return Math.min(elips(q, [0.36, 0.08, 0.0], [0.42, 0.66, 1.08]), elips(q, [0.34, 0.02, 0.62], [0.4, 0.56, 0.52]), elips(q, [0.44, -0.34, 0.12], [0.34, 0.3, 0.66]));
}
const beyincik = (p) => elips(p, [0, -0.5, -0.74], [0.58, 0.27, 0.34]);
const sap = (p) => elips(p, [0, -0.78, -0.38], [0.13, 0.32, 0.13]);
function beyindeMi(p, o = 1) {
  const q = { x: p.x / o, y: p.y / o, z: p.z / o };
  if (q.y < -0.36 && q.z > 0.5) return false;
  return yarimKure(q) < 1 || beyincik(q) < 1 || sap(q) < 1;
}
const kivrim = (p) => Math.sin(10.5 * p.z + 2.6 * Math.sin(6.2 * p.y) + 1.4 * Math.sin(5 * p.x)) + Math.sin(9.2 * p.y + 2.2 * Math.cos(7.1 * p.z));

export class Beyin3D {
  constructor(kap, { notTikla = () => {}, lobTikla = () => {}, turAdi = (t) => t } = {}) {
    this.turAdi = turAdi;
    this.kap = kap;
    this.notTikla = notTikla;
    this.lobTikla = lobTikla;
    this.tuval = document.createElement('canvas');
    this.tuval.className = 'beyinTuval';
    this.etiketKap = document.createElement('div');
    this.etiketKap.className = 'beyinEtiketler';
    this.ipucu = document.createElement('div');
    this.ipucu.className = 'beyinIpucu';
    kap.append(this.tuval, this.etiketKap, this.ipucu);
    this.loblar = [];
    this.notlar = [];
    this.baglar = [];
    this.komsu = new Map();
    this.sinyaller = [];
    this.ruya = 0;
    this.ruyaHedef = 0;
    this.gergin = 0;
    this.calisiyor = false;
    this.sonOlay = performance.now();
    this.olayDinle = null;
    this._kur();
  }

  _kur() {
    const r = (this.renderer = new THREE.WebGLRenderer({ canvas: this.tuval, antialias: true, alpha: true }));
    r.setPixelRatio(Math.min(2, devicePixelRatio));
    this.scene = new THREE.Scene();
    this.kamera = new THREE.PerspectiveCamera(40, 1, 0.01, 100);
    this.kamera.position.set(3.1, 0.85, 1.1);
    const k = (this.kontrol = new OrbitControls(this.kamera, this.tuval));
    k.enableDamping = true;
    k.autoRotate = true;
    k.autoRotateSpeed = 0.35;
    k.minDistance = 1.8;
    k.maxDistance = 6;
    k.target.set(0, -0.08, 0);
    k.addEventListener('start', () => (this.odak = null));
    this.composer = new EffectComposer(r);
    this.composer.addPass(new RenderPass(this.scene, this.kamera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 1.1, 0.6, 0.1);
    this.composer.addPass(this.bloom);
    this.kok = new THREE.Group();
    this.scene.add(this.kok);

    // nöronlar
    const EN = (this.EN = 900);
    this.geo = new THREE.BufferGeometry();
    for (const [ad, n] of [['position', 3], ['color', 3], ['boy', 1], ['isik', 1], ['dogum', 1]]) this.geo.setAttribute(ad, new THREE.BufferAttribute(new Float32Array(EN * n), n));
    this.malzeme = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
      uniforms: { uOlcek: { value: 380 }, uZaman: { value: 0 }, uRuya: { value: 0 } },
      vertexShader: `attribute float boy; attribute float isik; attribute float dogum; varying vec3 vRenk; varying float vIsik; varying float vDogum;
        uniform float uOlcek; uniform float uZaman; uniform float uRuya;
        void main(){ vRenk = color; vIsik = isik; vDogum = dogum; vec3 p = position * (1.0 + uRuya * 0.025 * sin(uZaman * 1.3));
          vec4 mv = modelViewMatrix * vec4(p,1.0);
          gl_PointSize = boy * (1.0 + dogum * 3.5) * (1.0 + isik * 1.7) * uOlcek / -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying vec3 vRenk; varying float vIsik; varying float vDogum;
        void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard;
          float c = smoothstep(0.5, 0.0, d); float halka = vDogum * smoothstep(0.08, 0.0, abs(d - 0.42));
          vec3 r = mix(vRenk, vec3(1.0), vIsik * 0.7 + pow(c, 4.0) * 0.5);
          gl_FragColor = vec4(r * (0.55 + vIsik * 1.8) + halka * 2.0, max(c, halka)); }`,
    });
    this.noktalar = new THREE.Points(this.geo, this.malzeme);
    this.kok.add(this.noktalar);
    this.cg = new THREE.BufferGeometry();
    this.cg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(EN * 4 * 6), 3));
    this.cg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(EN * 4 * 6), 3));
    this.kok.add(new THREE.LineSegments(this.cg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false })));

    // çekirdek (talamus)
    this.cekirdek = new THREE.Mesh(new THREE.SphereGeometry(0.05, 24, 24), new THREE.MeshBasicMaterial({ color: 0x9ff7ea }));
    this.cekirdek.position.set(0, -0.12, 0.05);
    this.hale = new THREE.Mesh(new THREE.SphereGeometry(0.09, 24, 24), new THREE.MeshBasicMaterial({ color: 0x17b8a6, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.hale.position.copy(this.cekirdek.position);
    this.kok.add(this.cekirdek, this.hale);

    // sinyaller
    const SN = (this.SN = 240);
    this.sg = new THREE.BufferGeometry();
    for (const [ad, n] of [['position', 3], ['color', 3], ['boy', 1]]) this.sg.setAttribute(ad, new THREE.BufferAttribute(new Float32Array(SN * n), n));
    this.kok.add(
      new THREE.Points(
        this.sg,
        new THREE.ShaderMaterial({
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          vertexColors: true,
          vertexShader: `attribute float boy; varying vec3 vR; void main(){ vR = color; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = boy * 300.0 / -mv.z; gl_Position = projectionMatrix * mv; }`,
          fragmentShader: `varying vec3 vR; void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; gl_FragColor = vec4(mix(vR, vec3(1.0), 0.5) * 1.6, smoothstep(0.5, 0.0, d)); }`,
        })
      )
    );

    // fare
    this.ray = new THREE.Raycaster();
    this.ray.params.Points.threshold = 0.05;
    this.fare = new THREE.Vector2(-9, -9);
    this.tuval.addEventListener('mousemove', (e) => {
      const b = this.tuval.getBoundingClientRect();
      this.fare.set(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1);
      this.ipucu.style.left = e.clientX - b.left + 14 + 'px';
      this.ipucu.style.top = e.clientY - b.top + 10 + 'px';
    });
    this.tuval.addEventListener('mouseleave', () => this.fare.set(-9, -9));
    this.tuval.addEventListener('click', () => {
      if (!this.uzerinde) return;
      this.atesle(this.uzerinde, 5);
      if (this.uzerinde.not) this.notTikla(this.uzerinde.not);
    });
    this.gozlem = new ResizeObserver(() => this.boyutla());
    this.gozlem.observe(this.kap);
  }

  _nokta(yuzey, lob) {
    for (let deneme = 0; deneme < 20000; deneme++) {
      const p = new THREE.Vector3((Math.random() * 2 - 1) * 0.95, (Math.random() * 2 - 1) * 1.0, (Math.random() * 2 - 1) * 1.25);
      if (!beyindeMi(p)) continue;
      if (lob && this._lobBul(p) !== lob) continue;
      const kabuk = !beyindeMi(p, 0.9);
      if (yuzey) {
        if (!kabuk) continue;
        if (beyincik(p) < 1 && yarimKure(p) >= 1) {
          if (Math.sin(p.y * 70) < 0.2) continue;
        } else if (kivrim(p) < 0.25) continue;
        return p;
      }
      if (!kabuk && Math.random() > 0.3) continue;
      return p;
    }
    return lob ? lob.merkez.clone() : new THREE.Vector3();
  }

  _lobBul(p) {
    let en = this.loblar[0];
    let d = 1e9;
    for (const l of this.loblar) {
      const q = Math.min(p.distanceTo(l.merkez), p.distanceTo(new THREE.Vector3(-l.merkez.x, l.merkez.y, l.merkez.z)));
      if (q < d) {
        d = q;
        en = l;
      }
    }
    return en;
  }

  // veri: { katlar: [{id, ad, tur, anilar}], notlar: [{id, baslik, proje, baglar}] }, beyinAdi
  veriKoy(veri, beyinAdi = '') {
    // loblar: 0 beynin kendisi, sonra kişisel olmayan katlar, en son kişisel kat
    const katlar = [...veri.katlar.filter((k) => k.tur !== 'kisisel'), ...veri.katlar.filter((k) => k.tur === 'kisisel')].slice(0, LOB_YER.length - 1);
    const imza = JSON.stringify([beyinAdi, katlar.map((k) => k.id + k.ad)]);
    if (imza !== this.lobImza) {
      this.lobImza = imza;
      this.loblar = [{ id: 'beyin', ad: beyinAdi, i: 0 }, ...katlar.map((k, i) => ({ id: k.id, ad: k.ad, i: i + 1 }))].map((l) => ({
        ...l,
        renk: LOB_RENK[l.i % LOB_RENK.length],
        c: new THREE.Color(LOB_RENK[l.i % LOB_RENK.length]),
        merkez: new THREE.Vector3(...LOB_YER[l.i]),
        olcek: 1,
        hedef: 1,
        aktivite: 0.15,
      }));
      this._tozKur();
      this._etiketKur();
      this.notlar = [];
      this.baglar = [];
      this.komsu = new Map();
      this.noktaAnahtar = new Map();
      // her lobda hafif "uyuyan" nöronlar: veri az olsa da beyin canlı görünür
      for (const l of this.loblar) for (let i = 0; i < 22; i++) this._notEkle({ anahtar: `s:${l.id}:${i}`, lob: l, ad: '', tur: 'sessiz', sessiz: true }, false);
    }
    // nöronlar: yalnızca yeni olanlar eklenir (var olanlar yerinde kalır)
    const lobId = new Map(this.loblar.map((l) => [l.id, l]));
    const lobAd = new Map(this.loblar.map((l) => [String(l.ad).toLocaleLowerCase('tr'), l]));
    const yeniler = [];
    for (const k of katlar) {
      const lob = lobId.get(k.id);
      for (const a of k.anilar) yeniler.push({ anahtar: `a:${k.id}:${a.z}`, lob, ad: a.metin, tur: a.tur });
    }
    for (const n of veri.notlar) {
      const lob = lobAd.get(String(n.proje || '').toLocaleLowerCase('tr')) || this.loblar[0];
      yeniler.push({ anahtar: 'n:' + n.id, lob, ad: n.baslik, tur: 'not', not: n });
    }
    const ilkMi = !this.notlar.some((n) => !n.sessiz);
    for (const y of yeniler) if (!this.noktaAnahtar.has(y.anahtar)) this._notEkle(y, !ilkMi);
    // notların [[bağlantıları]]: aynı başlıktaki nota ya da projenin lobuna
    const baslik = new Map(this.notlar.filter((n) => n.not).map((n) => [n.not.baslik.toLocaleLowerCase('tr'), n]));
    for (const n of this.notlar) {
      if (!n.not || n.baglandi) continue;
      n.baglandi = true;
      for (const b of n.not.baglar || []) {
        const h = baslik.get(b.toLocaleLowerCase('tr'));
        if (h && h !== n) this._bagla(n, h);
        else {
          const l = lobAd.get(b.toLocaleLowerCase('tr'));
          if (l) {
            const m = this.notlar.find((x) => x.lob === l && x !== n);
            if (m) this._bagla(n, m);
          }
        }
      }
    }
    this._baglariYaz();
    return { not: this.notlar.length, bag: this.baglar.length };
  }

  _bagla(a, b) {
    if (this.baglar.length >= this.EN * 4) return;
    if ((this.komsu.get(a) || []).includes(b)) return;
    this.baglar.push([a, b]);
    a.derece++;
    b.derece++;
    (this.komsu.get(a) || this.komsu.set(a, []).get(a)).push(b);
    (this.komsu.get(b) || this.komsu.set(b, []).get(b)).push(a);
  }

  _notEkle(y, yeni) {
    if (this.notlar.length >= this.EN) return null;
    const p = this._nokta(false, y.lob);
    const n = { id: this.notlar.length, taban: p.clone(), p, lob: y.lob, ad: y.ad, tur: y.tur, not: y.not || null, sessiz: !!y.sessiz, derece: 0, isik: 0, dogum: yeni ? 1 : 0 };
    this.notlar.push(n);
    this.noktaAnahtar.set(y.anahtar, n);
    const yakin = this.notlar
      .filter((b) => b !== n && b.lob === n.lob)
      .map((b) => [b, n.p.distanceTo(b.p)])
      .sort((a, b) => a[1] - b[1])
      .slice(0, 2);
    for (const [b, d] of yakin) if (d < 0.5) this._bagla(n, b);
    const a = this.geo.attributes;
    a.position.array.set([p.x, p.y, p.z], n.id * 3);
    const c = y.sessiz ? y.lob.c.clone().multiplyScalar(0.45) : y.lob.c;
    a.color.array.set([c.r, c.g, c.b], n.id * 3);
    for (const x of [n, ...yakin.map((q) => q[0])]) a.boy.array[x.id] = x.sessiz ? 0.022 : (x.not ? 0.05 : 0.035) + Math.min(0.09, x.derece * 0.011);
    this.geo.setDrawRange(0, this.notlar.length);
    for (const k of ['position', 'color', 'boy']) a[k].needsUpdate = true;
    if (yeni) this.atesle(n, 4);
    return n;
  }

  _baglariYaz() {
    const cp = this.cg.attributes.position.array;
    const cc = this.cg.attributes.color.array;
    this.baglar.forEach(([a, b], i) => {
      cp.set([a.p.x, a.p.y, a.p.z, b.p.x, b.p.y, b.p.z], i * 6);
      const ca = a.lob.c.clone().multiplyScalar(0.34);
      const cb = b.lob.c.clone().multiplyScalar(0.34);
      cc.set([ca.r, ca.g, ca.b, cb.r, cb.g, cb.b], i * 6);
    });
    this.cg.setDrawRange(0, this.baglar.length * 2);
    this.cg.attributes.position.needsUpdate = true;
    this.cg.attributes.color.needsUpdate = true;
  }

  _tozKur() {
    if (this.toz) {
      this.kok.remove(this.toz);
      this.toz.geometry.dispose();
    }
    const N = 8000;
    const tg = new THREE.BufferGeometry();
    const tp = new Float32Array(N * 3);
    const tc = new Float32Array(N * 3);
    this.tozTaban = [];
    this.tozLob = [];
    for (let i = 0; i < N; i++) {
      const p = this._nokta(true);
      this.tozTaban.push(p);
      const l = this._lobBul(p);
      this.tozLob.push(l);
      const c = new THREE.Color('#3f8295').lerp(l.c, 0.42);
      tc.set([c.r, c.g, c.b], i * 3);
      tp.set([p.x, p.y, p.z], i * 3);
    }
    tg.setAttribute('position', new THREE.BufferAttribute(tp, 3));
    tg.setAttribute('color', new THREE.BufferAttribute(tc, 3));
    this.toz = new THREE.Points(tg, new THREE.PointsMaterial({ size: 0.011, vertexColors: true, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.kok.add(this.toz);
  }

  _etiketKur() {
    this.etiketKap.textContent = '';
    for (const l of this.loblar) {
      const e = document.createElement('button');
      e.type = 'button';
      e.className = 'beyinLob';
      e.style.setProperty('--r', l.renk);
      const b = document.createElement('b');
      b.textContent = l.ad;
      const bar = document.createElement('span');
      bar.className = 'bar';
      const i = document.createElement('i');
      bar.append(i);
      e.append(b, bar);
      e.onclick = () => {
        this.odak = l;
        this.kontrol.autoRotate = false;
        this.lobTikla(l.id);
      };
      this.etiketKap.append(e);
      l.el = e;
      l.cubuk = i;
    }
  }

  atesle(n, kalan = 3) {
    if (!n) return;
    n.isik = 1;
    n.lob.aktivite = Math.min(1, n.lob.aktivite + 0.01);
    if (kalan <= 0) return;
    for (const m of (this.komsu.get(n) || []).slice(0, 2)) if (this.sinyaller.length < this.SN) this.sinyaller.push({ a: n.p, b: m, t: 0, h: 1.4 + Math.random(), kalan: kalan - 1, renk: n.lob.c, boy: 0.045 });
  }

  // Bir katın olayı: çekirdekten o loba kavisli sinyal, lob büyür
  olay(katId) {
    this.sonOlay = performance.now();
    const lob = this.loblar.find((l) => l.id === katId) || this.loblar[0];
    if (!lob) return;
    lob.hedef = Math.min(1.12, lob.hedef + 0.02);
    lob.aktivite = Math.min(1, lob.aktivite + 0.12);
    const hedefler = this.notlar.filter((n) => n.lob === lob);
    if (!hedefler.length) {
      this.hale.scale.setScalar(1.8);
      return;
    }
    const hedef = hedefler[Math.floor(Math.random() * hedefler.length)];
    const k = this.cekirdek.position.clone().lerp(hedef.p, 0.5).add(new THREE.Vector3((Math.random() - 0.5) * 0.5, 0.35 + Math.random() * 0.2, (Math.random() - 0.5) * 0.4));
    if (this.sinyaller.length < this.SN) this.sinyaller.push({ egri: [this.cekirdek.position.clone(), k], b: hedef, t: 0, h: 0.9, kalan: 4, renk: lob.c, boy: 0.11 });
    this.hale.scale.setScalar(1.8);
  }

  ruhAyarla({ gergin = false, ruya = false } = {}) {
    this.gergin = gergin ? 1 : 0;
    this.ruyaHedef = ruya ? 1 : 0;
  }

  boyutla() {
    const b = this.kap.getBoundingClientRect();
    if (!b.width || !b.height) return;
    this.renderer.setSize(b.width, b.height, false);
    this.tuval.style.width = b.width + 'px';
    this.tuval.style.height = b.height + 'px';
    this.composer.setSize(b.width, b.height);
    this.bloom.setSize(b.width, b.height);
    this.kamera.aspect = b.width / b.height;
    this.kamera.updateProjectionMatrix();
  }

  goster() {
    if (this.calisiyor) return;
    this.calisiyor = true;
    this.boyutla();
    this.saat = new THREE.Clock();
    const dongu = () => {
      if (!this.calisiyor) return;
      this._kare();
      this.istek = requestAnimationFrame(dongu);
    };
    dongu();
  }

  gizle() {
    this.calisiyor = false;
    cancelAnimationFrame(this.istek);
  }

  dondur(acik) {
    this.kontrol.autoRotate = acik;
    if (acik) this.odak = null;
  }

  _kare() {
    const dt = Math.min(0.05, this.saat.getDelta());
    const t = this.saat.elapsedTime;
    this.ruya += (this.ruyaHedef - this.ruya) * 0.03;
    this.malzeme.uniforms.uRuya.value = this.ruya;
    this.malzeme.uniforms.uZaman.value = t;
    this.bloom.strength += ((this.gergin ? 1.5 : 1.1 - this.ruya * 0.3) - this.bloom.strength) * 0.04;
    this.kontrol.autoRotateSpeed = 0.35 - this.ruya * 0.2;
    if (this.odak) {
      const m = this.odak.merkez.clone();
      m.x = Math.abs(m.x) + 0.2;
      const hedef = m.normalize().multiplyScalar(2.6).add(new THREE.Vector3(0.6, 0.3, 0));
      this.kamera.position.lerp(hedef, 0.04);
      this.kontrol.target.lerp(this.odak.merkez, 0.05);
    }
    this.kontrol.update();
    for (const l of this.loblar) {
      l.hedef += (1 - l.hedef) * 0.0008;
      l.olcek += (l.hedef - l.olcek) * 0.05;
      l.aktivite *= 0.997;
    }
    // toz ve nöronlar lobun büyümesiyle dışarı itilir
    if (this.toz) {
      const tp = this.toz.geometry.attributes.position.array;
      for (let i = 0; i < this.tozTaban.length; i++) {
        const p = this.tozTaban[i];
        const o = this.tozLob[i].olcek;
        tp[i * 3] = p.x * o;
        tp[i * 3 + 1] = p.y * o + (o - 1) * 0.2;
        tp[i * 3 + 2] = p.z * o;
      }
      this.toz.geometry.attributes.position.needsUpdate = true;
    }
    const a = this.geo.attributes;
    for (const n of this.notlar) {
      const o = n.lob.olcek;
      n.p.set(n.taban.x * o, n.taban.y * o + (o - 1) * 0.2, n.taban.z * o);
      a.position.array.set([n.p.x, n.p.y, n.p.z], n.id * 3);
      n.isik *= 0.94;
      a.isik.array[n.id] = n.isik;
      n.dogum *= 0.985;
      a.dogum.array[n.id] = n.dogum;
    }
    a.position.needsUpdate = a.isik.needsUpdate = a.dogum.needsUpdate = true;
    this._baglariYaz();
    this.hale.scale.setScalar(Math.max(1, this.hale.scale.x * 0.96) + Math.sin(t * 3) * 0.04);
    // sinyaller
    for (let i = this.sinyaller.length - 1; i >= 0; i--) {
      const s = this.sinyaller[i];
      s.t += dt * s.h;
      if (s.t >= 1) {
        this.sinyaller.splice(i, 1);
        this.atesle(s.b, s.kalan);
      }
    }
    const sp = this.sg.attributes.position.array;
    const sc = this.sg.attributes.color.array;
    const sb = this.sg.attributes.boy.array;
    for (let i = 0; i < this.SN; i++) {
      const s = this.sinyaller[i];
      if (!s) {
        sp.set([999, 999, 999], i * 3);
        continue;
      }
      let p;
      if (s.egri) {
        const [b0, k] = s.egri;
        const u = 1 - s.t;
        p = new THREE.Vector3().addScaledVector(b0, u * u).addScaledVector(k, 2 * u * s.t).addScaledVector(s.b.p, s.t * s.t);
      } else p = s.a.clone().lerp(s.b.p, s.t);
      sp.set([p.x, p.y, p.z], i * 3);
      sc.set([s.renk.r, s.renk.g, s.renk.b], i * 3);
      sb[i] = s.boy;
    }
    for (const k of ['position', 'color', 'boy']) this.sg.attributes[k].needsUpdate = true;
    // boşta: rastgele küçük ateşlemeler (beyin hiç durmaz)
    if (Math.random() < 0.06 && this.notlar.length) this.atesle(this.notlar[Math.floor(Math.random() * this.notlar.length)], 2);
    // lob etiketleri
    const b = this.tuval.getBoundingClientRect();
    const bakis = this.kamera.position.clone().sub(this.kontrol.target).normalize();
    for (const l of this.loblar) {
      if (!l.el) continue;
      const m = l.merkez.clone().multiplyScalar(l.olcek);
      m.x = Math.abs(m.x) * Math.sign(this.kamera.position.x || 1);
      const v = m.clone().project(this.kamera);
      l.el.style.left = ((v.x + 1) / 2) * b.width + 'px';
      l.el.style.top = ((1 - v.y) / 2) * b.height + 'px';
      l.el.classList.toggle('arka', bakis.dot(m.clone().sub(this.kontrol.target).normalize()) < -0.1);
      l.cubuk.style.width = Math.round(l.aktivite * 100) + '%';
    }
    // fare üstündeki nöron
    this.ray.setFromCamera(this.fare, this.kamera);
    const vur = this.fare.x > -2 ? this.ray.intersectObject(this.noktalar)[0] : null;
    this.uzerinde = vur && !this.notlar[vur.index].sessiz ? this.notlar[vur.index] : null;
    if (this.uzerinde) {
      const n = this.uzerinde;
      this.ipucu.textContent = '';
      const bb = document.createElement('b');
      bb.textContent = n.ad;
      const ss = document.createElement('span');
      ss.textContent = `${this.turAdi(n.not ? 'not' : n.tur)} · ${n.lob.ad}`;
      this.ipucu.append(bb, ss);
      this.ipucu.style.opacity = 1;
      this.tuval.style.cursor = 'pointer';
    } else {
      this.ipucu.style.opacity = 0;
      this.tuval.style.cursor = 'grab';
    }
    this.composer.render();
  }
}
