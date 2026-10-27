import numpy as np, wave

SR = 44100
DUR = 16.5
N = int(SR * (DUR + 1.0))
rng = np.random.default_rng(7)
t_all = np.arange(N) / SR

def buf(): return np.zeros(N)
def at(sec): return int(sec * SR)
def env_ad(n, a, d, curve=4.0):
    e = np.ones(n); na = max(1, int(a * SR)); e[:na] = np.linspace(0, 1, na)
    rest = n - na; e[na:] = np.exp(-curve * np.arange(rest) / max(1, int(d * SR)))
    return e
def add(dst, sig, start):
    s = at(start); e = min(N, s + len(sig))
    if s < N: dst[s:e] += sig[:e - s]
def lowpass(x, cutoff):
    # one-pole, cutoff may be array
    a = np.exp(-2 * np.pi * np.asarray(cutoff) / SR) * np.ones(len(x))
    y = np.zeros_like(x); prev = 0.0
    for i in range(len(x)):
        prev = (1 - a[i]) * x[i] + a[i] * prev; y[i] = prev
    return y
def hz(m): return 440.0 * 2 ** ((m - 69) / 12)
def saw(f, n, ph=0.0):
    tt = np.arange(n) / SR; return 2 * ((f * tt + ph) % 1) - 1
def sq(f, n):
    tt = np.arange(n) / SR; return np.sign(np.sin(2 * np.pi * f * tt))

BPM = 128; BEAT = 60 / BPM; BAR = 4 * BEAT
DROP = 1.6; OUT = 14.4
drums, bass, music, sfx = buf(), buf(), buf(), buf()

# chord progression (F minor): Fm, Db, Ab, Eb
CH = [[53, 56, 60], [49, 53, 56], [56, 60, 63], [51, 55, 58]]
ROOT = [29, 25, 32, 27]

# ---- pad (whole track) ----
nbar = int(np.ceil((DUR + 1) / BAR))
for b in range(nbar):
    s = b * BAR; n = int(BAR * SR) + int(0.3 * SR); ch = CH[b % 4]
    sig = np.zeros(n)
    for m in ch + [ch[0] + 12]:
        for det in (-0.12, 0.0, 0.11):
            sig += saw(hz(m) * 2 ** (det / 12), n, rng.random())
    e = np.minimum(1, np.arange(n) / (0.25 * SR)) * np.minimum(1, (n - np.arange(n)) / (0.3 * SR))
    add(music, sig * e * 0.018, s)
# filter sweep on the pad: dark intro, opens at the drop
cut = np.interp(t_all, [0, DROP, DROP + 0.01, 13.8, 15.5, 17.5], [300, 2200, 1400, 2600, 900, 400])
music = lowpass(music, cut)

# ---- arp pluck (16ths, chord tones) from the drop ----
step = BEAT / 4; k = 0; tt = DROP
pat = [0, 1, 2, 3, 2, 1, 0, 2]
while tt < OUT + 1.2:
    b = int(tt // BAR); ch = CH[b % 4] + [CH[b % 4][0] + 12]
    m = ch[pat[k % 8]] + 12
    n = int(0.18 * SR); f = hz(m)
    sig = (0.6 * sq(f, n) + 0.4 * saw(f * 2, n)) * env_ad(n, 0.002, 0.07, 3.5)
    vel = 0.5 + 0.5 * (k % 4 == 0)
    fade = 1.0 if tt < OUT else max(0, 1 - (tt - OUT) / 1.2)
    add(music, lowpass(sig, 3200) * 0.045 * vel * fade, tt)
    tt += step; k += 1

# ---- drums ----
def kick():
    n = int(0.45 * SR); x = np.arange(n) / SR
    f = 48 + 110 * np.exp(-x * 28); ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-x * 7) + 0.4 * np.exp(-x * 220) * rng.standard_normal(n) * 0.3
