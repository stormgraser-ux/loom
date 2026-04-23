"""loom install — register Loom as an autostart service."""

import os
import platform
import shutil
import subprocess
import sys
from pathlib import Path

SYSTEMD_UNIT = """\
[Unit]
Description=Loom — local chat for branching thought
After=network.target

[Service]
Type=simple
WorkingDirectory={work_dir}
ExecStart={exec_path} --config {config_path}
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
"""

LAUNCHD_PLIST = """\
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>chat.loom</string>
  <key>ProgramArguments</key>
  <array>
    <string>{exec_path}</string>
    <string>--config</string>
    <string>{config_path}</string>
  </array>
  <key>WorkingDirectory</key>
  <string>{work_dir}</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>{log_dir}/loom.log</string>
  <key>StandardErrorPath</key>
  <string>{log_dir}/loom.log</string>
</dict>
</plist>
"""


def _find_loom_bin() -> str:
    found = shutil.which("loom")
    if found:
        return found
    return sys.executable + " -m loom"


def _get_local_ip() -> str | None:
    import socket
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return None


def _install_systemd(work_dir: str, config_path: str) -> None:
    exec_path = _find_loom_bin()
    unit_dir = Path.home() / ".config" / "systemd" / "user"
    unit_dir.mkdir(parents=True, exist_ok=True)
    unit_file = unit_dir / "loom.service"

    content = SYSTEMD_UNIT.format(
        work_dir=work_dir,
        exec_path=exec_path,
        config_path=config_path,
    )
    unit_file.write_text(content)

    subprocess.run(["systemctl", "--user", "daemon-reload"], check=True)
    subprocess.run(["systemctl", "--user", "enable", "loom.service"], check=True)
    subprocess.run(["systemctl", "--user", "start", "loom.service"], check=True)

    # lingering lets the user service start at boot without a login session
    subprocess.run(["loginctl", "enable-linger", os.environ.get("USER", "")],
                   check=False)

    print(f"  Installed: {unit_file}")
    print(f"  Service started and enabled at boot.")
    print()
    print("  Manage with:")
    print("    systemctl --user status loom")
    print("    systemctl --user restart loom")
    print("    journalctl --user -u loom -f")


def _install_launchd(work_dir: str, config_path: str) -> None:
    exec_path = _find_loom_bin()
    plist_dir = Path.home() / "Library" / "LaunchAgents"
    plist_dir.mkdir(parents=True, exist_ok=True)
    plist_file = plist_dir / "chat.loom.plist"
    log_dir = Path.home() / "Library" / "Logs"

    content = LAUNCHD_PLIST.format(
        work_dir=work_dir,
        exec_path=exec_path,
        config_path=config_path,
        log_dir=log_dir,
    )
    plist_file.write_text(content)

    subprocess.run(["launchctl", "unload", str(plist_file)],
                   capture_output=True, check=False)
    subprocess.run(["launchctl", "load", str(plist_file)], check=True)

    print(f"  Installed: {plist_file}")
    print(f"  Service loaded and will start at login.")
    print()
    print("  Manage with:")
    print(f"    launchctl unload {plist_file}")
    print(f"    launchctl load {plist_file}")
    print(f"    tail -f {log_dir}/loom.log")


def _uninstall_systemd() -> None:
    subprocess.run(["systemctl", "--user", "stop", "loom.service"],
                   capture_output=True, check=False)
    subprocess.run(["systemctl", "--user", "disable", "loom.service"],
                   capture_output=True, check=False)
    unit_file = Path.home() / ".config" / "systemd" / "user" / "loom.service"
    if unit_file.exists():
        unit_file.unlink()
    subprocess.run(["systemctl", "--user", "daemon-reload"], check=False)
    print("  Loom service stopped and removed.")


def _uninstall_launchd() -> None:
    plist_file = Path.home() / "Library" / "LaunchAgents" / "chat.loom.plist"
    if plist_file.exists():
        subprocess.run(["launchctl", "unload", str(plist_file)],
                       capture_output=True, check=False)
        plist_file.unlink()
    print("  Loom launch agent removed.")


def run_install(work_dir: str | None = None, config: str = "config.toml") -> None:
    work_dir = work_dir or os.getcwd()
    config_path = os.path.join(work_dir, config) if not os.path.isabs(config) else config

    from loom.config import load_config
    cfg = load_config(config_path)
    ip = _get_local_ip()
    system = platform.system()

    print()
    print("  Loom — installing autostart service")
    print()

    if system == "Linux":
        _install_systemd(work_dir, config_path)
    elif system == "Darwin":
        _install_launchd(work_dir, config_path)
    else:
        # Windows: create a vbs launcher in the Startup folder
        startup = Path(os.environ.get("APPDATA", "")) / "Microsoft" / "Windows" / "Start Menu" / "Programs" / "Startup"
        if not startup.exists():
            print(f"  Windows Startup folder not found at {startup}")
            print(f"  Add a shortcut to `loom` in your Startup folder manually.")
            return
        exec_path = _find_loom_bin()
        vbs = startup / "loom.vbs"
        vbs.write_text(
            f'CreateObject("WScript.Shell").Run "{exec_path} --config {config_path}", 0, False\n'
        )
        print(f"  Installed: {vbs}")
        print(f"  Loom will start silently on login.")

    print()
    print(f"  Loom is on port {cfg.port}, bound to {cfg.host}")
    if ip:
        print(f"  Mobile access: http://{ip}:{cfg.port}")
    print()


def run_uninstall() -> None:
    system = platform.system()
    print()
    if system == "Linux":
        _uninstall_systemd()
    elif system == "Darwin":
        _uninstall_launchd()
    else:
        startup = Path(os.environ.get("APPDATA", "")) / "Microsoft" / "Windows" / "Start Menu" / "Programs" / "Startup"
        vbs = startup / "loom.vbs"
        if vbs.exists():
            vbs.unlink()
        print("  Loom startup script removed.")
    print()
