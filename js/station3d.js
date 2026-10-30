import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.171.0/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.171.0/examples/jsm/controls/OrbitControls.js';
import { GLTFExporter } from 'https://cdn.jsdelivr.net/npm/three@0.171.0/examples/jsm/exporters/GLTFExporter.js';

const $ = (s) => document.querySelector(s);
const canvas = $('#station-canvas');
if (!canvas) throw new Error('Station 3D canvas not found');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xdce5ef, 5, 11);
const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 30);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.075;
controls.minDistance = 2.7;
controls.maxDistance = 7.5;
controls.maxPolarAngle = Math.PI * 0.49;
controls.target.set(0, 1.0, 0);

scene.add(new THREE.HemisphereLight(0xf6f9ff, 0x617080, 2.0));
const keyLight = new THREE.DirectionalLight(0xffffff, 3.1);
keyLight.position.set(-3, 5, 4);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(1024, 1024);
scene.add(keyLight);
const fillLight = new THREE.DirectionalLight(0x9fc7ff, 1.2);
fillLight.position.set(3, 2.6, -3);
scene.add(fillLight);

const mat = (color, roughness = 0.7, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
const m = {
  shell: mat(0xe6e8eb, .82), edge: mat(0xc5cbd2, .75), dark: mat(0x202934, .55), cavity: mat(0x333d49, .82),
  white: mat(0xfafafa, .55), tray: mat(0xd9e0e6, .28, .05), trayEdge: mat(0x354355, .3, .45),
  board: mat(0x26364b, .55), boardGreen: mat(0x1d7359, .52), boardBlue: mat(0x2773d2, .48), boardRed: mat(0xd9483b, .52),
  metal: mat(0x9ba6b2, .35, .72), rubber: mat(0x23272c, .88), accent: mat(0x4285f4, .35, .15),
  green: mat(0x34a853, .35), gold: mat(0xfbbc04, .38, .25), orange: mat(0xea7833, .5), label: mat(0x142235, .5)
};
const stationRoot = new THREE.Group();
stationRoot.name = 'Stasiun Wadah Pintar SLB-001';
scene.add(stationRoot);
const parts = {};
const anim = { door: 0, doorTarget: 0, trayY: 0, scan: 0, busy: false, phase: 'idle', type: '', container: true, exploded: false };
const originalPositions = new Map();

function box(parent, name, size, pos, material, cast = true, receive = true) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.name = name;
  mesh.position.set(...pos);
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  parent.add(mesh);
  return mesh;
}
function cylinder(parent, name, radiusTop, radiusBottom, height, pos, material, radial = 24) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, radial), material);
  mesh.name = name;
  mesh.position.set(...pos);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
function group(parent, name, pos = [0, 0, 0]) {
  const g = new THREE.Group(); g.name = name; g.position.set(...pos); parent.add(g); return g;
}
function addCalloutMark(parent, pos, color = 0x4285f4) {
  const mark = new THREE.Mesh(new THREE.SphereGeometry(.023, 16, 12), new THREE.MeshBasicMaterial({ color }));
  mark.position.set(...pos); parent.add(mark); return mark;
}

