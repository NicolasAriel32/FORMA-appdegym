"""Arma el loop de un ejercicio desde 3 o más imágenes en orden (inicio … final).

Uso: python3 tools/make_exercise_loop.py [--pad-top 0.22] [--flow-scale 3] inicio.png [intermedias.png ...] final.png carpeta_salida
  --pad-top: agrega fondo arriba (fracción de la altura) si el equipo queda cortado al alinear.
  --flow-scale: calcula el movimiento a menor resolución; ayuda cuando la barra cruza la cara.
  --transition N: cuadros por transición (por defecto automático). Usá 5 cuando un brazo fino gira
      mucho (elevaciones laterales): el fantasma dura un instante y se lee como desenfoque.
  --hold-mid N: cuadros de pausa en cada pose intermedia (por defecto 0).
Genera repetition-pilot.mp4, poster.webp y animation-NN.webp en 1008x672.
Alinea las poses sobre la base del equipo y las une con morph por flujo óptico.
Si el equipo se desplaza mucho entre dos imágenes, agregá una pose intermedia.
"""
import os, subprocess, sys, tempfile
import cv2, numpy as np
from PIL import Image

W, H, FPS = 1008, 672, 20

def align(img, ref):
    g1, g2 = (cv2.cvtColor(x, cv2.COLOR_BGR2GRAY) for x in (img, ref))
    mask = np.zeros_like(g2); mask[int(g2.shape[0] * .58):, :] = 255  # base del equipo: no se mueve
    orb = cv2.ORB_create(4000)
    k1, d1 = orb.detectAndCompute(g1, mask); k2, d2 = orb.detectAndCompute(g2, mask)
    if d1 is None or d2 is None: return img
    m = sorted(cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True).match(d1, d2), key=lambda x: x.distance)[:400]
    if len(m) < 12: return img
    A, inl = cv2.estimateAffinePartial2D(np.float32([k1[x.queryIdx].pt for x in m]), np.float32([k2[x.trainIdx].pt for x in m]), method=cv2.RANSAC, ransacReprojThreshold=4)
    if A is None or inl.sum() < 12: return img
    return cv2.warpAffine(img, A, (ref.shape[1], ref.shape[0]), borderMode=cv2.BORDER_REPLICATE)

def main(paths, out_dir, pad_top=0.0, flow_scale=1, transition=None, hold_mid=0):
    raw = [cv2.imread(p) for p in paths]
    if pad_top > 0:
        raw = [cv2.copyMakeBorder(x, int(x.shape[0] * pad_top), 0, 0, 0, cv2.BORDER_REPLICATE) for x in raw]
    ref = raw[len(raw) // 2]
    raw = [cv2.resize(x, (ref.shape[1], ref.shape[0])) for x in raw]
    poses = [x if x is ref else align(x, ref) for x in raw]
    poses = [cv2.resize(x, (W, H), interpolation=cv2.INTER_AREA) for x in poses]
    dis = cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM)
    gx, gy = np.meshgrid(np.arange(W, dtype=np.float32), np.arange(H, dtype=np.float32))
    gray = lambda x: cv2.cvtColor(x, cv2.COLOR_BGR2GRAY)
    def morph(a, b, fab, fba, t):
        t = np.float32(t)
        wa = cv2.remap(a, gx + t * fba[..., 0], gy + t * fba[..., 1], cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
        wb = cv2.remap(b, gx + (1 - t) * fab[..., 0], gy + (1 - t) * fab[..., 1], cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
        return wa.astype(np.float32) * (1 - t) + wb.astype(np.float32) * t
    ease = lambda t: 0.5 - 0.5 * np.cos(np.pi * t)
    steps = len(poses) - 1
    per = transition or max(10, round(29 / steps))  # cuadros por transición: más poses, transiciones más cortas
    def calc(a, b):
        if flow_scale == 1: return dis.calc(gray(a), gray(b), None)
        size = (W // flow_scale, H // flow_scale)
        small = dis.calc(cv2.resize(gray(a), size, interpolation=cv2.INTER_AREA), cv2.resize(gray(b), size, interpolation=cv2.INTER_AREA), None)
        return cv2.resize(small, (W, H)) * flow_scale
    flows = [(calc(a, b), calc(b, a)) for a, b in zip(poses, poses[1:])]
    seq = []
    hold = lambda a, n: seq.extend([a.astype(np.float32)] * n)
    def tr(a, b, fab, fba, n): seq.extend(morph(a, b, fab, fba, ease((i + 1) / n)) for i in range(n))
    hold(poses[0], 12)
    for i in range(steps):
        tr(poses[i], poses[i + 1], flows[i][0], flows[i][1], per)
        if i < steps - 1 and hold_mid: hold(poses[i + 1], hold_mid)
    hold(poses[-1], 10)
    for i in reversed(range(steps)):
        tr(poses[i + 1], poses[i], flows[i][1], flows[i][0], per)
        if i > 0 and hold_mid: hold(poses[i], hold_mid)
    hold(poses[0], 4)
    os.makedirs(out_dir, exist_ok=True)
    for old in os.listdir(out_dir):
        if old.startswith("animation-") and old.endswith(".webp"): os.remove(os.path.join(out_dir, old))
    with tempfile.TemporaryDirectory() as tmp:
        for i, fr in enumerate(seq): cv2.imwrite(f"{tmp}/{i:03d}.png", np.clip(fr, 0, 255).astype(np.uint8))
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-framerate", str(FPS), "-i", f"{tmp}/%03d.png", "-c:v", "libx264", "-preset", "veryfast", "-crf", "26", "-pix_fmt", "yuv420p", "-movflags", "+faststart", f"{out_dir}/repetition-pilot.mp4"], check=True)
    for i, img in enumerate(poses):
        Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB)).save(f"{out_dir}/animation-{i + 1:02d}.webp", quality=80)
    Image.fromarray(cv2.cvtColor(poses[0], cv2.COLOR_BGR2RGB)).save(f"{out_dir}/poster.webp", quality=80)
    print(f"{len(seq)} cuadros · {len(seq) / FPS:.1f} s")

if __name__ == "__main__":
    args, opts = sys.argv[1:], {}
    while args and args[0].startswith("--"):
        key = args.pop(0)
        if key == "--pad-top": opts["pad_top"] = float(args.pop(0))
        elif key == "--flow-scale": opts["flow_scale"] = int(args.pop(0))
        elif key == "--transition": opts["transition"] = int(args.pop(0))
        elif key == "--hold-mid": opts["hold_mid"] = int(args.pop(0))
        else: sys.exit(__doc__)
    if len(args) < 4: sys.exit(__doc__)
    main(args[:-1], args[-1], **opts)
