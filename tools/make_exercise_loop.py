"""Arma el loop de un ejercicio desde 3 imágenes (inicio, mitad, final).

Uso: python3 tools/make_exercise_loop.py inicio.png mitad.png final.png carpeta_salida
Genera repetition-pilot.mp4, poster.webp y animation-{start,mid,bottom}.webp en 1008x672.
Alinea las poses sobre la base del equipo y las une con morph por flujo óptico.
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

def main(start_path, mid_path, end_path, out_dir):
    raw = [cv2.imread(p) for p in (start_path, mid_path, end_path)]
    mid = raw[1]
    raw = [cv2.resize(x, (mid.shape[1], mid.shape[0])) for x in raw]
    poses = [align(raw[0], mid), mid, align(raw[2], mid)]
    s, m, f = (cv2.resize(x, (W, H), interpolation=cv2.INTER_AREA) for x in poses)
    dis = cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM)
    gx, gy = np.meshgrid(np.arange(W, dtype=np.float32), np.arange(H, dtype=np.float32))
    gray = lambda x: cv2.cvtColor(x, cv2.COLOR_BGR2GRAY)
    def flows(a, b): return dis.calc(gray(a), gray(b), None), dis.calc(gray(b), gray(a), None)
    def morph(a, b, fab, fba, t):
        t = np.float32(t)
        wa = cv2.remap(a, gx + t * fba[..., 0], gy + t * fba[..., 1], cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
        wb = cv2.remap(b, gx + (1 - t) * fab[..., 0], gy + (1 - t) * fab[..., 1], cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
        return wa.astype(np.float32) * (1 - t) + wb.astype(np.float32) * t
    ease = lambda t: 0.5 - 0.5 * np.cos(np.pi * t)
    fsm, fms = flows(s, m); fmf, ffm = flows(m, f)
    seq = []
    hold = lambda a, n: seq.extend([a.astype(np.float32)] * n)
    def tr(a, b, fab, fba, n): seq.extend(morph(a, b, fab, fba, ease((i + 1) / n)) for i in range(n))
    hold(s, 12); tr(s, m, fsm, fms, 16); tr(m, f, fmf, ffm, 13); hold(f, 10); tr(f, m, ffm, fmf, 13); tr(m, s, fms, fsm, 16); hold(s, 4)  # 84 cuadros = 4,2 s
    os.makedirs(out_dir, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        for i, fr in enumerate(seq): cv2.imwrite(f"{tmp}/{i:03d}.png", np.clip(fr, 0, 255).astype(np.uint8))
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-framerate", str(FPS), "-i", f"{tmp}/%03d.png", "-c:v", "libx264", "-preset", "veryfast", "-crf", "26", "-pix_fmt", "yuv420p", "-movflags", "+faststart", f"{out_dir}/repetition-pilot.mp4"], check=True)
    for img, name in ((s, "animation-start"), (m, "animation-mid"), (f, "animation-bottom"), (s, "poster")):
        Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB)).save(f"{out_dir}/{name}.webp", quality=80)

if __name__ == "__main__":
    if len(sys.argv) != 5: sys.exit(__doc__)
    main(*sys.argv[1:])