// Enclosure: open-front concept cabinet, with the proportions and three zones
// taken from the supplied SketchUp view. All dimensions below are meters.
const W = 1.0, H = 2.0, D = .52, T = .045;
const shell = group(stationRoot, 'Kabinet · rangka dan panel');
box(shell, 'Panel belakang', [W, H, T], [0, H / 2, -D / 2], m.edge);
box(shell, 'Panel sisi kiri', [T, H, D], [-W / 2 + T / 2, H / 2, 0], m.shell);
box(shell, 'Panel sisi kanan', [T, H, D], [W / 2 - T / 2, H / 2, 0], m.shell);
box(shell, 'Atap kabinet', [W, T, D], [0, H - T / 2, 0], m.shell);
box(shell, 'Alas kabinet', [W, .075, D], [0, .0375, 0], m.shell);
// Interior backing makes the active bay and two storage levels readable.
box(shell, 'Dinding ruang kontrol', [.91, .37, .018], [0, 1.775, .12], m.white, false);
box(shell, 'Lantai ruang perangkat', [.91, .025, .42], [0, 1.535, -.025], m.edge);
box(shell, 'Lantai ruang sensor', [.91, .035, .44], [0, .855, -.015], m.edge);
box(shell, 'Rak penyimpanan tengah', [.91, .035, .43], [0, .43, -.015], m.edge);
box(shell, 'Panel dasar ruang simpan', [.91, .018, .43], [0, .10, -.015], m.edge);
// Trim around the central return door opening.
box(shell, 'Lis atas pintu', [.88, .035, .07], [0, 1.47, .245], m.edge);
box(shell, 'Lis bawah pintu', [.88, .035, .07], [0, .875, .245], m.edge);
box(shell, 'Lis kiri pintu', [.035, .60, .07], [-.44, 1.17, .245], m.edge);
box(shell, 'Lis kanan pintu', [.035, .60, .07], [.44, 1.17, .245], m.edge);
// Control fascia, QR marker and live indicator. The attached firmware has no display.
const fascia = group(stationRoot, 'Panel identitas · area QR');
box(fascia, 'Papan identitas SLB-001', [.72, .30, .012], [0, 1.77, .273], m.white, false);
box(fascia, 'QR plate', [.115, .115, .006], [-.23, 1.77, .285], m.white, false);
// A small stylized, printed QR pattern; it is only a visual marker, not a functional QR code.
const qr = group(fascia, 'Penanda QR ilustratif', [-.287, 1.713, .29]);
box(qr, 'Latar QR', [.108, .108, .003], [.054, .054, 0], m.white, false);
for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) {
  if (((r * 3 + c * 5 + r * c) % 4 === 0) || (r < 2 && c < 2) || (r > 4 && c > 4)) box(qr, 'Titik QR ilustratif', [.009, .009, .004], [.018 + c * .012, .018 + r * .012, .003], m.dark, false, false);
}
box(fascia, 'Label stasiun', [.22, .046, .006], [.10, 1.82, .285], m.label, false);
const ledMat = new THREE.MeshStandardMaterial({ color: 0x34a853, emissive: 0x0c411a, emissiveIntensity: .55 });
const statusLed = cylinder(fascia, 'LED status stasiun', .015, .015, .008, [.30, 1.77, .292], ledMat);
// A clear guard is offset forward so the circuit can be seen in the model.
const guardMat = new THREE.MeshPhysicalMaterial({ color: 0xa8d4f0, roughness: .17, metalness: .08, transparent: true, opacity: .18, transmission: .15, thickness: .02, side: THREE.DoubleSide });
box(fascia, 'Pelindung bening panel', [.77, .34, .009], [0, 1.77, .31], guardMat, false, false);

// Main door pivot; continuous-rotation servo is shown with an illustrative horn/link.
const doorPivot = group(stationRoot, 'Pintu ruang pengembalian · engsel kiri', [-.405, 1.17, .288]);
box(doorPivot, 'Daun pintu tengah', [.79, .56, .035], [.395, 0, 0], m.shell);
box(doorPivot, 'Panel bagian dalam pintu', [.70, .47, .008], [.395, 0, .023], m.white, false);
box(doorPivot, 'Pegangan pintu', [.025, .15, .035], [.69, 0, .05], m.metal);
for (const y of [-.23, .23]) {
  const hinge = cylinder(doorPivot, 'Engsel pintu', .018, .018, .07, [.02, y, 0], m.metal, 16);
  hinge.rotation.z = Math.PI / 2;
}
// Bottom inventory bins: two containers visible through the lower open compartment.
function makeBin(parent, name, y, z) {
  const g = group(parent, name, [0, y, z]);
  box(g, 'Bodi wadah pakai ulang', [.58, .17, .28], [0, 0, 0], m.tray);
  box(g, 'Tutup/rim wadah', [.62, .025, .31], [0, .093, 0], m.trayEdge);
  box(g, 'Permukaan tutup', [.57, .006, .26], [0, .109, 0], m.tray);
  return g;
}
const storageBin1 = makeBin(stationRoot, 'Wadah stok bawah 1', .22, .02);
const storageBin2 = makeBin(stationRoot, 'Wadah stok bawah 2', .65, .02);

