"""Microphone selection and reversible NetEase ducking. No audio is persisted."""
import json
import os
from pathlib import Path
import queue
import subprocess
import threading


def choose_device(devices, selected=''):
    if selected:
        match = next((d for d in devices if d['id'] == selected), None)
        if match is None:
            raise RuntimeError('选中的麦克风已断开，请刷新收音设备并重新选择。')
        return match
    usb = [d for d in devices if d['host'] == 'Windows WASAPI'
           and 'USB' in d['name'].upper()]
    if len(usb) == 1:
        return usb[0]
    defaults = [d for d in devices if d.get('default')]
    return next((d for d in defaults if d['host'] == 'Windows WASAPI'),
                defaults[0] if defaults else None)


class MusicDucking:
    def __init__(self, config, emit):
        self.enabled = config.get('duckMusic', True) is not False
        self.emit = emit
        self.child = None
        self.messages = queue.Queue()
        self.lowered = False

    def reply(self):
        value = json.loads(self.messages.get(timeout=5).decode('utf-8-sig'))
        if value.get('error'):
            raise RuntimeError(value['error'])
        self.lowered = value.get('ducked', False)
        return value

    def lower(self):
        if self.child is not None and not self.lowered:
            self.child.stdin.write(b'lower\n')
            self.child.stdin.flush()
            self.reply()

    def restore(self):
        if self.child is not None and self.lowered:
            self.child.stdin.write(b'restore\n')
            self.child.stdin.flush()
            self.reply()

    def __enter__(self):
        if not self.enabled or os.name != 'nt':
            return self
        script = Path(__file__).with_name('media-control.ps1')
        shell = Path(os.environ.get('SystemRoot', 'C:/Windows')) / 'System32/WindowsPowerShell/v1.0/powershell.exe'
        try:
            self.child = subprocess.Popen([str(shell), '-NoProfile', '-NonInteractive',
                '-ExecutionPolicy', 'Bypass', '-File', str(script), '-Action', 'duck',
                '-ParentPID', str(os.getpid())], stdin=subprocess.PIPE,
                stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                creationflags=subprocess.CREATE_NO_WINDOW)
            child = self.child
            def read():
                for line in child.stdout:
                    self.messages.put(line)
            threading.Thread(target=read, daemon=True).start()
            value = self.reply()
            self.emit('music_duck', active=value.get('ducked', False))
        except Exception:
            self.close()
            self.emit('diagnostic', message='音乐自动压低未能启动；外放较响时建议先调低网易云音量。')
        return self

    def close(self):
        child, self.child = self.child, None
        if child is None:
            return
        try:
            child.stdin.close()
            child.wait(timeout=7)
        except (OSError, subprocess.TimeoutExpired):
            # Do not terminate the worker: its parent watchdog/finally restores volume.
            pass
        finally:
            child.stdout.close()

    def __exit__(self, *args):
        self.close()
