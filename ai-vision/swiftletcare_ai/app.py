"""Rap luong: lenh live (gui backend) va offline (ghi CSV). Phu thuoc ngoai di qua Deps de test thay duoc."""
import csv
import math
import sys
import time
import traceback
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from pathlib import Path
from typing import Callable

import cv2
import supervision as sv

from .config import AI_DIR, ConfigError, check_confirm_fps, load_camera_config, load_env
from .detector import Detector, measure_fps, require_classes
from .lockfile import LockExists, acquire, lock_path, release
from .logjson import JsonLog
from .pipeline import Pipeline
from .predators import Confirmed, PredatorConfirmer
from .sender import RETRY_DELAYS, PendingEvent, Sender
from .snapshot import encode_snapshot
from .timeutil import SystemClock, utc_iso
from .video import VideoOpenError, VideoPlayer
from .windows import CountQueue, WindowCounter

EXIT_OK, EXIT_ERROR, EXIT_STOP, EXIT_INTERRUPT = 0, 1, 2, 130
FPS_FRAMES = 30


def make_tracker(fps: float):
    """Cho DUY NHAT tao ByteTrack (ten tham so theo S4, Task 1)."""
    return sv.ByteTrack(frame_rate=max(1, round(fps)))


@dataclass
class Timing:
    counts_every: float = 60
    heartbeat_every: float = 30
    retry_delays: tuple = RETRY_DELAYS
    drain_seconds: float = 10
    fps_log_every: float = 60
    tick: float = 0.2


@dataclass
class Deps:
    clock: object = field(default_factory=SystemClock)
    opener: Callable = cv2.VideoCapture
    make_detector: Callable = Detector
    make_tracker: Callable = make_tracker
    timing: Timing = field(default_factory=Timing)
    stream: object = None
    ai_dir: Path = AI_DIR


def _load(camera: str, deps: Deps, need_backend: bool, playlist=None):
    ai = deps.ai_dir
    return load_camera_config(ai / 'cameras' / f'{camera}.yaml', ai, playlist_override=playlist), load_env(ai / '.env', need_backend)


def _start(cfg, player: VideoPlayer, deps: Deps, weights: Path, imgsz, measure: bool):
    """Mo thu video, nap mo hinh, kiem dieu kien fps (spec 3.4). Tra (detector, fps_xu_ly)."""
    video_fps = player.check_all()
    detector = deps.make_detector(weights, imgsz)
    require_classes(detector.names)
    fps = min(video_fps, cfg.process_fps or math.inf)
    if measure:
        fps = min(fps, measure_fps(detector, player.first_frames(FPS_FRAMES)))
    check_confirm_fps(cfg.predator.confirm_frames, cfg.predator.confirm_seconds, fps)
    return detector, fps


def run_live(camera: str, weights: Path, imgsz: int | None, heartbeat: bool, deps: Deps) -> int:
    clock, timing = deps.clock, deps.timing
    try:
        cfg, env = _load(camera, deps, need_backend=True)
    except ConfigError as e:
        print(f'Loi cau hinh: {e}', file=sys.stderr)
        return EXIT_STOP
    log = JsonLog(camera, deps.ai_dir / 'data' / 'logs' / f'{camera}.log', clock, deps.stream)
    lock = lock_path(deps.ai_dir, camera)
    try:
        acquire(lock, clock)
    except LockExists as e:
        log.error('stop', reason=str(e), exitCode=EXIT_STOP)
        return EXIT_STOP

    queue, windows, sender = CountQueue(), None, None
    try:
        player = VideoPlayer(camera, cfg.playlist, log, clock, deps.opener, cfg.process_fps)
        try:
            detector, fps = _start(cfg, player, deps, weights, imgsz, measure=True)
        except (ConfigError, VideoOpenError) as e:
            log.error('stop', reason=str(e), exitCode=EXIT_STOP)
            return EXIT_STOP
        log.info('start', fpsXuLy=round(fps, 1))

        confirmer = PredatorConfirmer(cfg.predator)
        sender = Sender(camera, env, queue, log, confirmer.release, clock, timing.retry_delays,
                        timing.heartbeat_every if heartbeat else None, timing.tick)

        def on_close(ws, in_, out):
            queue.put(ws, in_, out)
            sender.wake_counts()

        def on_confirmed(c: Confirmed):
            jpeg = encode_snapshot(c.frame, c.boxes, env.snapshot_max_bytes)
            sender.submit(PendingEvent(c.cls, c.at, c.confidence, jpeg))

        windows = WindowCounter(on_close)
        pipe = Pipeline(cfg, detector.names, windows, confirmer, log, lambda *a: None, on_confirmed, deps.make_tracker)
        sender.start()
        now = clock.monotonic()
        next_counts, next_fps = now + timing.counts_every, now + timing.fps_log_every
        fps_mark = (now, player.processed, player.skipped)

        for frame in player.live():
            if sender.fatal is not None:
                log.error('stop', reason=sender.fatal, exitCode=EXIT_STOP)
                return EXIT_STOP
            if frame.new_video:
                pipe.new_video(frame.fps)
            at = clock.now()
            pipe.process(frame.image, detector(frame.image), at)
            now = clock.monotonic()
            if now >= next_counts:
                next_counts = now + timing.counts_every
                queue.put(*windows.current())
                sender.wake_counts()
            if now >= next_fps:
                next_fps = now + timing.fps_log_every
                t0, p0, s0 = fps_mark
                done, skipped = player.processed - p0, player.skipped - s0
                real_fps = done / max(now - t0, 1e-9)
                ratio = round(skipped / max(done + skipped, 1), 3)
                ok = cfg.predator.confirm_frames <= real_fps * cfg.predator.confirm_seconds
                log.write('info' if ok else 'warning', 'fps', fps=round(real_fps, 2), droppedFrameRatio=ratio)
                fps_mark = (now, player.processed, player.skipped)
        return EXIT_OK  # live() khong bao gio het; dong nay chi de day du
    except KeyboardInterrupt:
        return _finish(log, queue, windows, sender, timing, 'ctrl+c', EXIT_OK)
    except Exception:
        log.error('error', message=traceback.format_exc())
        return _finish(log, queue, windows, sender, timing, 'loi khong luong truoc', EXIT_ERROR)
    finally:
        release(lock)