// Weighing platform, container, and RFID tag in the middle chamber.
const loadCell = group(stationRoot, 'Load cell · tatakan timbang', [0, .88, .075]);
box(loadCell, 'Load cell balok aluminium', [.30, .025, .10], [0, .045, 0], m.metal);
box(loadCell, 'Tatakan timbangan', [.66, .025, .35], [0, .075, 0], m.dark);
box(loadCell, 'Permukaan tatakan', [.62, .009, .32], [0, .092, 0], m.edge);
const returnBin = makeBin(loadCell, 'Wadah pada tatakan timbang', .245, .01);
const tag = group(loadCell, 'Tag RFID pada wadah', [.24, .215, .015]);
box(tag, 'Kartu RFID', [.07, .004, .045], [0, 0, 0], m.gold, false);
// RC522 board is placed behind the tray at the rear wall of the central chamber.
const rfid = group(stationRoot, 'RFID RC522 · pembaca tag', [-.29, 1.19, -.205]);
box(rfid, 'PCB RC522 biru', [.145, .18, .012], [0, 0, 0], m.boardBlue);
box(rfid, 'Antena RC522', [.105, .12, .003], [0, 0, .009], m.accent, false, false);
for (let i = 0; i < 3; i++) {
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.025 + i * .018, .0025, 8, 36), new THREE.MeshBasicMaterial({ color: 0x8bc4ff, transparent: true, opacity: .7 }));
  ring.position.set(.12, .015, .02); ring.rotation.y = Math.PI / 2; rfid.add(ring);
}
addCalloutMark(rfid, [.085, -.10, .03], 0x4285f4);
// ESP32 and HX711 sit in the top electronics bay, mounted on an internal back plate.
const esp = group(stationRoot, 'ESP32 DevKit · pengendali utama', [.20, 1.65, .29]);
box(esp, 'PCB ESP32 hitam', [.25, .17, .012], [0, 0, 0], m.dark);
box(esp, 'Modul ESP32', [.13, .105, .022], [.025, 0, .018], m.board);
box(esp, 'Perisai ESP32', [.105, .07, .006], [.025, 0, .033], m.metal);
for (let i = 0; i < 9; i++) {
  box(esp, 'Header ESP32', [.007, .012, .007], [-.105 + i * .026, -.077, .014], m.gold, false, false);
  box(esp, 'Header ESP32', [.007, .012, .007], [-.105 + i * .026, .077, .014], m.metal, false, false);
}
const hx = group(stationRoot, 'HX711 · penguat load cell', [-.22, 1.65, .29]);
box(hx, 'PCB HX711 merah', [.17, .14, .012], [0, 0, 0], m.boardRed);
box(hx, 'IC HX711', [.055, .08, .025], [0, 0, .018], m.dark);
for (let i = 0; i < 4; i++) box(hx, 'Terminal HX711', [.015, .015, .012], [-.055 + i * .037, -.052, .016], m.metal);
const buzzer = group(stationRoot, 'Buzzer aktif · indikator suara', [.36, 1.84, .29]);
cylinder(buzzer, 'Rumah buzzer', .046, .046, .055, [0, 0, 0], m.rubber);
cylinder(buzzer, 'Lubang suara buzzer', .017, .017, .004, [0, .03, 0], m.dark);
// Continuous servo and simple concept linkage at the left inner edge of the door.
const servo = group(stationRoot, 'Servo continuous · penggerak pintu', [-.43, 1.18, -.095]);
box(servo, 'Badan servo', [.12, .075, .08], [0, 0, 0], m.dark);
box(servo, 'Label servo', [.074, .045, .004], [0, 0, .043], m.board, false);
cylinder(servo, 'Poros servo', .018, .018, .026, [.065, 0, .01], m.metal, 16);
const horn = box(servo, 'Lengan servo ilustratif', [.11, .012, .012], [.11, .028, .01], m.white);
horn.rotation.z = -.24;
const link = box(servo, 'Linkage pintu ilustratif', [.20, .008, .008], [.20, .04, .085], m.orange);
link.rotation.y = -.25;