def clap():
    n = int(0.3 * SR); x = np.arange(n) / SR; nz = rng.standard_normal(n)
    e = np.exp(-x * 22) + 0.6 * np.exp(-np.maximum(0, x - 0.012) * 30) * (x > 0.012) + 0.4 * np.exp(-np.maximum(0, x - 0.024) * 30) * (x > 0.024)
    return lowpass(nz - lowpass(nz, 900), 6000) * e * 0.9
def hat(open_=False):
    n = int((0.22 if open_ else 0.05) * SR); x = np.arange(n) / SR; nz = rng.standard_normal(n)
    return (nz - lowpass(nz, 7000)) * np.exp(-x * (14 if open_ else 80))
K, C = kick(), clap()
tt = DROP; i = 0
while tt < OUT:
    pos = i % 16  # 16th in bar
    if pos in (0, 6, 10): add(drums, K * 0.9, tt)
    if pos in (4, 12): add(drums, C * 0.55, tt)
    roll = (int(tt // BAR) % 2 == 1 and pos >= 12)
    if pos % 2 == 0 or roll: add(drums, hat(pos == 14 and not roll) * (0.16 if pos % 4 == 0 else 0.1), tt)
    if roll and pos % 2 == 1: add(drums, hat() * 0.08, tt + step / 2)
    tt += step; i += 1

# 808 bass with glide
tt = DROP; i = 0
while tt < OUT:
    pos = i % 16; b = int(tt // BAR)
    if pos in (0, 6, 10):
        n = int((0.55 if pos != 10 else 0.4) * SR); x = np.arange(n) / SR
        f0 = hz(ROOT[b % 4]); f = f0 * (1 + 0.25 * np.exp(-x * 30))
        sig = np.tanh(2.2 * np.sin(2 * np.pi * np.cumsum(f) / SR)) * np.exp(-x * 2.8)
        add(bass, sig * 0.32, tt)
    tt += step; i += 1

# ---- intro: power-up riser + boot ----
n = int(DROP * SR); x = np.arange(n) / SR
f = 70 + 900 * (x / DROP) ** 2.2
riser = np.sin(2 * np.pi * np.cumsum(f) / SR) * (x / DROP) ** 1.5 * 0.12
nz = rng.standard_normal(n); riser += lowpass(nz, 400 + 5000 * (x / DROP) ** 2) * (x / DROP) ** 2 * 0.12
add(sfx, riser, 0)
# impact at the drop
n = int(1.4 * SR); x = np.arange(n) / SR
boom = np.sin(2 * np.pi * np.cumsum(38 + 60 * np.exp(-x * 9)) / SR) * np.exp(-x * 3) * 0.55
crash = (lambda z: (z - lowpass(z, 3000)))(rng.standard_normal(n)) * np.exp(-x * 2.5) * 0.12
add(sfx, boom + crash, DROP)

# ---- trade SFX ----
def blip_up():
    out = np.zeros(int(0.26 * SR))
    for j, m in enumerate((84, 91)):
        n = int(0.11 * SR); s = (sq(hz(m), n) * 0.5 + np.sin(2 * np.pi * hz(m) * np.arange(n) / SR)) * env_ad(n, 0.002, 0.05, 3)
        o = int(j * 0.075 * SR); out[o:o + n] += s
    return lowpass(out, 5000) * 0.16
def coin():
    out = np.zeros(int(0.9 * SR))
    for j, m in enumerate((88, 93, 100, 105)):
        n = int(0.6 * SR); x = np.arange(n) / SR
        s = (np.sin(2 * np.pi * hz(m) * x) + 0.3 * np.sin(2 * np.pi * hz(m) * 2.01 * x)) * np.exp(-x * 7)
        o = int(j * 0.055 * SR); out[o:o + n] += s
    return out * 0.13
def stop():
    n = int(0.5 * SR); x = np.arange(n) / SR; f = 520 * np.exp(-x * 4.5) + 90
    return lowpass(np.tanh(np.sin(2 * np.pi * np.cumsum(f) / SR) * 2.5), 1800) * np.exp(-x * 5) * 0.22
def whoosh_down():
    n = int(1.1 * SR); x = np.arange(n) / SR; nz = rng.standard_normal(n)
    s = lowpass(nz, 6000 * np.exp(-x * 3) + 200) * np.sin(np.pi * np.minimum(1, x / 1.1)) * 0.3
    s += np.sin(2 * np.pi * np.cumsum(220 * np.exp(-x * 2.5) + 40) / SR) * np.exp(-x * 2) * 0.25
    return s
def zap():
    n = int(0.12 * SR); x = np.arange(n) / SR
    return np.sin(2 * np.pi * np.cumsum(2400 * np.exp(-x * 30) + 300) / SR) * np.exp(-x * 30) * 0.05
def tick():
    n = int(0.02 * SR); x = np.arange(n) / SR
    z = rng.standard_normal(n); return (z - lowpass(z, 4000)) * np.exp(-x * 300) * 0.07

EXEC = [(4.15, 'buy'), (5.6, 'win'), (6.95, 'buy'), (8.25, 'stop'), (10.4, 'buy'), (11.9, 'win')]
for tt, kind in EXEC:
    add(sfx, {'buy': blip_up, 'win': coin, 'stop': stop}[kind](), tt)
for tt in (9.15, 13.75): add(sfx, whoosh_down(), tt - 0.05)
for tt in (3.45, 4.15, 4.95, 5.6, 6.4, 6.95, 7.7, 8.25, 8.95, 9.85, 10.4, 11.25, 11.9, 12.7, 13.45):
    add(sfx, zap(), tt - 0.8)
# terminal typing ticks
LINES = [0.35, 1.35, 1.75, 2.15, 2.55, 3.45, 4.15, 4.95, 5.6, 6.4, 6.95, 7.7, 8.25, 8.95, 9.85, 10.4, 11.25, 11.9, 12.7, 13.45]
for tt in LINES:
    for j in range(6 if tt > 0.5 else 18):
        add(sfx, tick() * (0.6 + 0.4 * rng.random()), tt + j * (0.035 if tt > 0.5 else 0.022))

# ---- reverb on music + sfx ----
def reverb(x, sec=1.6, wet=0.22):
    n = int(sec * SR); ir = rng.standard_normal(n) * np.exp(-np.arange(n) / SR * 4.0); ir /= np.sqrt(np.sum(ir ** 2))
    L = 1 << int(np.ceil(np.log2(len(x) + n)))
    y = np.fft.irfft(np.fft.rfft(x, L) * np.fft.rfft(ir, L), L)[:len(x)]
    return x + wet * y
music = reverb(music, 2.0, 0.3); sfx = reverb(sfx, 1.2, 0.18)

# sidechain duck on music from kick
duck = np.ones(N); tt = DROP; i = 0
while tt < OUT:
    if i % 16 in (0, 6, 10):
        s = at(tt); n = int(0.25 * SR); e = min(N, s + n); duck[s:e] = np.minimum(duck[s:e], 1 - 0.55 * np.exp(-np.arange(e - s) / SR * 14))
    tt += step; i += 1

mix = drums + bass + music * duck * 1.1 + sfx
mix = np.tanh(mix * 1.4) / np.tanh(1.4)
mix = mix[:int(DUR * SR)]
fo = int(1.0 * SR); mix[-fo:] *= np.linspace(1, 0, fo) ** 1.5
fi = int(0.05 * SR); mix[:fi] *= np.linspace(0, 1, fi)
mix = mix / np.max(np.abs(mix)) * 0.89
# slight stereo: pad/arp width via short delay
st = np.stack([mix, np.roll(mix, int(0.008 * SR)) * 0.98 + mix * 0.02], axis=1)
pcm = (st * 32767).astype(np.int16)
with wave.open('ziggy_music.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print('ok', len(mix) / SR)