def _finish(log: JsonLog, queue: CountQueue, windows, sender, timing: Timing, reason: str, code: int) -> int:
    """Ctrl+C lan 1 / loi: dua tong cuoi vao hang doi, gui not toi da drain_seconds. Ctrl+C lan 2: thoat ngay."""
    try:
        if sender is not None:
            if windows is not None and windows.current() is not None:
                queue.put(*windows.current())
            lost_counts, lost_events = sender.drain(timing.drain_seconds)
            for ws, i, o in lost_counts:
                log.warning('counts.dropped', windowStart=utc_iso(ws), **{'in': i, 'out': o}, status=None,
                            code=None, reason='mat khi dung')
            for ev in lost_events:
                log.warning('predator.dropped', **{'class': ev.cls}, at=utc_iso(ev.at), attempt=ev.retries + 1,
                            status=None, code=None, reason='mat khi dung')
            if sender.fatal is not None:
                reason, code = sender.fatal, EXIT_STOP
        log.write('info' if code == EXIT_OK else 'error', 'stop', reason=reason, exitCode=code)
        return code
    except KeyboardInterrupt:
        log.warning('stop', reason='ctrl+c lan hai - thoat ngay', exitCode=EXIT_INTERRUPT)
        return EXIT_INTERRUPT


def run_offline(camera: str, out: Path, weights: Path, imgsz: int | None, t0: datetime | None,
                playlist: list[str] | None, deps: Deps) -> int:
    clock = deps.clock
    try:
        cfg, env = _load(camera, deps, need_backend=False, playlist=playlist)
    except ConfigError as e:
        print(f'Loi cau hinh: {e}', file=sys.stderr)
        return EXIT_STOP
    out.mkdir(parents=True, exist_ok=True)
    (out / 'snapshots').mkdir(exist_ok=True)
    log = JsonLog(camera, out / f'{camera}.log', clock, deps.stream)
    player = VideoPlayer(camera, cfg.playlist, log, clock, deps.opener, cfg.process_fps)
    try:
        detector, _ = _start(cfg, player, deps, weights, imgsz, measure=False)
    except (ConfigError, VideoOpenError) as e:
        log.error('stop', reason=str(e), exitCode=EXIT_STOP)
        return EXIT_STOP
    t0 = t0 or clock.now()

    with (out / 'counts.csv').open('w', encoding='utf-8', newline='') as fc, \
            (out / 'predators.csv').open('w', encoding='utf-8', newline='') as fp, \
            (out / 'crossings.csv').open('w', encoding='utf-8', newline='') as fx:
        counts, preds, crossings = csv.writer(fc), csv.writer(fp), csv.writer(fx)
        counts.writerow(['camera', 'windowStart', 'in', 'out'])
        preds.writerow(['camera', 'class', 'confidence', 'at'])
        crossings.writerow(['at', 'chieu', 'track_id'])

        def on_confirmed(c: Confirmed):
            at = utc_iso(c.at)
            preds.writerow([camera, c.cls, c.confidence, at])
            name = f'{c.cls}_{at.replace(":", "")}.jpg'
            (out / 'snapshots' / name).write_bytes(encode_snapshot(c.frame, c.boxes, env.snapshot_max_bytes))

        windows = WindowCounter(lambda ws, i, o: counts.writerow([camera, utc_iso(ws), i, o]))
        pipe = Pipeline(cfg, detector.names, windows, PredatorConfirmer(cfg.predator), log,
                        lambda at, d, tid: crossings.writerow([utc_iso(at), d, tid]), on_confirmed, deps.make_tracker)
        started = time.perf_counter()
        for frame in player.offline():
            if frame.new_video:
                pipe.new_video(frame.fps)
            at = t0 + timedelta(seconds=frame.pos)
            pipe.process(frame.image, detector(frame.image), at)
        if windows.current() is not None:
            counts.writerow([camera, utc_iso(windows.current()[0]), *windows.current()[1:]])
    elapsed = max(time.perf_counter() - started, 1e-9)
    log.info('fps', fps=round(player.processed / elapsed, 2),
             droppedFrameRatio=round(player.skipped / max(player.processed + player.skipped, 1), 3))
    log.info('stop', reason='het playlist', exitCode=EXIT_OK)
    return EXIT_OK