parts.esp32 = esp; parts.rfid = rfid; parts.scale = loadCell; parts.servo = servo; parts.buzzer = buzzer;
// Snapshot reference positions for exploded view and export naming.
stationRoot.traverse(o => { if (o.isGroup || o.isMesh) originalPositions.set(o, o.position.clone()); });

// Ground plane and subtle grid are presentation-only and are excluded from the GLB export.
const ground = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.MeshStandardMaterial({ color: 0xe5ebf1, roughness: .92 }));
ground.rotation.x = -Math.PI / 2; ground.position.y = -.012; ground.receiveShadow = true; scene.add(ground);
const grid = new THREE.GridHelper(8, 24, 0xbac5d0, 0xd0d9e2); grid.position.y = -.009; scene.add(grid);

function resize() {
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(1, rect.width), h = Math.max(1, rect.height);
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(canvas.parentElement);
function resetView() { camera.position.set(2.7, 2.2, 3.35); controls.target.set(0, 1.0, 0); controls.update(); }
resetView(); resize();

const component = {
  esp32: { n: '01', name: 'ESP32 DevKit', copy: 'Pengendali utama: membaca sensor, mengirim event HTTPS ke Supabase, dan menerima perintah transaksi melalui Wi-Fi.', pin: 'RFID 5/22/18/23/19 · HX711 4/16 · Servo 21 · Buzzer 27' },
  rfid: { n: '02', name: 'RFID RC522', copy: 'Membaca UID tag pada wadah. Hanya UID yang diizinkan firmware yang diteruskan untuk diperiksa server.', pin: 'SS 5 · RST 22 · SCK 18 · MOSI 23 · MISO 19' },
  scale: { n: '03', name: 'Load cell + HX711', copy: 'Load cell mengukur massa wadah; HX711 menguatkan sinyalnya. Firmware mengambil beberapa sampel untuk memastikan bacaan stabil.', pin: 'DOUT 4 · SCK 16 · valid 60–200 g · kosong ≤5 g' },
  servo: { n: '04', name: 'Servo pintu continuous', copy: 'Berputar singkat untuk membuka atau menutup pintu. Lama putaran bawaan 300 ms dan batas keras firmware 2.000 ms; posisi fisik tidak diukur sensor.', pin: 'GPIO 21 · buka 0° · stop 90° · tutup 180°' },
  buzzer: { n: '05', name: 'Buzzer aktif', copy: 'Memberi umpan balik lokal: dua bunyi pendek untuk diterima, satu bunyi panjang untuk ditolak, dan tiga bunyi pendek saat jalur masih terhalang.', pin: 'GPIO 27 · aktif HIGH' }
};
let selected = 'esp32';
function selectPart(key) {
  if (!component[key]) return;
  selected = key;
  document.querySelectorAll('.component-chip').forEach(b => b.classList.toggle('active', b.dataset.part === key));
  const d = component[key]; $('.component-number').textContent = d.n; $('#component-name').textContent = d.name; $('#component-copy').textContent = d.copy; $('#component-pin').textContent = d.pin;
  const target = parts[key]; if (target) {
    const world = new THREE.Vector3(); target.getWorldPosition(world); controls.target.lerp(world, .55);
    target.traverse(o => { if (o.isMesh && o.material && 'emissive' in o.material) { o.material.emissive.set(0x214b77); o.material.emissiveIntensity = .18; } });
    setTimeout(() => target.traverse(o => { if (o.isMesh && o.material && 'emissive' in o.material) o.material.emissiveIntensity = 0; }), 650);
  }
}
document.querySelectorAll('.component-chip').forEach(b => b.addEventListener('click', () => selectPart(b.dataset.part)));

const stateLabel = $('#station-status'), stateLed = $('#station-led'), txLabel = $('#station-tx-label'), note = $('#station-note');
const flowSteps = ['rfid', 'weight', 'server', 'door', 'removed'];
function stageUI(stage) {
  const index = flowSteps.indexOf(stage);
  document.querySelectorAll('#station-stages li').forEach((li, i) => {
    li.classList.toggle('active', i === index);
    li.classList.toggle('done', index >= 0 && i < index);
  });
}
function setStatus(label, mode = 'ready') {
  stateLabel.textContent = label;
  stateLed.classList.toggle('busy', mode === 'busy');
  stateLed.classList.toggle('error', mode === 'error');
  statusLed.material.color.set(mode === 'error' ? 0xd93025 : mode === 'busy' ? 0xfbbc04 : 0x34a853);
  statusLed.material.emissive.set(mode === 'error' ? 0x50100c : mode === 'busy' ? 0x493800 : 0x0c411a);
}
let stepTimers = [];
function clearSteps() { stepTimers.forEach(clearTimeout); stepTimers = []; anim.busy = false; }
function later(fn, ms) { stepTimers.push(setTimeout(fn, ms)); }
function setStage(stage) {
  if (stage === 'reading') { stageUI('rfid'); txLabel.textContent = 'Membaca UID wadah'; setStatus('RFID terbaca · timbang stabil', 'busy'); anim.scan = 1; note.textContent = 'RC522 membaca UID, lalu HX711 mengambil beberapa sampel berat.'; }
  if (stage === 'rejected') { stageUI('server'); txLabel.textContent = 'Ditolak oleh server'; setStatus('Berat tidak valid · pintu tetap terbuka', 'error'); anim.doorTarget = 1.25; note.textContent = 'Sesuai firmware, keputusan penolakan tidak menutup pintu jika wadah atau tag masih terdeteksi.'; }
}
function startBorrow(fromControl = true) {
  if (anim.busy || anim.phase === 'waiting_pickup') { if (anim.phase === 'waiting_pickup') completeBorrow(); return; }
  clearSteps(); anim.busy = true; anim.type = 'borrow'; anim.phase = 'reading'; anim.container = true; returnBin.visible = true;
  stageUI('rfid'); txLabel.textContent = 'Peminjaman · mulai'; setStatus('Membaca wadah di dalam stasiun', 'busy');
  note.textContent = 'Pintu tetap tertutup saat tag dan berat wadah diperiksa. Rentang valid firmware: 60–200 g.';
  if (fromControl) window.stationPhoneNavigate?.('borrow');
  const weight = Number($('#station-weight').value);
  later(() => { stageUI('weight'); txLabel.textContent = `HX711 · ${weight} g`; anim.trayY = .014; }, 520);
  later(() => {
    anim.trayY = 0;
    if (weight < 60 || weight > 200) {
      stageUI('server'); txLabel.textContent = 'Berat di luar rentang'; setStatus('Validasi gagal · pintu tertutup', 'error');
      note.textContent = `${weight} g tidak lolos rentang 60–200 g. Server menolak dan pintu tetap tertutup.`;
      anim.busy = false; anim.phase = 'rejected'; return;
    }
    stageUI('server'); txLabel.textContent = 'Server menyetujui pinjaman';
    later(() => {
      stageUI('door'); txLabel.textContent = 'Servo membuka pintu'; anim.doorTarget = 1.25; anim.phase = 'waiting_pickup'; anim.busy = false;
      setStatus('Pintu terbuka · wadah siap diambil', 'busy');
      note.textContent = 'Setelah server menyetujui tag dan berat, servo membuka pintu. Tekan “Ambil wadah” di panel ini atau “Selesai” di simulasi HP.';
      $('#station-borrow').textContent = '✓ Ambil wadah';
    }, 520);
  }, 1120);
}
function completeBorrow() {
  if (anim.type !== 'borrow' || anim.phase !== 'waiting_pickup') return;
  clearSteps(); anim.phase = 'removing'; anim.busy = true; anim.container = false; returnBin.visible = false;
  stageUI('removed'); txLabel.textContent = 'Timbangan kosong · konfirmasi'; anim.trayY = -.008;
  setStatus('Wadah diambil · mengonfirmasi', 'busy');
  note.textContent = 'Berat kosong stabil ≤5 g dikonfirmasi ke server. Firmware menunggu sekitar 700 ms sebelum menutup pintu.';
  later(() => { stageUI('door'); txLabel.textContent = 'Servo menutup pintu'; anim.doorTarget = 0; }, 750);
  later(() => {
    stageUI(''); txLabel.textContent = 'Pinjaman tercatat'; setStatus('Transaksi selesai · pintu tertutup');
    note.textContent = 'Wadah yang diambil tercatat setelah sensor beban memastikan tatakan kosong.';
    anim.busy = false; anim.phase = 'done'; $('#station-borrow').textContent = '▶ Simulasikan pinjam';
  }, 1450);
}
function startReturn(fromControl = true) {
  if (anim.busy) return;
  clearSteps(); anim.type = 'return'; anim.phase = 'waiting_return'; anim.container = false; returnBin.visible = false;
  stageUI('door'); txLabel.textContent = 'Transaksi kembali diterima'; setStatus('Pintu pengembalian terbuka', 'busy'); anim.doorTarget = 1.25;
  note.textContent = 'Untuk pengembalian, pintu dibuka saat server menerima transaksi. Letakkan wadah di tatakan lalu pembaca RFID dan timbangan memeriksa.';
  if (fromControl) window.stationPhoneNavigate?.('ret');
}
function performReturn() {
  if (anim.type !== 'return') startReturn(false);
  if (anim.phase !== 'waiting_return') return;
  anim.phase = 'reading'; anim.busy = true; anim.container = true; returnBin.visible = true;
  const weight = Number($('#station-weight').value);
  stageUI('rfid'); txLabel.textContent = 'RC522 membaca tag'; anim.scan = 1;
  setStatus('Wadah diletakkan · membaca RFID', 'busy');
  note.textContent = 'RC522 membaca UID dan HX711 memeriksa berat dalam sampel stabil.';
  later(() => { stageUI('weight'); txLabel.textContent = `HX711 · ${weight} g`; anim.trayY = .014; }, 560);
  later(() => {
    anim.trayY = 0; stageUI('server');
    if (weight < 60 || weight > 200) {
      txLabel.textContent = 'Berat di luar rentang'; setStatus('Ditolak · pintu tetap terbuka', 'error');
      note.textContent = `${weight} g tidak lolos rentang 60–200 g. Stasiun memberi bunyi penolakan dan menjaga pintu terbuka.`;
      anim.busy = false; anim.phase = 'rejected'; return;
    }
    txLabel.textContent = 'Server menyetujui pengembalian';
    later(() => finishReturn(), 520);
  }, 1180);
}
function finishReturn() {
  stageUI('door'); txLabel.textContent = 'Bunyi sukses · pintu menutup'; setStatus('Pengembalian diterima', 'busy');
  note.textContent = 'Server mengesahkan wadah. Buzzer memberi dua bunyi pendek, lalu servo menutup pintu.';
  later(() => { anim.doorTarget = 0; }, 260);
  later(() => { stageUI(''); txLabel.textContent = 'Pengembalian tercatat'; setStatus('Transaksi selesai · pintu tertutup'); note.textContent = 'Wadah sudah tercatat kembali. Bagian rak bawah pada model menggambarkan ruang stok wadah.'; anim.busy = false; anim.phase = 'done'; }, 980);
}
function completeReturn(ok) {
  if (ok && anim.type === 'return' && anim.phase === 'reading') { clearSteps(); finishReturn(); }
}
$('#station-borrow').addEventListener('click', () => {
  if (anim.phase === 'waiting_pickup') completeBorrow(); else startBorrow(true);
});
$('#station-return').addEventListener('click', () => {
  if (anim.phase === 'waiting_return') performReturn(); else if (anim.phase === 'reading' && anim.type === 'return') performReturn(); else startReturn(true);
});
$('#station-weight').addEventListener('input', e => { $('#station-weight-value').textContent = e.target.value; });
$('#station-door-toggle').addEventListener('click', e => {
  const open = anim.doorTarget < .6; anim.doorTarget = open ? 1.25 : 0;
  e.currentTarget.setAttribute('aria-pressed', String(open));
  e.currentTarget.innerHTML = open ? '<span>↙</span> Tutup pintu' : '<span>↗</span> Buka/tutup pintu';
});
$('#station-reset').addEventListener('click', resetView);
$('#station-explode').addEventListener('click', e => {
  anim.exploded = !anim.exploded; e.currentTarget.setAttribute('aria-pressed', String(anim.exploded));
  e.currentTarget.innerHTML = anim.exploded ? '<span>⇱</span> Satukan komponen' : '<span>⇲</span> Pisahkan komponen';
});
$('#station-export').addEventListener('click', () => {
  const exporter = new GLTFExporter();
  $('#station-export').disabled = true;
  exporter.parse(stationRoot, result => {
    const blob = new Blob([result], { type: 'model/gltf-binary' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'stasiun-wadah-pintar-SLB-001.glb'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000); $('#station-export').disabled = false;
  }, error => { console.error(error); toast('Model gagal diekspor. Coba lagi.'); $('#station-export').disabled = false; }, { binary: true, onlyVisible: true });
});
function toast(text) { const t = $('#model-toast'); t.textContent = text; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2300); }

// Keep the physical model aligned with the existing mobile web simulator.
function setFromPhone(screen, kind) {
  if (screen === 'borrow' && anim.phase !== 'waiting_pickup' && anim.phase !== 'reading') startBorrow(false);
  if (screen === 'ret' && anim.type === 'return' && anim.phase === 'rejected') { anim.phase = 'waiting_return'; setStatus('Pintu pengembalian terbuka · coba lagi', 'busy'); txLabel.textContent = 'Siap membaca ulang'; }
  else if (screen === 'ret' && (anim.type !== 'return' || anim.phase === 'done' || anim.phase === 'idle')) startReturn(false);
  if (screen === 'verify' && anim.type === 'return') performReturn();
  if (screen === 'err' && anim.type === 'return') setStage('rejected');
  if (screen === 'ok' && kind === 'borrow' && anim.phase === 'waiting_pickup') completeBorrow();
}
window.station3D = { setStage, setFromPhone, completeBorrow, completeReturn, startBorrow, startReturn, performReturn };

const raycaster = new THREE.Raycaster(); const pointer = new THREE.Vector2();
canvas.addEventListener('pointerdown', ev => {
  if (ev.button !== 0) return;
  const rect = canvas.getBoundingClientRect(); pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1; pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects([esp, rfid, loadCell, servo, buzzer], true);
  if (hits.length) {
    const hit = hits[0].object;
    const root = [esp, rfid, loadCell, servo, buzzer].find(g => { let p = hit; while (p) { if (p === g) return true; p = p.parent; } return false; });
    const key = Object.keys(parts).find(k => parts[k] === root); if (key) selectPart(key);
  }
});

const clock = new THREE.Clock();
function render() {
  requestAnimationFrame(render);
  const dt = Math.min(clock.getDelta(), .05);
  controls.update();
  anim.door += (anim.doorTarget - anim.door) * Math.min(1, dt * 4.5);
  doorPivot.rotation.y = -anim.door;
  anim.trayY *= .88; loadCell.position.y = .88 + anim.trayY;
  anim.scan *= .94;
  // RFID field rings pulse while reading.
  rfid.children.filter(o => o.geometry?.type === 'TorusGeometry').forEach((o, i) => { o.material.opacity = .18 + .5 * anim.scan; o.scale.setScalar(1 + anim.scan * .12); });
  // Explode the top control electronics and RFID board enough to show the actual component placement.
  for (const [key, g] of Object.entries(parts)) {
    const orig = originalPositions.get(g); if (!orig) continue;
    const factor = anim.exploded ? 1 : 0;
    const offset = key === 'esp32' ? [0, .14, .18] : key === 'scale' ? [0, -.055, .06] : key === 'rfid' ? [-.10, 0, .16] : key === 'servo' ? [-.13, 0, .12] : [0, .12, .12];
    g.position.set(orig.x + offset[0] * factor, orig.y + (key === 'scale' ? anim.trayY : offset[1] * factor), orig.z + offset[2] * factor);
  }
  renderer.render(scene, camera);
}
render();
selectPart('esp32');
