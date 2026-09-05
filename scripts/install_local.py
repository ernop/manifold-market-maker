#!/usr/bin/env python3
"""Integrate the reviewed local service with mybrowser and systemd."""
import json
import socket
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MYB = ROOT.parent / 'mybrowser'
CADDY = MYB / 'utilities' / 'caddy'
NAME = 'manifold-market-maker'


def run(*args, cwd=None):
    return subprocess.run(args, cwd=cwd, check=True, text=True, capture_output=True).stdout.strip()


def write_json(path: Path, data):
    path.write_text(json.dumps(data, indent=2) + '\n')


def main():
    settings = json.loads((ROOT / 'settings.json').read_text())
    registry_path = CADDY / 'projects.json'
    registry = json.loads(registry_path.read_text())
    for project in registry['projects']:
        if project['name'] != NAME and (project.get('port') == settings['port'] or project['hostname'] == settings['hostname']):
            raise SystemExit('Port or hostname already assigned to ' + project['name'])
    linger = run('loginctl', 'show-user', str(Path.home().owner()), '-p', 'Linger', '--value')
    if linger != 'yes':
        raise SystemExit('User linger is not enabled; boot startup needs loginctl enable-linger for this user first.')
    entry = {'name': NAME, 'label': 'Manifold', 'hostname': settings['hostname'], 'port': settings['port']}
    existing = next((item for item in registry['projects'] if item['name'] == NAME), None)
    if existing:
        existing.update(entry)
    else:
        registry['projects'].append(entry)
    write_json(registry_path, registry)
    overlay_path = CADDY / 'machines' / (socket.gethostname() + '.json')
    overlay = json.loads(overlay_path.read_text())
    overlay[NAME] = {'dir': str(ROOT), 'start': f'{sys.executable} -u server.py',
                     'systemd_unit': NAME + '.service', 'verified': False}
    write_json(overlay_path, overlay)
    print(run(sys.executable, str(CADDY / 'generate.py')))
    print(run('caddy', 'validate', '--config', str(CADDY / 'linux' / 'Caddyfile'), cwd=CADDY))
    units = Path.home() / '.config' / 'systemd' / 'user'
    units.mkdir(parents=True, exist_ok=True)
    template = (ROOT / 'scripts' / (NAME + '.service.template')).read_text()
    (units / (NAME + '.service')).write_text(template.replace('__WORKDIR__', str(ROOT)).replace('__PYTHON__', sys.executable))
    run('systemctl', '--user', 'daemon-reload')
    run('systemctl', '--user', 'enable', '--now', NAME + '.service')
    print(run('caddy', 'reload', '--config', str(CADDY / 'linux' / 'Caddyfile'), cwd=CADDY))
    print('Service enabled and Caddy reloaded. Verify HTTP before marking the overlay verified.')


if __name__ == '__main__':
    main()
